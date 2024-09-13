const { codio, auth } = require('../auth.js')

async function main() {
    await auth    
    const all_events = await codio.events.loadAllEvents()
    console.log(all_events)
    console.log(all_events.length)

}

main()
