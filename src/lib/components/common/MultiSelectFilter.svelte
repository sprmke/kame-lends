<script lang="ts">
	import { ChevronDown, Search, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		DROPDOWN_LIST_MAX_HEIGHT_CLASS,
		filterDropdownOptions,
		shouldShowDropdownSearch,
		type DropdownOption
	} from '$lib/dropdown-ux';
	import { cn } from '$lib/utils';

	export type MultiSelectOption = DropdownOption;

	interface Props {
		options: MultiSelectOption[];
		selected: string[];
		onChange: (selected: string[]) => void;
		placeholder?: string;
		allLabel?: string;
		class?: string;
		triggerClassName?: string;
		searchable?: boolean;
		searchPlaceholder?: string;
	}

	let {
		options,
		selected,
		onChange,
		placeholder = 'Select...',
		allLabel = 'All',
		class: className,
		triggerClassName,
		searchable,
		searchPlaceholder = 'Search...'
	}: Props = $props();

	let open = $state(false);
	let query = $state('');
	let searchInputRef = $state<HTMLInputElement | null>(null);

	const showSearch = $derived(shouldShowDropdownSearch(options.length, searchable));
	const filteredOptions = $derived(filterDropdownOptions(options, query));

	function handleToggle(value: string) {
		if (selected.includes(value)) {
			onChange(selected.filter((v) => v !== value));
		} else {
			onChange([...selected, value]);
		}
	}

	function handleClear(e: MouseEvent) {
		e.stopPropagation();
		onChange([]);
	}

	function handleSelectAll() {
		if (selected.length === options.length) {
			onChange([]);
		} else {
			onChange(options.map((o) => o.value));
		}
	}

	const displayText = $derived.by(() => {
		if (selected.length === 0) return allLabel;
		if (selected.length === 1) {
			return options.find((o) => o.value === selected[0])?.label ?? selected[0];
		}
		return `${selected.length} selected`;
	});

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
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				class={cn(
					'h-11 min-h-11 shrink-0 justify-between font-normal',
					selected.length > 0 && 'border-primary/50',
					triggerClassName
				)}
			>
				<span class="truncate text-sm">{displayText}</span>
				<div class="ml-2 flex items-center gap-1">
					{#if selected.length > 0}
						<span
							role="button"
							tabindex="0"
							onclick={handleClear}
							onkeydown={(e) => e.key === 'Enter' && handleClear(e as unknown as MouseEvent)}
							class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30"
						>
							<X class="h-3 w-3" />
						</span>
					{/if}
					<ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
				</div>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class={cn('min-w-60 p-0', className)} align="start">
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
		<div class="p-1.5">
			<div class="mb-1.5 flex items-center justify-between border-b border-border/50 px-2 pb-2">
				<span class="text-xs font-medium text-muted-foreground">{placeholder}</span>
				<button
					type="button"
					onclick={handleSelectAll}
					class="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{selected.length === options.length ? 'Clear All' : 'Select All'}
				</button>
			</div>
			<div class={cn('space-y-0.5 overflow-y-auto', DROPDOWN_LIST_MAX_HEIGHT_CLASS)}>
				{#if filteredOptions.length > 0}
					{#each filteredOptions as option (option.value)}
						{@const isSelected = selected.includes(option.value)}
						<button
							type="button"
							class={cn(
								'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm whitespace-nowrap transition-colors',
								isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-accent'
							)}
							onclick={() => handleToggle(option.value)}
						>
							<Checkbox checked={isSelected} class="pointer-events-none" />
							<span class="text-sm">{option.label}</span>
						</button>
					{/each}
				{:else}
					<div class="px-3 py-6 text-center text-sm text-muted-foreground">No results found.</div>
				{/if}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
