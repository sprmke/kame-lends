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
    this.claims += 1;
  }

  release() {
    this.claims = Math.max(0, this.claims - 1);
  }
}

export const mobileDockSlot = new MobileDockSlotStore();
