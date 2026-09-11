<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs';
	import ImageUploadPreview from '$lib/components/common/ImageUploadPreview.svelte';
	import SignatureDrawBox from '$lib/components/common/SignatureDrawBox.svelte';
	import { readSignatureImageFileAsDataUrl } from '$lib/valid-id-document';
	import { toast } from '$lib/toast';
	import { Eraser, Save } from 'lucide-svelte';

	interface Props {
		value?: string | null;
		onChange: (value: string | null) => void;
		disabled?: boolean;
		label?: string;
		idPrefix?: string;
	}

	let {
		value = null,
		onChange,
		disabled = false,
		label = 'E-Signature',
		idPrefix
	}: Props = $props();

	let inputRef = $state<HTMLInputElement | null>(null);
	let drawBox = $state<SignatureDrawBox | null>(null);
	let isProcessing = $state(false);
	let mode = $state<'upload' | 'draw'>('upload');
	let draftHasInk = $state(false);

	const inputId = $derived(idPrefix ? `${idPrefix}-signature-file` : undefined);
	const busy = $derived(disabled || isProcessing);

	async function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (!file) return;

		isProcessing = true;
		try {
			onChange(await readSignatureImageFileAsDataUrl(file));
			mode = 'upload';
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to upload signature.');
		} finally {
			isProcessing = false;
		}
	}

	function handleRemove() {
		onChange(null);
		drawBox?.clear();
		draftHasInk = false;
		mode = 'upload';
	}

	function handleClearDrawn() {
		drawBox?.clear();
		draftHasInk = false;
	}

	function handleSaveDrawn() {
		const dataUrl = drawBox?.getDataUrl();
		if (!dataUrl) {
			toast.error('Draw your signature first.');
			return;
		}
		onChange(dataUrl);
		drawBox?.clear();
		draftHasInk = false;
		mode = 'upload';
	}

	function handleModeChange(next: string) {
		mode = next as 'upload' | 'draw';
	}

	function handleCancelDraw() {
		drawBox?.clear();
		draftHasInk = false;
		mode = 'upload';
	}
</script>

<div class="space-y-2">
	<Label for={inputId}>{label}</Label>

	{#if value && mode === 'upload'}
		<ImageUploadPreview
			{value}
			alt="E-signature preview"
			disabled={busy}
			{isProcessing}
			emptyLabel="Upload e-signature"
			previewClass="max-h-24 w-full object-contain object-left"
			frameClass="bg-white px-3 py-2"
			onPick={() => inputRef?.click()}
			onRemove={handleRemove}
			onDraw={() => (mode = 'draw')}
		/>
	{:else if mode === 'draw'}
		<div class="space-y-2">
			{#if value}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="min-h-11 w-full sm:w-auto"
					disabled={busy}
					onclick={handleCancelDraw}
				>
					Cancel
				</Button>
			{/if}
			<SignatureDrawBox
				bind:this={drawBox}
				compact
				liveCommit={false}
				disabled={busy}
				onInkChange={(next) => (draftHasInk = next)}
			/>
			<div class="flex flex-col gap-2 sm:flex-row">
				<Button
					type="button"
					variant="outline"
					size="sm"
					class="min-h-11 w-full sm:w-auto"
					disabled={busy || !draftHasInk}
					onclick={handleClearDrawn}
				>
					<Eraser class="mr-1.5 h-3.5 w-3.5" />
					Clear
				</Button>
				<Button
					type="button"
					size="sm"
					class="min-h-11 w-full sm:flex-1"
					disabled={busy || !draftHasInk}
					onclick={handleSaveDrawn}
				>
					<Save class="mr-1.5 h-3.5 w-3.5" />
					Save
				</Button>
			</div>
		</div>
	{:else}
		<Tabs.Root value={mode} onValueChange={handleModeChange}>
			<Tabs.List class="grid h-9 w-full grid-cols-2 gap-1 p-1">
				<Tabs.Trigger value="upload" class="h-full w-full px-2 text-xs" disabled={busy}>
					Upload
				</Tabs.Trigger>
				<Tabs.Trigger value="draw" class="h-full w-full px-2 text-xs" disabled={busy}>Draw</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="upload" class="mt-2">
				<ImageUploadPreview
					value={null}
					alt="E-signature preview"
					disabled={busy}
					{isProcessing}
					emptyLabel="Upload e-signature"
					previewClass="max-h-24 w-full object-contain object-left"
					frameClass="bg-white px-3 py-2"
					onPick={() => inputRef?.click()}
					onRemove={handleRemove}
				/>
			</Tabs.Content>

			<Tabs.Content value="draw" class="mt-2 space-y-2">
				<SignatureDrawBox
					bind:this={drawBox}
					compact
					liveCommit={false}
					disabled={busy}
					onInkChange={(next) => (draftHasInk = next)}
				/>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="min-h-11 w-full sm:w-auto"
						disabled={busy || !draftHasInk}
						onclick={handleClearDrawn}
					>
						<Eraser class="mr-1.5 h-3.5 w-3.5" />
						Clear
					</Button>
					<Button
						type="button"
						size="sm"
						class="min-h-11 w-full sm:flex-1"
						disabled={busy || !draftHasInk}
						onclick={handleSaveDrawn}
					>
						<Save class="mr-1.5 h-3.5 w-3.5" />
						Save
					</Button>
				</div>
			</Tabs.Content>
		</Tabs.Root>
	{/if}

	<input
		bind:this={inputRef}
		id={inputId}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		class="hidden"
		disabled={busy}
		onchange={handleFileChange}
	/>
</div>
