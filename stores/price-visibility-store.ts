import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { APP_NAME_SLUG } from '@/lib/brand';

interface PriceVisibilityState {
  pricesHidden: boolean;
  togglePricesHidden: () => void;
  setPricesHidden: (hidden: boolean) => void;
}

export const usePriceVisibilityStore = create<PriceVisibilityState>()(
  persist(
    (set) => ({
      pricesHidden: false,
      togglePricesHidden: () =>
        set((state) => ({ pricesHidden: !state.pricesHidden })),
      setPricesHidden: (pricesHidden) => set({ pricesHidden }),
    }),
    {
      name: `${APP_NAME_SLUG}-price-visibility`,
      storage: createJSONStorage(() => localStorage),
    }
  )
);
