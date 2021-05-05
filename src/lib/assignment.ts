import fs from 'fs'
import path from 'path'
import bent from 'bent'
import FormData from 'form-data'
import tar from 'tar'

import config from './config'

async function archiveTar(src: string): Promise<{ file: string; dir: string; }> {
  const dir = await fs.promises.mkdtemp('codio_export')
  const file = path.join(dir, 'project.tar.gz')
  await tar.c(
    {
      gzip: true,
      file,
      cwd: src
    },
    ['./']
  )
  return {file, dir}
}

const sleep = async (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000))

const getJson = bent('json')

async function publishArchive (courseId: string, assignmentId:string, archivePath: string, changelog: string) {
  if (!config) {
    throw new Error('No Config')
  }
  try {
    const token = config.getToken()
    const domain = config.getDomain()
    const authHeaders = {
      'Authorization': 'Bearer ' + token
    }

    const api = bent(`https://octopus.${domain}`, 'POST', 'json', 200)

    const postData = new FormData();
    postData.append('changelog', changelog)
    postData.append('archive', fs.createReadStream(archivePath),  {
      knownLength: fs.statSync(archivePath).size
    })
    const headers = Object.assign(postData.getHeaders(), authHeaders)
    headers['Content-Length'] = await postData.getLengthSync()
    const res = await api(`/api/v1/courses/${courseId}/assignments/${assignmentId}/versions`,
      postData, headers);
    const taskUrl = res['taskUri']
    if (!taskUrl) {
      throw new Error('task Url not found')
    }
    for (let i = 0; i < 100; i++) { // 100 checks attempt
      await sleep(10)
      const status = await getJson(taskUrl, undefined, authHeaders)
      if (status['done']) {
        if (status['error']) {
          throw new Error(status['error'])
        }
        break
      }

    }
  } catch (error) {
    if (error.json) {
      console.log(await error.json())
    }
  }
}

const assignment = {
  publish: async (courseId: string, assignmentId: string, projectPath: string, changelog: string) => {
    const {file, dir} = await archiveTar(projectPath)
    await assignment.publishArchive(courseId, assignmentId, file, changelog)
    fs.rmdirSync(dir, {recursive: true})
  },
  publishArchive,
}

export default assignment