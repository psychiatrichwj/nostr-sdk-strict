// Copyright 2024 nostr-messages authors & contributors
// SPDX-License-Identifier: Apache-2.0

// partially ported from nostr-tools

import { z } from "zod";
import { Event } from "./events";
import { isReplaceableKind } from "./kind";
import { hexStringAnyLenSchema, hex32Schema } from ".";

export const tagFilterSchema = z.record(
  z.string().startsWith("#"),
  z.array(z.string()),
);
export const fullFilterSchema = z.object({
  ids: z.array(hex32Schema),
  kinds: z.array(z.number()),
  authors: z.array(hexStringAnyLenSchema()),

  since: z.number(),
  until: z.number(),
  limit: z.number(),

  tags: tagFilterSchema,
});

export const filterSchema = fullFilterSchema.partial();

export type TagFilter = z.infer<typeof tagFilterSchema>;
export type Filter = z.infer<typeof filterSchema>;
export type FullFilter = z.infer<typeof fullFilterSchema>;

const matchOneTag = (
  tags: [string, string][],
  name: string,
  values: string[],
): boolean => {
  for (const tag of tags) {
    if (tag[0] === name && values.indexOf(tag[1]) !== -1) {
      return true;
    }
  }

  return false;
};

export function matchFilterExceptTags(filter: Filter, event: Event): boolean {
  if (filter.ids && filter.ids.indexOf(event.id) === -1) return false;
  if (filter.kinds && filter.kinds.indexOf(event.kind) === -1) return false;
  if (filter.authors && filter.authors.indexOf(event.sender) === -1) {
    return false;
  }
  if (filter.since && event.created_at < filter.since) return false;
  if (filter.until && event.created_at > filter.until) return false;

  return true;
}

export function matchFilter(filter: Filter, event: Event): boolean {
  if (!matchFilterExceptTags(filter, event)) {
    return false;
  }

  const tags = filter.tags;
  for (const f in tags) {
    const tagName = f;
    const tagContents = tags[tagName];

    if (tagName.startsWith("#")) {
      if (!matchOneTag(event.tags, tagName.substring(1), tagContents))
        return false;
    }
  }

  return true;
}

export function matchFilters(filters: Filter[], event: Event): boolean {
  for (let i = 0; i < filters.length; i++) {
    if (matchFilter(filters[i], event)) return true;
  }
  return false;
}

export function cleanFilter(filter: FullFilter): Filter {
  const r = filterSchema.parse(filter);
  r.kinds = Array.from(new Set(r.kinds));
  r.ids = Array.from(new Set(r.ids));
  r.authors = Array.from(new Set(r.authors));
  r.tags = Object.fromEntries(
    Object.entries(filter.tags).map(([k, v]) => [k, Array.from(new Set(v))]),
  );
  if (r.since === 4_294_967_295) r.since = undefined;
  if (r.until === -1) r.until = undefined;
  if (r.limit === 4_294_967_295) r.limit = undefined;

  return r;
}

export function defaultFullFilter(): FullFilter {
  return fullFilterSchema.parse({
    kinds: [],
    authors: [],
    ids: [],
    since: 4_294_967_295,
    until: -1,
    limit: 4_294_967_295,
    tags: {},
  });
}

export function mergeFilters(...filters: Filter[]): Filter {
  const result = defaultFullFilter();

  for (const oneFilter of filters) {
    const kinds = oneFilter.kinds || [];
    const ids = oneFilter.ids || [];
    const authors = oneFilter.authors || [];

    result.kinds = [...result.kinds, ...kinds];
    result.ids = [...result.ids, ...ids];
    result.authors = [...result.authors, ...authors];

    for (const tagName in oneFilter.tags) {
      result.tags[tagName] = [
        ...(result.tags[tagName] || []),
        ...oneFilter.tags[tagName],
      ];
    }

    if (oneFilter.limit && (!result.limit || oneFilter.limit > result.limit))
      result.limit = oneFilter.limit;
    if (oneFilter.until && (!result.until || oneFilter.until > result.until))
      result.until = oneFilter.until;
    if (oneFilter.since && (!result.since || oneFilter.since < result.since))
      result.since = oneFilter.since;
  }

  return cleanFilter(result);
}

/** Calculate the intrinsic limit of a filter. This function may return `Infinity`. */
export function getFilterLimit(filter: Filter): number {
  if (filter.ids && !filter.ids.length) return 0;
  if (filter.kinds && !filter.kinds.length) return 0;
  if (filter.authors && !filter.authors.length) return 0;

  return Math.min(
    Math.max(0, filter.limit ?? Infinity),
    filter.ids?.length ?? Infinity,
    filter.authors?.length &&
    filter.kinds?.every((kind) => isReplaceableKind(kind))
      ? filter.authors.length * filter.kinds.length
      : Infinity,
  );
}
