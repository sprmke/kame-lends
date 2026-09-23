import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { loadWorkspaceDataOwnerUsers } from "$lib/server/workspace-owner";
import { backupFilename } from "$lib/brand";
import { fetchBackupDataForUser } from "$lib/server/backup-data";
import {
  buildBackupEmailHtml,
  buildBackupEmailSubject,
} from "$lib/server/email/backup-email";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "$lib/server/email/send-email";
import { isCronAuthorized } from "$lib/server/cron-auth";
import { publicJsonError } from "$lib/server/http-error";

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
 * Cron endpoint for automated daily backups
 * Sends backup data via email using Resend
 *
 * To enable email backups:
 * 1. Sign up at https://resend.com (free tier: 3000 emails/month)
 * 2. Add RESEND_API_KEY to your environment variables
 * 3. Add BACKUP_EMAIL to specify where backups should be sent
 */
export const GET: RequestHandler = async (event) => {
  const request = event.request;
  try {
    if (!isCronAuthorized(request)) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminUsers = await loadWorkspaceDataOwnerUsers();

    if (adminUsers.length === 0) {
      return json({
        message: "No workspace data owners found",
        timestamp: new Date().toISOString(),
      });
    }

    const backupResults = [];

    for (const user of adminUsers) {
      const payload = await fetchBackupDataForUser({
        userId: user.id,
        exportedByLabel: user.email ?? user.id,
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
        overdueLoans: loansForStats.filter((l) => l.status === "Overdue")
          .length,
        totalLoanInvestors: payload.summary.totalLoanInvestors,
        totalInterestPeriods: payload.summary.totalInterestPeriods,
        totalReceivedPayments: payload.summary.totalReceivedPayments,
      };

      const backupData = {
        ...payload,
        type: "automated-daily-backup",
        summary,
      };

      // Send email if Resend is configured
      const backupEmail = process.env.BACKUP_EMAIL || user.email;
      const resendConfigured = isTransactionalEmailConfigured();

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

          backupResults.push({
            userId: user.id,
            email: backupEmail,
            status: "sent",
            summary,
          });
        } catch (emailError) {
          console.error("Error sending backup email:", emailError);
          backupResults.push({
            userId: user.id,
            email: backupEmail,
            status: "email_failed",
            error:
              emailError instanceof Error
                ? emailError.message
                : "Unknown error",
            summary,
          });
        }
      } else {
        backupResults.push({
          userId: user.id,
          email: user.email,
          status: "skipped",
          reason: !resendConfigured
            ? "Resend not configured"
            : "No backup email",
          summary,
        });
      }
    }

    return json({
      success: true,
      timestamp: new Date().toISOString(),
      results: backupResults,
    });
  } catch (error) {
    console.error("Error in cron backup:", error);
    return json(publicJsonError("Failed to run backup cron", error), {
      status: 500,
    });
  }
};
