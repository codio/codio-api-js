const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, studentId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/export_work.zip'
    
    const result = await codio.course.downloadWorkExport(courseId, filePath)

}

main()
