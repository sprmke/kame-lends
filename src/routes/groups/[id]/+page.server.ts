import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanGroups,
  loans as loansTable,
} from "$lib/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import {
  hasGroupViewAccess,
  hasGroupManageAccess,
} from "$lib/server/group-access";
import { projectLoanForGroupViewer } from "$lib/loan-group-viewer-projection";
import { stripDataImageUrls } from "$lib/json-safe-images";
import { isTelegramConfigured } from "$lib/server/telegram/config";
import { publicTelegramSettings } from "$lib/server/telegram/public-settings";
import { groupCalendarSubscribeUrl } from "$lib/server/group-calendar";
import { getCachedGroupsForUser } from "$lib/server/cached-data";
import {
  mapOwnedLoanToWizardRow,
  buildWizardContactOptions,
} from "$lib/groups/group-list-map";

async function resolveRuleContactNames(
  rules: Array<{ partyType: string; contactId: number }>,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (rules.length === 0) return names;

  const investorIds = [
    ...new Set(
      rules
        .filter((rule) => rule.partyType === "investor")
        .map((rule) => rule.contactId),
    ),
  ];
  const borrowerIds = [
    ...new Set(
      rules
        .filter((rule) => rule.partyType === "borrower")
        .map((rule) => rule.contactId),
    ),
  ];

  if (investorIds.length > 0) {
    const rows = await db
      .select({ id: investors.id, name: investors.name })
      .from(investors)
      .where(inArray(investors.id, investorIds));
    for (const row of rows) {
      names.set(`investor:${row.id}`, row.name);
    }
  }
  if (borrowerIds.length > 0) {
    const rows = await db
      .select({ id: borrowers.id, name: borrowers.name })
      .from(borrowers)
      .where(inArray(borrowers.id, borrowerIds));
    for (const row of rows) {
      names.set(`borrower:${row.id}`, row.name);
    }
  }
  return names;
}

export const load: PageServerLoad = async (event) => {
  event.depends("app:groups");
  const session = requireUserSession(event);
  const groupId = parseInt(event.params.id);
  if (!Number.isFinite(groupId)) throw error(404, "Group not found");

  if (!(await hasGroupViewAccess(groupId, session.user.id))) {
    throw error(404, "Group not found");
  }

  const canManage = await hasGroupManageAccess(groupId, session.user.id);

  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
    with: {
      creator: { columns: { id: true, name: true, email: true } },
      groupLoans: {
        columns: { loanId: true, source: true },
        with: {
          loan: {
            with: {
              borrower: true,
              loanInvestors: {
                with: {
                  investor: true,
                  interestPeriods: true,
                  receivedPayments: true,
                },
              },
              loanWitnesses: { with: { witness: true } },
            },
          },
        },
      },
      members: {
        columns: { userId: true, partyRoles: true },
        with: { user: { columns: { id: true, name: true, email: true } } },
      },
      rules: true,
      calendar: true,
      telegram: true,
    },
  });

  if (!group) throw error(404, "Group not found");

  const loans = group.groupLoans.map((gl) => {
    const loan = gl.loan;
    const projected = canManage ? loan : projectLoanForGroupViewer(loan);
    return stripDataImageUrls({
      ...projected,
      groupSource: gl.source,
    });
  });

  const viewerMember = group.members.find((m) => m.userId === session.user.id);
  const viewerRoles = (viewerMember?.partyRoles ?? []) as string[];

  const members = canManage
    ? group.members
    : group.members.map((member) => ({
        ...member,
        user: member.user
          ? {
              id: member.user.id,
              name: member.user.name,
              email: null as string | null,
            }
          : member.user,
      }));

  const creator = canManage
    ? group.creator
    : group.creator
      ? {
          id: group.creator.id,
          name: group.creator.name,
          email: null as string | null,
        }
      : group.creator;

  const ruleContactNames = await resolveRuleContactNames(group.rules);
  const rules = group.rules.map((rule) => ({
    ...rule,
    contactName:
      ruleContactNames.get(`${rule.partyType}:${rule.contactId}`) ??
      `Contact ${rule.contactId}`,
  }));

  const inGroupIds = new Set(group.groupLoans.map((link) => link.loanId));
  let addableLoans: ReturnType<typeof mapOwnedLoanToWizardRow>[] = [];
  let ruleContacts: ReturnType<typeof buildWizardContactOptions> = [];
  if (canManage) {
    const [ownedLoans, allGroups] = await Promise.all([
      db.query.loans.findMany({
        where: eq(loansTable.userId, session.user.id),
        with: {
          borrower: { columns: { id: true, name: true } },
          loanInvestors: {
            columns: { amount: true, isPaid: true, investorId: true },
            with: { investor: { columns: { id: true, name: true } } },
          },
          groupLoans: { columns: { groupId: true } },
        },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      }),
      getCachedGroupsForUser(session.user.id, true),
    ]);
    const stripped = stripDataImageUrls(ownedLoans);
    const groupMeta = new Map(
      allGroups.map((row) => [
        row.id,
        { id: row.id, name: row.name, color: row.color ?? "orange" },
      ]),
    );
    addableLoans = stripped
      .filter((loan) => !inGroupIds.has(loan.id))
      .map((loan) => mapOwnedLoanToWizardRow(loan, groupMeta));
    ruleContacts = buildWizardContactOptions(stripped);
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      color: group.color,
      notes: group.notes,
      creatorUserId: group.creatorUserId,
      creator,
      rules,
      calendar: group.calendar,
      telegram: group.telegram
        ? publicTelegramSettings(group.telegram, canManage)
        : null,
      members,
    },
    loans,
    addableLoans,
    ruleContacts,
    canManage,
    canCreate: false,
    emptyMessage: "No loans in this group yet",
    viewerRoles,
    isCreator: group.creatorUserId === session.user.id,
    telegramStartGroupAvailable: isTelegramConfigured(),
    calendarSubscribeUrl:
      canManage && group.calendar?.googleCalendarId
        ? groupCalendarSubscribeUrl(group.calendar.googleCalendarId)
        : null,
  };
};
