const { codio, auth } = require('../auth.js')
const { courseId, userIdToAdd } = require('../data.js')

async function main() {
    await auth

    // Add the user as a read-only teacher (third param is optional; default is false)
    const result = await codio.course.addTeacher(courseId, userIdToAdd, true)
    console.log(result)

}

main()
