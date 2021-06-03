import config from './lib/config'
import { auth } from './lib/auth'
import tools from './lib/tools'
import assignment from './lib/assignment'

export const v1 = {
  setDomain: (_: string) => config.setDomain(_),
  setAuthToken: (_: string) => config.setToken(_),
  auth: async (clientId: string, secretId: string): Promise<string> => {
    const token = await auth(clientId, secretId, config.getDomain())
    v1.setAuthToken(token)
    return token
  },
  tools,
  assignment
}
