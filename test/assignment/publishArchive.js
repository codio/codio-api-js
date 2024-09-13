const { codio, auth } = require('../auth.js')
const { assignmentId, courseId, stackVersionId, archivePath } = require('../data.js')

async function main() {
    await auth         

    changelog = 'changelog value'
    data = {changelog: changelog, stack: `${stackVersionId}:latest`, withStackUpdate: true}

    const result = await codio.assignment.publishArchive(courseId, assignmentId, archivePath, data)
}

main()
