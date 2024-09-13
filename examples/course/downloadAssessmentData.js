const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/assessmentData.csv'
    
    const result = await codio.course.downloadAssessmentData(courseId, assignmentId, filePath)

}

main()
