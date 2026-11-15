/**
 * Pure reducer for the multiple-interest editor (FORM-01/02/04/05/09).
 *
 * The component is fully controlled: the parent owns `periods`, sends actions,
 * and renders exactly what the reducer returns. There is no second copy of the
 * schedule inside the editor.
 *
 * Invariants:
 * - periods are sorted by due date;
 * - the last period is the loan due date;
 * - every other due date is inside (first sent date, loan due date);
 * - no duplicate due dates;
 * - a period always has a usable value for its type.
 */
import type { InterestPeriodData } from "$lib/components/loans/multiple-interest-types";
import {
  addDaysToKey,
  addMonthsClamped,
  daysBetweenKeys,
  isDateKeyBefore,
} from "$lib/dates/business-date";

export type EditorMode = "single" | "multiple";

export interface EditorState {
  mode: EditorMode;
  periods: InterestPeriodData[];
  /** True once the user edits a value or date by hand. */
  touched: boolean;
}

export type EditorAction =
  | { type: "init"; mode: EditorMode; periods: InterestPeriodData[] }
  | { type: "setMode"; mode: EditorMode }
  | {
      type: "generate";
      sentDate: string;
      dueDate: string;
      defaultRate: string;
      defaultType: "rate" | "fixed";
    }
  | {
      type: "regenerateIfUntouched";
      sentDate: string;
      dueDate: string;
      defaultRate: string;
      defaultType: "rate" | "fixed";
    }
  | {
      type: "add";
      sentDate: string;
      dueDate: string;
      defaultRate: string;
      defaultType: "rate" | "fixed";
    }
  | { type: "remove"; id: string }
  | {
      type: "editValue";
      id: string;
      field: "rate" | "fixed";
      value: string;
      principal: string;
    }
  | {
      type: "setType";
      id: string;
      interestType: "rate" | "fixed";
      principal: string;
    }
  | { type: "setDueDate"; id: string; value: string }
  | { type: "setFinalDueDate"; dueDate: string };

let idCounter = 0;
function nextId(sentDate = ""): string {
  idCounter += 1;
  return `period-${sentDate || "d"}-${Date.now()}-${idCounter}`;
}

