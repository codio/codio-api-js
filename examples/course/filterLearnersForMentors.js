const { codio, auth } = require('../auth.js')
const { courseId, leanersMapping } = require('../data.js')

async function main() {
    await auth

    const completed = await codio.course.filterLearnersForMentors(courseId, leanersMapping)
    console.log('completed', completed)
}

main()
