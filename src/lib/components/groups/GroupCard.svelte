<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Folders, FileText, Users } from 'lucide-svelte';
	import type { LoanGroupWithDetails } from '$lib/types';

	interface Props {
		group: LoanGroupWithDetails;
		currentUserId: string;
		onQuickView: (group: LoanGroupWithDetails) => void;
	}

	let { group, currentUserId, onQuickView }: Props = $props();

	const isCreator = $derived(group.creatorUserId === currentUserId);
	const activeMemberCount = $derived(
		group.members.filter((member) => member.status === 'active').length
	);
</script>

<Card.Root
	class="cursor-pointer transition-colors hover:border-primary/40"
	onclick={() => onQuickView(group)}
>
	<Card.Header class="flex flex-row items-start justify-between gap-2">
		<div class="flex items-center gap-2 min-w-0">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
				<Folders class="h-4 w-4" />
			</div>
			<Card.Title class="truncate text-base">{group.name}</Card.Title>
		</div>
		{#if isCreator}
			<Badge variant="secondary">Owner</Badge>
		{/if}
	</Card.Header>
	<Card.Content class="flex items-center gap-4 text-sm text-muted-foreground">
		<span class="flex items-center gap-1.5">
			<FileText class="h-3.5 w-3.5" />
			{group.groupLoans.length}
			{group.groupLoans.length === 1 ? 'loan' : 'loans'}
		</span>
		<span class="flex items-center gap-1.5">
			<Users class="h-3.5 w-3.5" />
			{activeMemberCount}
			{activeMemberCount === 1 ? 'member' : 'members'}
		</span>
	</Card.Content>
</Card.Root>
