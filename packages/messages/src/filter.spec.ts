// Copyright 2024 nostr-messages authors & contributors
// SPDX-License-Identifier: Apache-2.0

// partially ported from nostr-tools

import { senderSchema, senderToBytes } from "./sender";

import { describe, test, expect } from "bun:test";
import {
  filterSchema,
  getFilterLimit,
  matchFilter,
  matchFilters,
  mergeFilters,
} from "./filter";
import { buildEvent, partialEventSchema } from "./events";

const sender = senderSchema.parse({
  type: "EoaAddress",
  data: "4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
});

// 7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b
const partial = partialEventSchema.parse({
  kind: 1,
  content: "hello",
  created_at: 150,
  tags: [["tag", "value"]],
});

const fakeSig = "0x000000";

describe("Filter", () => {
  describe("matchFilter", () => {
    test("should return true when all filter conditions are met", () => {
      const filter = filterSchema.parse({
        ids: [
          "7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b",
          "0000000000000000000000000000000000000000000000000000000000000000",
        ],
        kinds: [1, 2, 3],
        authors: [senderToBytes(sender).substring(2)],
        since: 1,
        until: 200,
        tags: { "#tag": ["value"] },
      });

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilter(filter, event);

      expect(result).toEqual(true);
    });

    test("should return false when the event id is not in the filter", () => {
      const filter = filterSchema.parse({
        ids: [
          "0000000000000000000000000000000000000000000000000000000000000000",
        ],
      });

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilter(filter, event);

      expect(result).toEqual(false);
    });

    test("should return false when the event kind is not in the filter", () => {
      const filter = filterSchema.parse({
        kinds: [2, 3],
      });

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilter(filter, event);

      expect(result).toEqual(false);
    });

    test("should return false when a tag is not present in the event", () => {
      const filter = filterSchema.parse({ tags: { "#non_tag": ["value"] } });

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilter(filter, event);

      expect(result).toEqual(false);
    });

    test("should return false when a tag value is not present in the event", () => {
      const filter = filterSchema.parse({ tags: { "#tag": ["not value"] } });

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilter(filter, event);

      expect(result).toEqual(false);
    });
  });

  describe("matchFilters", () => {
    test("should return true when at least one filter matches the event", () => {
      const filters = [
        {
          ids: [
            "7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b",
          ],
          kinds: [1],
          authors: [senderToBytes(sender).substring(2)],
        },
        {
          ids: [
            "0000000000000000000000000000000000000000000000000000000000000000",
          ],
          kinds: [2],
          authors: ["0123"],
        },
        {
          ids: [
            "0000000000000000000000000000000000000000000000000000000000000000",
          ],
          kinds: [3],
          authors: ["0123"],
        },
      ];

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilters(filters, event);

      expect(result).toEqual(true);
    });

    test("should return false when no filters match the event", () => {
      const filters = [
        {
          ids: [
            "7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b",
          ],
          kinds: [1],
          authors: ["0123"],
        },
        {
          ids: [
            "0000000000000000000000000000000000000000000000000000000000000000",
          ],
          kinds: [2],
          authors: ["0123"],
        },
        {
          ids: [
            "0000000000000000000000000000000000000000000000000000000000000000",
          ],
          kinds: [3],
          authors: ["0123"],
        },
      ];

      const event = buildEvent(partial, sender, fakeSig);
      const result = matchFilters(filters, event);

      expect(result).toEqual(false);
    });
  });

  describe("mergeFilters", () => {
    test("should merge filters", () => {
      expect(
        mergeFilters(
          {
            ids: [
              "7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b",
              "0000000000000000000000000000000000000000000000000000000000000000",
            ],
            kinds: [1],
            authors: ["0123"],
          },
          {
            ids: [
              "0000000000000000000000000000000000000000000000000000000000000000",
            ],
            kinds: [2],
            authors: ["0123"],
          },
        ),
      ).toEqual({
        ids: [
          "7cd8211c6264d2f2ea2d71aea903740ef6ec7f9640c77d3e3057c7d266e0070b",
          "0000000000000000000000000000000000000000000000000000000000000000",
        ],
        kinds: [1, 2],
        tags: {},
        authors: ["0123"],
      });

      expect(
        mergeFilters(
          { kinds: [1], authors: ["0123"], since: 15, until: 30 },
          { kinds: [2], authors: ["0123"], until: 15 },
        ),
      ).toEqual({
        ids: [],
        kinds: [1, 2],
        since: 15,
        until: 30,
        tags: {},
        authors: ["0123"],
      });
    });
  });

  describe("getFilterLimit", () => {
    test("should handle ids", () => {
      expect(getFilterLimit({ ids: ["123"] })).toEqual(1);
      expect(getFilterLimit({ ids: ["123"], limit: 2 })).toEqual(1);
      expect(getFilterLimit({ ids: ["123"], limit: 0 })).toEqual(0);
      expect(getFilterLimit({ ids: ["123"], limit: -1 })).toEqual(0);
    });

    test("should count the authors times replaceable kinds", () => {
      expect(getFilterLimit({ kinds: [0], authors: ["alex"] })).toEqual(1);
      expect(getFilterLimit({ kinds: [0, 3], authors: ["alex"] })).toEqual(2);
      expect(
        getFilterLimit({ kinds: [0, 3], authors: ["alex", "fiatjaf"] }),
      ).toEqual(4);
    });

    test("should return Infinity for authors with regular kinds", () => {
      expect(getFilterLimit({ kinds: [1], authors: ["alex"] })).toEqual(
        Infinity,
      );
    });

    test("should return Infinity for empty filters", () => {
      expect(getFilterLimit({})).toEqual(Infinity);
    });
  });
});
