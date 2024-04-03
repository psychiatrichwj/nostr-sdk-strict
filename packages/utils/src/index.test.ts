// Copyright 2024 nostr-utils authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { expect, test, describe } from "bun:test";

import * as Utils from ".";

describe("nostr-utils", () => {
  test("isValidHex", () => {
    const hex = ["aa", "a", "1234", "sdjf", "asdfasdfasdf"];
    const expectedResult = [true, false, true, false, false];

    const result = hex.map(Utils.isValidHex);

    expect(result).toEqual(expectedResult);
  });

  test("hex <> u8a", () => {
    const hex = "1212121212";
    const u8a = Utils.hexToU8a(hex);
    const hex2 = Utils.u8aToHex(u8a);
    expect(hex2).toEqual(hex);
  });

  test("u32 <> u8a", () => {
    const number = 1234;
    const u8a = Utils.u32ToU8a(number);
    const number2 = Utils.u8aToU32(u8a);
    expect(number2).toEqual(number);
  });
});
