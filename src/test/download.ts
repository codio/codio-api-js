import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'

const client_id = process.env.CLIENT_ID || '' // your clientId here
const secret_id = process.env.SECRET_ID || '' // your secretId here

const courseId = 'd7fee75a4a26d1d1ea1de91b3bb8e072' // your course here
const assignmentId = '5aa20de4744c10d1a2d4130608bc95f9' // your assignment here
const studentId = '00112233-4455-6677-9995-81b80a402cbe'
const filePath = '1.zstd'


const main = async () => {
    try {
        codio.v1.setDomain('test2-codio.com')
        await codio.v1.auth(client_id, secret_id)
        await codio.v1.course.downloadStudentAssignment(courseId, assignmentId, studentId, filePath)
    } catch (error: any) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()