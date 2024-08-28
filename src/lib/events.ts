import querystring from 'querystring'
import bent from './bentWrapper'
import config from './config'
import {getApiV1Url, getBearer} from './tools'
const getJson = bent()

export type Event = {
  id: string,
  event: any,
  completed: boolean,
  error?: string,
  issuedAt: Date
}

export type LoadEventResponse = {
  events: Event[],
  nextToken: string
}

export async function loadEvents(nextToken: string, limit=50): Promise<LoadEventResponse> {
    if (!config) {
        throw new Error('No Config')
    }
    const query: any = {}
    if (limit && (limit >= 10 && limit <= 200)) {
      query.limit = limit
    }
    if (nextToken) {
      query.nextToken = nextToken
    }
    const paramsString = querystring.encode(query)
    const url = `${getApiV1Url()}/events?${paramsString}`

    try {
        return getJson(url, undefined, getBearer())
    } catch (error: any) {
        if (error.json) {
            const message = JSON.stringify(await error.json())
            throw new Error(message)
        }
        throw error
    }
}

export async function loadAllEvents(): Promise<Event[]> {
  let events: Event[] = []
  let nextToken = ''
  do {
    const resp = await loadEvents(nextToken)
    events = events.concat(resp.events)
    nextToken = resp.nextToken
  } while (nextToken)
  return events
}
