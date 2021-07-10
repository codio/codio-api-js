import fs from 'fs'
import bent from 'bent'
import path from 'path'
import config from './config'
import crypto from 'crypto'
import { Assessment, parse } from './assessmentsTypes'

const getJson = bent('json')



export type AssessmentParsons = {
  
}

type APIAssessment = {
  type: string
}

export type Library = {
  name: string
  id: string
  createdBy: string
}

const API_ID_TAG = 'CODIO_API_ID'

async function getHash(assessment: Assessment) {
  crypto.createHash('sha1').update(`${assessment.type}${assessment.name}`).digest('hex'); 
}

async function listLibraries(): Promise<Library[]> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const res = await getJson(`https://octopus.${domain}/api/v1/assessment_library`, undefined, authHeaders)
    console.log(res)
    const libraries: Library[] = []
    for( const _ of res) {
      libraries.push({
        name: res.name,
        id: res.id,
        createdBy: res.createdBy
      })
    }
    return libraries
  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      error = new Error(message)
    }
    throw error
  }
}

async function updateOrAdd(libraryId: string, assessment: Assessment): Promise<void> {
  console.log(libraryId, assessment)
}

async function loadProjectAssessments(dir: string): Promise<Assessment[]> {
  const res: Assessment[] = []
  const assessmentsJson = await fs.promises.readFile(path.join(dir, '/.guides/assessments.json'), 
  {encoding: 'utf8'})
  const assessments: any[] = JSON.parse(assessmentsJson)
  for (const json of assessments) {
    res.push(parse(json))
  }
  return res
}



async function fromCodioProject(libraryId: string, path: string): Promise<void> {
  const assessments = await loadProjectAssessments(path)
  for(const _ of assessments) {
    await updateOrAdd(libraryId, _)
  }
}

async function find(libraryId: string, tags = new Map()): Promise<Assessment> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const res = await getJson(`https://octopus.${domain}/api/v1/assessment_library/${libraryId}`, undefined, authHeaders)
    console.log(res)
    return res
  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      error = new Error(message)
    }
    throw error
  }
}

const assessment = {
  listLibraries,
  find,
  updateOrAdd,
  fromCodioProject
}

export default assessment
