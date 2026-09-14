import { getContext, setContext, untrack } from "svelte";

const OVERLAY_LAYER = Symbol("overlay-layer");
const BASE_Z = 50;
const STEP = 10;

const stack = $state<symbol[]>([]);
let stackGeneration = $state(0);

function zIndexFor(id: symbol): number {
  const index = stack.indexOf(id);
  return index === -1 ? BASE_Z : BASE_Z + index * STEP;
}

function pushLayer(id: symbol) {
  if (stack.includes(id)) return;
  stack.push(id);
  stackGeneration += 1;
}

function removeLayer(id: symbol) {
  const index = stack.indexOf(id);
  if (index === -1) return;
  stack.splice(index, 1);
  stackGeneration += 1;
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

export function overlayStackIsOpen(): boolean {
  void stackGeneration;
  return stack.length > 0;
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
