import config from './lib/config'
import { auth } from './lib/auth'
import tools from './lib/tools'
import assignment from './lib/assignment'

export const v1 = {
  setDomain: (domain: string) => config.setDomain(domain),
  setAuthToken: (token: string) => config.setToken(token),
  auth: async (clientId: string, secretId: string) => {
    const token = await auth(clientId, secretId, config.getDomain())
    v1.setAuthToken(token)
    return token
  },
  tools,
  assignment
}
