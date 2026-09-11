import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { loanGroups } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { requireUserSession } from "$lib/server/request-auth";
import {
  hasGroupViewAccess,
  hasGroupEditAccess,
  canLeaveGroup,
  syncGroupMembers,
} from "$lib/server/group-access";
import { hasLoanViewAccess } from "$lib/server/access-control";

export const load: PageServerLoad = async (event) => {
  const session = requireUserSession(event);
  const groupId = parseInt(event.params.id);
  event.depends("app:groups");

  if (Number.isNaN(groupId) || !(await hasGroupViewAccess(groupId, session.user.id))) {
    throw redirect(303, "/groups");
  }

  await syncGroupMembers(groupId);

  const group = await db.query.loanGroups.findFirst({
    where: eq(loanGroups.id, groupId),
    with: {
      creator: { columns: { id: true, name: true, email: true } },
      groupLoans: {
        with: {
          loan: {
            columns: {
              id: true,
              loanName: true,
              type: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
      members: {
        with: { user: { columns: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!group) throw redirect(303, "/groups");

  const visibleLoans = [];
  for (const groupLoan of group.groupLoans) {
    if (await hasLoanViewAccess(groupLoan.loan.id, session.user.id)) {
      visibleLoans.push(groupLoan.loan);
    }
  }

  const [canEdit, canLeave] = await Promise.all([
    hasGroupEditAccess(groupId, session.user.id),
    canLeaveGroup(groupId, session.user.id),
  ]);

  return {
    group: {
      id: group.id,
      name: group.name,
      notes: group.notes,
      creatorUserId: group.creatorUserId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    },
    creator: group.creator,
    loans: visibleLoans,
    members: group.members.map((member) => ({
      userId: member.userId,
      status: member.status,
      name: member.user?.name ?? null,
      email: member.user?.email ?? null,
    })),
    canEdit,
    canLeave,
    isCreator: group.creatorUserId === session.user.id,
    currentUserId: session.user.id,
  };
};