function numberOrZero(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Rate → fixed amount, or fixed → rate, at the current principal. */
export function convertPeriodValue(
  period: InterestPeriodData,
  interestType: "rate" | "fixed",
  principal: string | number,
): Pick<
  InterestPeriodData,
  "interestType" | "interestRate" | "interestAmount"
> {
  if (period.interestType === interestType) {
    return {
      interestType: period.interestType,
      interestRate: period.interestRate,
      interestAmount: period.interestAmount,
    };
  }

  const capital = numberOrZero(principal);
  if (interestType === "fixed") {
    const rate = numberOrZero(period.interestRate);
    const amount = capital > 0 ? ((capital * rate) / 100).toFixed(2) : "";
    return {
      interestType: "fixed",
      interestRate: period.interestRate,
      interestAmount: amount,
    };
  }

  const amount = numberOrZero(period.interestAmount);
  const rate = capital > 0 ? ((amount / capital) * 100).toFixed(2) : "";
  return {
    interestType: "rate",
    interestRate: rate,
    interestAmount: period.interestAmount,
  };
}

export function sortPeriods(
  periods: InterestPeriodData[],
): InterestPeriodData[] {
  if (periods.length <= 1) return periods;
  return [...periods].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function withFinalDate(
  periods: InterestPeriodData[],
  dueDate: string,
): InterestPeriodData[] {
  if (periods.length === 0 || !dueDate) return periods;
  return periods.map((period, index) =>
    index === periods.length - 1 ? { ...period, dueDate } : period,
  );
}

function generatedPeriods(input: {
  sentDate: string;
  dueDate: string;
  defaultRate: string;
  defaultType: "rate" | "fixed";
  previous?: InterestPeriodData[];
}): InterestPeriodData[] {
  const { sentDate, dueDate, defaultRate, defaultType } = input;
  if (!sentDate || !dueDate || !isDateKeyBefore(sentDate, dueDate)) return [];

  const keys = monthEndKeys(sentDate, dueDate);
  return keys.map((key, index) => {
    const previous = input.previous?.[index];
    return {
      id: previous?.id ?? nextId(sentDate),
      dueDate: key,
      interestRate: previous?.interestRate ?? defaultRate ?? "",
      interestAmount: previous?.interestAmount ?? "",
      interestType: previous?.interestType ?? defaultType ?? "rate",
      status: previous?.status,
    };
  });
}

/**
 * Period due dates for the editor: month ends or the sent day, with the final
 * period pinned to the loan due date.
 */
export function monthEndKeys(sentDate: string, dueDate: string): string[] {
  const [, , startDay] = sentDate.split("-").map(Number);
  const keys: string[] = [];

  for (let offset = 0; offset <= 120; offset++) {
    const base = addMonthsClamped(sentDate, offset);
    const [year, month] = base.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = startDay === 1 ? lastDay : Math.min(startDay, lastDay);
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (key > sentDate && key < dueDate) keys.push(key);
    if (key >= dueDate) break;
  }

  keys.push(dueDate);
  return keys;
}

/** A new intermediate period lands between its neighbors. */
export function defaultPeriodDate(
  periods: InterestPeriodData[],
  sentDate: string,
  dueDate: string,
): string {
  if (periods.length === 0) return dueDate;
  const first = periods[0]?.dueDate ?? sentDate;
  const second = periods[1]?.dueDate;
  const start = first || sentDate;

  if (second) {
    const days = daysBetweenKeys(start, second);
    if (days > 1) return addDaysToKey(start, Math.floor(days / 2));
  }

  const candidate = addMonthsClamped(start, 1);
  return isDateKeyBefore(candidate, dueDate) ? candidate : dueDate;
}

function hasDuplicate(periods: InterestPeriodData[], id: string, date: string) {
  return periods.some((period) => period.id !== id && period.dueDate === date);
}

function editValue(
  state: EditorState,
  action: Extract<EditorAction, { type: "editValue" }>,
): EditorState {
  const principal = numberOrZero(action.principal);
  const periods = state.periods.map((period) => {
    if (period.id !== action.id) return period;
    if (action.field === "rate") {
      const computed =
        principal > 0
          ? ((principal * numberOrZero(action.value)) / 100).toFixed(2)
          : period.interestAmount;
      return {
        ...period,
        interestRate: action.value,
        interestAmount: computed,
      };
    }
    const computedRate =
      principal > 0
        ? ((numberOrZero(action.value) / principal) * 100).toFixed(2)
        : period.interestRate;
    return {
      ...period,
      interestAmount: action.value,
      interestRate: computedRate,
    };
  });
  return { ...state, periods, touched: true };
}

export function interestEditorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "init":
      return {
        mode: action.mode,
        periods: sortPeriods(action.periods),
        touched: false,
      };

    case "setMode":
      return { ...state, mode: action.mode };

    case "generate":
      return {
        ...state,
        periods: generatedPeriods(action),
        touched: false,
      };

    case "regenerateIfUntouched":
      if (state.touched) return state;
      return {
        ...state,
        periods: generatedPeriods({
          ...action,
          previous: state.periods,
        }),
      };

    case "add": {
      const date = defaultPeriodDate(
        state.periods,
        action.sentDate,
        action.dueDate,
      );
      if (!date || date <= action.sentDate) return state;
      if (hasDuplicate(state.periods, "", date)) return state;
      const insert: InterestPeriodData = {
        id: nextId(action.sentDate),
        dueDate: date,
        interestRate: action.defaultRate ?? "",
        interestAmount: "",
        interestType: action.defaultType ?? "rate",
      };
      const sorted = sortPeriods([...state.periods, insert]);
      // Keep the final period pinned to the loan due date.
      return {
        ...state,
        periods: withFinalDate(sorted, action.dueDate),
        touched: true,
      };
    }

    case "remove": {
      const index = state.periods.findIndex(
        (period) => period.id === action.id,
      );
      if (index < 0 || index === state.periods.length - 1) return state;
      return {
        ...state,
        periods: state.periods.filter((period) => period.id !== action.id),
        touched: true,
      };
    }

    case "editValue":
      return editValue(state, action);

    case "setType": {
      const periods = state.periods.map((period) => {
        if (period.id !== action.id) return period;
        const converted = convertPeriodValue(
          period,
          action.interestType,
          action.principal,
        );
        return { ...period, ...converted };
      });
      return { ...state, periods, touched: true };
    }

    case "setDueDate": {
      const index = state.periods.findIndex(
        (period) => period.id === action.id,
      );
      if (index < 0 || index === state.periods.length - 1) return state;
      if (
        !action.value ||
        hasDuplicate(state.periods, action.id, action.value)
      ) {
        return state;
      }
      const periods = state.periods.map((period) =>
        period.id === action.id ? { ...period, dueDate: action.value } : period,
      );
      return { ...state, periods: sortPeriods(periods), touched: true };
    }

    case "setFinalDueDate":
      return {
        ...state,
        periods: withFinalDate(state.periods, action.dueDate),
      };

    default:
      return state;
  }
}

/** Validation used by the form and the editor banner. */
export function interestEditorErrors(
  state: EditorState,
  input: { sentDate: string; dueDate: string },
): string[] {
  const errors: string[] = [];
  const { periods } = state;
  if (state.mode !== "multiple") return errors;
  if (periods.length === 0)
    errors.push("Multiple interest periods are required");
  if (
    periods.length > 0 &&
    periods[periods.length - 1].dueDate !== input.dueDate
  ) {
    errors.push("The final period must end on the loan due date");
  }
  const seen = new Set<string>();
  for (const period of periods) {
    if (seen.has(period.dueDate)) {
      errors.push("Interest periods cannot share the same due date");
      break;
    }
    seen.add(period.dueDate);
    if (period.dueDate <= input.sentDate || period.dueDate > input.dueDate) {
      errors.push(
        "Each period must fall after the sent date and on or before the due date",
      );
      break;
    }
  }
  return errors;
}
