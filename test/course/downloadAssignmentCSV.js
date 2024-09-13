const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/assignment.csv'
    
    const result = await codio.course.downloadAssignmentCSV(courseId, assignmentId, filePath)

}

main()
