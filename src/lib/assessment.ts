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
  crypto.createHash('sha1').update(`${assessment.type}${assessment.details.name}`).digest('hex'); 
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
    const libraries: Library[] = []
    for(const _ of res) {
      libraries.push({
        name: _.name,
        id: _.id,
        createdBy: _.createdBy
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
  // read assessments
  const res: Assessment[] = []
  const assessmentsJson = await fs.promises.readFile(path.join(dir, '/.guides/assessments.json'), 
    {encoding: 'utf8'}) 

  const metadataPath = path.join(dir, '.guides', 'metadata.json')
  const metadataString = await fs.promises.readFile(metadataPath, { encoding: 'utf8'} )
  const metadata = JSON.parse(metadataString)
  const metadataPages: {page: string, data: any}[] = []
  for( const data of metadata.sections) {
    const path = data['content-file']
    const page = await fs.promises.readFile(path, {encoding: 'utf8'})
    metadataPages.push(
      {
        page,
        data
      }
    )
  }
  
  const assessments: any[] = JSON.parse(assessmentsJson)
  for (const json of assessments) {
    try {
      res.push(parse(json, metadataPages))
    } catch (_) {
      console.log(`Skipping assessment ${_.message}`)
    }
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

    return await getJson(`https://octopus.${domain}/api/v1/assessment_library/${libraryId}/assessment`, undefined, authHeaders)
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
