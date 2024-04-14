// Copyright 2024 nostr-utils authors & contributors
// SPDX-License-Identifier: Apache-2.0

// ported from nostr-tools

import { expect, test, describe } from "bun:test";
import { Queue } from "./queue";

describe("enqueue a message into MessageQueue", () => {
  test("enqueue into an empty queue", () => {
    const queue = new Queue();
    queue.enqueue("node1");
    expect(queue.first?.value).toBe("node1");
  });
  test("enqueue into a non-empty queue", () => {
    const queue = new Queue();
    queue.enqueue("node1");
    queue.enqueue("node3");
    queue.enqueue("node2");
    expect(queue.first?.value).toBe("node1");
    expect(queue.last?.value).toBe("node2");
  });
  test("dequeue from an empty queue", () => {
    const queue = new Queue();
    const item1 = queue.dequeue();
    expect(item1).toBe(null);
  });
  test("dequeue from a non-empty queue", () => {
    const queue = new Queue();
    queue.enqueue("node1");
    queue.enqueue("node3");
    queue.enqueue("node2");
    const item1 = queue.dequeue();
    expect(item1).toBe("node1");
    const item2 = queue.dequeue();
    expect(item2).toBe("node3");
  });
  test("dequeue more than in queue", () => {
    const queue = new Queue();
    queue.enqueue("node1");
    queue.enqueue("node3");
    const item1 = queue.dequeue();
    expect(item1).toBe("node1");
    const item2 = queue.dequeue();
    expect(item2).toBe("node3");
    const item3 = queue.dequeue();
    expect(item3).toBe(null);
  });
});
