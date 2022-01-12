import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'

const client_id = process.env.CLIENT_ID // your clientId here
const secret_id = process.env.SECRET_ID // your secretId here

const stackId = 'a66f9cf1-b2db-4923-a2e6-5164dda2e678'
// const stackId = '00112233-4455-6677-8899-aabbccddeeff'
// ANSIBLE or BASH
const provisioner = 'ansible'
const id = 'a66f9cf1-b2db-4923-a2e6-5164dda2e678'
// const id = 'c335de9e-4744-4f28-ba3b-0f6420e3e324'
// const test_id = 'not_exist'
// const content = null
const content = '#!/bin/bash\necho "content"\nls -al\nexit 0'
// const bundlePath = 'files/ruby.tar.gz'
const bundlePath = null
const message = 'only content check'

const main = async () => {
    try {
        // oauth
        codio.v1.setDomain('codio.test:15598')
        const accessToken = await codio.v1.auth(client_id, secret_id)
        console.log('accessToken', accessToken)
        // octopus
        codio.v1.setDomain('codio.test:15594')
        const stack = await codio.v1.stack.info(stackId)
        console.log('got stack:', JSON.stringify(stack))
        const res = await codio.v1.stack.publish(stackId, id, provisioner, content, bundlePath, message)
        console.log('got publish task:', res)

        let taskUri = res.taskUri
        taskUri = taskUri.replace('https://octopus.codio.test', 'http://codio.test:15594')
        console.log('taskUri', taskUri)
        const taskRes = await codio.v1.stack.waitTask(taskUri)
        console.log('taskRes', taskRes)
    } catch (error: any) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()