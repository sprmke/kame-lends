import { describe, expect, it } from "vitest";
import { AssistantStreamParser } from "./stream";
import type { AssistantEvent } from "./types";

function collect() {
  const events: AssistantEvent[] = [];
  return {
    events,
    parser: new AssistantStreamParser((event) => events.push(event)),
  };
}

describe("AssistantStreamParser", () => {
  it("parses events split across chunks", () => {
    const { events, parser } = collect();
    parser.feed('data: {"type":"phase","phase":"understanding"}\n\n');
    parser.feed('data: {"type":"text_delta","text":"Hel');
    parser.feed('lo"}\n\n');
    parser.end();
    expect(events).toEqual([
      { type: "phase", phase: "understanding" },
      { type: "text_delta", text: "Hello" },
    ]);
  });

  it("ignores heartbeat comments and malformed data", () => {
    const { events, parser } = collect();
    parser.feed(": heartbeat\n\n");
    parser.feed("data: not-json\n\n");
    parser.feed('data: {"type":"text_start"}\n\n');
    parser.end();
    expect(events).toEqual([{ type: "text_start" }]);
  });

  it("handles multiple data lines", () => {
    const { events, parser } = collect();
    parser.feed(
      'data: {"type":"error",\ndata: "code":"x","message":"nope"}\n\n',
    );
    parser.end();
    expect(events).toEqual([{ type: "error", code: "x", message: "nope" }]);
  });
});
