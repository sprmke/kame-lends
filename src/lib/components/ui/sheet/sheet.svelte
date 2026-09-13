<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";
	import { provideOverlayLayer } from "$lib/composables/overlay-stack.svelte";

	let { open = $bindable(false), ...restProps }: SheetPrimitive.RootProps = $props();
	provideOverlayLayer(() => open);
</script>

<SheetPrimitive.Root bind:open {...restProps} />
