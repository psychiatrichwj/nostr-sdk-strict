// Copyright 2024 nostr-messages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Hex } from "viem";
import { z } from "zod";
import { encodePacked, toBytes, toHex } from "viem";
import { u32ToU8a, u8aToU32 } from "nostr-utils";

const hexStringSchema = () => z.string().regex(/^[a-fA-F0-9]+$/);

export const senderTypeEnum = z.enum([
  "SchnorrPubkey",
  "EoaAddress",
  "ContractAddress",
  "Ens",
]);

export const senderSchema = z.object({
  type: senderTypeEnum,
  data: hexStringSchema(),
});

export type Sender = z.infer<typeof senderSchema>;
export type SenderType = z.infer<typeof senderTypeEnum>;

export function senderToBytes(s: Sender): Hex {
  let t: number;
  let data: string;

  switch (s.type) {
    case "SchnorrPubkey":
      t = 0;
      data = s.data;
      break;
    case "EoaAddress":
      t = 1;
      data = s.data;
      break;
    case "ContractAddress":
      t = 2;
      data = s.data;
      break;
    case "Ens":
      t = 3;
      data = s.data;
      break;
  }

  return encodePacked(["bytes4", "bytes"], [toHex(u32ToU8a(t)), toHex(data)]);
}

export function bytesToSender(bytes: Hex) {
  const b = toBytes(bytes);
  const type = b.slice(0, 4);
  const data = b.slice(4);

  const t = u8aToU32(type);

  switch (t) {
    case 0:
      return { type: "SchnorrPubkey", data: toHex(data) };
    case 1:
      return { type: "EoaAddress", data: toHex(data) };
    case 2:
      return { type: "ContractAddress", data: toHex(data) };
    case 3:
      return { type: "Ens", data: toHex(data) };
  }
}
