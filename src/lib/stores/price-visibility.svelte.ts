import { browser } from "$app/environment";
import { APP_NAME_SLUG } from "$lib/brand";

const STORAGE_KEY = `${APP_NAME_SLUG}-price-visibility`;

function readInitial(): boolean {
  if (!browser) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { pricesHidden?: boolean };
    return !!parsed.pricesHidden;
  } catch {
    return false;
  }
}

function persist(hidden: boolean) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ pricesHidden: hidden }));
}

class PriceVisibilityStore {
  pricesHidden = $state(readInitial());

  togglePricesHidden() {
    this.pricesHidden = !this.pricesHidden;
    persist(this.pricesHidden);
  }

  setPricesHidden(hidden: boolean) {
    this.pricesHidden = hidden;
    persist(this.pricesHidden);
  }
}

export const priceVisibility = new PriceVisibilityStore();
