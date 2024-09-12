const { codio, auth } = require('../auth.js')

async function main() {
    await auth    
    stackId = 'your stack id'
    
    const stack = await codio.stack.info(stackId)
    console.log(stack)
}

main()
