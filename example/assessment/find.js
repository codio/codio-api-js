const { codio, auth } = require('../auth.js')
const { libraryId, libraryName } = require('../data.js')

async function main() {
    await auth    
    const search = {"Assessment Type": "Advanced Code Test"}
    const result = await codio.assessment.find(libraryId, search)
    console.log(result)
    
}

main()
