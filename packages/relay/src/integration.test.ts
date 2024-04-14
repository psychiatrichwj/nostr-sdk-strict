import { describe, test } from "bun:test";
import { Relay } from ".";
import { buildEvent } from "nostr-messages/events";
import { senderSchema } from "nostr-messages/sender";

describe("relay", () => {
  // TODO(wangjun.hong): fix integration test
  test.skip("integration", async () => {
    const relay = await Relay.connect("ws://127.0.0.1:3030");
    // console.log(`connected to ${relay.url}`);

    // let's publish a new event while simultaneously monitoring the relay for it
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: "hello world",
    };

    relay.subscribe(
      [
        {
          kinds: [1],
        },
      ],
      {
        onclose: (_reason: string) => {
          // console.log(reason);
        },
        onevent(_evt) {
          // console.log(evt);
        },
        oneose() {
          // console.log("EOSE");
        },
      },
    );

    // relay.close()
    const sender = senderSchema.parse({
      type: "EoaAddress",
      data: "4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
    });

    // this assigns the pubkey, calculates the event id and signs the event in a single step
    const signedEvent = buildEvent(eventTemplate, sender, "0x0000");
    await relay.publish(signedEvent);
    // console.log("published", signedEvent);

    // for (;;) {}
  });
});
