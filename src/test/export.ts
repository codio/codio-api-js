import dotenv = require('dotenv')
dotenv.config()

import codio from '../index'


const clientId = process.env.CLIENT_ID || '' // your clientId here
const secretId = process.env.SECRET_ID || '' // your secretId here
const courseId = ''

const main = async () => {
  try {
    const api = codio.v1
    api.setDomain('codio.test')
    const accessToken = await api.auth(clientId, secretId)
    api.setAuthToken(accessToken)
    const resp1 = await api.course.getSourceExports(courseId)
    console.log('resp1', resp1)

    const resp2 = await api.course.getWorkExports(courseId)
    console.log('resp2', resp2)

    const resp3 = await api.course.createSourceExport(courseId)
    console.log('resp3', resp3)

    const resp4 = await api.course.createWorkExport(courseId)
    console.log('resp4', resp4)

  } catch (ex) {
    console.error(ex)
  }
}

main()
