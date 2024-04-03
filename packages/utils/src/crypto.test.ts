// Copyright 2024 nostr-utils authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { expect, test, describe } from "bun:test";

import * as Utils from ".";

describe("nostr-utils/utils/crypto", () => {
  test("generate randomness", () => {
    const result = Utils.secureGenerateRandom();

    expect(result.length).toEqual(32);
  });
});
