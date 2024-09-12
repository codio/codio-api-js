const { codio, auth } = require('../auth.js')
const { libraryId, libraryName } = require('../data.js')

async function main() {
  
    await auth
    dir =  './'
    // dir = './path'
    const result  = await codio.assessment.fromCodioProject(libraryId, dir)
    // const result  = await codio.assessment.fromCodioProject(libraryName, './')
    console.log(result)
    
}

main()