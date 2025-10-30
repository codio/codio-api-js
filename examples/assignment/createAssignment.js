const { codio, auth } = require('../auth.js')
const { courseId, assignmentData } = require('../data.js')

async function main() {
    await auth

    const result = await codio.assignment.createAssignment(courseId, assignmentData)
    console.log(result)
}

main()
