import fs from 'fs'
import path from 'path'
import bent from 'bent'
import FormData from 'form-data'
import tar from 'tar'
import glob from 'glob-promise'
import YAML from 'yaml'
import tools, { getApiV1Url, getBearer } from './tools'
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
}

type Yaml = {
  assignment: string | undefined
  assignmentName: string | undefined
  paths: (string | PathMap)[]
  section: string[][]
}

export type Penalty = {
  id: number
  datetime: Date
  percent: number
  message: string
}

type PenaltyRaw = {
  id: number
  datetime: string
  percent: number
  message: string
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
  penalties?: Penalty[]
  examMode?: {
    timedExamMode: {
      enabled: boolean
      duration: number // minutes
    }
    shuffleQuestionsOrder: boolean
    forwardOnlyNavigation: boolean
    singleLogin: boolean
    authentication: boolean
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
  penalties?: PenaltyRaw[]
  examMode?: {
    timedExamMode: {
      enabled: boolean,
      duration: number // minutes
    }
    shuffleQuestionsOrder: boolean
    forwardOnlyNavigation: boolean
    singleLogin: boolean
    authentication: boolean
  },
  releaseGrades?: boolean,
  isDisabled?: boolean
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

const getJson = bent('json')

async function publishArchive (courseId: string, assignmentId:string, archivePath: string, changelog: string): Promise<void> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const api = bent(`https://octopus.${domain}`, 'POST', 'json', 200)

    const postData = new FormData()
    postData.append('changelog', changelog)
    postData.append('archive', fs.createReadStream(archivePath),  {
      knownLength: fs.statSync(archivePath).size
    })
    const headers = Object.assign(postData.getHeaders(), authHeaders)
    headers['Content-Length'] = postData.getLengthSync()
    const res = await api(`/api/v1/courses/${courseId}/assignments/${assignmentId}/versions`,
      postData, headers)
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    for (let i = 0; i < 100; i++) { // 100 checks attempt
      await sleep(10)
      const status = await getJson(taskUrl, undefined, authHeaders)
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
    if (map.has(assignmentId)) {
      const item = map.get(assignmentId)
      if (!item) {
        continue
      }
      item.section.push(section)
      item.paths = item.paths.concat(yml.paths || [])
    } else {
      map.set(assignmentId, {
        assignment: yml.assignment,
        assignmentName: yml.assignmentName,
        paths: yml.paths || [],
        section: [section]
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
    } else {
      map.set(assignmentId, {
        assignment: yml.assignment,
        assignmentName: yml.assignmentName,
        paths: yml.paths || [],
        section: section
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

async function reducePublish(courseId: string, srcDir: string, yamlDir: string, changelog: string): Promise<void> {
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
      throw new Error(`assignment not found with name "${item.assignmentName}}"`)
    }
    await tools.reduce(srcDir, tmpDstDir, item.section, _.compact(paths))
    await assignment.publish(courseId, item.assignment, tmpDstDir, changelog)
    fs.rmdirSync(tmpDstDir, {recursive: true})
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
    examMode: res.examMode,
    releaseGrades: res.releaseGrades,
    isDisabled: res.isDisabled,
    penalties: res.penalties? _.map(res.penalties, _ => {
      return {
        id: _.id,
        datetime: new Date(_.datetime),
        percent: _.percent,
        message: _.message,
      }
    }) : undefined,
  }
}

export async function getSettings(courseId: string, assignmentId:string): Promise<AssignmentSettings> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const api = bent(getApiV1Url(), 'GET', 'json', 200)

    const res = await api(`/courses/${courseId}/assignments/${assignmentId}/settings`,
        undefined, getBearer()) as AssignmentSettingsRaw
    return fromRawSettings(res)
  } catch (error) {
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
  if (settings.examMode !== undefined) {
    res.examMode = settings.examMode
  }
  if (settings.releaseGrades !== undefined) {
    res.releaseGrades = settings.releaseGrades
  }
  if (settings.isDisabled !== undefined) {
    res.isDisabled = settings.isDisabled
  }
  if (settings.penalties !== undefined) {
    res.penalties = _.map(settings.penalties, _ => {
      validatePenalty(_)
      return {
        id: _.id,
        datetime: _.datetime.toISOString(),
        percent: _.percent,
        message: _.message,
      }
    })
  }
  return res
}

function validatePenalty(penalty: Penalty) {
  if (!_.isNumber(penalty.id) || !_.isFinite(penalty.id)) {
    throw new Error("penalty id must be a number and present")
  }

  if (_.isNumber(penalty.percent) && (penalty.percent < 0 || penalty.percent > 100)) {
    throw new Error("penalty percent must be a number between 0 and 100")
  }

  if (!_.isDate(penalty.datetime)) {
    throw new Error("penalty date must be a Date object")
  }
}

export async function updateSettings(courseId: string, assignmentId: string, settings: AssignmentSettings): Promise<AssignmentSettings> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const api = bent(getApiV1Url(), 'POST', 'json', 200)
    const res = await api(`/courses/${courseId}/assignments/${assignmentId}/settings`,
        toRawSettings(settings), getBearer()) as AssignmentSettingsRaw
    return fromRawSettings(res)
  } catch (error) {
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
    const authHeaders = getBearer()

    const api = bent(getApiV1Url(), 'POST', 'json', 200)

    return await api(
      `/courses/${courseId}/assignments/${assignmentId}/students/${studentId}`, extension, authHeaders
    ) as any
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

const assignment = {
  publish: async (courseId: string, assignmentId: string, projectPath: string, changelog: string): Promise<void> => {
    const {file, dir} = await archiveTar(projectPath)
    await assignment.publishArchive(courseId, assignmentId, file, changelog)
    fs.rmdirSync(dir, {recursive: true})
  },
  publishArchive,
  reducePublish,
  updateSettings,
  getSettings,
  updateStudentTimeExtension
}

export default assignment
