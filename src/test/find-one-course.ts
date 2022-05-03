import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'

const client_id = process.env.CLIENT_ID || '' // your clientId here
const secret_id = process.env.SECRET_ID || '' // your secretId here

const courseName = 'course 1'
const courseId = 'e14d7ae7aa80059397886c7fcbe1b8f4'

const main = async () => {
    try {
        codio.v1.setDomain('test1-codio.com')
        const authRes = await codio.v1.auth(client_id, secret_id)
        console.log('authed', authRes)
        let courseInfo = await codio.v1.course.info(courseId)
        console.log('course by id', courseInfo)

        const courseWithUnits = await codio.v1.course.findOneByName(courseName)
        console.log('course by name', courseWithUnits)
        for (const unit of courseWithUnits.units) {
            console.log('unit', unit.id, unit.name)
            for (const assignment of unit.assignments) {
                console.log('assignment', assignment.id, assignment.name)
            }
        }

    } catch (error: any) {
        if (error.json) {
            console.log(await error.json())
        } else {
            console.log(error)
        }
    }
}

main()