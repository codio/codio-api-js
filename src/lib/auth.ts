import querystring from 'querystring'
import bent from './bentWrapper'

const getJson = bent()

export async function auth(clientId: string, secretId: string, domain: string): Promise<string> {
  const params = {
    'grant_type': 'client_credentials',
    'client_id': clientId,
    'client_secret': secretId
  }
  const paramsString = querystring.encode(params)
  const url = `https://oauth.${domain}/api/v1/token?${paramsString}`

  const response = await getJson(url)

  return response['access_token']
}
