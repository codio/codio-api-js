const { codio, auth } = require('../auth.js')
const { assignmentId, courseId } = require('../data.js')

async function main() {
    await auth
    projectPath = 'your archive file path'
    stackVersionId = "your stack version id"            
    changelog = 'test'
    data = {changelog: changelog, stack: `${stackVersionId}:latest`, withStackUpdate: true}

    const result = await codio.assignment.publishArchive(courseId, assignmentId, projectPath, data)
}

main()
