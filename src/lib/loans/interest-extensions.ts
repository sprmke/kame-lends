/**
 * Interest date extension detection for loan edits.
 *
 * The loan form saves the whole graph. An existing period whose due date moves
 * later is a real extension worth telling the parties about. New or deleted
 * periods are not extensions.
 */

export type PeriodDueSnapshot = {
  id: number;
  dueDateKey: string;
};

export type InterestDateExtension = {
  periodId: number;
  previousDueDateKey: string;
  dueDateKey: string;
};

export function detectInterestDateExtensions(
  before: PeriodDueSnapshot[],
  after: PeriodDueSnapshot[],
): InterestDateExtension[] {
  const beforeById = new Map(before.map((row) => [row.id, row.dueDateKey]));
  const extensions: InterestDateExtension[] = [];

  for (const row of after) {
    const previous = beforeById.get(row.id);
    if (!previous || !row.dueDateKey) continue;
    if (row.dueDateKey > previous) {
      extensions.push({
        periodId: row.id,
        previousDueDateKey: previous,
        dueDateKey: row.dueDateKey,
      });
    }
  }

  return extensions.sort((a, b) => a.periodId - b.periodId);
}

export function latestExtension(
  extensions: InterestDateExtension[],
): InterestDateExtension | null {
  if (extensions.length === 0) return null;
  return extensions.reduce((latest, row) =>
    row.dueDateKey > latest.dueDateKey ? row : latest,
  );
}
