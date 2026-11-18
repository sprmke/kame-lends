import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { sql } from "drizzle-orm";
import { backupFilename } from "$lib/brand";
import { normalizeEmail } from "$lib/loan-signing";
import { fetchBackupDataForUser } from "$lib/server/backup-data";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { approxJsonBytes, logEgress } from "$lib/server/egress-log";
import {
  buildBackupEmailHtml,
  buildBackupEmailSubject,
} from "$lib/server/email/backup-email";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { publicJsonError } from "$lib/server/http-error";
import { WORKSPACE_OWNER_EMAIL } from "$lib/server/workspace-owner";

interface BackupSummary {
  totalInvestors: number;
  totalLoans: number;
  totalTransactions: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  totalLoanInvestors: number;
  totalInterestPeriods: number;
  totalReceivedPayments: number;
}

/**
 * GET /api/cron/backup
 * Weekly thin backup for the workspace owner only (no receipt image blobs).
 * Real DR remains `bun run backup:neon` / Neon PITR.
 *
 * Schedule: Sunday 06:00 UTC (`0 6 * * 0` in vercel.json).
 */
export const GET: RequestHandler = async (event) => {
  const request = event.request;
  const started = performance.now();
  try {
    if (!isCronAuthorized(request)) {
      console.warn(
        JSON.stringify({
          level: "warn",
          kind: "cron_unauthorized",
          path: "/api/cron/backup",
        }),
      );
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerEmail = normalizeEmail(WORKSPACE_OWNER_EMAIL);
    const owner = ownerEmail
      ? await db.query.users.findFirst({
          where: sql`lower(${users.email}) = ${ownerEmail}`,
        })
      : null;

    if (!owner) {
      return json({
        message: "Workspace owner user not found",
        timestamp: new Date().toISOString(),
      });
    }

    const payload = await fetchBackupDataForUser({
      userId: owner.id,
      exportedByLabel: owner.email ?? owner.id,
    });

    const loansForStats = payload.data.loans as Array<{
      status: string;
    }>;

    const summary: BackupSummary = {
      totalInvestors: payload.summary.totalInvestors,
      totalLoans: payload.summary.totalLoans,
      totalTransactions: payload.summary.totalTransactions,
      activeLoans: loansForStats.filter(
        (l) => l.status === "Fully Funded" || l.status === "Partially Funded",
      ).length,
      completedLoans: loansForStats.filter((l) => l.status === "Completed")
        .length,
      overdueLoans: loansForStats.filter((l) => l.status === "Overdue").length,
      totalLoanInvestors: payload.summary.totalLoanInvestors,
      totalInterestPeriods: payload.summary.totalInterestPeriods,
      totalReceivedPayments: payload.summary.totalReceivedPayments,
    };

    const backupData = {
      ...payload,
      type: "automated-weekly-backup",
      summary,
    };

    const approxBytes = approxJsonBytes(backupData);
    const backupEmail = process.env.BACKUP_EMAIL || owner.email;
    const resendConfigured = isTransactionalEmailConfigured();
    let result: Record<string, unknown>;

    if (resendConfigured && backupEmail) {
      try {
        const filename = backupFilename(new Date(), false);
        const jsonContent = JSON.stringify(backupData, null, 2);
        const base64Content = Buffer.from(jsonContent).toString("base64");

        await sendTransactionalEmail({
          to: backupEmail,
          subject: buildBackupEmailSubject(),
          html: buildBackupEmailHtml(summary),
          attachments: [
            {
              filename,
              content: base64Content,
            },
          ],
        });

        result = {
          userId: owner.id,
          email: backupEmail,
          status: "sent",
          summary,
          approxBytes,
        };
      } catch (emailError) {
        console.error("Error sending backup email:", emailError);
        result = {
          userId: owner.id,
          email: backupEmail,
          status: "email_failed",
          error:
            emailError instanceof Error ? emailError.message : "Unknown error",
          summary,
          approxBytes,
        };
      }
    } else {
      result = {
        userId: owner.id,
        email: owner.email,
        status: "skipped",
        reason: !resendConfigured ? "Resend not configured" : "No backup email",
        summary,
        approxBytes,
      };
    }

    logEgress({
      kind: "cron_egress",
      path: "/api/cron/backup",
      ms: Math.round(performance.now() - started),
      status: 200,
      approxBytes,
      rows: summary.totalLoans,
      extra: { backupStatus: String(result.status) },
    });

    return json({
      success: true,
      timestamp: new Date().toISOString(),
      results: [result],
    });
  } catch (error) {
    console.error("Error in cron backup:", error);
    return json(publicJsonError("Failed to run backup cron", error), {
      status: 500,
    });
  }
};
