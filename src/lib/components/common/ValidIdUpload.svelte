<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { readValidIdFileAsDataUrl } from '$lib/valid-id-document';
	import { toast } from '$lib/toast';
	import { Upload, X } from 'lucide-svelte';

	interface Props {
		value?: string | null;
		onChange: (value: string | null) => void;
		disabled?: boolean;
		label?: string;
		buttonLabel?: string;
		idPrefix?: string;
	}

	let {
		value = null,
		onChange,
		disabled = false,
		label = 'Valid ID',
		buttonLabel = 'Upload valid ID',
		idPrefix
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let isProcessing = $state(false);
	const inputId = $derived(idPrefix ? `${idPrefix}-file` : undefined);

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;

		isProcessing = true;
		try {
			onChange(await readValidIdFileAsDataUrl(file));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : `Failed to upload ${label.toLowerCase()}.`
			);
		} finally {
			isProcessing = false;
		}
	}
</script>

<div class="space-y-2">
	<Label for={inputId}>{label}</Label>

	{#if value}
		<div class="space-y-2">
			<div class="overflow-hidden rounded-md border border-border bg-muted/20">
				<img src={value} alt="{label} preview" class="max-h-48 w-full object-contain" />
			</div>
			<div class="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled || isProcessing}
					onclick={() => inputRef?.click()}
				>
					Replace
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={disabled || isProcessing}
					onclick={() => onChange(null)}
				>
					<X class="mr-1 h-3.5 w-3.5" />
					Remove
				</Button>
			</div>
		</div>
	{:else}
		<Button
			type="button"
			variant="outline"
			class="w-full justify-start"
			disabled={disabled || isProcessing}
			onclick={() => inputRef?.click()}
		>
			<Upload class="mr-2 h-4 w-4" />
			{isProcessing ? 'Processing...' : buttonLabel}
		</Button>
	{/if}

	<input
		bind:this={inputRef}
		id={inputId}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		class="hidden"
		disabled={disabled || isProcessing}
		onchange={handleFileChange}
	/>
</div>
