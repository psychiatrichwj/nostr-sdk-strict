// Copyright 2024 nostr-utils authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { utils as secpUtils } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha256";

// generate random Bytes32 in the secp256k1 field
export const secureGenerateRandom = (): Uint8Array => {
  return secpUtils.randomPrivateKey();
};

export const sha256Hash = (message: Uint8Array): Uint8Array => {
  return sha256(message);
};
