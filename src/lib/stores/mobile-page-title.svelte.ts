/**
 * Optional override for MobileTopBar titles on detail/entity pages.
 * DetailHeader (and similar) set this while mounted; Nav falls back to path-based titles.
 */
class MobilePageTitleStore {
  override = $state<string | null>(null);

  set(title: string | null) {
    this.override = title?.trim() ? title.trim() : null;
  }

  clear() {
    this.override = null;
  }
}

export const mobilePageTitle = new MobilePageTitleStore();
