import fs from 'fs'
import path from 'path'
import bent from './bentWrapper'
import FormData from 'form-data'
import tar from 'tar'
import glob from 'glob-promise'
import YAML from 'yaml'
import tools, { getBearer, fixGuidesVersion, getApiV1Url } from './tools'
import config, { excludePaths } from './config'
import _ from 'lodash'
import { info } from './course'

export type PathMap = {
  source: string
  destination: string
}

type YamlRaw = {
  assignment: string | undefined
  assignmentName: string | undefined
  paths: (string | PathMap)[] | undefined
  section: string | string[]
  withChildren: boolean | undefined
}

export type SectionConfig = {
  withChildren: boolean
}

export function sectionToKey(section: string[]) {
  return section.join('\n')
}

type Yaml = {
  assignment: string | undefined
  assignmentName: string | undefined
  paths: (string | PathMap)[]
  section: string[][]
  sectionConfig: Map<string, SectionConfig>
}

export type TimeExtension = {
  extendedDeadline?: number | undefined
  extendedTimeLimit?: number | undefined
}

export type AssignmentSettings = {
  enableResetAssignmentByStudent?: boolean
  disableDownloadByStudent?: boolean
  visibilityOnDisabled?: string, // "READ_ONLY", "NO_ACCESS",
  visibilityOnCompleted?: string, // "READ_ONLY_RESUBMIT", "READ_ONLY", "NO_ACCESS",
  startTime?: Date | null,
  endTime?: Date | null,
  action?: string // "COMPLETE", "DISABLE", "DISABLE_AND_COMPLETE",
  dueTime?: Date | null
  markAsCompleteOnDueDate?: boolean
  penaltiesV2?: PenaltySettings
  examMode?: {
    timedExamMode: {
      enabled: boolean
      duration: number // minutes
    }
    shuffleQuestionsOrder: boolean
    forwardOnlyNavigation: boolean
    singleLogin: boolean
    authentication: boolean
    restrictedIPRange?: {
      enabled: boolean
      range: string
    }
  },
  releaseGrades?: boolean,
  isDisabled?: boolean
}

type AssignmentSettingsRaw = {
  enableResetAssignmentByStudent?: boolean
  disableDownloadByStudent?: boolean
  visibilityOnDisabled?: string, // "READ_ONLY", "NO_ACCESS",
  visibilityOnCompleted?: string, // "READ_ONLY_RESUBMIT", "READ_ONLY", "NO_ACCESS",
  startTime?: string,
  endTime?: string,
  action?: string // "COMPLETE", "DISABLE", "DISABLE_AND_COMPLETE",
  dueTime?: string
  markAsCompleteOnDueDate?: boolean
  penaltiesV2?: PenaltySettings
  examMode?: {
    timedMode: {
      enabled: boolean,
      duration: number // minutes
    }
    shuffleQuestionsOrder: boolean
    forwardOnlyNavigation: boolean
    singleLogin: boolean
    authentication: boolean
    restrictedIPRange?: {
      enabled: boolean
      range: string
    }
  },
  releaseGrades?: boolean,
  isDisabled?: boolean
}

export type PenaltySettings = {
  enable: boolean
  deductionIntervalMinutes: number
  deductionPercent: number
  lowestGradePercent: number
}

type PublishOptions = {
  changelog: string
  stack: string
  withStackUpdate: boolean
}


async function archiveTar(src: string): Promise<{ file: string; dir: string; }> {
  const dir = await fs.promises.mkdtemp('/tmp/codio_export')
  const file = path.join(dir, 'project.tar.gz')
  await tar.c(
    {
      gzip: true,
      file,
      cwd: src,
      filter: (path: string) => {
        for (const exclude of excludePaths) {
          if (_.startsWith(path, exclude)) {
            return false
          }
        }
        return true
      }
    },
    ['./']
  )
  return {file, dir}
}

