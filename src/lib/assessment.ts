import fs from 'fs'
import bent from 'bent'
import path from 'path'
import config from './config'
import { Assessment, parse, API_ID_TAG, parseApi, API_HASH_TAG } from './assessmentsTypes'
import FormData from 'form-data'
import tools from './tools'
import _ from 'lodash'
import glob from "glob-promise";
const getJson = bent('json')

const ASSESSMENTS_DIR = '.guides/assessments'

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
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

function updateTags(tags: {name: string, value: string}[], id: string, hash: string): void {
  const idTag = _.find(tags, {name: API_ID_TAG})
  if (_.isUndefined(idTag)) {
    tags.push({
      name: API_ID_TAG,
      value: id
    })
  } else {
    idTag.value = id
  }
  const hashTag = _.find(tags, {name: API_HASH_TAG})
  if (_.isUndefined(hashTag)) {
    tags.push({
      name: API_HASH_TAG,
      value: hash
    })
  } else {
    hashTag.value = hash
  }
}

async function updateJSON(assessment: Assessment, base: string): Promise<void> {
  const assessmentJsonFiles = await glob('*.json', {cwd: path.join(base, ASSESSMENTS_DIR), nodir: true})
  for (const file of assessmentJsonFiles) {
    const filePath = path.join(ASSESSMENTS_DIR, file)
    const assessmentString = await fs.promises.readFile(filePath, {encoding: 'utf8'})
    const assessmentData = JSON.parse(assessmentString)
    if (assessmentData.taskId === assessment.taskId) {
      const hash = assessment.getHash()
      const id = assessment.getId()
      updateTags(assessmentData.source.metadata.tags, id, hash)
      await fs.promises.writeFile(filePath, JSON.stringify(assessmentData, undefined, ' '))
      break
    }
  }
}

export async function publishAssessment(libraryId: string, assessment: Assessment, isNew: boolean, base: string): Promise<void> {
  libraryId = await getLibraryId(libraryId)
  return _publishAssessment(libraryId, assessment, isNew, base)
}

async function _publishAssessment(libraryId: string, assessment: Assessment, isNew: boolean, base: string): Promise<void> {
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

    const postData = new FormData()
    postData.append('assessment', assessment.export())
    const archivePath = await assessment.getBundle(base)
    if (!_.isUndefined(archivePath)) {
      const { size } = await fs.promises.stat(archivePath)
      if (size === 0) {
        console.log(`empty bundle`)
      } else {
        postData.append('bundle', fs.createReadStream(archivePath),  {
          knownLength: size
        })
      }
    }
    const headers = Object.assign(postData.getHeaders(), authHeaders)
    headers['Content-Length'] = await new Promise(resolve => postData.getLength((_, length) => resolve(length)))
    const assessmentId = isNew ? '' : `/${assessment.assessmentId}`
    await updateJSON(assessment, base)
    await api(`/api/v1/assessment_library/${libraryId}/assessment${assessmentId}`, postData, headers)
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

//return id if name passed
async function getLibraryId(name: string): Promise<string> {
  const libraries = await listLibraries()
  const item = _.find(libraries, {name})
  if (_.isUndefined(item)) {
    return name
  }
  return item.id
}

export async function updateOrAdd(libraryId: string, assessment: Assessment, base: string): Promise<void> {
  libraryId = await getLibraryId(libraryId)
  return _updateOrAdd(libraryId, assessment, base)
}

async function _updateOrAdd(libraryId: string, assessment: Assessment, base: string): Promise<void> {
  const search: Map<string, string> = new Map()
  search.set(API_ID_TAG, assessment.getId())

  const assessments = await find(libraryId, search)
  const isNew = (assessments.length == 0)
  if (isNew) {
    console.log(`new ${assessment.details.name}`)
    await _publishAssessment(libraryId, assessment, true, base)
  } else {
    console.log(`${assessment.details.name} exists`)
    const libraryAssessment = assessments[0]
    const checksumLibrary = libraryAssessment.metadata.tags.get(API_HASH_TAG)
    const checksumProject = assessment.getHash()
    if (checksumLibrary != checksumProject) {
      console.log(`${assessment.details.name} updating 
      new "${checksumProject}" old "${checksumLibrary}"`)
      assessment.assessmentId = libraryAssessment.assessmentId
      await _publishAssessment(libraryId, assessment, false, base)
    } else {
      console.log(`${assessment.details.name} unchanged`)
    }
  }
}

async function loadProjectAssessments(dir: string): Promise<Assessment[]> {
  // read assessments
  const res: Assessment[] = []

  const assessmentJsonFiles = await glob('*.json', {cwd: path.join(dir, ASSESSMENTS_DIR), nodir: true})
  let assessments: any[] = []
  for (const file of assessmentJsonFiles) {
    const filePath = path.join(ASSESSMENTS_DIR, file)
    const assessmentString = await fs.promises.readFile(filePath, {encoding: 'utf8'})
    const assessment = JSON.parse(assessmentString)
    assessments = assessments.concat(assessment)
  }

  const rootMetadata = tools.readMetadataFile('.guides/content/index.json')
  const guidesStructure = tools.getGuidesStructure(rootMetadata, dir, '')
  const metadataPages = getMetadataPages(dir, guidesStructure)
  for (const json of assessments) {
    try {
      const item = parse(json, metadataPages)
      item.basePath = dir
      res.push(item)
    } catch (error: any) {
      console.log(`Skipping assessment ${error.message}`)
    }
  }
  console.log(`Assessments found: ${res.length}`)
  return res
}

function getMetadataPages(dir, guidesStructure) {
  let metadataPages: { page: string, data: any }[] = []
  for (const data of guidesStructure) {
    if (data.type === 'page') {
      const filePath = path.join(dir, data['content_path'])
      const page = fs.readFileSync(filePath, {encoding: "utf-8"})
      metadataPages.push({page, data})
    }
    if (data.children) {
      const res = getMetadataPages(dir, data.children)
      metadataPages = metadataPages.concat(res)
    }
  }
  return metadataPages
}

async function fromCodioProject(libraryId: string, path: string): Promise<void> {
  libraryId = await getLibraryId(libraryId)
  const assessments = await loadProjectAssessments(path)
  for(const _ of assessments) {
    try {
      await _updateOrAdd(libraryId, _, path)
    } catch(error: any) {
      console.error(error.message)
    }
  }
}

async function find(libraryId: string, tags = new Map()): Promise<Assessment[]> {
  libraryId = await getLibraryId(libraryId)
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const params = tools.mapToObject(tags)

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
  } catch (error: any) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

const assessment = {
  listLibraries,
  find,
  updateOrAdd,
  fromCodioProject,
  publishAssessment,
}

export default assessment
