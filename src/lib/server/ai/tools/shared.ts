import { z } from "zod";
import {
  dateKeyToUtcMidnight,
  daysBetweenKeys,
} from "$lib/dates/business-date";
import { addC, centavosToPesos, toCentavos } from "$lib/money/centavos";
import type { LoanWithInvestors } from "$lib/types";
import type { SourceRef } from "$lib/assistant/types";
import type { ToolContext } from "../agent/context";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const loanId = z.number().int().positive();
export const partyId = z.number().int().positive();

const READABLE_DATE = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function readableDate(key: string): string {
  if (!key) return "—";
  return READABLE_DATE.format(dateKeyToUtcMidnight(key));
}

export function loanHref(id: number): string {
  return `/loans/${id}`;
}

export function loanSource(
  loan: Pick<LoanWithInvestors, "id" | "loanName">,
): SourceRef {
  return {
    type: "loan",
    id: loan.id,
    label: loan.loanName,
    href: loanHref(loan.id),
  };
}

export function borrowerHref(id: number): string {
  return `/borrowers/${id}`;
}

export function investorHref(id: number): string {
  return `/investors/${id}`;
}

export function groupHref(id: number): string {
  return `/groups/${id}`;
}

export function debtHref(id: number): string {
  return `/debts/${id}`;
}

/** Money fact from integer centavos, with a source link when available. */
export function moneyFact(
  ctx: ToolContext,
  centavos: number,
  label: string,
  source?: SourceRef,
) {
  return ctx.facts.addMoney(Math.round(centavos), label, source);
}

export function countFact(
  ctx: ToolContext,
  value: number,
  label: string,
  source?: SourceRef,
) {
  return ctx.facts.addCount(value, label, source);
}

export function dateFact(
  ctx: ToolContext,
  key: string,
  label: string,
  source?: SourceRef,
) {
  return ctx.facts.addDate(key, label, source);
}

/** Sum centavos with the same integer helper the ledger uses. */
export function sumC(values: number[]): number {
  return addC(...values);
}

/** Convert a peso number (legacy calculation helpers) to centavos. */
export function pesosToC(value: number): number {
  return toCentavos(value);
}

export function pesos(valueC: number): number {
  return centavosToPesos(valueC);
}

export function clampLimit(
  value: number | undefined,
  fallback = 50,
  max = 200,
): number {
  if (!value || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

export function capDateRange(from: string, to: string, maxDays = 366): boolean {
  return daysBetweenKeys(from, to) <= maxDays;
}

export function daysBetween(from: string, to: string): number {
  return daysBetweenKeys(from, to);
}

/** "1 loan" / "3 loans". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
