<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatCount, formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import { Plus } from 'lucide-svelte';

	interface Props {
		groups: GroupsIndexItem[];
		selectedGroupIds: number[];
		disabled?: boolean;
	}

	let { groups, selectedGroupIds = $bindable([]), disabled = false }: Props = $props();

	const labelId = 'loan-form-groups-label';

	function setGroupSelected(id: number, checked: boolean | 'indeterminate') {
		if (checked === true) {
			if (!selectedGroupIds.includes(id)) {
				selectedGroupIds = [...selectedGroupIds, id];
			}
		} else {
			selectedGroupIds = selectedGroupIds.filter((value) => value !== id);
		}
	}

</script>

<div class="space-y-3 border-t border-border/60 pt-4">
	<Label id={labelId} class="text-sm font-medium">Groups</Label>

	{#if groups.length === 0}
		<div
			role="group"
			aria-labelledby={labelId}
			class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8"
		>
			<p class="text-sm text-muted-foreground">No groups yet.</p>
			<Button
				variant="outline"
				size="sm"
				class="touch-target gap-2"
				href="/groups?create=1"
				data-sveltekit-preload-data="tap"
				{disabled}
			>
				<Plus class="size-4" aria-hidden="true" />
				New group
			</Button>
		</div>
	{:else}
		<div role="group" aria-labelledby={labelId} class="space-y-2">
			<ul class="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
				{#each groups as group (group.id)}
					{@const palette = resolveGroupColor(group.color)}
					{@const selected = selectedGroupIds.includes(group.id)}
					<li>
						<label
							class={cn(
								'flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors',
								'hover:border-border hover:bg-muted/30',
								selected
									? 'border-primary/45 bg-primary/[0.06] ring-2 ring-primary/15'
									: 'border-border/60'
							)}
						>
							<span
								class={cn('size-2.5 shrink-0 rounded-full', palette.dot)}
								aria-hidden="true"
							></span>
							<span class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
								{formatText(group.name)}
							</span>
							{#if group.loanCount != null}
								<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
									{formatCount(group.loanCount)}
								</span>
							{/if}
							<Checkbox
								class="shrink-0"
								checked={selected}
								{disabled}
								aria-label={group.name}
								onCheckedChange={(checked) => setGroupSelected(group.id, checked)}
							/>
						</label>
					</li>
				{/each}
			</ul>

			<Button
				variant="outline"
				class="touch-target w-full gap-2 border-dashed"
				href="/groups?create=1"
				data-sveltekit-preload-data="tap"
				{disabled}
			>
				<Plus class="size-4" aria-hidden="true" />
				New group
			</Button>
		</div>
	{/if}
</div>
