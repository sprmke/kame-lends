import { ToolRegistry, type ToolDefinition } from "../agent/registry";
import { resolvePeriodTool } from "./resolve-period";
import { findPartyTool } from "./find-party";
import { getPortfolioSummaryTool } from "./get-portfolio-summary";
import { listLoansTool } from "./list-loans";
import { getLoanTool } from "./get-loan";
import { getLoanScheduleTool } from "./get-loan-schedule";
import { getLoanPaymentsTool } from "./get-loan-payments";
import { getBorrowerPositionTool } from "./get-borrower-position";
import { getInvestorPositionTool } from "./get-investor-position";
import { getUpcomingDuesTool } from "./get-upcoming-dues";
import { listOverdueTool } from "./list-overdue";
import { listPaymentsTool } from "./list-payments";
import { getCashflowTool } from "./get-cashflow";
import { getInterestSummaryTool } from "./get-interest-summary";
import { listDebtsTool, getDebtTool } from "./debts";
import { listGroupsTool, getGroupSummaryTool } from "./groups";
import { getCommissionSummaryTool } from "./get-commission-summary";
import { getDataHealthTool } from "./get-data-health";
import { simulateInterestTool } from "./simulate-interest";
import { calculateTool } from "./calculate";
import { openPageTool } from "./open-page";
import { searchHelpTool } from "./search-help";
import { readReceiptImageTool } from "./read-receipt-image";

/** Order matters only for prompt size. Keep the highest-value tools first. */
export const assistantTools = [
  resolvePeriodTool,
  findPartyTool,
  getBorrowerPositionTool,
  listLoansTool,
  getLoanTool,
  getPortfolioSummaryTool,
  getUpcomingDuesTool,
  listOverdueTool,
  getLoanScheduleTool,
  getLoanPaymentsTool,
  listPaymentsTool,
  getInvestorPositionTool,
  getInterestSummaryTool,
  getCashflowTool,
  listDebtsTool,
  getDebtTool,
  listGroupsTool,
  getGroupSummaryTool,
  getCommissionSummaryTool,
  getDataHealthTool,
  simulateInterestTool,
  calculateTool,
  openPageTool,
  searchHelpTool,
  readReceiptImageTool,
] as unknown as ToolDefinition<unknown>[];

export const assistantRegistry = new ToolRegistry(assistantTools);
