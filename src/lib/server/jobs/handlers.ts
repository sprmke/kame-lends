import { registerJobHandler, type JobRow } from "$lib/server/jobs/runner";
import { recomputeGroupMembers } from "$lib/server/group-access";

async function handleMembersRecompute(job: JobRow) {
  if (job.groupId == null) return;
  await recomputeGroupMembers(job.groupId);
}

async function handleCalendarProvision(job: JobRow) {
  if (job.groupId == null) return;
  const { provisionGroupCalendar } = await import("$lib/server/group-calendar");
  await provisionGroupCalendar(job.groupId);
}

async function handleCalendarAcl(job: JobRow) {
  if (job.groupId == null) return;
  const { reconcileGroupCalendarAcl } =
    await import("$lib/server/group-calendar");
  await reconcileGroupCalendarAcl(job.groupId);
}

async function handleCalendarSyncLoan(job: JobRow) {
  if (job.groupId == null) return;
  const loanId = Number((job.payload as { loanId?: number }).loanId);
  if (!Number.isFinite(loanId)) throw new Error("syncLoan missing loanId");
  const { syncGroupLoanEvents } = await import("$lib/server/group-calendar");
  await syncGroupLoanEvents(job.groupId, loanId);
}

async function handleCalendarRemoveLoan(job: JobRow) {
  const payload = job.payload as { loanId?: number; calendarId?: string };
  const loanId = Number(payload.loanId);
  const calendarId = payload.calendarId;
  if (!Number.isFinite(loanId) || !calendarId) {
    throw new Error("removeLoan missing loanId/calendarId");
  }
  const { removeGroupLoanEvents } = await import("$lib/server/group-calendar");
  await removeGroupLoanEvents(calendarId, loanId);
}

async function handleCalendarSummaries(job: JobRow) {
  if (job.groupId == null) return;
  const dateKeys = (job.payload as { dateKeys?: string[] }).dateKeys ?? [];
  const { syncGroupSummaries } = await import("$lib/server/group-calendar");
  await syncGroupSummaries(job.groupId, dateKeys);
}

async function handleCalendarDelete(job: JobRow) {
  const calendarId = (job.payload as { calendarId?: string }).calendarId;
  if (!calendarId) return;
  const { deleteGroupCalendar } = await import("$lib/server/group-calendar");
  await deleteGroupCalendar(calendarId);
}

async function handleTelegramActivity(job: JobRow) {
  if (job.groupId == null) return;
  const event = (job.payload as { event?: unknown }).event;
  const { sendGroupActivityNotification } =
    await import("$lib/server/telegram/group-notifications");
  await sendGroupActivityNotification(job.groupId, event);
}

registerJobHandler("group.members.recompute", handleMembersRecompute);
registerJobHandler("group.calendar.provision", handleCalendarProvision);
registerJobHandler("group.calendar.acl", handleCalendarAcl);
registerJobHandler("group.calendar.syncLoan", handleCalendarSyncLoan);
registerJobHandler("group.calendar.removeLoan", handleCalendarRemoveLoan);
registerJobHandler("group.calendar.summaries", handleCalendarSummaries);
registerJobHandler("group.calendar.delete", handleCalendarDelete);
registerJobHandler("group.telegram.activity", handleTelegramActivity);
