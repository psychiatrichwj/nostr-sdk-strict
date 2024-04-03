// Copyright 2024 nostr-messages authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { z } from "zod";

export const hexStringSchema = (len: number) =>
  z
    .string()
    .length(len * 2, "id should be a hex string of 32 bytes")
    .regex(/^[a-fA-F0-9]+$/);

export const hexStringAnyLenSchema = () => z.string().regex(/^[a-fA-F0-9]+$/);

export const hex32Schema = hexStringSchema(32);
