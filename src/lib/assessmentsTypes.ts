import _, { has } from 'lodash'
import crypto from 'crypto'

export const API_ID_TAG = 'CODIO_API_ID'
const FROM_LIBRARY_DUMMY = '<<<<<library-assessment>>>>>'

function fixGuideance(json: any) {
  if (!_.isUndefined(json.source.showGuidanceAfterResponse)) {
    // old format
    return {
      type: json.source.showGuidanceAfterResponse ? "Always": "Never"
    }
  } 
  return json.source.showGuidanceAfterResponseOption
}

function getContentForComplexAssessment(taskId: string, content: string): string {

   const pattern = new RegExp('{.+\\|assessment}\\(' + taskId + '\\)\\n?', 'gm')
   const result = content.replace(pattern, FROM_LIBRARY_DUMMY + '\n')
   return result.replace(/{.+\|assessment}\(.+-[0-9]+\)\n?/gm, '')
}

function getButtonTextForComplexAssessment(taskId: string, type: string, content: string): string | undefined {
  const pattern = new RegExp(
    '{(.+?)\\|assessment}\\(' + taskId + '\\)\\n?',
    'gm'
  )
  const match = pattern.exec(content)
  return match ? match[1] : undefined
}

function findPage(taskId: string, metadata: MetadataPage[]): MetadataPage {
  for(const { page, data } of metadata) {
    if (page.match(taskId)) {
      return {page, data}
    }
  }
  throw new Error(`Assessment ${taskId} is not in use`)
}

export type MetadataPage = {
  data: any,
  page: string
}

type LayoutOpened = {
  type: string
  panelNumber: number
  content: string
}

type Layout = {
  layout: string | undefined
  content: string | undefined
  pageTitle: string  | undefined
  buttonText: string | undefined
}

function extractLayout(json: any, metadata: MetadataPage[]): Layout {
  if (!_.isUndefined(json.source.metadata.layout)) { 
    // already has layout
    return {
      layout: json.source.metadata.layout,
      content: json.source.metadata.content,
      pageTitle: json.source.metadata.pageTitle,
      buttonText: json.source.metadata.buttonText
    } 
  }

  // parse layout
  const { page, data } = findPage(json.taskId, metadata)

  if (data.layout === '1-panel') {
    // simple do not need alyout
    return {
      layout: undefined,
      content: undefined,
      pageTitle: undefined,
      buttonText: undefined,
    }
  } 
  return {
    layout: data.layout,
    content: getContentForComplexAssessment(json.taskId, page),
    pageTitle: data.title,
    buttonText: getButtonTextForComplexAssessment(json.taskId, json.type, page)
  }
}

function getHash(assessment: Assessment): string {
  return crypto.createHash('sha1').update(`${assessment.type}${assessment.details.name}`).digest('hex'); 
}

export class Assessment {
  type = 'None'
  assessmentId: string | undefined
  
  details: {
    name: string
    showName: boolean
    instructions: string
    showExpectedAnswer: boolean
    guidance: string
  }

  metadata: {
    opened: LayoutOpened[]
    files: string[]
    tags: Map<string, string>
    layout: string | undefined
    content: string | undefined
    pageTitle: string | undefined
    buttonText: string | undefined
  }

  body: any = {}

  private getTagsFromJson(json: any): Map<string,string> {
    const tags = new Map<string,string>()
    for (const tag of json) {
      tags.set(tag.name, tag.value)
    }
    return tags
  }

  getLibraryId(): string {
    if (this.assessmentId) {
      return this.assessmentId
    } 

    if (this.metadata.tags.has(API_ID_TAG)) {
      return this.metadata.tags.get(API_ID_TAG) || ''
    }

    const hash = getHash(this)
    this.metadata.tags.set(API_ID_TAG, hash)
    return hash
  }

  constructor(json: any, metadata?: MetadataPage[]) {
    if (!metadata) {
      this.assessmentId = json.assessmentId
      this.details = json.details
      
      this.metadata = {
        files: json.metadata.files,
        opened: json.metadata.opened,
        layout: json.metadata.layout,
        content: json.metadata.content,
        pageTitle: json.metadata.pageTitle,
        buttonText: json.metadata.buttonText,
        tags: this.getTagsFromJson(json.source.metadata.tags)
      }
    } else {
      this.details = {
        name: json.source.name,
        showName: json.source.showName,
        instructions: json.source.instructions,
        showExpectedAnswer: json.source.showExpectedAnswer,
        guidance: json.source.guidance
      }
      const tags = this.getTagsFromJson(json.source.metadata.tags)
      tags.set('Learning Objectives', json.source.learningObjectives)
      tags.set(`Bloom's level`, json.source.bloomsObjectiveLevel)
      const {
        layout,
        content,
        pageTitle,
        buttonText
      } = extractLayout(json, metadata)
      this.metadata = {
        tags,
        layout, 
        content,
        pageTitle,
        buttonText,
        files: json.source.metadata.files,
        opened: json.source.metadata.opened
      }
    }
    this.getLibraryId()
  }
}

