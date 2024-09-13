const { codio, auth } = require('../auth.js')
const { stackId } = require('../data.js')

async function main() {
    await auth    
    
    const stack = await codio.stack.info(stackId)
    console.log(stack)
}

main()
