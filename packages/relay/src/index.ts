// Copyright 2024 nostr-relay authors & contributors
// SPDX-License-Identifier: Apache-2.0

// ported from nostr-tools

import { Event } from "nostr-messages/events";

import { Queue } from "nostr-utils/queue";
import { getHex64, getSubscriptionId, normalizeURL } from "nostr-utils"

import { Subscription, SubscriptionParams } from "./subscription";
import { Filter, matchFilters } from "nostr-messages/filter";

// TODO: strange shit
export async function yieldThread() {
  return new Promise<void>(resolve => {
    const ch = new MessageChannel()
    const handler = () => {
      // @ts-ignore (typescript thinks this property should be called `removeListener`, but in fact it's `removeEventListener`)
      ch.port1.removeEventListener('message', handler)
      resolve()
    }
    // @ts-ignore (typescript thinks this property should be called `addListener`, but in fact it's `addEventListener`)
    ch.port1.addEventListener('message', handler)
    ch.port2.postMessage(0)
    ch.port1.start()
  })
}

export class Relay {
  public readonly url: string
  private _connected: boolean = false;

  public baseEoseTimeout: number = 4400
  public connectionTimeout: number = 4400
  public openSubs: Map<string, Subscription> = new Map()

  public onclose: (() => void) | null = null
  public onnotice: (msg: string) => void = msg => console.debug(`NOTICE from ${this.url}: ${msg}`)

  private connectionTimeoutHandle: ReturnType<typeof setTimeout> | undefined

  private connectionPromise: Promise<void> | undefined
  private openCountRequests = new Map<string, CountResolver>()
  private openEventPublishes = new Map<string, EventPublishResolver>()
  private ws: WebSocket | undefined
  private incomingMessageQueue = new Queue<string>()
  private queueRunning = false
  private challenge: string | undefined
  private serial: number = 0

  constructor(url: string) {
    this.url = normalizeURL(url);
  }

  static async connect(url: string): Promise<Relay> {
    const relay = new Relay(url);
    await relay.connect()
    return relay;
  }

  public get connected(): boolean {
    return this._connected
  }

  public async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise

    this.challenge = undefined
    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionTimeoutHandle = setTimeout(() => {
        reject('connection timed out')
        this.connectionPromise = undefined
        this.onclose?.()
        this.closeAllSubscriptions('relay connection timed out')
      }, this.connectionTimeout)

      try {
        this.ws = new WebSocket(this.url)
      } catch (err) {
        reject(err)
        return
      }

      this.ws.onopen = () => {
        clearTimeout(this.connectionTimeoutHandle)
        this._connected = true
        resolve()
      }

      this.ws.onerror = ev => {
        reject((ev as any).message)
        if (this._connected) {
          this._connected = false
          this.connectionPromise = undefined
          this.onclose?.()
          this.closeAllSubscriptions('relay connection errored')
        }
      }

      this.ws.onclose = async () => {
        if (this._connected) {
          this._connected = false
          this.connectionPromise = undefined
          this.onclose?.()
          this.closeAllSubscriptions('relay connection closed')
        }
      }

