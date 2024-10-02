const { codio, auth } = require('../auth.js')
const { courseId } = require('../data.js')

async function main() {
    await auth

    const result = await codio.course.exportLLMProxyData(courseId)
    console.log(result)
}

main()
