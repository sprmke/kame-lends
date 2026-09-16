<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import GroupAvatarStack from '$lib/components/groups/GroupAvatarStack.svelte';
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatPartyRoles } from '$lib/groups/party-role-labels';
	import type { PartyRole } from '$lib/group-membership-diff';
	import {
		formatCount,
		formatCurrencyCompact,
		formatDateShort,
		formatText
	} from '$lib/format';
	import type { GroupListCardData } from '$lib/components/groups/types';
	import { groupChannelStatusA11y } from '$lib/groups/channel-status';
	import { Calendar, Send } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		group: GroupListCardData;
		onOpen: (group: GroupListCardData) => void;
		class?: string;
	}

	let { group, onOpen, class: className }: Props = $props();

	const palette = $derived(resolveGroupColor(group.color));

	const statParts = $derived.by(() => {
		const parts: string[] = [];
		parts.push(
			`${formatCount(group.loanCount)} ${group.loanCount === 1 ? 'loan' : 'loans'}`
		);
		const principal = parseFloat(String(group.outstandingPrincipal));
		if (!Number.isNaN(principal) && principal > 0) {
			parts.push(`${formatCurrencyCompact(principal)} outstanding`);
		}
		if (group.nextDueDate) {
			parts.push(`Next due ${formatDateShort(group.nextDueDate)}`);
		}
		return parts.join(' · ');
	});

	const calendarA11y = $derived(
		groupChannelStatusA11y('calendar', group.calendarStatus)
	);
	const telegramA11y = $derived(
		groupChannelStatusA11y('telegram', group.telegramStatus)
	);

	const viewerChip = $derived.by(() => {
		if (group.isViewerOwner) return 'Owner';
		const roles = group.viewerRoles ?? [];
		if (roles.length === 0) return null;
		const withoutOwner = roles.filter((r) => r !== 'owner') as PartyRole[];
		if (withoutOwner.length === 0) return 'Shared';
		return `You: ${formatPartyRoles(withoutOwner)}`;
	});
</script>

<Card.Root
	class={cn(
		'relative cursor-pointer overflow-hidden transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		className
	)}
	role="link"
	tabindex={0}
	onclick={() => onOpen(group)}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onOpen(group);
		}
	}}
>
	<div class={cn('absolute inset-y-0 left-0 w-1', palette.dot)} aria-hidden="true"></div>
	<Card.Header class="gap-2 pl-4">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0 space-y-1">
				<Card.Title class="truncate text-base">{formatText(group.name)}</Card.Title>
				{#if group.description?.trim()}
					<p class="line-clamp-1 text-sm text-muted-foreground">
						{formatText(group.description)}
					</p>
				{/if}
			</div>
			<div class="flex shrink-0 flex-col items-end gap-1.5">
				{#if group.overdueCount > 0}
					<Badge variant="destructive" class="text-[11px]">
						{formatCount(group.overdueCount)} overdue
					</Badge>
				{/if}
				{#if viewerChip}
					<Badge variant="secondary" class="text-[11px]">{viewerChip}</Badge>
				{/if}
			</div>
		</div>
	</Card.Header>
	<Card.Content class="space-y-3 pl-4 text-sm text-muted-foreground">
		<p>{statParts}</p>
		<div class="flex items-center justify-between gap-2">
			<GroupAvatarStack initials={group.peopleInitials} size="sm" />
			<div class="flex items-center gap-2 text-muted-foreground">
				<span class="inline-flex items-center gap-1" title={calendarA11y}>
					<Calendar class="size-4 shrink-0" aria-hidden="true" />
					<span class="sr-only">{calendarA11y}</span>
				</span>
				<span class="inline-flex items-center gap-1" title={telegramA11y}>
					<Send class="size-4 shrink-0" aria-hidden="true" />
					<span class="sr-only">{telegramA11y}</span>
				</span>
			</div>
		</div>
	</Card.Content>
</Card.Root>
