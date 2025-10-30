const { codio, auth } = require('../auth.js')
const { courseData } = require('../data.js')

async function main() {
    await auth

    const result = await codio.course.createCourse(courseData)
    console.log(result)
}

main()
