import bent from 'bent'

interface Headers {
    [key: string]: any;
}

const waitTimeout = async (ms: number) => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export default (...args: bent.Options[]) => {
    const api = bent.apply(null, args)
    const req = async (url: string, body?: bent.RequestBody | undefined, headers?: Headers | undefined): Promise<any> => {
        try {
            const resp = await api(url, body, headers) as bent.NodeResponse
            return await resp.json()
        } catch (e: any) {
            if (e.statusCode === 429) {
                const dailyRemaining = e.headers['x-ratelimit-dailylimit-remaining']
                if (parseInt(dailyRemaining) === 0) {
                    throw e
                }
                const resetHeaderMs = e.headers['x-ratelimit-reset'] / 1000000
                await waitTimeout(resetHeaderMs)
                return await req(url, body, headers)
            }
            throw e
        }
    }
    return req
}
