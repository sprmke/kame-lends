<script lang="ts">
	import type { AssistantPinChip } from '$lib/assistant/store.svelte';
	import type { QuickTool } from '$lib/assistant/quick-tools';
	import { MAX_MESSAGE_CHARS } from '$lib/assistant/types';
	import { useSpeechToText } from '$lib/assistant/use-speech.svelte';
	import { readReceiptFileAsDataUrl } from '$lib/receipt-image';
	import MentionPicker from './MentionPicker.svelte';
	import QuickToolsGallery from './QuickToolsGallery.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		ArrowUp,
		ImagePlus,
		Mic,
		MicOff,
		Paperclip,
		Sparkles,
		Square,
		Wand2,
		X
	} from 'lucide-svelte';

	interface Props {
		streaming: boolean;
		pins: AssistantPinChip[];
		pageLabel?: string | null;
		onSend: (text: string, imageDataUrl?: string) => void;
		onStop: () => void;
		onAddPin: (pin: AssistantPinChip) => void;
		onRemovePin: (pin: AssistantPinChip) => void;
		onQuickToolHint?: (message: string) => void;
	}

	let {
		streaming,
		pins,
		pageLabel = null,
		onSend,
		onStop,
		onAddPin,
		onRemovePin,
		onQuickToolHint
	}: Props = $props();

	let text = $state('');
	let textarea = $state<HTMLTextAreaElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let imageDataUrl = $state<string | null>(null);
	let imageError = $state<string | null>(null);
	let attachmentBusy = $state(false);
	let quickOpen = $state(false);
	let mentionOpen = $state(false);
	let mentionQuery = $state('');
	let mentionType = $state<'borrower' | 'investor' | 'loan' | undefined>(undefined);
	let pendingTool = $state<QuickTool | null>(null);
	let picker = $state<{ onKey: (event: KeyboardEvent) => boolean } | null>(null);
	const speech = useSpeechToText();

	$effect(() => {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
	});

	$effect(() => {
		if (!mentionOpen) mentionQuery = '';
	});

	function detectMention(value: string, caret: number) {
		const before = value.slice(0, caret);
		const match = /(?:^|\s)@([^\s@]*)$/.exec(before);
		if (!match) {
			if (!pendingTool) mentionOpen = false;
			return;
		}
		mentionType = pendingTool?.requires;
		mentionQuery = match[1];
		mentionOpen = true;
	}

	function send() {
		const message = text.trim();
		if ((!message && !imageDataUrl) || streaming) return;
		onSend(message || 'What is in this image?', imageDataUrl ?? undefined);
		text = '';
		imageDataUrl = null;
		imageError = null;
		speech.stop();
		if (textarea) textarea.style.height = 'auto';
	}

	function pickPin(pin: AssistantPinChip) {
		onAddPin(pin);
		mentionOpen = false;
		mentionQuery = '';
		text = text.replace(/(?:^|\s)@[^\s@]*$/, ' ').trim();
		if (pendingTool) {
			const prompt = pendingTool.prompt;
			pendingTool = null;
			onSend(prompt);
		} else {
			textarea?.focus();
		}
	}

	function pickQuickTool(tool: QuickTool) {
		quickOpen = false;
		const alreadyPinned = tool.requires
			? pins.some((pin) => pin.type === tool.requires)
			: true;
		if (!tool.requires || alreadyPinned) {
			onSend(tool.prompt);
			return;
		}
		pendingTool = tool;
		mentionType = tool.requires;
		mentionQuery = '';
		mentionOpen = true;
		onQuickToolHint?.(`Pick a ${tool.requires} for this question.`);
	}

	async function attach(file: File | undefined) {
		if (!file) return;
		attachmentBusy = true;
		imageError = null;
		try {
			imageDataUrl = await readReceiptFileAsDataUrl(file);
		} catch (error) {
			imageError = error instanceof Error ? error.message : "Couldn't open that image.";
		} finally {
			attachmentBusy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function toggleMic() {
		if (speech.listening) {
			speech.stop();
			return;
		}
		speech.start(text, (value) => (text = value));
	}

	function onKeydown(event: KeyboardEvent) {
		if (mentionOpen && picker?.onKey(event)) return;
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (streaming) return;
			send();
		} else if (event.key === 'Escape') {
			quickOpen = false;
			mentionOpen = false;
			if (streaming) onStop();
		}
	}

	function onPaste(event: ClipboardEvent) {
		const item = [...(event.clipboardData?.items ?? [])].find((entry) =>
			entry.type.startsWith('image/')
		);
		const file = item?.getAsFile();
		if (!file) return;
		event.preventDefault();
		void attach(file);
	}

	function onDrop(event: DragEvent) {
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;
		event.preventDefault();
		void attach(file);
	}

	const canSend = $derived((text.trim().length > 0 || imageDataUrl !== null) && !streaming);
	const nearLimit = $derived(text.length > MAX_MESSAGE_CHARS * 0.8);
</script>

<div class="relative border-t border-border/55 bg-background/95 px-2.5 pt-2 pb-[max(0.625rem,var(--safe-area-bottom))]">
	{#if pins.length > 0 || pageLabel}
		<div class="mb-1.5 flex flex-wrap gap-1">
			{#if pageLabel}
				<span class="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
					{pageLabel}
				</span>
			{/if}
			{#each pins as pin (pin.type + String(pin.id))}
				<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
					{pin.label}
					<button
						type="button"
						class="ml-0.5 rounded-full p-0.5 hover:bg-primary/15"
						aria-label={`Remove ${pin.label}`}
						onclick={() => onRemovePin(pin)}
					>
						<X class="size-2.5" />
					</button>
				</span>
			{/each}
		</div>
	{/if}

	{#if imageDataUrl}
		<div class="mb-1.5 flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-1.5">
			<!-- eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -->
			<img src={imageDataUrl} alt="Attachment preview" class="size-9 rounded object-cover" />
			<span class="min-w-0 flex-1 text-[10.5px] text-muted-foreground">Image attached. It is processed in memory and not saved.</span>
			<button
				type="button"
				class="native-press inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
				aria-label="Remove image"
				onclick={() => (imageDataUrl = null)}
			>
				<X class="size-3.5" />
			</button>
		</div>
	{/if}

	{#if speech.error || imageError}
		<p class="mb-1.5 rounded-md bg-destructive/8 px-2 py-1 text-[10.5px] text-destructive">
			{speech.error ?? imageError}
		</p>
	{/if}

	{#if quickOpen}
		<QuickToolsGallery onPick={pickQuickTool} onClose={() => (quickOpen = false)} />
	{/if}
	{#if mentionOpen}
		<MentionPicker
			bind:this={picker}
			query={mentionQuery}
			typeFilter={mentionType}
			onPick={pickPin}
			onClose={() => (mentionOpen = false)}
		/>
	{/if}

	<div
		class="flex items-end gap-1 rounded-xl border border-border/70 bg-card px-1.5 py-1 shadow-sm focus-within:border-primary/50"
		ondragover={(event) => event.preventDefault()}
		ondrop={onDrop}
	>
		<button
			type="button"
			class="native-press mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			aria-label="Quick tools"
			disabled={streaming}
			onclick={() => {
				quickOpen = !quickOpen;
				mentionOpen = false;
			}}
		>
			<Wand2 class="size-4" />
		</button>
		<button
			type="button"
			class="native-press mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			aria-label="Pin a borrower, investor, or loan"
			disabled={streaming}
			onclick={() => {
				pendingTool = null;
				mentionType = undefined;
				mentionQuery = '';
				mentionOpen = !mentionOpen;
				quickOpen = false;
				setTimeout(() => textarea?.focus(), 0);
			}}
		>
			<Sparkles class="size-4" />
		</button>
		<textarea
			bind:this={textarea}
			bind:value={text}
			rows="1"
			maxlength={MAX_MESSAGE_CHARS}
			placeholder="Ask about your loans…"
			class="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] leading-5 outline-none placeholder:text-muted-foreground/70"
			oninput={(event) => detectMention(text, event.currentTarget.selectionStart ?? text.length)}
			onkeydown={onKeydown}
			onpaste={onPaste}
			aria-label="Question"
		></textarea>
		<button
			type="button"
			class="native-press mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			aria-label="Attach an image"
			disabled={streaming || attachmentBusy}
			onclick={() => fileInput?.click()}
		>
			{#if imageDataUrl}<ImagePlus class="size-4 text-primary" />{:else}<Paperclip class="size-4" />{/if}
		</button>
		{#if speech.supported}
			<button
				type="button"
				class={[
					'native-press mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted',
					speech.listening ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
				]}
				aria-label={speech.listening ? 'Stop voice input' : 'Speak your question'}
				aria-pressed={speech.listening}
				disabled={streaming}
				onclick={toggleMic}
			>
				{#if speech.listening}<MicOff class="size-4" />{:else}<Mic class="size-4" />{/if}
			</button>
		{/if}
		{#if streaming}
			<Button
				type="button"
				size="icon"
				variant="secondary"
				class="mb-0.5 size-8 shrink-0 rounded-lg"
				onclick={onStop}
				aria-label="Stop the answer"
			>
				<Square class="size-3.5 fill-current" />
			</Button>
		{:else}
			<Button
				type="button"
				size="icon"
				class="mb-0.5 size-8 shrink-0 rounded-lg"
				disabled={!canSend}
				onclick={send}
				aria-label="Send question"
			>
				<ArrowUp class="size-4" />
			</Button>
		{/if}
	</div>
	{#if nearLimit}
		<p class="mt-1 text-right text-[10px] text-muted-foreground">{text.length}/{MAX_MESSAGE_CHARS}</p>
	{/if}
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
		capture="environment"
		aria-label="Attach an image"
		class="sr-only"
		onchange={(event) => void attach(event.currentTarget.files?.[0])}
	/>
</div>
