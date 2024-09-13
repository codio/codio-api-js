const library = require('../lib')
const codio = library.default.v1

codio.setDomain('codio.com') // codio.co.uk for UK domain
const auth = codio.auth(`your client_id`, `your client_secret`)

module.exports = { codio, auth }
