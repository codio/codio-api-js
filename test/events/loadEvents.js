const { codio, auth } = require('../auth.js')

async function main() {
    await auth
    const resp = await codio.events.loadEvents(null, 10)
    console.log(resp.events)
    console.log(resp.events.length)
}

main()