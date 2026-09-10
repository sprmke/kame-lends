import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import DashboardSkeleton from "./DashboardSkeleton.svelte";
import ListPageSkeleton from "./ListPageSkeleton.svelte";
import DetailPageSkeleton from "./DetailPageSkeleton.svelte";
import DebtDetailSkeleton from "./page-skeletons/DebtDetailSkeleton.svelte";
import { SHOW_TRANSACTIONS_UI } from "$lib/feature-flags";

describe("DashboardSkeleton", () => {
  it("mirrors the full dashboard layout", () => {
    const { body } = render(DashboardSkeleton);
    const cards = body.match(/data-slot="card"/g) ?? [];
    const summaryCount = 4;
    const activityCount = 4;
    const analyticsCount = SHOW_TRANSACTIONS_UI ? 2 : 1;
    const portfolioCount = 2;
    expect(cards.length).toBe(
      summaryCount + activityCount + analyticsCount + portfolioCount,
    );
    expect(body).toContain('aria-label="Loading dashboard"');
    expect(body).toContain("grid-cols-2 lg:grid-cols-4");
    expect(body).toContain("md:grid-cols-2 md:gap-5 2xl:grid-cols-4");
    expect(body).toContain("lg:grid-cols-2");
  });
});

describe("ListPageSkeleton", () => {
  it("renders loans table columns and summary cards", () => {
    const { body } = render(ListPageSkeleton, { props: { variant: "loans" } });
    expect(body).toContain("grow-[12]");
    expect(body).toContain('aria-label="Loading page"');
    expect(body).toContain("skeleton-toolbar");
    expect(body).toContain("surface-card");
    expect(body).toContain("grid-cols-2 lg:grid-cols-4");
  });

  it("renders investors table columns", () => {
    const { body } = render(ListPageSkeleton, {
      props: { variant: "investors" },
    });
    expect(body).toContain("grow-[18]");
    expect(body).toContain("skeleton-toolbar");
  });
});

describe("DetailPageSkeleton", () => {
  it("renders debt detail placeholders", () => {
    const { body } = render(DetailPageSkeleton, { props: { variant: "debt" } });
    expect(body).toContain('aria-label="Loading borrowing details"');
  });

  it("renders investor detail placeholders", () => {
    const { body } = render(DetailPageSkeleton, {
      props: { variant: "investor" },
    });
    expect(body).toContain('aria-label="Loading investor details"');
    expect(body).toContain("skeleton-toolbar");
  });
});

describe("DebtDetailSkeleton", () => {
  it("renders interest overview and schedule placeholders", () => {
    const { body } = render(DebtDetailSkeleton);
    expect(body).toContain('aria-label="Loading borrowing details"');
    expect(body).toContain("md:grid-cols-3");
  });
});
