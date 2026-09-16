<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { AlertTriangle, Loader2 } from 'lucide-svelte';
	import { partyRoleLabel } from '$lib/groups/party-role-labels';
	import { formatCount, formatText } from '$lib/format';
	import type { AccessPreviewData } from '$lib/components/groups/types';
	import { cn } from '$lib/utils';

	interface Props {
		preview: AccessPreviewData | null;
		loading?: boolean;
		error?: string | null;
		loanCount?: number;
		class?: string;
	}

	let {
		preview,
		loading = false,
		error = null,
		loanCount,
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
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="size-4 animate-spin" aria-hidden="true" />
			<span>Checking access…</span>
		</div>
	{:else if error}
		<p class="text-sm text-destructive">{error}</p>
	{:else if preview}
		{#if resolvedLoanCount > 0 && peopleWillSee > 0}
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

		{#if preview.gained.length > 0}
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
