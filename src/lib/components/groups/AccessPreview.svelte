<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { AlertTriangle } from 'lucide-svelte';
	import { partyRoleLabel } from '$lib/groups/party-role-labels';
	import { formatCount, formatText } from '$lib/format';
	import type { AccessPreviewData } from '$lib/components/groups/types';
	import { cn } from '$lib/utils';

	interface Props {
		preview: AccessPreviewData | null;
		loading?: boolean;
		error?: string | null;
		loanCount?: number;
		showSummary?: boolean;
		showGainedList?: boolean;
		class?: string;
	}

	let {
		preview,
		loading = false,
		error = null,
		loanCount,
		showSummary = true,
		showGainedList = true,
		class: className
	}: Props = $props();

	const distinctBorrowers = $derived(
		preview?.distinctBorrowerCount ?? preview?.mixedBorrowerCount ?? 0
	);
	const showMixedBorrowerWarning = $derived(distinctBorrowers >= 2);
	const resolvedLoanCount = $derived(loanCount ?? preview?.loanCount ?? 0);
	const peopleWillSee = $derived(
		preview ? preview.gained.length + preview.unchanged : 0
	);

	const noEmailPeople = $derived(
		preview
			? [...preview.gained, ...preview.lost].filter((person) => !person.hasEmail)
			: []
	);
</script>

<div class={cn('space-y-4', className)}>
	{#if loading}
		<div class="space-y-4" aria-busy="true" aria-label="Checking access" role="status">
			{#if showSummary}
				<Skeleton class="h-4 w-4/5 max-w-sm" />
			{/if}
			{#if showGainedList}
				<div class="space-y-2">
					<Skeleton class="h-4 w-32" />
					<ul class="space-y-1.5">
						{#each Array.from({ length: 2 }) as _, index (index)}
							<li class="flex flex-wrap items-center gap-2">
								<Skeleton class="h-4 w-28 max-w-full" />
								<Skeleton class="h-5 w-16 rounded-full" />
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{:else if error}
		<p class="text-sm text-destructive">{error}</p>
	{:else if preview}
		{#if showSummary && resolvedLoanCount > 0 && peopleWillSee > 0}
			<p class="text-sm text-muted-foreground">
				{formatCount(peopleWillSee)} {peopleWillSee === 1 ? 'person' : 'people'} will see all
				{formatCount(resolvedLoanCount)} {resolvedLoanCount === 1 ? 'loan' : 'loans'}.
			</p>
		{/if}

		{#if showMixedBorrowerWarning}
			<div
				class="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
				role="alert"
			>
				<AlertTriangle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<p>
					This group has {formatCount(distinctBorrowers)} borrowers. Each borrower will see the
					other borrowers' loans.
				</p>
			</div>
		{/if}

		{#if showGainedList && preview.gained.length > 0}
			<div class="space-y-2">
				<h3 class="text-sm font-medium">Will get access</h3>
				<ul class="space-y-1.5">
					{#each preview.gained as person (person.userId ?? person.name)}
						<li class="flex flex-wrap items-center gap-2 text-sm">
							<span class="font-medium">{formatText(person.name)}</span>
							{#each person.roles as role (role)}
								<Badge variant="secondary" class="text-[11px]">{partyRoleLabel(role)}</Badge>
							{/each}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if preview.lost.length > 0}
			<div class="space-y-2">
				<h3 class="text-sm font-medium">Will lose access</h3>
				<ul class="space-y-1.5">
					{#each preview.lost as person (person.userId ?? person.name)}
						<li class="flex flex-wrap items-center gap-2 text-sm">
							<span class="font-medium">{formatText(person.name)}</span>
							{#each person.roles as role (role)}
								<Badge variant="outline" class="text-[11px]">{partyRoleLabel(role)}</Badge>
							{/each}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if noEmailPeople.length > 0}
			<p class="text-xs text-muted-foreground">No email: will not get the Google Calendar.</p>
		{/if}

		{#if preview.gained.length === 0 && preview.lost.length === 0}
			<p class="text-sm text-muted-foreground">No access changes.</p>
		{/if}
	{/if}
</div>
