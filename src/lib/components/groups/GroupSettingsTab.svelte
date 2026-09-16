<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import GroupColorSwatches from '$lib/components/groups/GroupColorSwatches.svelte';
	import { formatText } from '$lib/format';
	import type { GroupGeneralDraft, GroupRuleRow } from '$lib/components/groups/types';
	import type { GroupColorKey } from '$lib/groups/group-colors';
	import { cn } from '$lib/utils';
	import { groupSettingsActionClass } from '$lib/groups/group-settings-actions';

	interface Props {
		general: GroupGeneralDraft;
		onGeneralChange: (draft: GroupGeneralDraft) => void;
		onSaveGeneral: () => void | Promise<void>;
		isSavingGeneral?: boolean;
		rules: GroupRuleRow[];
		onAddRule?: () => void;
		onRemoveRule?: (ruleId: number) => void;
		canManageRules?: boolean;
		calendarCard?: Snippet;
		telegramCard?: Snippet;
		dangerZone?: Snippet;
		class?: string;
	}

	let {
		general,
		onGeneralChange,
		onSaveGeneral,
		isSavingGeneral = false,
		rules,
		onAddRule,
		onRemoveRule,
		canManageRules = true,
		calendarCard,
		telegramCard,
		dangerZone,
		class: className
	}: Props = $props();

	function patchGeneral(partial: Partial<GroupGeneralDraft>) {
		onGeneralChange({ ...general, ...partial });
	}
</script>

<div class={cn('space-y-6', className)}>
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">General</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="group-name">Name</Label>
				<Input
					id="group-name"
					value={general.name}
					disabled={isSavingGeneral}
					oninput={(event) => patchGeneral({ name: event.currentTarget.value })}
				/>
			</div>
			<div class="space-y-2">
				<span class="text-sm font-medium">Color</span>
				<GroupColorSwatches
					value={general.color}
					disabled={isSavingGeneral}
					onValueChange={(color: GroupColorKey) => patchGeneral({ color })}
				/>
			</div>
			<div class="space-y-2">
				<Label for="group-description">Description</Label>
				<Textarea
					id="group-description"
					value={general.description}
					rows={3}
					disabled={isSavingGeneral}
					oninput={(event) => patchGeneral({ description: event.currentTarget.value })}
				/>
			</div>
			<Button
				type="button"
				variant="default"
				class={groupSettingsActionClass}
				disabled={isSavingGeneral || !general.name.trim()}
				onclick={() => onSaveGeneral()}
			>
				{isSavingGeneral ? 'Saving…' : 'Save'}
			</Button>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="space-y-1">
			<Card.Title class="text-base">Auto-add loans</Card.Title>
			<p class="text-sm font-normal text-muted-foreground">
				When a matching investor or borrower appears on a new loan, add that loan to this group.
			</p>
		</Card.Header>
		<Card.Content class="space-y-3">
			{#if rules.length === 0}
				<p class="text-sm text-muted-foreground">No rules yet.</p>
			{:else}
				<ul class="divide-y divide-border/60 rounded-lg border border-border/60">
					{#each rules as rule (rule.id)}
						<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
							<span>
								All loans for {rule.partyType === 'investor' ? 'investor' : 'borrower'}
								<span class="font-medium">{formatText(rule.contactName)}</span>
							</span>
							{#if canManageRules && onRemoveRule}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="text-destructive"
									onclick={() => onRemoveRule(rule.id)}
								>
									Remove
								</Button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if canManageRules && onAddRule}
				<Button
					type="button"
					variant="outline"
					class={groupSettingsActionClass}
					onclick={onAddRule}
				>
					Add rule
				</Button>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if calendarCard}
		{@render calendarCard()}
	{/if}

	{#if telegramCard}
		{@render telegramCard()}
	{/if}

	{#if dangerZone}
		{@render dangerZone()}
	{/if}
</div>
