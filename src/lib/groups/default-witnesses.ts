import type { ContractCustomization } from "$lib/loan-contract-customization";

/** A contract has two witness slots. */
export const CONTRACT_WITNESS_SLOT_COUNT = 2;

export type DefaultWitnessProfile = {
  id: number;
  name: string;
  email: string | null;
  address: string | null;
  validIdUrl: string | null;
  eSignatureUrl: string | null;
  autoSign: boolean;
};

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function slotIncluded(
  customization: ContractCustomization,
  slot: 1 | 2,
): boolean {
  if (!customization.includeWitnesses) return false;
  if (slot === 2 && !customization.includeSecondWitness) return false;
  return true;
}

function slotId(
  customization: ContractCustomization,
  slot: 1 | 2,
): number | null {
  return slot === 1 ? customization.witness1Id : customization.witness2Id;
}

function slotName(customization: ContractCustomization, slot: 1 | 2): string {
  return slot === 1 ? customization.witness1Name : customization.witness2Name;
}

/** A slot is taken when it is included and already names someone. */
export function witnessSlotOccupied(
  customization: ContractCustomization,
  slot: 1 | 2,
): boolean {
  if (!slotIncluded(customization, slot)) return false;
  const id = slotId(customization, slot);
  return id != null || slotName(customization, slot).trim().length > 0;
}

function canAutoSign(witness: DefaultWitnessProfile): boolean {
  return witness.autoSign && text(witness.eSignatureUrl).length > 0;
}

function writeSlot(
  next: ContractCustomization,
  slot: 1 | 2,
  witness: DefaultWitnessProfile,
): void {
  next.includeWitnesses = true;
  const sign = canAutoSign(witness);
  if (slot === 1) {
    next.witness1Id = witness.id;
    next.witness1Name = witness.name;
    next.witness1Email = text(witness.email);
    next.witness1Address = text(witness.address);
    next.witness1ValidIdUrl = text(witness.validIdUrl);
    next.witness1ESignatureUrl = text(witness.eSignatureUrl);
    next.witness1SignatureIncluded = sign;
    return;
  }
  next.includeSecondWitness = true;
  next.witness2Id = witness.id;
  next.witness2Name = witness.name;
  next.witness2Email = text(witness.email);
  next.witness2Address = text(witness.address);
  next.witness2ValidIdUrl = text(witness.validIdUrl);
  next.witness2ESignatureUrl = text(witness.eSignatureUrl);
  next.witness2SignatureIncluded = sign;
}

/**
 * First-seen order. The same witness from several groups is kept once.
 * Auto-sign is on if any group turned it on for that witness.
 */
export function uniqueDefaultWitnesses(
  witnesses: DefaultWitnessProfile[],
): DefaultWitnessProfile[] {
  const byId = new Map<number, DefaultWitnessProfile>();
  const order: number[] = [];
  for (const witness of witnesses) {
    const existing = byId.get(witness.id);
    if (!existing) {
      byId.set(witness.id, { ...witness });
      order.push(witness.id);
      continue;
    }
    if (witness.autoSign) existing.autoSign = true;
  }
  return order.map((id) => byId.get(id)!);
}

/**
 * Fill empty contract witness slots from group defaults.
 * Occupied slots that name a different person stay as they are.
 * Matching people are not written twice. Auto-sign turns on Use saved
 * signature only when that witness has a saved signature.
 */
export function applyDefaultWitnesses(
  customization: ContractCustomization,
  witnesses: DefaultWitnessProfile[],
): ContractCustomization {
  const next: ContractCustomization = { ...customization };
  const placed = new Set<number>();

  for (const slot of [1, 2] as const) {
    if (!witnessSlotOccupied(next, slot)) continue;
    const id = slotId(next, slot);
    if (id != null) placed.add(id);
  }

  const pending = uniqueDefaultWitnesses(witnesses);

  for (const witness of pending) {
    if (!canAutoSign(witness)) continue;
    if (next.witness1Id === witness.id && witnessSlotOccupied(next, 1)) {
      next.witness1SignatureIncluded = true;
      if (!text(next.witness1ESignatureUrl)) {
        next.witness1ESignatureUrl = text(witness.eSignatureUrl);
      }
    }
    if (next.witness2Id === witness.id && witnessSlotOccupied(next, 2)) {
      next.witness2SignatureIncluded = true;
      if (!text(next.witness2ESignatureUrl)) {
        next.witness2ESignatureUrl = text(witness.eSignatureUrl);
      }
    }
  }

  for (const witness of pending) {
    if (placed.has(witness.id)) continue;
    const slot = !witnessSlotOccupied(next, 1)
      ? 1
      : !witnessSlotOccupied(next, 2)
        ? 2
        : null;
    if (slot == null) break;
    writeSlot(next, slot, witness);
    placed.add(witness.id);
    if (
      placed.size >= CONTRACT_WITNESS_SLOT_COUNT &&
      witnessSlotOccupied(next, 1) &&
      witnessSlotOccupied(next, 2)
    ) {
      break;
    }
  }

  return next;
}
