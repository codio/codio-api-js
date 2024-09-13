const { codio, auth } = require('../auth.js')
const { stackId } = require('../data.js')

async function main() {
    await auth    
    const buildingStackId = "your building stack id"
    const provisioner = "bash" // or ansible
    const content = "sudo apt install htop"   
    const archivePath = "./examples/stack/files/bash.tar.gz"
    const message = "message"
    
    const result = await codio.stack.publish(buildingStackId, stackId, provisioner, content, archivePath, message)
    console.log(result)
    const res = await codio.stack.waitTask(result.taskUri)

}

main()
