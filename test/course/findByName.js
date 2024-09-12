const { codio, auth } = require('../auth.js')
const { courseName} = require('../data.js')

async function main() {
    await auth
   
    const result = await codio.course.findByName(courseName, true)
    console.log(result)
        
}

main()