import path from 'path'
import fs from 'fs'
import _ from 'lodash'
import bent from 'bent'
import copy from 'recursive-copy'
import {excludePaths} from './config'
import tar from 'tar'
import { ZSTDCompress } from 'simple-zstd'
import config from './config'
import { PathMap } from './assignment'

const getJson = bent('json')


async function copyStripped(srcDir: string, bookStripped: any, metadataStriped: any, dstDir: string, paths: (string | PathMap)[]): Promise<void> {
  const stringPaths =  (_.filter(paths, _ => typeof _ === 'string') as string[])
  const mapPaths = (_.filter(paths, _ => typeof _ != 'string') as PathMap[])
  stringPaths.push('.guides/**')
  stringPaths.push('.codio')
  stringPaths.push('.codio-menu')
  stringPaths.push('.settings')
  stringPaths.push('!.github/**')
  stringPaths.push('!.guides/book.json')
  stringPaths.push('!.guides/metadata.json')
  for(const path of excludePaths) {
    stringPaths.push(`!${path}`)
  }
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

  const bookJsonPath = path.join(dstDir, '.guides', 'book.json')
  const metadataPath = path.join(dstDir, '.guides', 'metadata.json')
  await fs.promises.mkdir(path.join(srcDir, '.guides'), {recursive: true})
  if (bookStripped.children.length > 0) {
    await fs.promises.writeFile(bookJsonPath, JSON.stringify(bookStripped, undefined, ' '))
  }
  if (metadataStriped.sections.length > 0) {
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadataStriped, undefined, ' '))
  }
}

// case-insensitive search for title
function findSection(children: any[], title: string): any | undefined {
  const capitalTitle = _.upperCase(title)
  for(const item of children) {
    if (_.upperCase(item.title) === capitalTitle) {
      return item
    }
  }
  return undefined
}

function traverseBook(book: any, sections: string[]): any {
  const sectionName = sections.shift()
  if (!sectionName) {
    return
  }
  const section = findSection(book.children, sectionName)
  if (!section) {
    throw new Error(`section "${sectionName}" is not found`)
  }
  if (sections.length > 0) {
    return traverseBook(section, sections)
  }
  return section
}

function getSectionIds(book: any): string[] {
  let ids: string[] = []
  if (book['pageId']) {
    ids.push(`${book['pageId']}`)
  }
  if (!book.children) {
    return ids
  }
  for(const section of book.children) {
    const sectionIds = getSectionIds(section)
    ids = ids.concat(sectionIds)
  }
  return ids
}

function stripBook(book: any, sections: string[][]): any {
  const children: any[] = []
  for (const sectionPath of sections ) {
    if (sectionPath.length === 0) { //skip empty sections
      continue
    }
    const section = traverseBook(book, sectionPath)
    if (!section) {
      throw new Error(`${section} not found`)
    }
    children.push(section)
  }
  book.children = children
  return book
}

function stripMetadata(metadata: any, book: any): string[] {
  const ids = getSectionIds(book)
  const newSections: any[] = []
  const excludePaths: string[] = []
  for (const section of metadata.sections) {
    if (ids.includes(section['id'])) {
      newSections.push(section)
    } else {
      if (section['content-file']) {
        excludePaths.push(`!${section['content-file']}`)
      }
    }
  }
  metadata.sections = newSections
  return excludePaths
}

export async function reduce(srcDir: string, dstDir: string, sections: string[][], paths: (string | PathMap)[]): Promise<void> {
  let book: any
  let metadata: any
  try {
    const bookJsonPath = path.join(srcDir, '.guides', 'book.json')
    const bookJson = await fs.promises.readFile(bookJsonPath, { encoding: 'utf-8' })
    book = JSON.parse(bookJson)
  } catch (_) {
    book = {children:[]}
  }

  try {
    const metadataPath = path.join(srcDir, '.guides', 'metadata.json')
    const metadataJson = await fs.promises.readFile(metadataPath, { encoding: 'utf-8' })
    metadata = JSON.parse(metadataJson)
  } catch(_) {
    metadata = {sections:[]}
  }

  const bookStripped = stripBook(book, sections)
  const excludePaths = stripMetadata(metadata, bookStripped)
  await copyStripped(srcDir, bookStripped, metadata, dstDir, paths.concat(excludePaths))
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
