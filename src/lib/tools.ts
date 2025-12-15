import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import copy from 'recursive-copy'
import process from 'child_process';
import {excludePaths} from './config'
import tar from 'tar'
import { ZSTDCompress } from 'simple-zstd'
import config from './config'
import { PathMap } from './assignment'

const CONVERTER_VERSION = '4ca4944ddf9d4fe4df9697bec06cbd0a6c170419'
const GUIDES_CONTENT_DIR = '.guides/content'
const OLD_METADATA_FILE = '.guides/metadata.json'
const INDEX_METADATA_FILE = 'index.json'
const PAGE = 'page'

export async function fixGuidesVersion(projectPath: string) {
  if (fs.existsSync(path.join(projectPath, OLD_METADATA_FILE))) {
    await convertToGuidesV3(projectPath)
  }
}

export async function reduce(
  srcDir: string, dstDir: string, yaml_sections: string[][], paths: (string | PathMap)[], withChildren=true
): Promise<void> {
  await fixGuidesVersion(srcDir)
  const contentDir = path.join(srcDir, GUIDES_CONTENT_DIR)
  const rootMetadataPath = path.join(contentDir, INDEX_METADATA_FILE)
  const rootMetadata = readMetadataFile(rootMetadataPath)
  const guidesStructure = getGuidesStructure(rootMetadata, srcDir, '')
  const filter = collectFilter(guidesStructure, _.cloneDeep(yaml_sections), withChildren)
  const strippedStructure = stripStructure(guidesStructure, filter)
  const strippedSectionsIds = getStrippedSectionIds(strippedStructure)
  const excludePaths = getExcludedPaths(guidesStructure, strippedSectionsIds)

  await copyStripped(srcDir, dstDir, paths.concat(excludePaths))
  await updateRootMetadata(strippedStructure, rootMetadata, dstDir)
  await updateMetadata(strippedStructure, dstDir)
}

export function getGuidesStructure(metadata, srcDir, currentPath) {
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
      const sectionMetadata = readMetadataFile(indexFilePath)
      sectionMetadata['name'] = item
      sectionMetadata['metadata_path'] = path.join(GUIDES_CONTENT_DIR, newMetadataPath)
      sectionMetadata['section_path'] = sectionPath
      sectionMetadata['children'] = getGuidesStructure(sectionMetadata, srcDir, sectionPath)
      return sectionMetadata
    }
  })
}

export function readMetadataFile(path) {
  try {
    const metadataJson = fs.readFileSync(path, {encoding: "utf-8"})
    return JSON.parse(metadataJson)
  } catch (error: any) {
    throw new Error(error)
  }
}

// if all is true, then copy all children
// else use children list
type Section = {
  all: boolean,
  children: { [id: string]: Section }
}

const DEFAULT_ALL_SECTION: Section = {
  all: true,
  children: {}
}

function collectFilter(guidesStructure, yaml_sections, withChildren: boolean) {
  const filterMap = {
    all: false,
    children: {}
  }

  for (const sectionPath of yaml_sections) {
    if (sectionPath.length === 0) {
      continue
    }
    const section = traverseItems(guidesStructure, sectionPath, filterMap, withChildren)
    if (!section) {
      throw new Error(`${section} not found`)
    }
  }
  
  if (_.isEmpty(_.keys(filterMap))) {
    throw new Error(`Nothing to publish`)
  }
  return filterMap
}

function traverseItems(structure, sectionPath: string[], filterMap: Section, withChildren: boolean) {
  const sectionName = sectionPath.shift()
  if (!sectionName) {
    return
  }
  const section = findSection(structure, sectionName)
  if (!section) {
    throw new Error(`section "${sectionName}" is not found`)
  }
  if (filterMap.children[section.id] === undefined) {
    filterMap.children[section.id] = {
      all: false,
      children: {}
    }
  }
  if (sectionPath.length > 0) {
    // fill-in filterMap
    traverseItems(section.children, sectionPath, filterMap.children[section.id], withChildren)
  } else {
    filterMap.children[section.id].all = withChildren
  }
  return section
}

// if filter is empty then add all sections
function stripStructure(guidesStructure, filterMap) {
  const structure = _.cloneDeep(guidesStructure)
  return _.filter(structure, section => {
    if (filterMap.all) {
      return true
    }
    return _.keys(filterMap.children).includes(section.id)
  }).map(section => {
    if (section.children) {
      const filter = filterMap.all ? DEFAULT_ALL_SECTION : filterMap.children[section.id]
      section.children = stripStructure(section.children, filter)
    }
    return section
  })
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

function getExcludedPaths(structure, strippedSectionIds) {
  let paths: string[] = []
  for (const section of structure) {
    if (!strippedSectionIds.includes(section.id)) {
      if (section.type === PAGE) {
        paths.push(`!${section.metadata_path}`)
        paths.push(`!${section.content_path}`)
      } else {
        paths.push(`!${section.metadata_path}`)
        paths.push(`!${section.metadata_path}/**`)
      }
    }
    if (section.children) {
      const childrenPaths = getExcludedPaths(section.children, strippedSectionIds)
      paths = paths.concat(childrenPaths)
    }
  }
  return paths
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
          path => stringPaths.push(path))
  _.forEach(excludePaths, path => stringPaths.push(path))

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
        ..._.omit(item, 'children'),
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

export async function convertToGuidesV3(cwd: string) {
  console.log('guides conversion process...')
  try {
    await execShellCommand(`curl "https://static-assets.codio.com/guides-converter-v3/guides-converter-v3-${CONVERTER_VERSION}" --output guides-converter-v3`, cwd)
    await execShellCommand('chmod +x ./guides-converter-v3', cwd)
    await execShellCommand('./guides-converter-v3', cwd)
    await execShellCommand('rm guides-converter-v3', cwd)
  } catch (error: any) {
    throw new Error(error);
  }
}

function execShellCommand(command: string, cwd: string) {
  return new Promise((resolve, reject) => {
    process.exec(command, { cwd }, (error, stdout, stderr) => {
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

const tools = {
  reduce,
  mapToObject,
  createTar,
  secondsToDate,
  readMetadataFile,
  getGuidesStructure
}

export default tools
