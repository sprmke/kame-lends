import { describe, expect, it } from "vitest";
import { findMatchingParty, nameMatchScore, nameTokens } from "./match-party";

const lenders = [
  { id: 1, name: "Juan Dela Cruz" },
  { id: 2, name: "Maria Santos" },
  { id: 3, name: "José Rizal" },
];

describe("nameTokens", () => {
  it("normalizes accents, punctuation and honorifics but keeps masks", () => {
    expect(nameTokens("Atty. José  Rizal, Jr.")).toEqual(["jose", "rizal"]);
    expect(nameTokens("JU** DE** C.")).toEqual(["ju**", "de**", "c"]);
  });
});

describe("nameMatchScore", () => {
  it("scores exact, contained, reordered, and masked names", () => {
    expect(nameMatchScore("JUAN DELA CRUZ", "Juan Dela Cruz")).toBe(1);
    expect(nameMatchScore("Juan Dela Cruz Jr", "Juan Dela Cruz")).toBe(1);
    expect(nameMatchScore("Maria", "Maria Santos")).toBe(0.9);
    expect(nameMatchScore("SANTOS, MARIA", "Maria Santos")).toBe(0.85);
    expect(nameMatchScore("JU** DE** C.", "Juan Dela Cruz")).toBe(0.75);
  });

  it("rejects weak or wrong matches", () => {
    expect(nameMatchScore("J", "Juan Dela Cruz")).toBe(0);
    expect(nameMatchScore("MA** SA**", "Juan Dela Cruz")).toBe(0);
    expect(nameMatchScore("Pedro Penduko", "Juan Dela Cruz")).toBe(0);
    expect(nameMatchScore("", "Juan")).toBe(0);
  });
});

describe("findMatchingParty", () => {
  it("returns the unique best lender", () => {
    expect(findMatchingParty("JU** DE** C.", lenders)?.id).toBe(1);
    expect(findMatchingParty("Jose Rizal", lenders)?.id).toBe(3);
  });

  it("returns null when ambiguous or unknown", () => {
    const twins = [
      { id: 1, name: "Juan Dela Cruz" },
      { id: 2, name: "Juana Dela Cruz" },
    ];
    expect(findMatchingParty("JU** DE** C.", twins)).toBeNull();
    expect(findMatchingParty("Someone Else", lenders)).toBeNull();
    expect(findMatchingParty(null, lenders)).toBeNull();
  });
});
