import fs from 'fs'
import bent from 'bent'
import path from 'path'
import config from './config'
import { Assessment, parse, API_ID_TAG, parseApi, API_HASH_TAG } from './assessmentsTypes'
import FormData from 'form-data'

const getJson = bent('json')

export type Library = {
  name: string
  id: string
  createdBy: string
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

async function publishAssessment(libraryId: string, assessment: Assessment, isNew: boolean): Promise<void> {
  if (!config) {
    throw new Error('No Config')
  }
  
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }
    const api = bent(`https://octopus.${domain}`, isNew ? 'POST': 'PUT', 'json', 200)

    const postData = new FormData();
    postData.append('assessment', assessment.export())
    console.log(assessment.export())
    const archivePath = await assessment.getBundle()
    if (archivePath) {
      postData.append('bundle', fs.createReadStream(archivePath),  {
        knownLength: fs.statSync(archivePath).size
      })
    }
    const headers = Object.assign(postData.getHeaders(), authHeaders)
    headers['Content-Length'] = postData.getLengthSync()
    const assessmentId = isNew ? '' : `/${assessment.assessmentId}`
    await api(`/api/v1/assessment_library/${libraryId}/assessment${assessmentId}`, postData, headers);

  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      error = new Error(message)
    }
    throw error
  }
}


async function updateOrAdd(libraryId: string, assessment: Assessment): Promise<void> {

  const search: Map<string, string> = new Map()
  search.set(API_ID_TAG, assessment.getId())

  const assessments = await find(libraryId, search)
  const isNew = (assessments.length == 0)
  if (isNew) {
    console.log(`new ${assessment.details.name}`)
    await publishAssessment(libraryId, assessment, true)
  } else {
    console.log(`${assessment.details.name} exists`)
    const libraryAssessment = assessments[0]
    const checksum = libraryAssessment.metadata.tags.get(API_HASH_TAG)
    if (checksum !== assessment.getAssessmentHash()) {
      console.log(`${assessment.details.name} updating`) 
      await publishAssessment(libraryId, assessment, false)
    } else {
      console.log(`${assessment.details.name} unchanged`)
    }
  }

  return
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
    const filePath = path.join(dir, data['content-file'])
    const page = await fs.promises.readFile(filePath, {encoding: 'utf8'})
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

async function find(libraryId: string, tags = new Map()): Promise<Assessment[]> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }
    
    const params = tags.size === 0 ? [] : Array.from(tags).reduce((obj, [key, value]) => (
      Object.assign(obj, { [key]: value }) 
    ), {})

    const urlParams = new URLSearchParams(params)
    const url = `https://octopus.${domain}/api/v1/assessment_library/${libraryId}/assessment?${urlParams.toString()}`
    const apiRes = await getJson(url, undefined, authHeaders)
    if (!apiRes.assessments) {
      return []
    }
    const res: Assessment[] = []
    for(const _ of apiRes.assessments) {
      res.push(parseApi(_))
    }
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
