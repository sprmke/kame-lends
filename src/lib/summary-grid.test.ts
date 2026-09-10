import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import SummaryCard from "$lib/components/common/SummaryCard.svelte";
import {
  getOddLastVisibleMobileSpan,
  getSummaryMetricGridCols,
  INVESTOR_DETAIL_SUMMARY_GRID,
  ODD_LAST_MOBILE_SPAN,
  summaryGridIsTwoColMobile,
} from "$lib/summary-grid";

describe("getSummaryMetricGridCols", () => {
  it("keeps 5 metrics on a 3+2 desktop layout", () => {
    expect(getSummaryMetricGridCols(5)).toBe(
      "grid-cols-2 md:grid-cols-3 2xl:grid-cols-5",
    );
  });
});

describe("getOddLastVisibleMobileSpan", () => {
  const fiveCol = getSummaryMetricGridCols(5);
  const fourCol = getSummaryMetricGridCols(4);

  it("spans the last odd card only until md on a 5-metric dashboard grid", () => {
    expect(
      getOddLastVisibleMobileSpan({
        empty: false,
        isLastVisible: true,
        visibleCount: 5,
        gridClass: fiveCol,
      }),
    ).toBe("col-span-2 md:col-span-1");
  });

  it("does not span when the visible count is even", () => {
    expect(
      getOddLastVisibleMobileSpan({
        empty: false,
        isLastVisible: true,
        visibleCount: 4,
        gridClass: fiveCol,
      }),
    ).toBe("");
  });

  it("does not span hidden empty cards", () => {
    expect(
      getOddLastVisibleMobileSpan({
        empty: true,
        isLastVisible: false,
        visibleCount: 5,
        gridClass: fiveCol,
      }),
    ).toBe("");
  });

  it("does not span 3-col mobile grids", () => {
    expect(
      getOddLastVisibleMobileSpan({
        empty: false,
        isLastVisible: true,
        visibleCount: 3,
        gridClass: getSummaryMetricGridCols(3),
      }),
    ).toBe("");
  });

  it("spans on investor detail 2-col mobile override until md", () => {
    expect(summaryGridIsTwoColMobile(INVESTOR_DETAIL_SUMMARY_GRID)).toBe(true);
    expect(
      getOddLastVisibleMobileSpan({
        empty: false,
        isLastVisible: true,
        visibleCount: 9,
        gridClass: INVESTOR_DETAIL_SUMMARY_GRID,
      }),
    ).toBe("col-span-2 md:col-span-1");
  });

  it("spans until lg on a 4-metric grid with 3 visible", () => {
    expect(
      getOddLastVisibleMobileSpan({
        empty: false,
        isLastVisible: true,
        visibleCount: 3,
        gridClass: fourCol,
      }),
    ).toBe(ODD_LAST_MOBILE_SPAN);
  });
});

describe("SummaryCard odd-last span", () => {
  it("adds col-span-2 md:col-span-1 on the last of 5 visible metrics", () => {
    const { body } = render(SummaryCard, {
      props: {
        metrics: [
          { label: "Total Principal", amount: 100 },
          { label: "Active", amount: 80 },
          { label: "Completed", amount: 20 },
          { label: "Interest Earned", amount: 5 },
          { label: "Total Earnings", amount: 25 },
        ],
      },
    });
    expect(body).toContain("col-span-2 md:col-span-1");
    expect(body.match(/col-span-2 md:col-span-1/g)?.length).toBe(1);
  });

  it("spans the last visible card when a trailing empty metric is hidden", () => {
    const { body } = render(SummaryCard, {
      props: {
        metrics: [
          { label: "A", amount: 1 },
          { label: "B", amount: 1 },
          { label: "C", amount: 1 },
          { label: "Empty", amount: 0 },
        ],
      },
    });
    expect(body).toContain("col-span-2 lg:col-span-1");
    expect(body).toContain("hidden lg:block");
  });
});
