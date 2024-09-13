const { codio, auth } = require('../auth.js')
const { courseId } = require('../data.js')

async function main() {
    await auth
    const filePath = '/home/codio/workspace/export_source.zip'
    
    const result = await codio.course.downloadSourceExport(courseId, filePath)

}

main()
