import bent from './bentWrapper'
import https from 'https'
import fs from 'fs'
import _ from 'lodash'

import config from './config'
import { getApiV1Url, secondsToDate, getBearer } from './tools'
const getJson = bent()

export type Assignment = {
  id: string
  name: string
}

export type Module = {
  id: string,
  name: string,
  assignments: Assignment[]
}

export type Course = {
  id: string
  name: string
  modules: Module[]
  assignments: Assignment[]
}

export type StudentProgress = {
  student_id: string
  student_email: string
  student_name: string
  seconds_spent: number
  grade: number
  status: 'NOT_STARTED' | 'COMPLETED' | 'STARTED'
  completion_date: Date
  timeLimitExtension: number | undefined
  deadlineExtension: number | undefined
}

export type AssignmentProgressInfo = {
  seconds_spent: number
  grade: number
  status: 'COMPLETED' | 'STARTED'
  completion_date: Date
  extended_deadline: number | undefined
  extended_time_limit: number | undefined
}

export type AssignmentProgress = {
  assignment_name: string
  assignment_id: string
  module_name: string
  module_id: string
  started: boolean
  progress: AssignmentProgressInfo | undefined
}

export type User = {
  id: string
  name: string
  login: string
  email: string
}

export type CourseExport = {
  taskId: string
  done: boolean
  error?: string
  url?: string
}

export type TaskResponce = {
  taskId: string
}

function flattenAssignments(course: Course) {
  course.assignments = _.flatten(_.map(course.modules, 'assignments'))
}

export async function info(courseId: string, withHiddenAssignments = true): Promise<Course> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const params = {
      withHiddenAssignments: withHiddenAssignments ? 'true' : 'false'
    }
    const urlParams = new URLSearchParams(params)

    const course: Course = await getJson(`${getApiV1Url()}/courses/${courseId}?${urlParams.toString()}`, undefined, getBearer())
    flattenAssignments(course)
    return course
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function findByName(courseName: string, withHiddenAssignments: boolean | undefined): Promise<Course> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const params = {
      name: courseName,
      withHiddenAssignments: withHiddenAssignments ? 'true' : 'false'
    }
    const urlParams = new URLSearchParams(params)
    const course = await getJson(`${getApiV1Url()}/courses?${urlParams.toString()}`, undefined, getBearer())
    flattenAssignments(course)
    return course
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function assignmentStudentsProgress(courseId: string, assignmentId: string): Promise<StudentProgress[]> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const res = await getJson(`${getApiV1Url()}/courses/${courseId}/assignments/${assignmentId}/students`, undefined, getBearer())
    for (const progress of res) {
      if (progress.completion_date) {
        progress.completion_date = secondsToDate(progress.completion_date.seconds)
      }
    }
    return res
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function studentCourseProgress(courseId: string, studentIdentification: string): Promise<AssignmentProgress[]> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const res = await getJson(`${getApiV1Url()}/courses/${courseId}/students/${studentIdentification}/progress`, undefined, getBearer())
    for (const progress of res) {
      if (progress.completion_date) {
        progress.completion_date = new Date(progress.completion_date)
      }
    }
    return res
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function waitDownloadTask(taskUrl: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }

  try {
    const archive = await getJson(taskUrl, undefined, getBearer())
    if (!archive.done) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return await waitDownloadTask(taskUrl)
    }
    if (archive.error) {
      throw new Error(`Task ${archive.taskId} failed with an error`)
    }
    return archive.url
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function exportStudentAssignment(courseId: string, assignmentId: string, studentId: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }

  try {
    const res = await getJson(`${getApiV1Url()}/courses/${courseId}/assignments/${assignmentId}/students/${studentId}/download`, undefined, getBearer())
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    return await waitDownloadTask(taskUrl)
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function downloadStudentAssignment(courseId: string, assignmentId: string, studentId: string, filePath: string): Promise<void> {
  const url = await exportStudentAssignment(courseId, assignmentId, studentId)
  return download(filePath, url)
}

export async function downloadStudentCSV(courseId: string, studentId: string, filePath: string): Promise<void> {
  const url = await exportStudentCSV(courseId, studentId)
  return download(filePath, url)
}

export async function downloadAssignmentCSV(courseId: string, assignmentId: string, filePath: string): Promise<void> {
  const url = await exportAssignmentCSV(courseId, assignmentId)
  return download(filePath, url)
}

export async function downloadAssessmentData(courseId: string, assignmentIds: string, filePath: string): Promise<void> {
  const url = await exportAssessmentData(courseId, assignmentIds)
  return download(filePath, url)
}

async function download(filePath: string, url: string): Promise<void> {
  if (!url) {
    throw new Error('Url Not Found');
  }
  const file = fs.createWriteStream(filePath)
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(filePath, e => {
        reject(e && e.message)
      })
      reject(err.message)
    })
  })
}

