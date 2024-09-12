const { codio, auth } = require('../auth.js')
const { courseId, studentId } = require('../data.js')

async function main() {
    await auth
    
    const result = await codio.course.exportStudentCSV(courseId, studentId)
    console.log(result)
}

main()