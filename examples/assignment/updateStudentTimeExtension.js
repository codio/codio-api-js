const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, studentId } = require('../data.js')

async function main() {
    await auth
    
    const result = await codio.assignment.updateStudentTimeExtension(courseId, assignmentId, studentId, {
        extendedDeadline: 55,
        extendedTimeLimit: '22'
    })
    console.log(result)
    
}

main()
