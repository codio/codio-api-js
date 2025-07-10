const { codio, auth } = require('../auth.js')
const { courseId, leanersMapping } = require('../data.js')

async function main() {
    await auth

    const compelted = await codio.course.filterLearnersForMentors(courseId, leanersMapping)
    console.log('compelted', compelted)

}

main()
