const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, studentId } = require('../data.js')

async function main() {
    await auth
    
    const result = await codio.course.exportStudentAssignment(courseId, assignmentId, studentId)
    console.log(result)
}

main()