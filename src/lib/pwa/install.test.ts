import { describe, expect, it } from "vitest";
import { canOfferInstall } from "$lib/pwa/install";

describe("canOfferInstall", () => {
  it("shows install UI for a pending Chromium prompt", () => {
    expect(
      canOfferInstall({
        standalone: false,
        ios: false,
        installAvailable: true,
      }),
    ).toBe(true);
  });

  it("shows install UI for iOS Add to Home Screen", () => {
    expect(
      canOfferInstall({
        standalone: false,
        ios: true,
        installAvailable: false,
      }),
    ).toBe(true);
  });

  it("hides install UI when the browser has no install path", () => {
    expect(
      canOfferInstall({
        standalone: false,
        ios: false,
        installAvailable: false,
      }),
    ).toBe(false);
  });

  it("hides install UI when the app is already installed", () => {
    expect(
      canOfferInstall({
        standalone: true,
        ios: true,
        installAvailable: true,
      }),
    ).toBe(false);
  });
});
