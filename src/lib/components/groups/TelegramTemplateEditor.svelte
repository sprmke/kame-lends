<script lang="ts">
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import {
		DEFAULT_GROUP_TELEGRAM_TEMPLATES,
		GROUP_TELEGRAM_PREVIEW_SAMPLES,
		GROUP_TELEGRAM_TEMPLATE_LABELS,
		applyTelegramTemplate,
		groupTelegramPlaceholdersFor,
		type GroupTelegramTemplateKind
	} from '$lib/groups/group-telegram-templates';
	import {
		formatTelegramPreviewText,
		normalizeTelegramTemplateText,
		splitTemplateHighlightParts
	} from '$lib/groups/telegram-template-highlight';
	import { Braces, Check, Copy, Eye, Pencil, RotateCcw } from 'lucide-svelte';

	interface Props {
		kind: GroupTelegramTemplateKind;
		value: string;
		disabled?: boolean;
		showLabel?: boolean;
		onchange: (value: string) => void;
	}

	let { kind, value, disabled = false, showLabel = true, onchange }: Props = $props();

	let tab = $state<'edit' | 'preview'>('edit');
	let placeholdersOpen = $state(false);
	let copiedToken = $state<string | null>(null);
	let textarea = $state<HTMLTextAreaElement | null>(null);

	const label = $derived(GROUP_TELEGRAM_TEMPLATE_LABELS[kind]);
	const placeholders = $derived(groupTelegramPlaceholdersFor(kind));
	const validKeys = $derived(new Set(placeholders.map((row) => row.key)));
	const editParts = $derived(splitTemplateHighlightParts(value, validKeys));
	const previewText = $derived(applyTelegramTemplate(value, GROUP_TELEGRAM_PREVIEW_SAMPLES));
	const previewParts = $derived(splitTemplateHighlightParts(previewText, validKeys));
	const isDefault = $derived(value.trim() === DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind]);
	const inputId = $derived(`tg-template-${kind}`);

	const textLayerClass =
		'box-border w-full min-w-0 whitespace-pre-wrap break-words px-4 py-3 text-sm font-medium leading-[1.5]';

	function syncTextareaHeight() {
		const el = textarea;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}

	$effect(() => {
		// Read the template so the textarea resizes when the text changes.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		value;
		if (tab !== 'edit') return;
		syncTextareaHeight();
	});

	function commitNormalized() {
		const next = normalizeTelegramTemplateText(value);
		if (next !== value) onchange(next);
	}

	async function insertToken(token: string) {
		const current = value;
		const el = textarea;
		const start = el?.selectionStart ?? current.length;
		const end = el?.selectionEnd ?? start;
		const next = current.slice(0, start) + token + current.slice(end);
		tab = 'edit';
		placeholdersOpen = false;
		onchange(next);
		await tick();
		const field = textarea;
		if (!field) return;
		field.focus();
		const pos = start + token.length;
		field.setSelectionRange(pos, pos);
		syncTextareaHeight();
	}

	async function copyToken(token: string) {
		try {
			await navigator.clipboard.writeText(token);
			copiedToken = token;
			toast.success('Copied');
			window.setTimeout(() => {
				if (copiedToken === token) copiedToken = null;
			}, 1600);
		} catch {
			toast.error('Could not copy');
		}
	}

	function resetTemplate() {
		tab = 'edit';
		onchange(DEFAULT_GROUP_TELEGRAM_TEMPLATES[kind]);
	}
</script>

<div
	class="grid grid-cols-1 gap-2 rounded-lg border border-border/80 bg-background/80 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-3 sm:p-3"
