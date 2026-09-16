import { test, expect } from "@playwright/test";
import { gotoApp, skipIfNoDatabase, switchE2ESession } from "./helpers";

/**
 * Groups v2 flows. UI chips stay behind SHOW_GROUPS_UI; API + hub routes are live.
 */
test.describe("loan groups v2", () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    void _page;
    skipIfNoDatabase(testInfo);
  });

  test("owner can open groups list and create wizard", async ({ page }) => {
    await switchE2ESession(page.request, undefined, page.context());
    await gotoApp(page, "/groups");
    await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible({
      timeout: 20_000,
    });

    await gotoApp(page, "/groups?create=1");
    await expect(page.getByRole("heading", { name: "New group" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Name")).toBeVisible();
  });

  test("owner can create a group via API and open the hub", async ({
    page,
  }) => {
    const request = page.request;
    await switchE2ESession(request, undefined, page.context());

    const stamp = Date.now();
    const create = await request.post("/api/groups", {
      data: {
        name: `E2E Group ${stamp}`,
        color: "teal",
        description: "e2e",
        loanIds: [],
        createCalendar: false,
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const group = (await create.json()) as { id: number };

    await gotoApp(page, `/groups/${group.id}?tab=loans`);
    await expect(page.getByText(`E2E Group ${stamp}`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("button", { name: "Add loans" }).first(),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByPlaceholder("Search loans by name or notes..."),
    ).toBeVisible();

    await request.delete(`/api/groups/${group.id}`);
  });

  test("wizard accepts investor prefill query params", async ({ page }) => {
    await switchE2ESession(page.request, undefined, page.context());
    await gotoApp(
      page,
      "/groups?create=1&investorId=1&name=Test%20Investor&loanIds=1,2",
    );
    await expect(page.getByRole("heading", { name: "New group" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Name")).toBeVisible();
  });

  test("party gains and loses group loan view via membership", async ({
    page,
  }) => {
    const stamp = Date.now();
    const request = page.request;
    const investorEmail = `e2e-grp-inv-${stamp}@example.com`;
    const borrowerEmail = `e2e-grp-bor-${stamp}@example.com`;

    const ids: {
      groupId?: number;
      loanA?: number;
      loanB?: number;
      investorId?: number;
      borrowerId?: number;
    } = {};

    try {
      await switchE2ESession(request, undefined, page.context());

      const investorRes = await request.post("/api/investors", {
        data: {
          name: `E2E Grp Inv ${stamp}`,
          email: investorEmail,
          contactNumber: "09171234567",
        },
      });
      expect(investorRes.ok(), await investorRes.text()).toBeTruthy();
      const investor = (await investorRes.json()) as { id: number };
      ids.investorId = investor.id;

      const borrowerRes = await request.post("/api/borrowers", {
        data: {
          name: `E2E Grp Bor ${stamp}`,
          email: borrowerEmail,
          contactNumber: "09179876543",
        },
      });
      expect(borrowerRes.ok(), await borrowerRes.text()).toBeTruthy();
      const borrower = (await borrowerRes.json()) as { id: number };
      ids.borrowerId = borrower.id;

      async function createLoan(label: string) {
        const due = new Date();
        due.setDate(due.getDate() + 30);
        const dueDate = due.toISOString().slice(0, 10);
        const res = await request.post("/api/loans", {
          data: {
            loanData: {
              borrowerId: borrower.id,
              loanName: label,
              type: "Agent",
              status: "Fully Funded",
              dueDate,
              freeLotSqm: null,
              notes: null,
            },
            investorData: [
              {
                investorId: investor.id,
                amount: "10000",
                interestRate: "10",
                interestType: "rate",
                sentDate: dueDate,
                isPaid: true,
                hasMultipleInterest: false,
                receipts: [],
                interestPeriods: [],
              },
            ],
            receivedPaymentsByInvestor: [],
            contractCustomization: null,
          },
        });
        expect(res.ok(), await res.text()).toBeTruthy();
        return (await res.json()) as { id: number };
      }

      const loanA = await createLoan(`E2E Grp Loan A ${stamp}`);
      const loanB = await createLoan(`E2E Grp Loan B ${stamp}`);
      ids.loanA = loanA.id;
      ids.loanB = loanB.id;

      const groupRes = await request.post("/api/groups", {
        data: {
          name: `E2E Access Group ${stamp}`,
          color: "sky",
          loanIds: [loanA.id, loanB.id],
          createCalendar: false,
        },
      });
      expect(groupRes.ok(), await groupRes.text()).toBeTruthy();
      const group = (await groupRes.json()) as { id: number };
      ids.groupId = group.id;

      // Investor is party on both loans → group member. Switch to investor session.
      const invSession = await switchE2ESession(
        request,
        investorEmail,
        page.context(),
      );
      expect(invSession.email?.toLowerCase()).toBe(investorEmail);

      const hub = await request.get(`/api/groups/${group.id}`);
      // Some environments expose hub only via page load; accept 200 or page.
      if (!hub.ok()) {
        await gotoApp(page, `/groups/${group.id}?tab=loans`);
        await expect(page.getByText(`E2E Access Group ${stamp}`)).toBeVisible({
          timeout: 20_000,
        });
      }

      const detailB = await request.get(`/api/loans/${loanB.id}`);
      expect(detailB.ok(), await detailB.text()).toBeTruthy();

      // Payments stay party-gated (investor is party on loanB so may succeed).
      // Use a loan the investor is NOT a party on: remove loanB from group first
      // after switching back to admin, then verify investor loses view if they
      // were only seeing via group… but investor IS a party on both. Create loanC
      // with a different investor to test pure group-viewer access.
      await switchE2ESession(request, undefined, page.context());

      const otherInvRes = await request.post("/api/investors", {
        data: {
          name: `E2E Other Inv ${stamp}`,
          email: `e2e-grp-other-${stamp}@example.com`,
          contactNumber: "09170001111",
        },
      });
      expect(otherInvRes.ok(), await otherInvRes.text()).toBeTruthy();
      const otherInv = (await otherInvRes.json()) as { id: number };

      const due = new Date();
      due.setDate(due.getDate() + 45);
      const dueDate = due.toISOString().slice(0, 10);
      const loanCRes = await request.post("/api/loans", {
        data: {
          loanData: {
            borrowerId: borrower.id,
            loanName: `E2E Grp Loan C ${stamp}`,
            type: "Agent",
            status: "Fully Funded",
            dueDate,
            freeLotSqm: null,
            notes: null,
          },
          investorData: [
            {
              investorId: otherInv.id,
              amount: "5000",
              interestRate: "5",
              interestType: "rate",
              sentDate: dueDate,
              isPaid: true,
              hasMultipleInterest: false,
              receipts: [],
              interestPeriods: [],
            },
          ],
          receivedPaymentsByInvestor: [],
          contractCustomization: null,
        },
      });
      expect(loanCRes.ok(), await loanCRes.text()).toBeTruthy();
      const loanC = (await loanCRes.json()) as { id: number };

      const addC = await request.post(`/api/groups/${group.id}/loans`, {
        data: { loanIds: [loanC.id] },
      });
      expect(addC.ok(), await addC.text()).toBeTruthy();

      await switchE2ESession(request, investorEmail, page.context());
      const groupView = await request.get(`/api/loans/${loanC.id}`);
      expect(groupView.ok(), await groupView.text()).toBeTruthy();
      const projected = (await groupView.json()) as {
        access?: {
          isGroupViewer?: boolean;
          viaGroupIds?: number[];
          memberships?: string[];
          canView?: boolean;
        };
        borrower?: { contactNumber?: string | null };
      };
      expect(
        projected.access,
        `expected group-viewer access, got ${JSON.stringify(projected.access)}`,
      ).toMatchObject({
        canView: true,
        isGroupViewer: true,
      });
      expect(projected.access?.viaGroupIds?.length ?? 0).toBeGreaterThan(0);

      const paymentsDenied = await request.post(
        `/api/loans/${loanC.id}/payments`,
        {
          data: {
            investorId: otherInv.id,
            amount: 1,
            interestValue: 0,
            sentDate: dueDate,
          },
        },
      );
      expect([401, 403, 404]).toContain(paymentsDenied.status());

      const contractDenied = await request.get(
        `/api/loans/${loanC.id}/contract`,
      );
      expect([401, 403, 404]).toContain(contractDenied.status());

      await switchE2ESession(request, undefined, page.context());
      const removeC = await request.delete(
        `/api/groups/${group.id}/loans/${loanC.id}`,
      );
      expect(removeC.ok(), await removeC.text()).toBeTruthy();

      await switchE2ESession(request, investorEmail, page.context());
      const revoked = await request.get(`/api/loans/${loanC.id}`);
      expect([403, 404]).toContain(revoked.status());

      await switchE2ESession(request, undefined, page.context());
      await request.delete(`/api/loans/${loanC.id}`);
      await request.delete(`/api/investors/${otherInv.id}`);
    } finally {
      await switchE2ESession(request, undefined, page.context()).catch(
        () => undefined,
      );
      if (ids.groupId) await request.delete(`/api/groups/${ids.groupId}`);
      if (ids.loanA) await request.delete(`/api/loans/${ids.loanA}`);
      if (ids.loanB) await request.delete(`/api/loans/${ids.loanB}`);
      if (ids.investorId)
        await request.delete(`/api/investors/${ids.investorId}`);
      if (ids.borrowerId)
        await request.delete(`/api/borrowers/${ids.borrowerId}`);
    }
  });

  test("bulk add loans to group via API", async ({ page }) => {
    const stamp = Date.now();
    const request = page.request;
    await switchE2ESession(request, undefined, page.context());

    const investorRes = await request.post("/api/investors", {
      data: {
        name: `E2E Bulk Inv ${stamp}`,
        email: `e2e-bulk-inv-${stamp}@example.com`,
        contactNumber: "09171112222",
      },
    });
    expect(investorRes.ok()).toBeTruthy();
    const investor = (await investorRes.json()) as { id: number };

    const borrowerRes = await request.post("/api/borrowers", {
      data: {
        name: `E2E Bulk Bor ${stamp}`,
        email: `e2e-bulk-bor-${stamp}@example.com`,
        contactNumber: "09173334444",
      },
    });
    expect(borrowerRes.ok()).toBeTruthy();
    const borrower = (await borrowerRes.json()) as { id: number };

    const dueDate = new Date(Date.now() + 40 * 86400000)
      .toISOString()
      .slice(0, 10);
    const loanIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request.post("/api/loans", {
        data: {
          loanData: {
            borrowerId: borrower.id,
            loanName: `E2E Bulk Loan ${i} ${stamp}`,
            type: "Agent",
            status: "Fully Funded",
            dueDate,
            freeLotSqm: null,
            notes: null,
          },
          investorData: [
            {
              investorId: investor.id,
              amount: "1000",
              interestRate: "10",
              interestType: "rate",
              sentDate: dueDate,
              isPaid: true,
              hasMultipleInterest: false,
              receipts: [],
              interestPeriods: [],
            },
          ],
          receivedPaymentsByInvestor: [],
          contractCustomization: null,
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      loanIds.push(((await res.json()) as { id: number }).id);
    }

    const groupRes = await request.post("/api/groups", {
      data: {
        name: `E2E Bulk Group ${stamp}`,
        color: "orange",
        loanIds: [],
        createCalendar: false,
      },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = (await groupRes.json()) as { id: number };

    const add = await request.post(`/api/groups/${group.id}/loans`, {
      data: { loanIds },
    });
    expect(add.ok(), await add.text()).toBeTruthy();

    await gotoApp(page, `/groups/${group.id}?tab=loans`);
    await expect(
      page.getByRole("heading", { name: `E2E Bulk Group ${stamp}` }),
    ).toBeVisible({
      timeout: 20_000,
    });

    await request.delete(`/api/groups/${group.id}`);
    for (const id of loanIds) await request.delete(`/api/loans/${id}`);
    await request.delete(`/api/investors/${investor.id}`);
    await request.delete(`/api/borrowers/${borrower.id}`);
  });
});