export async function exportStudentCSV(courseId: string, studentId: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    return await getJson(
        `${getApiV1Url()}/courses/${courseId}/students/${studentId}/export/csv`,
        undefined,
        getBearer()
    )
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function exportAssignmentCSV(courseId: string, assignmentId: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    return await getJson(
        `${getApiV1Url()}/courses/${courseId}/assignments/${assignmentId}/export/csv`,
        undefined,
        getBearer()
    )
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function exportAssessmentData(courseId: string, assignmentIds: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const res = await getJson(
        `${getApiV1Url()}/courses/${courseId}/export/assessments/csv?assignmentIds=${assignmentIds}`,
        undefined,
        getBearer()
    )
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    return await waitDownloadTask(taskUrl)
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function getStudents(courseId: string): Promise<User[]> {
  try {
    return await getJson(`${getApiV1Url()}/courses/${courseId}/students`, undefined, getBearer())
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function getTeachers(courseId: string): Promise<User[]> {
  try {
    return await getJson(`${getApiV1Url()}/courses/${courseId}/teachers`, undefined, getBearer())
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function getSourceExports(courseId: string): Promise<CourseExport[]> {
  try {
    return await getJson(`${getApiV1Url()}/courses/${courseId}/export/sources`, undefined, getBearer())
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function getSourceExportProgress(courseId: string, taskId: string): Promise<CourseExport> {
  try {
    return await getJson(
      `${getApiV1Url()}/courses/${courseId}/export/sources/progress/${taskId}`, undefined, getBearer()
    )
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

async function waitExportTaskReady(taskId: string, taskChecker: (taskId: string) => Promise<CourseExport>): Promise<CourseExport> {
  return new Promise((resolve, reject) => {
    const checker = async () => {
      try {
        const check = await taskChecker(taskId)
        if (check.done) {
          if (check.error) {
            reject(new Error(check.error))
          } else {
            resolve(check)
          }
        } else {
          setTimeout(() => checker(), 10000)
        }
      } catch (ex) {
        reject(ex)
      }
    }
    checker()
  })
}

export async function createSourceExport(courseId: string): Promise<CourseExport> {
  const api = bent(getApiV1Url(), 'POST', 'json', 200)
  try {
    const res = await api(`/courses/${courseId}/export/sources`, undefined, getBearer()) as TaskResponce
    return await waitExportTaskReady(res.taskId, (taskId) => getSourceExportProgress(courseId, taskId))
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function downloadSourceExport(courseId: string, filePath: string): Promise<void> {
  const resp = await createSourceExport(courseId)
  if (!resp.url) {
    throw new Error(resp.error)
  }
  return download(filePath, resp.url)
}

export async function getWorkExports(courseId: string): Promise<CourseExport[]> {
  try {
    return await getJson(`${getApiV1Url()}/courses/${courseId}/export/workdata`, undefined, getBearer())
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function getWorkExportProgress(courseId: string, taskId: string): Promise<CourseExport> {
  try {
    return await getJson(
      `${getApiV1Url()}/courses/${courseId}/export/workdata/progress/${taskId}`, undefined, getBearer()
    )
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function createWorkExport(courseId: string): Promise<CourseExport> {
  const api = bent(getApiV1Url(), 'POST', 'json', 200)
  try {
    const res = await api(`/courses/${courseId}/export/workdata`, undefined, getBearer()) as TaskResponce
    return await waitExportTaskReady(res.taskId, (taskId) => getWorkExportProgress(courseId, taskId))
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function downloadWorkExport(courseId: string, filePath: string): Promise<void> {
  const resp = await createWorkExport(courseId)
  if (!resp.url) {
    throw new Error(resp.error)
  }
  return download(filePath, resp.url)
}

const course = {
  assignmentStudentsProgress,
  info,
  exportStudentAssignment,
  downloadStudentAssignment,
  exportStudentCSV,
  exportAssignmentCSV,
  exportAssessmentData,
  downloadStudentCSV,
  downloadAssignmentCSV,
  downloadAssessmentData,
  findByName,
  getStudents,
  getTeachers,
  getWorkExportProgress,
  getWorkExports,
  createWorkExport,
  downloadWorkExport,
  getSourceExportProgress,
  getSourceExports,
  createSourceExport,
  downloadSourceExport,
  studentCourseProgress
}

export default course
