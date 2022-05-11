import fs from 'fs'
import path from 'path'
import bent from 'bent'
import FormData from 'form-data'
import tar from 'tar'
import glob from 'glob-promise'
import YAML from 'yaml'
import tools, { getApiV1Url } from './tools'
import config, { excludePaths } from './config'
import _ from 'lodash'
import { Course } from './course'

type YamlRaw = {
  assignment: string | undefined
  assignmentName: string | undefined
  paths: string[] | undefined
  section: string | string[]
}

type Yaml = {
  assignment: string | undefined
  assignmentName: string | undefined
  paths: string[]
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

export type AssignmentSettings = {
  enableResetAssignmentByStudent?: boolean
  disableDownloadByStudent?: boolean
  visibilityOnDisabled?: string, // "READ_ONLY", "NO_ACCESS",
  visibilityOnCompleted?: string, // "READ_ONLY_RESUBMIT", "READ_ONLY", "NO_ACCESS",
  startTime?: Date | null,
  endTime?: Date | null,
  action?: string // "COMPLETE", "DISABLE", "DISABLE_AND_COMPLETE", 
  penalties?: Penalty[]
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
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const api = bent(getApiV1Url(), 'POST', 'json', 200)

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

async function loadYaml(yamlDir: string): Promise<Yaml[]> {
  let res: YamlRaw[] = []
  const files = await glob('*.+(yml|yaml)', {cwd: yamlDir, nodir: true})
  for (const file of files) {
    const ymlText = await fs.promises.readFile(path.join(yamlDir, file), {encoding: 'utf-8'})
    let ymls: YamlRaw[] = YAML.parse(ymlText)
    if (!_.isArray(ymls)) {
      ymls = [ymls]
    }
    res = res.concat(ymls)
  }

  return validityState(res)
}

async function reducePublish(course: string | Course, srcDir: string, yamlDir: string, changelog: string): Promise<void> {
  const ymlCfg = await loadYaml(yamlDir)
  const courseId = typeof course === 'string' ? course : course.id
  for(const item of ymlCfg) {
    console.log(`publishing ${JSON.stringify(item)}`)
    const tmpDstDir = fs.mkdtempSync('/tmp/publish_codio_reduce')
    const paths = item.paths || []
    paths.push(`!${yamlDir}`) // exclude yaml directory from export
    paths.push(`!${yamlDir}/**`) // exclude yaml directory from export
    
    let assignmentId
    if (item.assignmentName && typeof course !== 'string') {
      for (const module of course.modules) {
        for (const assignment of module.assignments) {
          if (assignment.name === item.assignmentName) {
            if (assignmentId) {
              throw new Error(`many assignments in course with same name ${item.assignmentName}`)
            } else {
              assignmentId = assignment.id
            }
          }
        }
      }
    } else {
      assignmentId = item.assignment
    }
    if (!assignmentId) {
      throw new Error(`assignment not found with name "${item.assignmentName}}"`)
    }
    await tools.reduce(srcDir, tmpDstDir, item.section, paths)
    await assignment.publish(courseId, assignmentId, tmpDstDir, changelog)
    fs.rmdirSync(tmpDstDir, {recursive: true})
  }
}

export async function getSettings(courseId: string, assignmentId:string): Promise<AssignmentSettings> {
  return updateSettings(courseId, assignmentId, {})
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
    const token = config.getToken()
    const authHeaders = {'Authorization': `Bearer ${token}`}
    
    const api = bent(getApiV1Url(), 'POST', 'json', 200)

    const res = await api(`/courses/${courseId}/assignments/${assignmentId}/settings`,
        toRawSettings(settings), authHeaders) as AssignmentSettingsRaw
    return {
      enableResetAssignmentByStudent: res.enableResetAssignmentByStudent,
      disableDownloadByStudent: res.disableDownloadByStudent,
      visibilityOnDisabled: res.visibilityOnDisabled,
      visibilityOnCompleted: res.visibilityOnCompleted,
      startTime: convertDateToLocal(res.startTime),
      endTime: convertDateToLocal(res.endTime),
      action: res.action,
      penalties: res.penalties? _.map(res.penalties, _ => {
        return {
          id: _.id,
          datetime: new Date(_.datetime),
          percent: _.percent,
          message: _.message,
        }
      }) : undefined,
    }
  } catch (error) {
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
}

export default assignment
