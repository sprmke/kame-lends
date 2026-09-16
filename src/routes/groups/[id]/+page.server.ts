import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
  borrowers,
  investors,
  loanGroupMembers,
  loanGroups,
} from "$lib/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import { projectLoanForGroupViewer } from "$lib/loan-group-viewer-projection";
import { stripDataImageUrls } from "$lib/json-safe-images";
import { isTelegramConfigured } from "$lib/server/telegram/config";
import { publicTelegramSettings } from "$lib/server/telegram/public-settings";
import { groupCalendarSubscribeUrl } from "$lib/server/group-calendar";
import { getCachedLoansByIds } from "$lib/server/cached-data";

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

  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
    with: {
      creator: { columns: { id: true, name: true, email: true } },
      groupLoans: { columns: { loanId: true, source: true } },
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

  const userId = session.user.id;
  const isCreator = group.creatorUserId === userId;
  let hasMembership = isCreator;
  if (!hasMembership) {
    const membership = await db.query.loanGroupMembers.findFirst({
      where: and(
        eq(loanGroupMembers.groupId, groupId),
        eq(loanGroupMembers.userId, userId),
      ),
      columns: { id: true },
    });
    hasMembership = Boolean(membership);
  }
  if (!hasMembership) throw error(404, "Group not found");

  const canManage = isCreator;

  const loanIds = group.groupLoans.map((link) => link.loanId);
  const sourceByLoanId = new Map(
    group.groupLoans.map((link) => [link.loanId, link.source]),
  );

  const loadedLoans =
    loanIds.length > 0 ? await getCachedLoansByIds(loanIds, "list") : [];

  const loansById = new Map(loadedLoans.map((loan) => [loan.id, loan]));
  const loans = loanIds
    .map((id) => loansById.get(id))
    .filter((loan): loan is NonNullable<typeof loan> => Boolean(loan))
    .map((loan) => {
      const projected = canManage ? loan : projectLoanForGroupViewer(loan);
      return stripDataImageUrls({
        ...projected,
        groupSource: sourceByLoanId.get(loan.id),
      });
    });

  const viewerMember = group.members.find((m) => m.userId === userId);
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
    canManage,
    canCreate: false,
    emptyMessage: "No loans in this group yet",
    viewerRoles,
    isCreator,
    telegramStartGroupAvailable: isTelegramConfigured(),
    calendarSubscribeUrl:
      canManage && group.calendar?.googleCalendarId
        ? groupCalendarSubscribeUrl(group.calendar.googleCalendarId)
        : null,
  };
};
