export class Assessment {
  name: string
  type: string
  tags: Map<string, string>
  files: string[]
  opened: {
    type: string
    panelNumber: number
    content: string
  }[]
  showName: boolean
  instructions: string
  points: number

  oneTimeTest: boolean

  bloomsObjectiveLevel: string
  learningObjectives: string
  guidance: string
  showGuidanceAfterResponse: string

  constructor(json: any) {
    this.type = json.type
    this.name = json.source.name
    this.showName = json.source.showName
    this.instructions = json.source.instructions
    this.points = json.source.points

    this.oneTimeTest = json.source.oneTimeTest

    this.bloomsObjectiveLevel = json.source.bloomsObjectiveLevel
    this.learningObjectives = json.source.learningObjectives
    this.guidance = json.source.guidance
    this.showGuidanceAfterResponse = json.source.showGuidanceAfterResponse

    // tags
    this.tags = new Map()
    for (const tag of json.source.metadata.tags) {
      this.tags.set(tag.name, tag.value)
    }

    this.files = json.source.files
    this.opened = json.source.opened
  }
}

export class AssessmentParsons extends Assessment {
  initial: string
  options: string
  constructor(json: any) {
    super(json)
    this.initial = json.source.initial
    this.options = json.source.options
  }
}

export class AssessmentAdvanced extends Assessment {
  command: string
  arePartialPointsAllowed: boolean
  timeoutSeconds: number

  constructor(json: any) {
    super(json)
    this.command = json.source.command
    this.arePartialPointsAllowed = json.source.arePartialPointsAllowed
    this.timeoutSeconds = json.source.timeoutSeconds
  }
}

export class AssessmentMultipleChoice extends Assessment{
  answers: {
    _id: string
    correct: boolean
    answer: string
  }
  multipleResponse: boolean
  showExpectedAnswer: boolean
  incorrectPoints: number

  constructor(json: any) {
    super(json)
    this.showExpectedAnswer = json.source.showExpectedAnswer
    this.multipleResponse = json.source.multipleResponse
    this.answers = json.source.answers 
    this.incorrectPoints = json.source.incorrectPoints

  }
}

export class AssessmentFillInTheBlanks extends Assessment {
  text: string
  showExpectedAnswer: boolean
  showValues: boolean
  tokens: {
    blank: string[]
    text: (string | number)[]
    regexPositions: number[]
  }
  constructor(json: any) {
    super(json)
    this.text = json.source.text
    this.showExpectedAnswer = json.source.showExpectedAnswer
    this.showValues = json.source.showValues
    this.tokens = json.source.tokens
  }
}

export class AssessmentStandardCode extends Assessment {
  command: string
  preExecuteCommand: string
  arePartialPointsAllowed: boolean
  oneTimeTest: boolean
  options: {
    ignoreCase: boolean
    ignoreWhitespaces: boolean
    ignoreNewline: boolean
    matchSubstring: boolean
    timeout: number
  }
  sequence: {
    arguments: string
    input: string
    output: string
    showFeedback: boolean
    feedback: string
  }[]
  showExpectedAnswer: boolean
  constructor(json: any) {
    super(json)
    this.command = json.source.command
    this.preExecuteCommand = json.source.preExecuteCommand
    this.arePartialPointsAllowed = json.source.arePartialPointsAllowed
    this.oneTimeTest = json.source.oneTimeTest
    this.options = json.source.options
    this.showExpectedAnswer = json.source.showExpectedAnswer
    this.sequence = json.source.sequence
  }
}


export function parse(json: any): Assessment {
  switch (json.type) {
    case 'test': 
      return new AssessmentAdvanced(json)
    case 'multiple-choice':
      return new AssessmentMultipleChoice(json)
    case 'fill-in-the-blanks':
      return new AssessmentFillInTheBlanks(json)
    case 'code-output-compare': 
      return new AssessmentStandardCode(json)
    case 'parsons-puzzle':
    default:
      return new AssessmentParsons(json)
  }
}
