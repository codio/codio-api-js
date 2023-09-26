const VALID_DOMAINS=[
  'codio.com',
  'codio.co.uk',
  'codiodev.com',
  'test1-codio.com',
  'test2-codio.com',
  'codio.test:15598',
  'codio.test:15594'
]

class Config {
  private domain = 'codio.com'
  private token: string | null = null

  public setDomain(domain: string): void {
    if (!VALID_DOMAINS.includes(domain) ) {
      throw new Error('Invalid Domain')
    }
    this.domain = domain
  }

  public setToken (token: string) {
    this.token = token
  }

  public getToken(): string {
    if (this.token === null) {
      throw new Error('Not authenticated')
    }
    return this.token
  }
  public getDomain(): string {
    return this.domain
  }
}
const config = new Config()

export default config

export const excludePaths = []
