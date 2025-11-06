const { codio, auth } = require('../auth.js')
const { courseId, userIdToAdd } = require('../data.js')

async function main() {
    await auth

    const result = await codio.course.addTeacher(courseId, userIdToAdd)
    console.log(result)

}

main()
