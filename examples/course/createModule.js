const { codio, auth } = require('../auth.js')
const { courseId, moduleName } = require('../data.js')

async function main() {
    await auth

    const result = await codio.course.createModule(courseId, moduleName)
    console.log(result)
}

main()