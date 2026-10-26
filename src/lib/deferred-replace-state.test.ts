import { describe, expect, it } from "vitest";
import { createDeferredReplaceState } from "./deferred-replace-state";

describe("createDeferredReplaceState", () => {
  it("holds URL writes until the router task runs, then writes immediately", () => {
    const calls: string[] = [];
    let flush = () => {};
    const replace = createDeferredReplaceState(
      (href) => {
        calls.push(href);
      },
      (run) => {
        flush = run;
      },
    );

    replace("/loans?q=saved", {});
    replace("/loans?q=saved&status=Overdue", {});
    expect(calls).toEqual([]);

    flush();
    expect(calls).toEqual(["/loans?q=saved", "/loans?q=saved&status=Overdue"]);

    replace("/loans?q=next", {});
    expect(calls).toEqual([
      "/loans?q=saved",
      "/loans?q=saved&status=Overdue",
      "/loans?q=next",
    ]);
  });
});
