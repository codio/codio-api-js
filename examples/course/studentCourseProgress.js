const { codio, auth } = require('../auth.js')
const {courseId, studentId, studentEmail, studentLogin } = require('../data.js')

async function main() {
    await auth
    
    const result = await codio.course.studentCourseProgress(courseId, studentId)
    // const result = await codio.course.studentCourseProgress(courseId, studentEmail)
    // const result = await codio.course.studentCourseProgress(courseId, studentLogin)

    console.log(result)
    
}

main()
