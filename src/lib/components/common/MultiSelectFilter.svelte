<script lang="ts">
	import { Check, ChevronDown, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { cn } from '$lib/utils';

	export interface MultiSelectOption {
		value: string;
		label: string;
	}

	interface Props {
		options: MultiSelectOption[];
		selected: string[];
		onChange: (selected: string[]) => void;
		placeholder?: string;
		allLabel?: string;
		class?: string;
		triggerClassName?: string;
	}

	let {
		options,
		selected,
		onChange,
		placeholder = 'Select...',
		allLabel = 'All',
		class: className,
		triggerClassName
	}: Props = $props();

	let open = $state(false);

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
					'h-10 justify-between font-normal',
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
							class="flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30"
						>
							<X class="h-3 w-3" />
						</span>
					{/if}
					<ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
				</div>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class={cn('w-[200px] p-0', className)} align="start">
		<div class="p-2">
			<div class="mb-2 flex items-center justify-between border-b pb-2">
				<span class="text-xs font-semibold text-muted-foreground">{placeholder}</span>
				<button
					type="button"
					onclick={handleSelectAll}
					class="text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					{selected.length === options.length ? 'Clear All' : 'Select All'}
				</button>
			</div>
			<div class="max-h-[240px] space-y-1 overflow-y-auto">
				{#each options as option (option.value)}
					{@const isSelected = selected.includes(option.value)}
					<button
						type="button"
						class={cn(
							'flex w-full items-center gap-2 rounded p-2 text-left transition-colors',
							isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-accent'
						)}
						onclick={() => handleToggle(option.value)}
					>
						<Checkbox checked={isSelected} class="pointer-events-none" />
						<span class="text-sm">{option.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
