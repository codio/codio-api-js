import _ from 'lodash'
import hash from 'object-hash'
import { v4 } from 'uuid'
import fs from 'fs'
import crypto from 'crypto'
import { createTar } from './tools'
import path from 'path'

export const API_ID_TAG = 'CODIO_API_ID'
export const API_HASH_TAG = 'CODIO_API_HASH'

const FROM_LIBRARY_DUMMY = '<<<<<library-assessment>>>>>'

export const BLOOMS_LEVEL = {
  '1': 'Level I - Remembering',
  '2': 'Level II - Understanding',
  '3': 'Level III - Applying',
  '4': 'Level IV - Analyzing',
  '5': 'Level V - Evaluating',
  '6': 'Level VI - Creating'
}

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

export class Assessment {
  type = 'None'
  basePath = ''
  taskId = 'none'
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

  private getTagsFromJsonApi(json: any): Map<string,string> {
    const array: [string, string][] = Object.entries(json)
    return new Map(array);
  }

  async getBundle(base: string): Promise<string | undefined> {
    if (this.metadata.files.length === 0) {
      return
    }
    return createTar(base, this.metadata.files)
  }

  getId(): string {
    if (!this.metadata.tags.has(API_ID_TAG)) {
      this.metadata.tags.set(API_ID_TAG, v4())
    }
    return this.metadata.tags.get(API_ID_TAG) || ''
  }

  private loadFiles(basePath: string): any {
    const hashes = this.metadata.files.map(filePath => {
      try {
        const fullPath = path.join(basePath, filePath)
        const fileBuffer = fs.readFileSync(fullPath)
        const hashSum = crypto.createHash('md5')
        hashSum.update(fileBuffer);
        
        const hex = hashSum.digest('hex')
        return {
          hex,
          filePath
       }
      } catch(_) {
        console.error(`Error Processing ${filePath} problem: ${_.message}`)
        return {
          hex: '',
          filePath
        }
      }
    })
    const res = {}
    for (const _ in hashes) {
      res[_['filePath']] = _['hex']
    }
    return res
  }

  getHash(): string {
    const object = this.export(true)
    Object.assign('loadedFiles', this.loadFiles(this.basePath))
    return hash(object)
  }

  export(checksum = false): string {
    const tags: any = {}
    this.metadata.tags.forEach((value, name) => {
      if (checksum && (name == API_HASH_TAG || name == API_ID_TAG)) {
        // skip for hashing
        return
      }
      tags[name] = value
    })

    if (!checksum) {
      tags[API_HASH_TAG] = this.getHash()
    }

    const object = {
      details: this.details,
      body: this.body,
      metadata: {
        files: this.metadata.files,
        opened: this.metadata.opened,
        layout: this.metadata.layout,
        content: this.metadata.content,
        pageTitle: this.metadata.pageTitle,
        buttonText: this.metadata.buttonText,
        tags,
      }
    }
    return JSON.stringify(object)
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
        tags: this.getTagsFromJsonApi(json.metadata.tags)
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
      tags.set(`Bloom's level`, BLOOMS_LEVEL[json.source.bloomsObjectiveLevel])
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
      this.taskId = json.taskId
    }

    // assessment has id already => not new update
    this.getId()
  }
}

export class AssessmentParsons extends Assessment {
  type = 'Parsons Puzzle'
  body: {
    parsonPuzzle: {
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
        parsonPuzzle: {
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

type MultipleChoiseOption = {
  _id: string
  correct: boolean
  answer: string
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
      const options = json.source.answers.map((rec: MultipleChoiseOption) => {
        return {
          id: rec._id,
          correct: rec.correct,
          answer: rec.answer
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

export class AssessmentFradeBook extends Assessment{
  type= 'Grade Book'

  body: {
    gradeBook: {
      arePartialPointsAllowed: boolean
      rubrics: {
        id: string
        weight: number
        message: string
      }
    }
  }


  constructor(json: any, metadata?: MetadataPage[]) {
    super(json, metadata)
    if (metadata) {
      this.body = {
        gradeBook: {
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,      
          rubrics: json.source.rubrics,
        }
      }
    } else {
      this.body = json.body
    }
  }
}

export class AssessmentFreeText extends Assessment{
  type= 'Free Text'

  body: {
    freeText: {
      previewType: string
      oneTimeTest: boolean
      arePartialPointsAllowed: boolean
      rubrics: {
        id: string
        weight: number
        message: string
      }
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
        freeText: {
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,      
          showGuidanceAfterResponseOption: fixGuideance(json),
          oneTimeTest: json.source.oneTimeTest,
          rubrics: json.source.rubrics,
          previewType: json.source.previewType
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

export class AssessmentFreeTextAuto extends Assessment {
  type = 'Free Text Autograde'

  body: {
    freeTextAuto: {
      previewType: string
      oneTimeTest: boolean
      arePartialPointsAllowed: boolean
      command: string
      timeout: number
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
        freeTextAuto: {
          arePartialPointsAllowed: json.source.arePartialPointsAllowed,      
          showGuidanceAfterResponseOption: fixGuideance(json),
          oneTimeTest: json.source.oneTimeTest,
          previewType: json.source.previewType,
          command: json.source.command,
          timeout: json.source.timeoutSeconds,
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
      oneTimeTest: boolean
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
      return new AssessmentParsons(json, metadataPages)
    case 'free-text':
      return new AssessmentFreeText(json, metadataPages)
    case 'free-text-auto':
      return new AssessmentFreeTextAuto(json, metadataPages)
    case 'grade-book':
      return new AssessmentFradeBook(json, metadataPages)
    default:
      throw new Error('assessemnt type not found')
  }
}

export function parseApi(json: any): Assessment {
  const type = json.metadata.tags['Assessment Type']
  switch (type) {
    case 'Advanced Code Test': 
      return new AssessmentAdvanced(json)
    case 'Multiple Choice':
      return new AssessmentMultipleChoice(json)
    case 'Fill in the Blanks':
      return new AssessmentFillInTheBlanks(json)
    case 'Standard Code Test': 
      return new AssessmentStandardCode(json)
    case 'Parsons Puzzle':
      return new AssessmentParsons(json)
    case 'Free Text':
      return new AssessmentFreeText(json)
    case 'Free Text Autograde':
      return new AssessmentFreeTextAuto(json)
    case 'Grade Book':
      return new AssessmentFradeBook(json)
    default:
      throw new Error(`assessment type ${type} not found`)
  }
}
