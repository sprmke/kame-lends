import { getContext, setContext } from "svelte";

const OVERLAY_LAYER = Symbol("overlay-layer");
const BASE_Z = 50;
const STEP = 10;

let stack: symbol[] = $state([]);

function zIndexFor(id: symbol): number {
  const index = stack.indexOf(id);
  return index === -1 ? BASE_Z : BASE_Z + index * STEP;
}

export function createOverlayLayer(getOpen: () => boolean) {
  const id = Symbol("overlay");

  $effect(() => {
    if (!getOpen()) return;
    stack = [...stack, id];
    return () => {
      stack = stack.filter((item) => item !== id);
    };
  });

  return {
    get zIndex() {
      return zIndexFor(id);
    },
  };
}

export function provideOverlayLayer(getOpen: () => boolean) {
  const layer = createOverlayLayer(getOpen);
  setContext(OVERLAY_LAYER, layer);
  return layer;
}

export function useOverlayLayer() {
  return getContext<ReturnType<typeof createOverlayLayer> | undefined>(
    OVERLAY_LAYER,
  );
}
