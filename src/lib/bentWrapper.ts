import bent from 'bent'

interface Headers {
    [key: string]: any;
}

const RETRIES_COUNT = 5

const waitTimeout = async (ms: number) => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

const encodings = new Set(['json', 'buffer', 'string'])
const getEncodingFromArgs = (...args: bent.Options[]) => {
    let encoding

    args.forEach(arg => {
        if (typeof arg === 'string') {
            if (arg.toUpperCase() === arg) {
                // ignore
            } else if (arg.startsWith('http:') || arg.startsWith('https:')) {
                // ignore
            } else {
                if (encodings.has(arg)) {
                    encoding = arg
                }
            }
        }
    })
    if (!encoding) {
        encoding = 'json'
    }
    return encoding
}

export default (...args: bent.Options[]) => {
    const api = bent(...args)
    const req = async (url: string, body?: bent.RequestBody | undefined, headers?: Headers | undefined, tries?: number | undefined): Promise<any> => {
        try {
            if (tries === 0) {
                throw Error('Tries limit exceeded')
            }
            const resp = await api(url, body, headers) as bent.NodeResponse
            const encoding = getEncodingFromArgs(args)

            if (!encoding) {
              return resp
            }

            if (encoding === 'buffer' && resp.arrayBuffer) {
              return resp.arrayBuffer()
            }

            if (encoding === 'json' && resp.json) {
              return resp.json()
            }

            if (encoding === 'string' && resp.text) {
              return resp.text()
            }

            return resp.json ? resp.json() : resp
        } catch (e: any) {
            if (e.statusCode === 429) {
                const dailyRemaining = e.headers['x-ratelimit-dailylimit-remaining']
                if (parseInt(dailyRemaining) === 0) {
                    throw e
                }
                const resetHeaderMs = e.headers['x-ratelimit-reset'] / 1000000
                await waitTimeout(resetHeaderMs)
                const triesCount = tries !== undefined && tries > 0 ? tries - 1 : RETRIES_COUNT
                return req(url, body, headers, triesCount)
            }
            throw e
        }
    }
    return req
}
