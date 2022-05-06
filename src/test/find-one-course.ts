import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'

const client_id = process.env.CLIENT_ID || '' // your clientId here
const secret_id = process.env.SECRET_ID || '' // your secretId here

const courseName = 'course 1'
const courseId = 'e2842655b02e4620560fa753d8f5519a'

const main = async () => {
    try {
        codio.v1.setDomain('test1-codio.com')
        const authRes = await codio.v1.auth(client_id, secret_id)
        console.log('authed', authRes)
        const courseInfo = await codio.v1.course.info(courseId)
        console.log('course by id', courseInfo)
        for (const unit of courseInfo) {
            console.log('unit', unit.id, unit.name)
            for (const assignment of unit.assignments) {
                console.log('assignment', assignment.id, assignment.name)
            }
        }

        const courseWithUnits = await codio.v1.course.findOneByName(courseName, true)
        console.log('course by name', courseWithUnits)
        for (const unit of courseWithUnits.modules) {
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