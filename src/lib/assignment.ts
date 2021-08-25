import fs from 'fs'
import path from 'path'
import bent from 'bent'
import FormData from 'form-data'
import tar from 'tar'
import glob from 'glob-promise'
import YAML from 'yaml'
import tools from './tools'
import config, {excludePaths} from './config'
import _ from 'lodash'

type YamlRaw = {
  assignment: string
  paths: string[] | undefined
  section: string | string[]
}

type Yaml = {
  assignment: string
  paths: string[]
  section: string[][]
}

async function archiveTar(src: string): Promise<{ file: string; dir: string; }> {
  const dir = await fs.promises.mkdtemp('/tmp/codio_export')
  const file = path.join(dir, 'project.tar.gz')
  await tar.c(
    {
      gzip: true,
      file,
      cwd: src,
      filter: (path: string) => {
        for (const exclude of excludePaths) {
          if (_.startsWith(path, exclude)) {
            return false
          }
        }
        return true
      }
    },
    ['./']
  )
  return {file, dir}
}

const sleep = async (seconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const getJson = bent('json')

async function publishArchive (courseId: string, assignmentId:string, archivePath: string, changelog: string): Promise<void> {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': `Bearer ${token}`
    }

    const api = bent(`https://octopus.${domain}`, 'POST', 'json', 200)

    const postData = new FormData()
    postData.append('changelog', changelog)
    postData.append('archive', fs.createReadStream(archivePath),  {
      knownLength: fs.statSync(archivePath).size
    })
    const headers = Object.assign(postData.getHeaders(), authHeaders)
    headers['Content-Length'] = await postData.getLengthSync()
    const res = await api(`/api/v1/courses/${courseId}/assignments/${assignmentId}/versions`,
      postData, headers)
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    for (let i = 0; i < 100; i++) { // 100 checks attempt
      await sleep(10)
      const status = await getJson(taskUrl, undefined, authHeaders)
      console.log(status)
      if (status['done']) {
        if (status['error']) {
          throw new Error(status['error'])
        }
        break
      }
    }
  } catch (error) {
    if (error.json) {
      const message = JSON.stringify(await error.json())
      throw new Error(message)
    }
    throw error
  }
}

function validityState(ymls: YamlRaw[]): Yaml[] {
  const map: Map<string, Yaml> = new Map()
  for(const yml of ymls) {
    const section = _.isString(yml.section)? [yml.section] : yml.section
    if (map.has(yml.assignment)) {
      const item = map.get(yml.assignment)
      if (!item) {
        continue
      }
      item.section.push(section)
      item.paths = item.paths.concat(yml.paths || [])
    } else {
      map.set(yml.assignment, {
        assignment: yml.assignment,
        paths: yml.paths || [],
        section: [section]
      })
    }
  }

  return Array.from(map.values())
}

async function loadYaml(yamlDir: string): Promise<Yaml[]> {
  let res: YamlRaw[] = []
  const files = await glob('*.+(yml|yaml)', {cwd: yamlDir, nodir: true})
  for (const file of files) {
    const ymlText = await fs.promises.readFile(path.join(yamlDir, file), {encoding: 'utf-8'})
    let ymls: YamlRaw[] = YAML.parse(ymlText)
    if (!_.isArray(ymls)) {
      ymls = [ymls]
    }
    res = res.concat(ymls)
  }

  return validityState(res)
}

async function reducePublish(courseId: string, srcDir: string, yamlDir: string, changelog: string): Promise<void> {
  const ymlCfg = await loadYaml(yamlDir)
  for(const item of ymlCfg) {
    console.log(`publishing ${JSON.stringify(item)}`)
    const tmpDstDir = fs.mkdtempSync('/tmp/publish_codio_reduce')
    const paths = item.paths || []
    paths.push(`!${yamlDir}`) // exclude yaml directory from export
    paths.push(`!${yamlDir}/**`) // exclude yaml directory from export
    await tools.reduce(srcDir, tmpDstDir, item.section, paths)
    await assignment.publish(courseId, item.assignment, tmpDstDir, changelog)
    fs.rmdirSync(tmpDstDir, {recursive: true})
  }
}

const assignment = {
  publish: async (courseId: string, assignmentId: string, projectPath: string, changelog: string): Promise<void> => {
    const {file, dir} = await archiveTar(projectPath)
    await assignment.publishArchive(courseId, assignmentId, file, changelog)
    fs.rmdirSync(dir, {recursive: true})
  },
  publishArchive,
  reducePublish
}

export default assignment
