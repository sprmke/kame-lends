import { getContext, setContext, untrack } from "svelte";

const OVERLAY_LAYER = Symbol("overlay-layer");
const BASE_Z = 50;
const STEP = 10;

const stack = $state<symbol[]>([]);

function zIndexFor(id: symbol): number {
  const index = stack.indexOf(id);
  return index === -1 ? BASE_Z : BASE_Z + index * STEP;
}

function pushLayer(id: symbol) {
  if (!stack.includes(id)) stack.push(id);
}

function removeLayer(id: symbol) {
  const index = stack.indexOf(id);
  if (index !== -1) stack.splice(index, 1);
}

export function createOverlayLayer(getOpen: () => boolean) {
  const id = Symbol("overlay");

  $effect(() => {
    if (!getOpen()) return;
    // Subscribe to open only. Reading/writing `stack` here loops the effect.
    untrack(() => pushLayer(id));
    return () => untrack(() => removeLayer(id));
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
