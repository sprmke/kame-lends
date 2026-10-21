<script lang="ts">
	import { Check, ChevronDown, Search } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import {
		DROPDOWN_LIST_MAX_HEIGHT_CLASS,
		filterDropdownOptions,
		shouldShowDropdownSearch,
		type DropdownOption
	} from '$lib/dropdown-ux';
	import { cn } from '$lib/utils';

	interface Props {
		id?: string;
		options: DropdownOption[];
		selectedIds: string[];
		onToggle: (value: string) => void;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyMessage?: string;
		disabled?: boolean;
		sheetTitle: string;
	}

	let {
		id,
		options,
		selectedIds,
		onToggle,
		placeholder = 'Select',
		searchPlaceholder = 'Search',
		emptyMessage = 'No results',
		disabled = false,
		sheetTitle
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let searchInputRef = $state<HTMLInputElement | null>(null);
	const mobileShell = createIsMobileShell(false);

	const showSearch = $derived(shouldShowDropdownSearch(options.length));
	const filteredOptions = $derived(filterDropdownOptions(options, query));
	const selectedCount = $derived(selectedIds.length);
	const displayLabel = $derived.by(() => {
		if (selectedCount === 0) return placeholder;
		if (selectedCount === 1) {
			return options.find((option) => option.value === selectedIds[0])?.label ?? placeholder;
		}
		return `${selectedCount} selected`;
	});

	$effect(() => mobileShell.init());

	$effect(() => {
		if (!open) {
			query = '';
			return;
		}
		if (showSearch && !mobileShell.matches) {
			requestAnimationFrame(() => searchInputRef?.focus());
		}
	});
</script>

{#snippet field(props: Record<string, unknown> = {})}
	<Button
		{...props}
		{id}
		type="button"
		variant="outline"
		class={cn(
			'h-11 min-h-11 w-full justify-between rounded-2xl border border-border/50 bg-card px-4 font-normal shadow-none hover:bg-card',
			selectedCount === 0 && 'text-muted-foreground'
		)}
		{disabled}
		aria-expanded={open}
	>
		<span class="truncate text-left">{displayLabel}</span>
		<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
	</Button>
{/snippet}

{#snippet optionsList()}
	{#if showSearch}
		<div class="relative mb-2">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				bind:ref={searchInputRef}
				value={query}
				oninput={(event) => (query = event.currentTarget.value)}
				placeholder={searchPlaceholder}
				class="h-11 pl-9"
				onkeydown={(event) => event.stopPropagation()}
			/>
		</div>
	{/if}
	<div
		class={cn(
			'space-y-0.5 overflow-y-auto',
			mobileShell.matches ? 'max-h-[50vh]' : DROPDOWN_LIST_MAX_HEIGHT_CLASS
		)}
	>
		{#if filteredOptions.length > 0}
			{#each filteredOptions as option (option.value)}
				{@const selected = selectedIds.includes(option.value)}
				<button
					type="button"
					class={cn(
						'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm',
						selected ? 'bg-primary/10' : 'hover:bg-accent'
					)}
					onclick={() => onToggle(option.value)}
				>
					<span class="min-w-0 flex-1 truncate">{option.label}</span>
					{#if selected}
						<Check class="h-4 w-4 shrink-0" aria-hidden="true" />
					{/if}
				</button>
			{/each}
		{:else}
			<p class="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
		{/if}
	</div>
{/snippet}

{#if mobileShell.matches}
	{@render field({
		onclick: () => (open = true),
		'aria-haspopup': 'dialog'
	})}
	<ResponsiveModal
		{open}
		onOpenChange={(next) => (open = next)}
		title={sheetTitle}
		deferBody={false}
		contentClass="sm:max-w-lg"
	>
		{@render optionsList()}
	</ResponsiveModal>
{:else}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				{@render field(props)}
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-2" align="start">
			{@render optionsList()}
		</Popover.Content>
	</Popover.Root>
{/if}
