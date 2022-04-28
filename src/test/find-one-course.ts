import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'

const client_id = process.env.CLIENT_ID || '' // your clientId here
const secret_id = process.env.SECRET_ID || '' // your secretId here

const courseName = 'course'

const main = async () => {
    try {
        codio.v1.setDomain('test2-codio.com')
        await codio.v1.auth(client_id, secret_id)
        await codio.v1.course.findOneByName(courseName)
    } catch (error) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()