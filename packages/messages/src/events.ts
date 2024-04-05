// Copyright 2024 nostr-messages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Hex } from "viem";
import type { Hex32 } from ".";

import { z } from "zod";
import { Sender, senderToBytes } from "./sender";
import { sha256Hash } from "nostr-utils/crypto";
import { toHex } from "viem";
import { hex32Schema, hexStringAnyLenSchema } from ".";

export const eventSchema = z.object({
  kind: z.number(),
  tags: z.array(z.tuple([z.string(), z.string()])),
  content: z.string(),
  created_at: z.number().int().positive().safe(),

  sender: hexStringAnyLenSchema(),
  id: hex32Schema,
  sig: hexStringAnyLenSchema(),
});

export const partialEventSchema = eventSchema.partial({
  sender: true,
  id: true,
  sig: true,
});

export type PartialEvent = z.infer<typeof partialEventSchema>;
export type Event = z.infer<typeof eventSchema>;

export function eventToId(e: PartialEvent): Hex32 {
  const serializedEvent = JSON.stringify([
    0,
    e.sender,
    e.created_at,
    e.kind,
    e.tags,
    e.content,
  ]);

  console.log(serializedEvent)
  const hash = sha256Hash(new TextEncoder().encode(serializedEvent));
  return hex32Schema.parse(toHex(hash).substring(2));
}

export function buildEvent(e: PartialEvent, sender: Sender, sig: Hex): Event {
  e.sender = senderToBytes(sender).substring(2);
  const id = eventToId(e);
  const s = hexStringAnyLenSchema().parse(sig.substring(2));

  return eventSchema.parse({
    kind: e.kind,
    tags: e.tags,
    content: e.content,
    created_at: e.created_at,

    id,
    sender: e.sender,
    sig: s.substring(2),
  });
}
