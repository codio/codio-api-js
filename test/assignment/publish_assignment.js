const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth
    projectPath = './'
    stackVersionId = "your stack version id"
    changelog = 'changelog description'
    data = {changelog: changelog, stack: `${stackVersionId}:latest`, withStackUpdate: true}

    const result = await codio.assignment.publish(courseId, assignmentId, projectPath, data)
    
}

main()
