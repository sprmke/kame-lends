<script lang="ts">
	import ListEmptyState from '$lib/components/common/ListEmptyState.svelte';
	import GroupPersonPanel from '$lib/components/groups/GroupPersonPanel.svelte';
	import type { GroupPersonRow } from '$lib/components/groups/types';
	import type { PartyRole } from '$lib/group-membership-diff';
	import { formatCount } from '$lib/format';
	import type { LoanWithInvestors } from '$lib/types';
	import type { IconComponent } from '$lib/types/icon';
	import { CircleDollarSign, Eye, Shield, UserRound, Users } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		people: GroupPersonRow[];
		loans: LoanWithInvestors[];
		class?: string;
	}

	let { people, loans, class: className }: Props = $props();

	const sections: { key: PartyRole; title: string; icon: IconComponent }[] = [
		{ key: 'owner', title: 'Owner', icon: Shield },
		{ key: 'investor', title: 'Investors', icon: CircleDollarSign },
		{ key: 'borrower', title: 'Borrowers', icon: UserRound },
		{ key: 'witness', title: 'Witnesses', icon: Eye }
	];

	function peopleInSection(role: PartyRole): GroupPersonRow[] {
		return people
			.filter((person) => person.roles.includes(role))
			.sort((a, b) => a.name.localeCompare(b.name));
	}
</script>

<div class={cn('space-y-5', className)}>
	{#if people.length === 0}
		<ListEmptyState message="No people yet." icon={Users} />
	{:else}
		{#each sections as section (section.key)}
			{@const rows = peopleInSection(section.key)}
			{#if rows.length > 0}
				{@const SectionIcon = section.icon}
				<section class="space-y-2" aria-labelledby="people-section-{section.key}">
					<h2
						id="people-section-{section.key}"
						class="flex items-center gap-2 text-sm font-semibold"
					>
						<SectionIcon class="size-4 text-muted-foreground" aria-hidden="true" />
						{section.title}
						<span class="text-xs font-medium tabular-nums text-muted-foreground">
							{formatCount(rows.length)}
						</span>
					</h2>
					<ul
						class="divide-y divide-border/50 rounded-2xl border border-border/60 bg-card shadow-elevated"
					>
						{#each rows as person (`${section.key}-${person.userId}`)}
							<li>
								<GroupPersonPanel {person} sectionRole={section.key} {loans} />
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}
	{/if}
</div>
