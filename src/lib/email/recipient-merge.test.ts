import { describe, expect, it } from "vitest";
import {
  excludeActorRecipients,
  filterRecipientsByRole,
  mergeEmailRecipients,
  withRoleLabels,
} from "$lib/email/recipient-merge";

describe("recipient merge", () => {
  it("dedupes by normalized email and merges roles", () => {
    const merged = mergeEmailRecipients(
      [
        {
          email: "ADA@example.com",
          userId: "user-1",
          name: "Ada",
          roles: ["investor"],
        },
      ],
      [
        {
          email: "ada@example.com",
          userId: "user-1",
          name: "",
          roles: ["witness"],
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.email).toBe("ada@example.com");
    expect(merged[0]?.roles).toEqual(["investor", "witness"]);
    expect(merged[0]?.name).toBe("Ada");
  });

  it("keeps the first name and fills in a missing user id", () => {
    const merged = mergeEmailRecipients(
      [
        {
          email: "bob@example.com",
          userId: null,
          name: "Bob",
          roles: ["owner"],
        },
      ],
      [
        {
          email: "bob@example.com",
          userId: "user-2",
          name: "Robert",
          roles: ["borrower"],
        },
      ],
    );

    expect(merged[0]?.userId).toBe("user-2");
    expect(merged[0]?.name).toBe("Bob");
  });

  it("excludes the actor by user id or email", () => {
    const recipients = mergeEmailRecipients([
      {
        email: "owner@example.com",
        userId: "user-1",
        name: "Owner",
        roles: ["owner"],
      },
      {
        email: "ada@example.com",
        userId: "user-2",
        name: "Ada",
        roles: ["investor"],
      },
      {
        email: "bob@example.com",
        userId: null,
        name: "Bob",
        roles: ["borrower"],
      },
    ]);

    expect(
      excludeActorRecipients(recipients, { actorUserId: "user-1" }).map(
        (row) => row.email,
      ),
    ).toEqual(["ada@example.com", "bob@example.com"]);

    expect(
      excludeActorRecipients(recipients, { actorEmail: "BOB@example.com" }).map(
        (row) => row.email,
      ),
    ).toEqual(["owner@example.com", "ada@example.com"]);
  });

  it("filters by role and adds human labels", () => {
    const recipients = mergeEmailRecipients([
      {
        email: "owner@example.com",
        userId: "user-1",
        name: "Owner",
        roles: ["owner"],
      },
      {
        email: "ada@example.com",
        userId: "user-2",
        name: "Ada",
        roles: ["investor"],
      },
      {
        email: "wit@example.com",
        userId: "user-3",
        name: "Wit",
        roles: ["witness"],
      },
    ]);

    const due = filterRecipientsByRole(recipients, [
      "owner",
      "borrower",
      "investor",
    ]);
    expect(due.map((row) => row.email)).toEqual([
      "owner@example.com",
      "ada@example.com",
    ]);

    expect(withRoleLabels(due)[1]?.roleLabels).toEqual(["Investor"]);
  });
});