      this.ws.onmessage = this._onmessage.bind(this)
    })

    return this.connectionPromise
  }

  private async runQueue() {
    this.queueRunning = true
    while (true) {
      if (false === this.handleNext()) {
        break
      }
      await yieldThread()
    }
    this.queueRunning = false
  }

  private handleNext(): undefined | false {
    const json = this.incomingMessageQueue.dequeue()
    if (!json) {
      return false
    }

    const subid = getSubscriptionId(json)
    if (subid) {
      const so = this.openSubs.get(subid as string)
      if (!so) {
        // this is an EVENT message, but for a subscription we don't have, so just stop here
        return
      }

      // this will be called only when this message is a EVENT message for a subscription we have
      // we do this before parsing the JSON to not have to do that for duplicate events
      //   since JSON parsing is slow
      const id = getHex64(json, 'id')
      const alreadyHave = so.alreadyHaveEvent?.(id)

      // notify any interested client that the relay has this event
      // (do this after alreadyHaveEvent() because the client may rely on this to answer that)
      so.receivedEvent?.(this, id)

      if (alreadyHave) {
        // if we had already seen this event we can just stop here
        return
      }
    }

    try {
      let data = JSON.parse(json)
      // we won't do any checks against the data since all failures (i.e. invalid messages from relays)
      // will naturally be caught by the encompassing try..catch block

      switch (data[0]) {
        case 'EVENT': {
          const so = this.openSubs.get(data[1] as string) as Subscription
          const event = data[2] as Event
          if (this.verifyEvent(event) && matchFilters(so.filters, event)) {
            so.onevent(event)
          }
          return
        }
        case 'COUNT': {
          const id: string = data[1]
          const payload = data[2] as { count: number }
          const cr = this.openCountRequests.get(id) as CountResolver
          if (cr) {
            cr.resolve(payload.count)
            this.openCountRequests.delete(id)
          }
          return
        }
        case 'EOSE': {
          const so = this.openSubs.get(data[1] as string)
          if (!so) return
          so.receivedEose()
          return
        }
        case 'OK': {
          const id: string = data[1]
          const ok: boolean = data[2]
          const reason: string = data[3]
          const ep = this.openEventPublishes.get(id) as EventPublishResolver
          if (ok) ep.resolve(reason)
          else ep.reject(new Error(reason))
          this.openEventPublishes.delete(id)
          return
        }
        case 'CLOSED': {
          const id: string = data[1]
          const so = this.openSubs.get(id)
          if (!so) return
          so.closed = true
          so.close(data[2] as string)
          return
        }
        case 'NOTICE':
          this.onnotice(data[1] as string)
          return
        case 'AUTH': {
          this.challenge = data[1] as string
          return
        }
      }
    } catch (err) {
      return
    }
  }

  public async send(message: string) {
    if (!this.connectionPromise) throw new Error('sending on closed connection')

    this.connectionPromise.then(() => {
      this.ws?.send(message)
    })
  }

  // public async auth(signAuthEvent: (evt: EventTemplate) => Promise<VerifiedEvent>): Promise<string> {
  //   if (!this.challenge) throw new Error("can't perform auth, no challenge was received")
  //   const evt = await signAuthEvent(makeAuthEvent(this.url, this.challenge))
  //   const ret = new Promise<string>((resolve, reject) => {
  //     this.openEventPublishes.set(evt.id, { resolve, reject })
  //   })
  //   this.send('["AUTH",' + JSON.stringify(evt) + ']')
  //   return ret
  // }

  public async publish(event: Event): Promise<string> {
    const ret = new Promise<string>((resolve, reject) => {
      this.openEventPublishes.set(event.id, { resolve, reject })
    })
    this.send('["EVENT",' + JSON.stringify(event) + ']')
    return ret
  }

  public async count(filters: Filter[], params: { id?: string | null }): Promise<number> {
    this.serial++
    const id = params?.id || 'count:' + this.serial
    const ret = new Promise<number>((resolve, reject) => {
      this.openCountRequests.set(id, { resolve, reject })
    })
    this.send('["COUNT","' + id + '",' + JSON.stringify(filters) + ']')
    return ret
  }

  public subscribe(filters: Filter[], params: Partial<SubscriptionParams>): Subscription {
    const subscription = this.prepareSubscription(filters, params)
    subscription.fire()
    return subscription
  }

  public prepareSubscription(filters: Filter[], params: Partial<SubscriptionParams> & { id?: string }): Subscription {
    this.serial++
    const id = params.id || 'sub:' + this.serial
    const subscription = new Subscription(this, id, filters, params)
    this.openSubs.set(id, subscription)
    return subscription
  }

  public close() {
    this.closeAllSubscriptions('relay connection closed by us')
    this._connected = false
    this.ws?.close()
  }

  // this is the function assigned to this.ws.onmessage
  // it's exposed for testing and debugging purposes
  public _onmessage(ev: MessageEvent<any>) {
    this.incomingMessageQueue.enqueue(ev.data as string)
    if (!this.queueRunning) {
      this.runQueue()
    }
  }


  /* Private */
  private verifyEvent(events: Event): boolean {
    return true;
  }

  private closeAllSubscriptions(reason: string) {
    for (let [_, sub] of this.openSubs) {
      sub.close(reason)
    }
    this.openSubs.clear()

    for (let [_, ep] of this.openEventPublishes) {
      ep.reject(new Error(reason))
    }
    this.openEventPublishes.clear()

    for (let [_, cr] of this.openCountRequests) {
      cr.reject(new Error(reason))
    }
    this.openCountRequests.clear()
  }
}

export type CountResolver = {
  resolve: (count: number) => void
  reject: (err: Error) => void
}

export type EventPublishResolver = {
  resolve: (reason: string) => void
  reject: (err: Error) => void
}
