const { codio, auth } = require('../auth.js')
const { courseIdToArchive } = require('../data.js')

async function main() {
    await auth

    const result = await codio.course.archive(courseIdToArchive)
    console.log(result)
}

main()
