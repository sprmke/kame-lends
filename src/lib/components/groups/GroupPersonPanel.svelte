<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import GroupAvatarStack from '$lib/components/groups/GroupAvatarStack.svelte';
	import InvestorDetailContent from '$lib/components/investors/InvestorDetailContent.svelte';
	import { partyRoleLabel } from '$lib/groups/party-role-labels';
	import type { PartyRole } from '$lib/group-membership-diff';
	import {
		buildGroupPersonInvestorView,
		compactStatsForPersonRole,
		loansForPersonRole
	} from '$lib/groups/group-people';
	import { formatCount, formatCurrencyCompact, formatText } from '$lib/format';
	import type { GroupPersonRow } from '$lib/components/groups/types';
	import type { LoanWithInvestors } from '$lib/types';
	import { ChevronDown } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		person: GroupPersonRow;
		sectionRole: PartyRole;
		loans: LoanWithInvestors[];
	}

	let { person, sectionRole, loans }: Props = $props();

	const roleLoans = $derived(loansForPersonRole(person.userId, loans, sectionRole));
	const stats = $derived(compactStatsForPersonRole(person.userId, loans, sectionRole));
	const view = $derived(buildGroupPersonInvestorView(person, roleLoans, sectionRole));
	const expandable = $derived(roleLoans.length > 0);
	const otherRoles = $derived(person.roles.filter((role) => role !== sectionRole));

	function initialsFor(name: string): string {
		return name.trim() || '?';
	}

	function loanCountLabel(count: number): string {
		return `${formatCount(count)} ${count === 1 ? 'loan' : 'loans'}`;
	}
</script>

{#snippet personBody()}
	<GroupAvatarStack
		initials={[initialsFor(person.name)]}
		max={1}
		size="md"
		decorative
		class="shrink-0"
	/>
	<div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
		<p class="min-w-0 truncate font-medium" title={formatText(person.name)}>
			{formatText(person.name)}
		</p>
		{#each otherRoles as role (role)}
			<Badge variant="secondary" class="shrink-0 text-[11px]">{partyRoleLabel(role)}</Badge>
		{/each}
	</div>
	{#if stats.loanCount > 0}
		<div
			class="flex shrink-0 items-center gap-2.5 text-xs tabular-nums text-muted-foreground sm:gap-4"
		>
			<span class="whitespace-nowrap">
				<span class="max-sm:sr-only">{stats.amountLabel}</span>
				<span class="text-foreground">{formatCurrencyCompact(stats.amount)}</span>
			</span>
			<span class="whitespace-nowrap">
				<span class="max-sm:sr-only">Interest</span>
				<span class="text-foreground">{formatCurrencyCompact(stats.interest)}</span>
			</span>
		</div>
	{/if}
	<span
		class={cn(
			'inline-flex shrink-0 items-center gap-0.5 text-sm tabular-nums text-muted-foreground',
			expandable && 'group-data-[state=open]:text-foreground'
		)}
	>
		{loanCountLabel(stats.loanCount)}
		{#if expandable}
			<ChevronDown
				class="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
				aria-hidden="true"
			/>
		{/if}
	</span>
{/snippet}

{#if expandable}
	<Collapsible.Root>
		<Collapsible.Trigger
			class="group flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none"
		>
			{@render personBody()}
		</Collapsible.Trigger>
		<Collapsible.Content>
			<div class="border-t border-border/40 bg-muted/20 px-3 py-4">
				<InvestorDetailContent
					investor={view.investor}
					loans={roleLoans}
					canManage={false}
					embedded
					showBorrowings={false}
					scopeToInvestor={view.scopeToInvestor}
					investorUserId={view.scopeToInvestor ? person.userId : null}
				/>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{:else}
	<div class="flex min-h-11 w-full items-center gap-3 px-3 py-2.5">
		{@render personBody()}
	</div>
{/if}
