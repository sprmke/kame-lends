<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import { provideOverlayLayer } from "$lib/composables/overlay-stack.svelte";

	let { open = $bindable(false), ...restProps }: AlertDialogPrimitive.RootProps = $props();
	provideOverlayLayer(() => open);
</script>

<AlertDialogPrimitive.Root bind:open {...restProps} />
