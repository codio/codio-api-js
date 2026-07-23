const { codio, auth } = require('../auth.js')

async function main() {
    await auth
    await codio.course.deleteCourse({id: "your course id", removeOutdatedStudents: false})
}

main()
