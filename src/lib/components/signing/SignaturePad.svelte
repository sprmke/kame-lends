<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SignatureDrawBox from '$lib/components/common/SignatureDrawBox.svelte';
	import { Eraser } from 'lucide-svelte';

	interface Props {
		onChange: (dataUrl: string | null) => void;
		onDrawingChange?: (isDrawing: boolean) => void;
		disabled?: boolean;
		class?: string;
	}

	let { onChange, onDrawingChange, disabled = false, class: className = '' }: Props = $props();

	let drawBox = $state<SignatureDrawBox | null>(null);
	let hasInk = $state(false);

	function handleChange(dataUrl: string | null) {
		onChange(dataUrl);
	}

	function clear() {
		drawBox?.clear();
		hasInk = false;
	}
</script>

<div class="space-y-3 {className}">
	<SignatureDrawBox
		bind:this={drawBox}
		{disabled}
		liveCommit
		onChange={handleChange}
		onInkChange={(next) => (hasInk = next)}
		onDrawingChange={onDrawingChange}
	/>

	<div class="flex flex-col gap-2.5">
		<p class="text-sm leading-relaxed text-muted-foreground">
			Draw your signature inside the box above using your mouse or finger.
		</p>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="w-full sm:w-auto sm:self-start"
			onclick={clear}
			disabled={disabled || !hasInk}
		>
			<Eraser class="mr-1.5 h-3.5 w-3.5" />
			Clear Signature
		</Button>
	</div>
</div>