const sleep = async (seconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const getJson = bent()

async function publishArchive (courseId: string, assignmentId: string, archivePath: string,
                               changelogOrOptions: string | PublishOptions): Promise<void> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const api = bent(getApiV1Url(), 'POST')

    const postData = new FormData()
    if (typeof changelogOrOptions == 'string') {
      postData.append('changelog', changelogOrOptions || '')
    } else {
      const options = changelogOrOptions || {}
      postData.append('changelog', options.changelog || '')
      postData.append('stackVersionId', options.stack || '')
      postData.append('withStackUpdate', `${options.withStackUpdate}`)
    }
    postData.append('archive', fs.createReadStream(archivePath),  {
      knownLength: fs.statSync(archivePath).size
    })
    const headers = Object.assign(postData.getHeaders(), getBearer())
    headers['Content-Length'] = postData.getLengthSync()
    const res = await api(`/courses/${courseId}/assignments/${assignmentId}/versions`,
      postData, headers)
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    for (let i = 0; i < 100; i++) { // 100 checks attempt
      await sleep(10)
      const status = await getJson(taskUrl, undefined, getBearer())
      console.log(status)
      if (status['done']) {
        if (status['error']) {
          throw new Error(status['error'])
        }
        break
      }
    }
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

function validityState(ymls: YamlRaw[]): Yaml[] {
  const map: Map<string, Yaml> = new Map()
  for(const yml of ymls) {
    if (!yml.section) {
      console.error(`Warning: ${yml.assignment || yml.assignmentName} is empty`)
      yml.section = []
    }
    const section = _.isString(yml.section)? [yml.section] : yml.section
    const assignmentId = yml.assignment || yml.assignmentName
    if (assignmentId === undefined) {
      throw new Error('assignment and assignmentName does not exist')
    }
      const withChildren = yml.withChildren !== false
    if (map.has(assignmentId)) {
      const item = map.get(assignmentId)
      if (!item) {
        continue
      }
      item.section.push(section)
      item.paths = item.paths.concat(yml.paths || [])
      item.sectionConfig.set(sectionToKey(section), {withChildren: withChildren})
    } else {
      const sectionConfig: Map<string, SectionConfig> = new Map()
      sectionConfig.set(sectionToKey(section), {withChildren: withChildren})
      map.set(assignmentId, {
        assignment: yml.assignment,
        assignmentName: yml.assignmentName,
        paths: yml.paths || [],
        section: [section],
        sectionConfig: sectionConfig
      })
    }
  }

  return Array.from(map.values())
}

// after find names should regroup assignments by id
function validateYmlCfg(ymls: Yaml[]): Yaml[] {
  const map: Map<string, Yaml> = new Map()
  for (const yml of ymls) {
    const section = yml.section || []
    const assignmentId = yml.assignment
    if (assignmentId === undefined) {
      throw new Error('assignment does not exist')
    }
    if (map.has(assignmentId)) {
      const item = map.get(assignmentId)
      if (!item) {
        continue
      }
      item.section = item.section.concat(section)
      item.paths = item.paths.concat(yml.paths || [])
      item.sectionConfig = yml.sectionConfig
    } else {
      map.set(assignmentId, {
        assignment: yml.assignment,
        assignmentName: yml.assignmentName,
        paths: yml.paths || [],
        section: section,
        sectionConfig: yml.sectionConfig
      })
    }
  }

  return Array.from(map.values())
}

async function loadYaml(yamlDir: string): Promise<Yaml[]> {
  let res: YamlRaw[] = []
  const files = await glob('*.+(yml|yaml)', {cwd: yamlDir, nodir: true})
  for (const file of files) {
    const ymlText = await fs.promises.readFile(path.join(yamlDir, file), {encoding: 'utf-8'})
    let ymls: YamlRaw[] = YAML.parse(ymlText)
    if (!ymls) {
      continue
    }
    if (!_.isArray(ymls)) {
      ymls = [ymls]
    }
    res = res.concat(ymls)
  }

  return validityState(res)
}

async function findNames(courseId: string, ymlCfg: Yaml[]) {
  const usesNames = _(ymlCfg).map('assignmentName').compact().size() > 0
  if (!usesNames) {
    return
  }
  const course = await info(courseId)

  for(const item of ymlCfg) {
    if (!item.assignment && item.assignmentName) { // make id higher priority
      const assignments = _.filter(course.assignments, {name: item.assignmentName})
      if (assignments.length == 0) {
        throw new Error(`no assignments in course with name ${item.assignmentName} is found`)
      }
      if (assignments.length > 1) {
        throw new Error(`many assignments in course with same name ${item.assignmentName}`)
      }
      item.assignment = assignments[0].id
    }
  }
}

async function reducePublish(courseId: string, srcDir: string, yamlDir: string, changelogOrOptions: string | PublishOptions): Promise<void> {
  let ymlCfg = await loadYaml(yamlDir)

  await findNames(courseId, ymlCfg)
  ymlCfg = validateYmlCfg(ymlCfg)

  for(const item of ymlCfg) {
    console.log(`publishing ${JSON.stringify(item)}`)
    const tmpDstDir = fs.mkdtempSync('/tmp/publish_codio_reduce')
    const paths = item.paths || []
    paths.push(`!${yamlDir}`) // exclude yaml directory from export
    paths.push(`!${yamlDir}/**`) // exclude yaml directory from export

    if (!item.assignment) {
      throw new Error(`assignment not found with name "${item.assignmentName}"`)
    }
    await tools.reduce(srcDir, tmpDstDir, item.section, _.compact(paths), item.sectionConfig)
    await assignment.publish(courseId, item.assignment, tmpDstDir, changelogOrOptions)
    fs.rmSync(tmpDstDir, {recursive: true})
  }
}

function fromRawSettings(res: AssignmentSettingsRaw): AssignmentSettings {
  return {
    enableResetAssignmentByStudent: res.enableResetAssignmentByStudent,
    disableDownloadByStudent: res.disableDownloadByStudent,
    visibilityOnDisabled: res.visibilityOnDisabled,
    visibilityOnCompleted: res.visibilityOnCompleted,
    startTime: convertDateToLocal(res.startTime),
    endTime: convertDateToLocal(res.endTime),
    action: res.action,
    dueTime: convertDateToLocal(res.dueTime),
    markAsCompleteOnDueDate: res.markAsCompleteOnDueDate,
    penaltiesV2: res.penaltiesV2,
    examMode: res.examMode? {
      timedExamMode: res.examMode?.timedMode,
      shuffleQuestionsOrder: res.examMode?.shuffleQuestionsOrder,
      forwardOnlyNavigation: res.examMode?.forwardOnlyNavigation,
      singleLogin: res.examMode?.singleLogin,
      authentication: res.examMode?.authentication,
      restrictedIPRange: res.examMode?.restrictedIPRange,
    } : undefined,
    releaseGrades: res.releaseGrades,
    isDisabled: res.isDisabled,
  }
}

export async function getSettings(courseId: string, assignmentId:string): Promise<AssignmentSettings> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const api = bent(getApiV1Url())
    const rawSettings = await api(`/courses/${courseId}/assignments/${assignmentId}/settings`,
      undefined, getBearer()) as AssignmentSettingsRaw
    return fromRawSettings(rawSettings)
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

function convertDateToLocal(date: string | undefined): Date | null {
  if (!date) {
    return null
  }

 return new Date(date)
}

function toRawSettings(settings: AssignmentSettings): AssignmentSettingsRaw {
  const res = {} as AssignmentSettingsRaw
  if (settings.enableResetAssignmentByStudent !== undefined) {
    res.enableResetAssignmentByStudent = settings.enableResetAssignmentByStudent
  }
  if (settings.disableDownloadByStudent !== undefined) {
    res.disableDownloadByStudent = settings.disableDownloadByStudent
  }
  if (settings.visibilityOnDisabled !== undefined) {
    res.visibilityOnDisabled = settings.visibilityOnDisabled
  }
  if (settings.visibilityOnCompleted !== undefined) {
    res.visibilityOnCompleted = settings.visibilityOnCompleted
  }
  if (settings.startTime !== undefined) {
    res.startTime = settings.startTime ? settings.startTime.toISOString() : ''
  }
  if (settings.endTime !== undefined) {
    res.endTime = settings.endTime ? settings.endTime.toISOString() : ''
  }
  if (settings.action !== undefined) {
    res.action = settings.action
  }
  if (settings.dueTime !== undefined) {
    res.dueTime = settings.dueTime ? settings.dueTime.toISOString() : ''
  }
  if (settings.markAsCompleteOnDueDate !== undefined) {
    res.markAsCompleteOnDueDate = settings.markAsCompleteOnDueDate
  }
  if (settings.penaltiesV2 !== undefined) {
    const deductionPercent = settings.penaltiesV2.deductionPercent
    if (!_.isNumber(deductionPercent) || deductionPercent < 0 || deductionPercent > 100) {
      throw new Error("penalty deduction percent must be a number between 0 and 100")
    }
    const lowestGradePercent = settings.penaltiesV2.lowestGradePercent
    if (!_.isNumber(lowestGradePercent) || lowestGradePercent < 0 || lowestGradePercent > 100) {
      throw new Error("lowest grade percent after penalty must be a number between 0 and 100")
    }
    res.penaltiesV2 = settings.penaltiesV2
  }
  if (settings.examMode !== undefined) {
    res.examMode = {
      timedMode: settings.examMode.timedExamMode,
      shuffleQuestionsOrder: settings.examMode.shuffleQuestionsOrder,
      forwardOnlyNavigation: settings.examMode.forwardOnlyNavigation,
      singleLogin: settings.examMode.singleLogin,
      authentication: settings.examMode.authentication,
      restrictedIPRange: settings.examMode.restrictedIPRange
    }
  }
  if (settings.releaseGrades !== undefined) {
    res.releaseGrades = settings.releaseGrades
  }
  if (settings.isDisabled !== undefined) {
    res.isDisabled = settings.isDisabled
  }
  return res
}

export async function updateSettings(courseId: string, assignmentId: string, settings: AssignmentSettings): Promise<AssignmentSettings> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const api = bent(getApiV1Url(), 'POST')
    const res = await api(`/courses/${courseId}/assignments/${assignmentId}/settings`,
        toRawSettings(settings), getBearer()) as AssignmentSettingsRaw
    return fromRawSettings(res)
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function updateStudentTimeExtension(
  courseId: string, assignmentId: string, studentId: string, extension: TimeExtension
): Promise<void> {
  try {
    const api = bent(getApiV1Url(), 'POST')
    return await api(
      `/courses/${courseId}/assignments/${assignmentId}/students/${studentId}`, extension, getBearer()
    ) as any
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export type ProjectSource = {
  type: 'git', url: string, credentials?: {username: string, password: string}
} | {
  type: 'zip'
}

export type AssignmentData = {
  moduleId: string
  settings: {
    name: string
    description?: string
    imageUrl?: string
    gigaboxSlot?: {
      boxType: string
    }
  }
}

export async function createAssignment(courseId: string, assignmentData: AssignmentData): Promise<string> {
  const api = bent(getApiV1Url(), 'POST', 'json', 200)
  try {
    const res = await api(`/courses/${courseId}/assignments`, assignmentData, getBearer())
    const assignmentId = res['id']
    if (!assignmentId) {
      throw new Error('assignmentId not found in response')
    }
    return assignmentId
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      console.log(message)
      throw new Error(message)
    }
    console.log(error)
    throw error
  }
}

const assignment = {
  publish: async (courseId: string, assignmentId: string, projectPath: string,
                  changelogOrOptions: string | PublishOptions): Promise<void> => {
    await fixGuidesVersion(projectPath)
    const {file, dir} = await archiveTar(projectPath)
    await assignment.publishArchive(courseId, assignmentId, file, changelogOrOptions)
    fs.rmSync(dir, {recursive: true})
  },
  publishArchive,
  reducePublish,
  updateSettings,
  getSettings,
  updateStudentTimeExtension,
  createAssignment
}

export default assignment
