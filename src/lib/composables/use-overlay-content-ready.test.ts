import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOverlayContentReady } from "./use-overlay-content-ready.svelte";

function installRafPolyfill() {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0)) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
}

async function flushPaint() {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createOverlayContentReady", () => {
  beforeEach(installRafPolyfill);
  afterEach(() => {
    // @ts-expect-error test polyfill
    delete globalThis.requestAnimationFrame;
    // @ts-expect-error test polyfill
    delete globalThis.cancelAnimationFrame;
  });

  it("becomes ready after paint when opened once", async () => {
    const overlay = createOverlayContentReady();
    overlay.armWhenOpen(true);
    expect(overlay.ready).toBe(false);
    await flushPaint();
    expect(overlay.ready).toBe(true);
  });

  it("ignores re-arm while paint is pending so the skeleton cannot stick", async () => {
    const overlay = createOverlayContentReady();
    overlay.armWhenOpen(true);
    overlay.armWhenOpen(true);
    overlay.armWhenOpen(true);
    await flushPaint();
    expect(overlay.ready).toBe(true);
  });

  it("does not reset ready when armWhenOpen is called again while still open", async () => {
    const overlay = createOverlayContentReady();
    overlay.armWhenOpen(true);
    await flushPaint();
    expect(overlay.ready).toBe(true);
    overlay.armWhenOpen(true);
    expect(overlay.ready).toBe(true);
  });

  it("resets when closed then can arm again", async () => {
    const overlay = createOverlayContentReady();
    overlay.armWhenOpen(true);
    await flushPaint();
    overlay.armWhenOpen(false);
    expect(overlay.ready).toBe(false);
    overlay.armWhenOpen(true);
    expect(overlay.ready).toBe(false);
    await flushPaint();
    expect(overlay.ready).toBe(true);
  });
});
