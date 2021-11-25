import codio from '../index'

const client_id = '2iHS4bkAfuQdyRD7l3lVJ4n9' // your clientId here
const secret_id = 'M96ke7mQs299L8KymPhXlNO4' // your secretId here

const stackId = 'a66f9cf1-b2db-4923-a2e6-5164dda2e678'
// const stackId = '00112233-4455-6677-8899-aabbccddeeff'
// ANSIBLE or BASH
const provisioner = 'BASH'
const id = null
const content = 'ls\nexit 0'
const bundlePath = null //'files/ruby.tar.gz'
const message = 'new version message'

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
    } catch (error) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()