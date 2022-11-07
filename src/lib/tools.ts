import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import bent from 'bent'
import copy from 'recursive-copy'
import process from 'child_process';
import {excludePaths} from './config'
import tar from 'tar'
import { ZSTDCompress } from 'simple-zstd'
import config from './config'
import { PathMap } from './assignment'

const getJson = bent('json')

const CONVERTER_VERSION = '4ca4944ddf9d4fe4df9697bec06cbd0a6c170419'
const GUIDES_CONTENT_DIR = '.guides/content'
const OLD_METADATA_FILE = '.guides/metadata.json'
const INDEX_METADATA_FILE = 'index.json'
const PAGE = 'page'

export async function reduce(
    srcDir: string, dstDir: string, yaml_sections: string[][], paths: (string | PathMap)[]): Promise<void> {
  if (fs.existsSync(OLD_METADATA_FILE)) {
    await convertToGuidesV3()
  }
  const contentDir = path.join(srcDir, GUIDES_CONTENT_DIR)
  const rootMetadataPath = path.join(contentDir, INDEX_METADATA_FILE)
  const rootMetadata = readMetadataFile(rootMetadataPath)
  const guidesStructure = getGuidesStructure(rootMetadata, srcDir, '')
  const strippedStructure = stripStructure(guidesStructure, yaml_sections)
  const excludePaths = []
  const strippedSectionsIds = getStrippedSectionIds(strippedStructure)
  getExcludedPaths(guidesStructure, strippedSectionsIds, excludePaths)

  await copyStripped(srcDir, dstDir, paths.concat(excludePaths))
  await updateRootMetadata(strippedStructure, rootMetadata, dstDir)
  await updateMetadata(strippedStructure, dstDir)
}

function getGuidesStructure(metadata, srcDir, currentPath) {
  return _.map(metadata['order'], item => {
    const contentDirPath = path.join(srcDir, GUIDES_CONTENT_DIR)
    const sectionPath = path.join(currentPath, item)
    const indexFilePath = path.join(contentDirPath, sectionPath, INDEX_METADATA_FILE)
    if (!fs.existsSync(indexFilePath)) {
      const metadataFilePath = path.join(contentDirPath, `${sectionPath}.json`)
      const sectionMetadata = readMetadataFile(metadataFilePath)
      sectionMetadata['name'] = item
      sectionMetadata['content_path'] = path.join(GUIDES_CONTENT_DIR, `${sectionPath}.md`)
      sectionMetadata['metadata_path'] = path.join(GUIDES_CONTENT_DIR, `${sectionPath}.json`)
      return sectionMetadata
    } else {
      const newMetadataPath = path.join(currentPath, item)
      const indexFilePath = path.join(contentDirPath, sectionPath, INDEX_METADATA_FILE)
      const sectionMetadata = readMetadataFile(indexFilePath)
      sectionMetadata['name'] = item
      sectionMetadata['metadata_path'] = path.join(GUIDES_CONTENT_DIR, newMetadataPath)
      sectionMetadata['section_path'] = sectionPath
      sectionMetadata['children'] = getGuidesStructure(sectionMetadata, srcDir, sectionPath)
      return sectionMetadata
    }
  })
}

function readMetadataFile(path) {
  try {
    const metadataJson = fs.readFileSync(path, {encoding: "utf-8"})
    return JSON.parse(metadataJson)
  } catch (_) {
    return []
  }
}

function stripStructure(guidesStructure, yaml_sections) {
  const result: string[] = []
  const structure = _.cloneDeep(guidesStructure)
  for (const item of yaml_sections) {
    if (item.length === 0) { //skip empty sections
      continue
    }
    const section = traverseData(structure, item)
    if (!section) {
      throw new Error(`${section} not found`)
    }
    result.push(section)
  }
  return result
}

function traverseData(structure, sections) {
  const sectionName = sections.shift()
  if (!sectionName) {
    return
  }
  const section = findSection(structure, sectionName)
  if (!section) {
    throw new Error(`section "${sectionName}" is not found`)
  }
  if (sections.length > 0) {
    section['children'] = [traverseData(section.children, sections)]
    return section
  }
  return section
}

function findSection(structure, title) {
  const capitalTitle = _.upperCase(title)
  if (structure.title === PAGE) {
    if (structure.title === capitalTitle) {
      return structure
    }
  }
  else {
    for (const item of structure) {
      if (_.upperCase(item.title) === capitalTitle) {
        return item
      }
    }
  }
  return undefined
}

function getStrippedSectionIds(stripped) {
  let ids: string[] = []
  for (const item of stripped) {
    if (item.id) {
      ids.push(`${item.id}`)
    }
    if (item.children) {
      for (const section of [item.children]) {
        const sectionIds = getStrippedSectionIds(section)
        ids = ids.concat(sectionIds)
      }
    }
  }
  return ids
}

