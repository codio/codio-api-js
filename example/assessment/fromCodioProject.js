const { codio, auth } = require('../auth.js')
const { libraryId, libraryName, projectPath } = require('../data.js')

async function main() {
  
    await auth

    const result  = await codio.assessment.fromCodioProject(libraryId, projectPath)
    // const result  = await codio.assessment.fromCodioProject(libraryName, projectPath)
    console.log(result)
    
}

main()