>
	<div class="flex min-w-0 flex-wrap items-center gap-2">
		{#if showLabel}
			<Label for={tab === 'edit' ? inputId : `${inputId}-preview`} class="text-sm">
				{label}
			</Label>
		{/if}
		<div
			class="inline-flex rounded-lg bg-muted/50 p-0.5"
			role="tablist"
			aria-label="{label} view"
		>
			<button
				type="button"
				role="tab"
				class={cn(
					'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
					tab === 'edit'
						? 'bg-card text-foreground shadow-sm'
						: 'text-muted-foreground'
				)}
				aria-selected={tab === 'edit'}
				disabled={disabled}
				onclick={() => (tab = 'edit')}
			>
				<Pencil class="size-3.5" aria-hidden="true" />
				Edit
			</button>
			<button
				type="button"
				role="tab"
				class={cn(
					'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium',
					tab === 'preview'
						? 'bg-card text-foreground shadow-sm'
						: 'text-muted-foreground'
				)}
				aria-selected={tab === 'preview'}
				disabled={disabled}
				onclick={() => (tab = 'preview')}
			>
				<Eye class="size-3.5" aria-hidden="true" />
				Preview
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-end gap-2">
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="gap-1.5"
			{disabled}
			onclick={() => (placeholdersOpen = true)}
		>
			<Braces aria-hidden="true" />
			Placeholders
		</Button>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="gap-1.5"
			disabled={disabled || isDefault}
			onclick={resetTemplate}
		>
			<RotateCcw aria-hidden="true" />
			Reset
		</Button>
	</div>

	<div class="col-span-full min-w-0 sm:col-span-2">
		{#if tab === 'edit'}
			<div
				class="min-h-[88px] resize-y overflow-auto rounded-lg border border-border/70 bg-card shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)] focus-within:ring-2 focus-within:ring-ring dark:border-border/50 dark:bg-muted/40 dark:shadow-none"
			>
				<div class="relative grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1">
					<div aria-hidden="true" class="pointer-events-none text-foreground {textLayerClass}">
						{#if value}
							{#each editParts as part, index (index)}
								{#if part.kind === 'token'}
									<mark
										class="m-0 rounded-sm bg-primary/15 p-0 text-primary shadow-none [box-decoration-break:clone]"
									>{part.text}</mark>
								{:else}
									{part.text}
								{/if}
							{/each}
						{:else}
							<span class="text-transparent">Write the message</span>
						{/if}
					</div>
					<textarea
						bind:this={textarea}
						id={inputId}
						rows="3"
						spellcheck="false"
						autocomplete="off"
						placeholder="Write the message"
						aria-label={label}
						{disabled}
						{value}
						oninput={(event) => {
							onchange(event.currentTarget.value);
							syncTextareaHeight();
						}}
						onblur={commitNormalized}
						style="color: transparent; -webkit-text-fill-color: transparent;"
						class="caret-foreground relative z-[1] block min-h-full w-full resize-none overflow-hidden border-0 bg-transparent text-transparent outline-none selection:bg-primary/20 selection:text-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 {textLayerClass}"
					></textarea>
				</div>
			</div>
		{:else}
			<div class="space-y-1.5">
				<div
					id="{inputId}-preview"
					role="region"
					aria-label="{label} preview"
					class="min-h-[88px] resize-y overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-card px-4 py-3 text-sm font-medium leading-[1.5] text-foreground shadow-[inset_0_1px_2px_hsl(240_6%_10%_/0.04)] dark:border-border/50 dark:bg-muted/40 dark:shadow-none"
				>
					{#if !value.trim()}
						<span class="text-muted-foreground">Nothing to preview yet.</span>
					{:else}
						{#each previewParts as part, index (index)}
							{#if part.kind === 'token'}
								<mark class="rounded-sm bg-primary/15 font-mono text-primary">{part.text}</mark>
							{:else}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- preview escapes text, then restores only b and i -->
								{@html formatTelegramPreviewText(part.text)}
							{/if}
						{/each}
					{/if}
				</div>
				{#if value.trim()}
					<p class="text-xs text-muted-foreground">Sample data</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<ResponsiveModal
	open={placeholdersOpen}
	onOpenChange={(open) => (placeholdersOpen = open)}
	title="Placeholders"
>
	<p class="mb-3 text-xs text-muted-foreground">Tap to insert.</p>
	<ul class="space-y-1">
		{#each placeholders as row (row.key)}
			{@const token = `{{${row.key}}}`}
			{@const sample = GROUP_TELEGRAM_PREVIEW_SAMPLES[row.key]}
			<li class="flex items-start gap-1 rounded-lg hover:bg-muted/40">
				<button
					type="button"
					class="min-h-11 min-w-0 flex-1 px-2 py-2 text-left"
					onclick={() => insertToken(token)}
				>
					<code class="block font-mono text-xs font-semibold text-primary">{token}</code>
					<span class="mt-0.5 block text-xs text-muted-foreground">{row.label}</span>
					{#if sample}
						<span class="mt-0.5 block truncate text-xs text-muted-foreground/80">
							e.g. {sample.replaceAll('\n', ' ')}
						</span>
					{/if}
				</button>
				<button
					type="button"
					class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					aria-label="Copy {token}"
					onclick={() => copyToken(token)}
				>
					{#if copiedToken === token}
						<Check class="size-3.5 text-primary" aria-hidden="true" />
					{:else}
						<Copy class="size-3.5" aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</ResponsiveModal>