function getExcludedPaths(structure, strippedSectionIds, excludePaths) {
  for (const section of structure) {
    if (!strippedSectionIds.includes(section.id)) {
      if (section.type === PAGE) {
        excludePaths.push(`!${section.metadata_path}`)
        excludePaths.push(`!${section.content_path}`)
      } else {
        excludePaths.push(`!${section.metadata_path}`)
        excludePaths.push(`!${section.metadata_path}/**`)
      }
    }
    if (section.children) {
      getExcludedPaths(section.children, strippedSectionIds, excludePaths)
    }
  }
  return excludePaths
}

async function copyStripped(srcDir: string, dstDir: string, paths: (string | PathMap)[]): Promise<void> {
  const mapPaths = _.filter(paths, _ => typeof _ != 'string') as PathMap[]
  const stringPaths = [] as string[]
  stringPaths.push('.guides/**')
  stringPaths.push('.codio')
  stringPaths.push('.codio-menu')
  stringPaths.push('.settings')
  stringPaths.push('!.github/**')
  stringPaths.push('!**/index.json')

  _.forEach(_.filter(paths, _ => typeof _ === 'string') as string[],
          path => stringPaths.push(`${path}`))
  _.forEach(excludePaths, path => stringPaths.push(`${path}`))

  await copy(srcDir, dstDir, {
    filter: stringPaths,
    overwrite: true,
    dot: true
  })

  for( const map of mapPaths) {
    try {
      await copy(path.join(srcDir, map.source), path.join(dstDir, map.destination), {
        overwrite: true,
        dot: true
      })
    } catch (_) {
      console.error(_)
    }
  }
}

async function updateRootMetadata(structure, metadata, dstDir) {
  const filePath = path.join(dstDir, GUIDES_CONTENT_DIR, INDEX_METADATA_FILE)
  metadata['order'] = _.map(structure, item => item.name)
  await fs.promises.writeFile(filePath, JSON.stringify(metadata, undefined, ' '))
}

async function updateMetadata(structure, dstDir) {
  for (const item of structure) {
    if (item.children) {
      const filePath = path.join(dstDir, GUIDES_CONTENT_DIR, item['section_path'], INDEX_METADATA_FILE)
      const data = {
        id: item.id,
        title: item.title,
        type: item.type,
        order: _.map(item.children, child => child.name)
      }
      await fs.promises.writeFile(filePath, JSON.stringify(data, undefined, ' '))
      await updateMetadata(item.children, dstDir)
    }
  }
}

export function mapToObject(map: Map<string, any>): any {
  return map.size === 0 ? [] :
  Array.from(map).reduce((obj, [key, value]) => (
    Object.assign(obj, { [key]: value })
  ), {})
}

export async function createTar(basePath: string, paths: string[], excludePaths?: string[]) {
  const dir = await fs.promises.mkdtemp('/tmp/codio_export')
  const file = path.join(dir, 'archive.tar')
  await tar.c(
    {
      file,
      cwd: basePath,
      filter: (path: string) => {
        if (!excludePaths) {
          return true
        }
        for (const exclude of excludePaths) {
          if (_.startsWith(path, exclude)) {
            return false
          }
        }
        return true
      }
    },
    paths
  )
  const zst = path.join(dir, 'archive.tar.zst')
  await new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(ZSTDCompress())
      .pipe(fs.createWriteStream(path.join(dir, 'archive.tar.zst')))
      .on('finish', resolve)
      .on('error', reject)
  })
  return zst
}

export function secondsToDate(seconds: number): Date {
  const t = new Date(1970, 0, 1) // Epoch
  t.setUTCSeconds(seconds)
  return t
}

export async function convertToGuidesV3() {
  console.log('guides conversion process...')
  try {
    await execShellCommand(`curl "https://static-assets.codio.com/guides-converter-v3/guides-converter-v3-${CONVERTER_VERSION}" --output guides-converter-v3`)
    await execShellCommand('chmod +x ./guides-converter-v3')
    await execShellCommand('./guides-converter-v3')
    await execShellCommand('rm guides-converter-v3')
  } catch (error) {
    console.error(error);
  }
}

function execShellCommand(command) {
  return new Promise((resolve, reject) => {
    process.exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      }
      resolve(stdout ? stdout : stderr)
    })
  })
}

export function getApiV1Url(): string {
  return `https://octopus.${config.getDomain()}/api/v1`
}

export function getBearer() {
  if (!config) {
    throw new Error('No Config')
  }
  const token = config.getToken()
  return {
    'Authorization': `Bearer ${token}`
  }
}

export async function sendApiRequest(url, body): Promise<any> {
  const authHeaders =  getBearer()
  return getJson(url, body, authHeaders)
}

const tools = {
  reduce,
  mapToObject,
  createTar,
  secondsToDate,
  sendApiRequest
}

export default tools
