// Copyright 2024 nostr-relay authors & contributors
// SPDX-License-Identifier: Apache-2.0

// ported from nostr-tools

import { Filter } from "nostr-messages/filter"
import { Relay } from "."
import { Event } from "nostr-messages/events"

export class Subscription {
    public readonly relay: Relay
    public readonly id: string
  
    public closed: boolean = false
    public eosed: boolean = false
    public filters: Filter[]
    public alreadyHaveEvent: ((id: string) => boolean) | undefined
    public receivedEvent: ((relay: Relay, id: string) => void) | undefined
  
    public onevent: (evt: Event) => void
    public oneose: (() => void) | undefined
    public onclose: ((reason: string) => void) | undefined
  
    public eoseTimeout: number
    private eoseTimeoutHandle: ReturnType<typeof setTimeout> | undefined
  
    constructor(relay: Relay, id: string, filters: Filter[], params: SubscriptionParams) {
      this.relay = relay
      this.filters = filters
      this.id = id
      this.alreadyHaveEvent = params.alreadyHaveEvent
      this.receivedEvent = params.receivedEvent
      this.eoseTimeout = params.eoseTimeout || relay.baseEoseTimeout
  
      this.oneose = params.oneose
      this.onclose = params.onclose
      this.onevent =
        params.onevent ||
        (event => {
          console.warn(
            `onevent() callback not defined for subscription '${this.id}' in relay ${this.relay.url}. event received:`,
            event,
          )
        })
    }
  
    public fire() {
      this.relay.send('["REQ","' + this.id + '",' + JSON.stringify(this.filters).substring(1))
  
      // only now we start counting the eoseTimeout
      this.eoseTimeoutHandle = setTimeout(this.receivedEose.bind(this), this.eoseTimeout)
    }
  
    public receivedEose() {
      if (this.eosed) return
      clearTimeout(this.eoseTimeoutHandle)
      this.eosed = true
      this.oneose?.()
    }
  
    public close(reason: string = 'closed by caller') {
      if (!this.closed && this.relay.connected) {
        // if the connection was closed by the user calling .close() we will send a CLOSE message
        // otherwise this._open will be already set to false so we will skip this
        this.relay.send('["CLOSE",' + JSON.stringify(this.id) + ']')
        this.closed = true
      }
      this.relay.openSubs.delete(this.id)
      this.onclose?.(reason)
    }
  }
  
  export type SubscriptionParams = {
    onevent?: (evt: Event) => void
    oneose?: () => void
    onclose?: (reason: string) => void
    alreadyHaveEvent?: (id: string) => boolean
    receivedEvent?: (relay: Relay, id: string) => void
    eoseTimeout?: number
  }