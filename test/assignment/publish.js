const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, projectPath, stackVersionId } = require('../data.js')

async function main() {
    await auth

    changelog = 'test'
    data = {changelog: changelog, stack: `${stackVersionId}:latest`, withStackUpdate: true}

    const result = await codio.assignment.publish(courseId, assignmentId, projectPath, data)
    
}

main()