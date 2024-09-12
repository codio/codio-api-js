const { codio, auth } = require('../auth.js')
const { courseId } = require('../data.js')

async function main() {
    await auth
    const taskId = 'your task id'
    
    const result = await codio.course.getWorkExportProgress(courseId, taskId)
    console.log(result)
}

main()
