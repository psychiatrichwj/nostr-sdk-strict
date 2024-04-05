// Copyright 2024 nostr-utils authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { secureGenerateRandom } from "./crypto";

export const isValidHex = (str: string): boolean => {
  return (str.length & 1) === 0 && /^[0-9A-Fa-f]*$/g.test(str);
};

export const hexToU8a = (hex: string): Uint8Array => {
  if (isValidHex(hex)) {
    const bytes = hex.match(/[0-9A-Fa-f]{1,2}/g);
    if (bytes) {
      return new Uint8Array(bytes.map((byte) => parseInt(byte, 16)));
    }
    throw new Error("invalid hex string: Util.hexToU8a");
  }
  throw new Error("invalid hex string: Util.hexToU8a");
};

export const u8aToHex = (bytes: Uint8Array): string =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

export const toBase64 = (x: string): string =>
  Buffer.from(x, "binary").toString("base64");

export const fromBase64 = (x: string): string =>
  Buffer.from(x, "base64").toString("binary");

export const stringToU8a = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

export const u8aToString = (u8a: Uint8Array): string => {
  return new TextDecoder("utf-8").decode(u8a);
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function u32ToU8a(long: number): Uint8Array {
  const byteArray = [0, 0, 0, 0];
  let num = long;

  for (let index = 0; index < byteArray.length; index++) {
    const byte = num & 0xff;
    byteArray[index] = byte;
    num = (num - byte) / 256;
  }

  return Uint8Array.from(byteArray);
}

export function u8aToU32(byteArray: Uint8Array): number {
  let value = 0;
  for (let i = byteArray.length - 1; i >= 0; i--) {
    value = value * 256 + byteArray[i];
  }

  return value;
}

export function normalizeURL(url: string): string {
  if (url.indexOf('://') === -1) url = 'wss://' + url
  let p = new URL(url)
  p.pathname = p.pathname.replace(/\/+/g, '/')
  if (p.pathname.endsWith('/')) p.pathname = p.pathname.slice(0, -1)
  if ((p.port === '80' && p.protocol === 'ws:') || (p.port === '443' && p.protocol === 'wss:')) p.port = ''
  p.searchParams.sort()
  p.hash = ''
  return p.toString()
}

export function getHex64(json: string, field: string): string {
  let len = field.length + 3
  let idx = json.indexOf(`"${field}":`) + len
  let s = json.slice(idx).indexOf(`"`) + idx + 1
  return json.slice(s, s + 64)
}


export function getSubscriptionId(json: string): string | null {
  let idx = json.slice(0, 22).indexOf(`"EVENT"`)
  if (idx === -1) return null

  let pstart = json.slice(idx + 7 + 1).indexOf(`"`)
  if (pstart === -1) return null
  let start = idx + 7 + 1 + pstart

  let pend = json.slice(start + 1, 80).indexOf(`"`)
  if (pend === -1) return null
  let end = start + 1 + pend

  return json.slice(start + 1, end)
}

export { secureGenerateRandom };
