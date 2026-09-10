<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Check, ChevronDown, Search } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import {
		DROPDOWN_LIST_MAX_HEIGHT_CLASS,
		filterDropdownOptions,
		shouldShowDropdownSearch,
		type DropdownOption
	} from '$lib/dropdown-ux';
	import { cn } from '$lib/utils';

	interface HeaderContext {
		select: (value: string) => void;
	}

	interface Props {
		options: DropdownOption[];
		value?: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyMessage?: string;
		disabled?: boolean;
		id?: string;
		class?: string;
		triggerClassName?: string;
		searchable?: boolean;
		header?: Snippet<[HeaderContext]>;
	}

	let {
		options,
		value = '',
		onValueChange,
		placeholder = 'Select...',
		searchPlaceholder = 'Search...',
		emptyMessage = 'No results found.',
		disabled = false,
		id,
		class: className,
		triggerClassName,
		searchable,
		header
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let searchInputRef = $state<HTMLInputElement | null>(null);

	const showSearch = $derived(shouldShowDropdownSearch(options.length, searchable));
	const filteredOptions = $derived(filterDropdownOptions(options, query));
	const displayLabel = $derived(
		options.find((option) => option.value === value)?.label ?? placeholder
	);

	function selectOption(nextValue: string) {
		onValueChange?.(nextValue);
		open = false;
	}

	$effect(() => {
		if (!open) {
			query = '';
			return;
		}
		if (showSearch) {
			requestAnimationFrame(() => searchInputRef?.focus());
		}
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger {disabled}>
		{#snippet child({ props })}
			<Button
				{...props}
				{id}
				type="button"
				variant="outline"
				role="combobox"
				aria-expanded={open}
				{disabled}
				class={cn(
					'h-11 min-h-11 w-full justify-between rounded-2xl border border-border/50 bg-card px-4 py-2 text-sm font-normal shadow-none hover:bg-card',
					triggerClassName
				)}
			>
				<span class="truncate text-left">{displayLabel}</span>
				<ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class={cn('w-[var(--bits-popover-anchor-width)] p-0', className)} align="start">
		{#if showSearch}
			<div class="border-b border-border p-2">
				<div class="relative">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						bind:ref={searchInputRef}
						value={query}
						oninput={(event) => (query = event.currentTarget.value)}
						placeholder={searchPlaceholder}
						class="h-9 pl-9"
						onkeydown={(event) => event.stopPropagation()}
					/>
				</div>
			</div>
		{/if}

		<div class={cn('overflow-y-auto p-1', DROPDOWN_LIST_MAX_HEIGHT_CLASS)}>
			{#if header}
				<div class="px-1">
					{@render header({ select: selectOption })}
				</div>
			{/if}

			{#if filteredOptions.length > 0}
				{#each filteredOptions as option (option.value)}
					{@const isSelected = value === option.value}
					<button
						type="button"
						class={cn(
							'relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg py-2.5 pr-10 pl-3.5 text-left text-sm transition-colors',
							isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-accent'
						)}
						onclick={() => selectOption(option.value)}
					>
						<span class="truncate">{option.label}</span>
						{#if isSelected}
							<Check class="absolute end-2 h-4 w-4 shrink-0" />
						{/if}
					</button>
				{/each}
			{:else}
				<div class="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
