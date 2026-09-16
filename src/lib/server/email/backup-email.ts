import { format } from "date-fns";
import { APP_NAME } from "$lib/brand";
import { renderBrandedEmailShell } from "./branded-email-shell";
import { escapeHtml } from "./email-html";

export type BackupEmailSummary = {
  totalInvestors: number;
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  totalTransactions: number;
  totalLoanInvestors: number;
  totalInterestPeriods: number;
  totalReceivedPayments: number;
};

function summaryRow(label: string, value: number, valueColor?: string): string {
  const color = valueColor ?? "#1e293b";
  return `<tr class="meta-row">
  <td>${escapeHtml(label)}</td>
  <td style="color:${color};">${escapeHtml(String(value))}</td>
</tr>`;
}

export function buildBackupEmailHtml(summary: BackupEmailSummary): string {
  const generatedOn = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  const bodyHtml = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333333;">Your automated daily backup has been created.</p>
<p class="section-label">Backup summary</p>
<table role="presentation" class="data-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 4px 0;">
${summaryRow("Investors", summary.totalInvestors)}
${summaryRow("Total loans", summary.totalLoans)}
${summaryRow("Active loans", summary.activeLoans, "#16a34a")}
${summaryRow("Completed loans", summary.completedLoans, "#2563eb")}
${summaryRow("Overdue loans", summary.overdueLoans, "#dc2626")}
${summaryRow("Transactions", summary.totalTransactions)}
${summaryRow("Loan-investor rows", summary.totalLoanInvestors)}
${summaryRow("Interest periods", summary.totalInterestPeriods)}
${summaryRow("Received payments", summary.totalReceivedPayments)}
</table>
<p style="margin:20px 0 0 0;font-size:15px;line-height:1.6;color:#333333;">The full backup file is attached as JSON. Keep it safe for restoration.</p>
<p style="margin:16px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">Generated on ${escapeHtml(generatedOn)}</p>`;

  return renderBrandedEmailShell({
    emailTitle: "Daily backup",
    unitLabel: APP_NAME,
    bodyHtml,
  });
}

export function buildBackupEmailSubject(date = new Date()): string {
  return `${APP_NAME} daily backup - ${format(date, "MMM d, yyyy")}`;
}
