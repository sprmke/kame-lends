import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSession } from "$lib/server/session";
import { todayKey } from "$lib/dates/business-date";
import { ViewerData } from "$lib/server/assistant/viewer-data";
import type { SourceRef } from "$lib/assistant/types";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const GET: RequestHandler = async (event) => {
  const session = await getSession(event);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = normalize(event.url.searchParams.get("q")?.slice(0, 80) ?? "");
  const type = event.url.searchParams.get("type") ?? "";
  if (!query && !type) return json({ pins: [] });

  const viewer = new ViewerData(
    session.user.id,
    todayKey(),
    (session.user as { role?: string | null }).role ?? null,
  );
  const [parties, loans] = await Promise.all([
    viewer.partyCandidates(),
    viewer.allLoans(),
  ]);

  const pins: Array<SourceRef & { hint: string }> = [];

  for (const party of parties) {
    if (type && party.type !== type) continue;
    if (!normalize(party.name).includes(query)) continue;
    pins.push({
      type: party.type,
      id: party.id,
      label: party.name,
      href:
        party.type === "borrower"
          ? `/borrowers/${party.id}`
          : party.type === "investor"
            ? `/investors/${party.id}`
            : "/witnesses",
      hint: `${party.type}${party.loanCount > 0 ? ` · ${party.loanCount} loan${party.loanCount === 1 ? "" : "s"}` : ""}`,
    });
  }
  for (const loan of loans) {
    if (type && type !== "loan") continue;
    if (!normalize(loan.loanName).includes(query)) continue;
    pins.push({
      type: "loan",
      id: loan.id,
      label: loan.loanName,
      href: `/loans/${loan.id}`,
      hint: `loan${loan.borrower?.name ? ` · ${loan.borrower.name}` : ""}`,
    });
  }

  const ranked = pins
    .sort((a, b) => {
      const aStart = normalize(String(a.label ?? ""))
        .toLowerCase()
        .startsWith(query)
        ? 0
        : 1;
      const bStart = normalize(String(b.label ?? ""))
        .toLowerCase()
        .startsWith(query)
        ? 0
        : 1;
      return (
        aStart - bStart ||
        String(a.label ?? "").localeCompare(String(b.label ?? ""))
      );
    })
    .slice(0, 8);

  return json(
    { pins: ranked },
    { headers: { "Cache-Control": "private, max-age=15" } },
  );
};
