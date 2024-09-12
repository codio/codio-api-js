const { codio, auth } = require('../auth.js')

async function main() {
    await auth    
    const result = await codio.assessment.listLibraries()
    console.log(result)
    
}

main()