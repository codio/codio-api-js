import bent from 'bent'
import config from './config'
import { secondsToDate } from './tools'

const getJson = bent('json')

export type Assignment = {
  id: string
  name: string
}

export type Course = {
  id: string
  name: string
  assignments: Assignment[] 
}

export type StudentProgress = {
  student_id: string
  student_email: string
  seconds_spent: number
  grade: number
  status: string
  completion_date: Date
}

export async function info(courseId: string): Promise<Course> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    return getJson(`https://octopus.${domain}/api/v1/courses/${courseId}`, undefined, authHeaders)
  } catch (error) {
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
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }
    const res = await getJson(`https://octopus.${domain}/api/v1/courses/${courseId}/assignments/${assignmentId}/students`, undefined, authHeaders)
    for (const progress of res) {
      if (progress.completion_date) {
        progress.completion_date = secondsToDate(progress.completion_date.seconds)
      }
    }
    return res
  } catch (error) {
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
    const token = config.getToken()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }
    const archive = await getJson(taskUrl, undefined, authHeaders)
    if (!archive.done) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return await waitDownloadTask(taskUrl)
    }
    return archive.url
  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function downloadStudentAssignment(courseId: string, assignmentId: string, studentId: string): Promise<string> {
  if (!config) {
    throw new Error('No Config')
  }
  
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }
    const res = await getJson(`https://octopus.${domain}/api/v1/courses/${courseId}/assignments/${assignmentId}/students/${studentId}/download`, undefined, authHeaders)
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    return await waitDownloadTask(taskUrl)
  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

export async function downloadStudentsAssignments(courseId: string, assignmentId: string, filter: (s: StudentProgress) => boolean): Promise<string[]> {
  let students = await assignmentStudentsProgress(courseId, assignmentId)
  students = students.filter(filter)
  const urls = await Promise.all(students.map(student => {
    return downloadStudentAssignment(courseId, assignmentId, student.student_id)
  }))
  return urls
}

const course = {
  assignmentStudentsProgress,
  info,
  downloadStudentsAssignments,
  downloadStudentAssignment
}

export default course