export class AssessmentParsons extends Assessment {
  type = 'Parsons Puzzle'
  body: {
    parsonsPuzzle: {
      initial: string
      options: string
      grader: string
      oneTimeTest: boolean
      showGuidanceAfterResponseOption: {
        type: string,
        passedFrom: number | undefined
      }
    }
  }
  
  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (metadata) {
      this.body = {
        parsonsPuzzle: {
          initial: json.source.initial,
          options: json.source.options,
          grader: json.source.grader,
          showGuidanceAfterResponseOption: fixGuideance(json),
          oneTimeTest: json.source.oneTimeTest
        }
      }
    } else {
      this.body = json.body
    }
  }
}


export class AssessmentAdvanced extends Assessment {
  type = 'Advanced Code Test'
  body: {
    codeTest: {
      command: string
      arePartialPointsAllowed: boolean
      timeoutSeconds: number    
      oneTimeTest: boolean
      showGuidanceAfterResponseOption: {
        type: string,
        passedFrom: number | undefined
      }
    }
  }

  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (metadata) {
      this.body = {
        codeTest: {
          command: json.source.command,
          timeoutSeconds: json.source.timeoutSeconds,
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,
          oneTimeTest: json.source.oneTimeTest,
          showGuidanceAfterResponseOption: fixGuideance(json)
        }
      }
    } else {
      this.body = json.body
    }
  }
}

export class AssessmentMultipleChoice extends Assessment{
  type= 'Multiple Choice'

  body: {
    multipleChoice: {
      options: {
        id: string
        correct: boolean
        answer: string  
      }[]
      isMultipleResponse: boolean
      isRandomized: boolean
      arePartialPointsAllowed: boolean,
      showGuidanceAfterResponseOption: {
        type: string,
        passedFrom: number | undefined
      }
    }
  }


  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (metadata) {
      const options = json.source.answers.forEach(_ => {
        return {
          id: _._id,
          correct: _.correct,
          answer: _.answer
        }
      })
      this.body = {
        multipleChoice: {
          options,
          isMultipleResponse: json.source.multipleResponse,
          isRandomized: json.source.isRandomized,
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,      
          showGuidanceAfterResponseOption: fixGuideance(json),
        }
      }
    } else {
      this.body = json.body
    }
  }
}

export class AssessmentFillInTheBlanks extends Assessment {
  type = 'Fill in the Blanks'

  body: {
    fillInBlanks: {
      text: string
      showValues: boolean
      blanks: string[]
      texts: string[]
      distractors: string
      arePartialPointsAllowed: boolean
      showGuidanceAfterResponseOption: {
        type: string,
        passedFrom: number | undefined
      }
    }
  }

  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (metadata) {
      const texts: string[] = json.source.tokens.text
      texts.unshift('')
      this.body = {
        fillInBlanks: {
          text: json.source.text,
          showValues: json.source.showValues,
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,
          blanks: json.source.tokens.blank,
          texts: _.filter(texts, _.isString),
          distractors: json.source.distractors,
          showGuidanceAfterResponseOption: fixGuideance(json)
        }
      }
    } else {
      this.body = json.body
    }
  }
}

export class AssessmentStandardCode extends Assessment {
  type = 'Standard Code Test'
  body: {
    codeCompare: {
      options: {
        ignoreCase: boolean
        ignoreWhitespaces: boolean
        ignoreNewline: boolean
        matchSubstring: boolean
        timeout: number
      }
      command: string
      preExecuteCommand: string
      showGuidanceAfterResponseOption: {
        type: string,
        passedFrom: number | undefined
      }
      oneTimeTest: Boolean
      sequence: {
        arguments: string
        input: string
        output: string
        showFeedback: boolean
        feedback: string
      }[]
    }
  }
 
  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (!metadata) {
      this.body = json.body
    } else {
      this.body = {
        codeCompare: {
          options: json.source.options,
          command: json.source.command,
          preExecuteCommand: json.source.preExecuteCommand,
          showGuidanceAfterResponseOption: fixGuideance(json),
          oneTimeTest: json.source.oneTimeTest,
          sequence: json.source.sequence
        }
      }
    }
  }
}


export function parse(json: any, metadataPages:  MetadataPage[]): Assessment {
  switch (json.type) {
    case 'test': 
      return new AssessmentAdvanced(json, metadataPages)
    case 'multiple-choice':
      return new AssessmentMultipleChoice(json, metadataPages)
    case 'fill-in-the-blanks':
      return new AssessmentFillInTheBlanks(json, metadataPages)
    case 'code-output-compare': 
      return new AssessmentStandardCode(json, metadataPages)
    case 'parsons-puzzle':
    default:
      return new AssessmentParsons(json, metadataPages)
  }
}
