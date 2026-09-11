<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import ImageUploadPreview from '$lib/components/common/ImageUploadPreview.svelte';
	import { readValidIdFileAsDataUrl } from '$lib/valid-id-document';
	import { toast } from '$lib/toast';

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
	const inputId = $derived(idPrefix ? `${idPrefix}-valid-id-file` : undefined);

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

	<ImageUploadPreview
		{value}
		alt="{label} preview"
		{disabled}
		{isProcessing}
		emptyLabel={buttonLabel}
		onPick={() => inputRef?.click()}
		onRemove={() => onChange(null)}
	/>

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
