import path from 'path'
import {promises as fs } from 'fs'
import _ from 'lodash'
import copy from 'recursive-copy'

async function copyStripped(srcDir: string, bookStripped: Object, metadataStriped: Object, dstDir: string, paths: string[]): Promise<void> {
  paths.push('.guides/**')
  paths.push('.codio')
  paths.push('.codio-menu')
  paths.push('.settings')
  paths.push('!.github/**')
  paths.push('!.github')
  await copy(srcDir, dstDir, {
    filter: paths,
    overwrite: true,
    dot: true
  })
  const bookJsonPath = path.join(dstDir, '.guides', 'book.json')
  const metadataPath = path.join(dstDir, '.guides', 'metadata.json')
  await fs.mkdir(path.join(srcDir, '.guides'), {recursive: true})
  await fs.writeFile(bookJsonPath, JSON.stringify(bookStripped, undefined, ' '))
  await fs.writeFile(metadataPath, JSON.stringify(metadataStriped, undefined, ' '))
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

async function reduce(srcDir: string, dstDir: string, sections: string[][], paths: string[]): Promise<void> {
  const bookJsonPath = path.join(srcDir, '.guides', 'book.json')
  const metadataPath = path.join(srcDir, '.guides', 'metadata.json')

  const bookJson = await fs.readFile(bookJsonPath, { encoding: 'utf-8' })
  const book = JSON.parse(bookJson)
  const metadataJson = await fs.readFile(metadataPath, { encoding: 'utf-8' })
  const metadata = JSON.parse(metadataJson)

  const bookStripped = stripBook(book, sections)
  const excludePaths = stripMetadata(metadata, bookStripped)
  await copyStripped(srcDir, bookStripped, metadata, dstDir, paths.concat(excludePaths))
}

const tools = {
  reduce
}

export default tools
