import bent from './bentWrapper'
import FormData from 'form-data'
import fs from 'fs'

import config from './config'
import {getApiV1Url, getBearer} from './tools'
const getJson = bent()

export type StackVersion = {
    id: string,
    changelog: string,
    date: Date
}

export type Stack = {
    id: string,
    name: string,
    short_description: string,
    long_description: string,
    owner: string,
    owner_type: string,
    versions: StackVersion[],
    installations: number
}

export async function info(stackId: string): Promise<Stack> {
    if (!config) {
        throw new Error('No Config')
    }

    try {
        return getJson(`${getApiV1Url()}/stacks/${stackId}`, undefined, getBearer())
    } catch (error: any) {
        if (error.json) {
            const message = JSON.stringify(await error.json())
            throw new Error(message)
        }
        throw error
    }
}

export async function publish(
    stackId: string,
    id: string | null,
    provisioner: string,
    content: string | null,
    archivePath: string | null,
    message: string
): Promise<any> {
    if (!config) {
        throw new Error('No Config')
    }

    try {
        const api = bent(getApiV1Url, 'POST', 200)
        
        const postData = new FormData()
        postData.append('provisioner', provisioner)
        if (archivePath !== null) {
            postData.append('files', fs.createReadStream(archivePath), {
                knownLength: fs.statSync(archivePath).size
            })
        }
        if (id !== null) {
            postData.append('id', id)
        }
        if (content !== null) {
            postData.append('content', content)
        }
        postData.append('message', message)
        
        const headers = Object.assign(postData.getHeaders(), getBearer())
        headers['Content-Length'] = await postData.getLengthSync()
        
        console.log('headers', headers)
        console.log('data', postData)

        const res = await api(`/stacks/${stackId}/versions`, postData, headers)
        console.log('publish result', res)
        return res
    } catch (error: any) {
        if (error.json) {
            const message = JSON.stringify(await error.json())
            throw new Error(message)
        }
        throw error
    }
}

export async function waitTask(taskUrl: string): Promise<string> {
    if (!config) {
        throw new Error('No Config')
    }

    try {
        const res = await getJson(taskUrl, undefined, getBearer())
        console.log('waitTask', res)
        if (res.status !== 'done' && res.status !== 'error') {
            await new Promise(resolve => setTimeout(resolve, 500))
            return await waitTask(taskUrl)
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

const stack = {
    info,
    publish,
    waitTask
}
  
export default stack
