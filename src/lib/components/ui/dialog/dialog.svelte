<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { provideOverlayLayer } from "$lib/composables/overlay-stack.svelte";

	let { open = $bindable(false), ...restProps }: DialogPrimitive.RootProps = $props();
	provideOverlayLayer(() => open);
</script>

<DialogPrimitive.Root bind:open {...restProps} />
