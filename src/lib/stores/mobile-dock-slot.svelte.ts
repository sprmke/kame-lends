/**
 * Phone select / contextual bars claim this slot so Nav can hide MobileTabBar.
 * One bottom nav layer under `lg` (tab bar or this bar, never both).
 */
class MobileDockSlotStore {
  claims = $state(0);

  get claimed() {
    return this.claims > 0;
  }

  claim() {
    const next = this.claims + 1;
    if (next === this.claims) return;
    this.claims = next;
  }

  release() {
    const next = Math.max(0, this.claims - 1);
    if (next === this.claims) return;
    this.claims = next;
  }
}

export const mobileDockSlot = new MobileDockSlotStore();
