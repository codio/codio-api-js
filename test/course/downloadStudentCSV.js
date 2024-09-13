const { codio, auth } = require('../auth.js')
const { courseId, studentId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/student.csv'
    
    const result = await codio.course.downloadStudentCSV(courseId, studentId, filePath)

}

main()
