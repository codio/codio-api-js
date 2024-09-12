const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth
    
    const result = await codio.course.exportAssessmentData(courseId, assignmentId)
    console.log(result)
}

main()