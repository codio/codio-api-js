const { codio, auth } = require('../auth.js')

async function main() {
    await auth

    const result = await codio.course.list()
    console.log(result)
}

main()
