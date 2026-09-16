<script lang="ts">
	import GroupBadge from '$lib/components/groups/GroupBadge.svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { createIsMobileOverlay } from '$lib/composables/use-media-query.svelte';
	import { formatCount } from '$lib/format';
	import type { GroupBadgeData } from '$lib/components/groups/types';
	import { cn } from '$lib/utils';

	interface Props {
		groups: GroupBadgeData[];
		maxVisible?: number;
		size?: 'sm' | 'md';
		badgeHref?: (group: GroupBadgeData) => string | undefined;
		onBadgeClick?: (group: GroupBadgeData, event: MouseEvent) => void;
		class?: string;
	}

	let {
		groups,
		maxVisible = 2,
		size = 'sm',
		badgeHref,
		onBadgeClick,
		class: className
	}: Props = $props();

	const mobile = createIsMobileOverlay(false);
	$effect(() => mobile.init());

	let sheetOpen = $state(false);
	let popoverOpen = $state(false);

	const visible = $derived(groups.slice(0, maxVisible));
	const overflow = $derived(groups.slice(maxVisible));
	const overflowCount = $derived(overflow.length);

	function openOverflow() {
		if (mobile.matches) {
			sheetOpen = true;
		} else {
			popoverOpen = true;
		}
	}
</script>

{#if groups.length === 0}
	<!-- empty -->
{:else}
	<div class={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
		{#each visible as group (group.id)}
			<GroupBadge
				name={group.name}
				color={group.color}
				{size}
				href={badgeHref?.(group)}
				onclick={onBadgeClick ? (event) => onBadgeClick(group, event) : undefined}
			/>
		{/each}

		{#if overflowCount > 0}
			{#if mobile.matches}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="h-8 min-h-8 px-2 text-xs text-muted-foreground"
					onclick={openOverflow}
				>
					+{formatCount(overflowCount)}
				</Button>
				<ResponsiveModal
					open={sheetOpen}
					onOpenChange={(value) => (sheetOpen = value)}
					title="Groups"
					contentClass="sm:max-w-md"
				>
					<ul class="space-y-2">
						{#each groups as group (group.id)}
							<li>
								<GroupBadge
									name={group.name}
									color={group.color}
									size="md"
									href={badgeHref?.(group)}
									onclick={onBadgeClick
										? (event) => onBadgeClick(group, event)
										: undefined}
									class="w-full"
								/>
							</li>
						{/each}
					</ul>
				</ResponsiveModal>
			{:else}
				<Popover.Root bind:open={popoverOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								type="button"
								variant="ghost"
								size="sm"
								class="h-8 min-h-8 px-2 text-xs text-muted-foreground"
							>
								+{formatCount(overflowCount)}
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-64 p-2" align="start">
						<ul class="space-y-1.5">
							{#each groups as group (group.id)}
								<li>
									<GroupBadge
										name={group.name}
										color={group.color}
										size="md"
										href={badgeHref?.(group)}
										onclick={onBadgeClick
											? (event) => onBadgeClick(group, event)
											: undefined}
										class="w-full"
									/>
								</li>
							{/each}
						</ul>
					</Popover.Content>
				</Popover.Root>
			{/if}
		{/if}
	</div>
{/if}
