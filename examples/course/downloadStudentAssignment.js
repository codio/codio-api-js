const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, studentId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/studentAssignmentArchive.tar.zst'
    
    const result = await codio.course.downloadStudentAssignment(courseId, assignmentId, studentId, filePath)

}

main()
