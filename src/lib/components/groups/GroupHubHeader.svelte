<script lang="ts">
	import PageBackHeader from '$lib/components/common/PageBackHeader.svelte';
	import RegisterMobileHeroActions from '$lib/components/layout/RegisterMobileHeroActions.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatPartyRoles } from '$lib/groups/party-role-labels';
	import type { PartyRole } from '$lib/group-membership-diff';
	import {
		formatCount,
		formatDateShort,
		formatText
	} from '$lib/format';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { ArrowLeft, MoreHorizontal, PlusCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		name: string;
		color: string;
		description?: string | null;
		loanCount: number;
		peopleCount: number;
		nextDueDate?: Date | string | null;
		viewerLabel?: string | null;
		viewerRoles?: PartyRole[];
		isOwner?: boolean;
		onBack: () => void;
		backHref?: string;
		onAddLoans?: () => void;
		onOpenSettings?: () => void;
		onDelete?: () => void;
		class?: string;
	}

	let {
		name,
		color,
		description,
		loanCount,
		peopleCount,
		nextDueDate,
		viewerLabel,
		viewerRoles = [],
		isOwner = false,
		onBack,
		backHref = '/groups',
		onAddLoans,
		onOpenSettings,
		onDelete,
		class: className
	}: Props = $props();

	const mobileShell = createIsMobileShell(false);
	$effect(() => mobileShell.init());

	const palette = $derived(resolveGroupColor(color));

	const metaLine = $derived.by(() => {
		const parts = [
			`${formatCount(loanCount)} ${loanCount === 1 ? 'loan' : 'loans'}`,
			`${formatCount(peopleCount)} ${peopleCount === 1 ? 'person' : 'people'}`
		];
		if (nextDueDate) {
			parts.push(`Next due ${formatDateShort(nextDueDate)}`);
		}
		return parts.join(' · ');
	});

	const resolvedViewerLabel = $derived.by(() => {
		if (viewerLabel) return viewerLabel;
		if (isOwner) return 'Owner';
		if (viewerRoles.length === 0) return null;
		const roles = viewerRoles.filter((r) => r !== 'owner');
		if (roles.length === 0) return 'Owner';
		return `You're ${formatPartyRoles(roles).toLowerCase()} here`;
	});

	const showDesktopActions = $derived(
		Boolean(onAddLoans || onOpenSettings || onDelete)
	);
</script>

{#snippet moreMenu(hero = false)}
	{#if isOwner && (onOpenSettings || onDelete)}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant={hero ? 'outline' : 'outline'}
						size={hero ? 'sm' : 'icon'}
						class={hero ? 'touch-target h-10 shrink-0 px-2 md:h-8 md:px-3' : 'touch-target'}
						adaptToMobileHero={hero}
						aria-label="More actions"
					>
						<MoreHorizontal class="size-4" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#if onOpenSettings}
					<DropdownMenu.Item onclick={onOpenSettings}>Settings</DropdownMenu.Item>
				{/if}
				{#if onDelete}
					<DropdownMenu.Item class="text-destructive" onclick={onDelete}>
						Delete
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
{/snippet}

{#snippet heroActions()}
	<div class="flex items-center justify-end gap-1.5">
		{#if isOwner && onAddLoans}
			<Button
				type="button"
				size="sm"
				adaptToMobileHero
				aria-label="Add loans"
				onclick={onAddLoans}
			>
				<PlusCircle class="h-4 w-4 lg:mr-2" />
				<span class="hidden lg:inline">Add loans</span>
			</Button>
		{/if}
		{@render moreMenu(true)}
	</div>
{/snippet}

<div class={cn('space-y-2 lg:space-y-4', className)}>
	<!-- Mobile: back + title, primary CTA in hero -->
	<div class="lg:hidden">
		<PageBackHeader title={name} backLabel="Groups" {backHref} {onBack}>
			{#snippet titleAddon()}
				<span class={cn('size-3 shrink-0 rounded-sm', palette.dot)} aria-hidden="true"></span>
			{/snippet}
			{#snippet descriptionContent()}
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm text-muted-foreground">{metaLine}</p>
					{#if resolvedViewerLabel}
						<Badge variant="secondary" class="text-[11px]">{resolvedViewerLabel}</Badge>
					{/if}
				</div>
				{#if description?.trim()}
					<p class="pt-1 text-sm text-muted-foreground line-clamp-2">
						{formatText(description)}
					</p>
				{/if}
			{/snippet}
		</PageBackHeader>
	</div>

	<!-- Desktop: title row with actions top-right (matches DetailHeader) -->
	<div class="hidden flex-col gap-4 lg:flex">
		<a
			href={backHref}
			data-sveltekit-preload-data="tap"
			class="native-press -ml-2 inline-flex h-9 w-fit items-center gap-0.5 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
			onclick={(event) => {
				if (onBack) {
					event.preventDefault();
					onBack();
				}
			}}
		>
			<ArrowLeft class="mr-2 size-4 shrink-0" />
			Groups
		</a>

		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="min-w-0 space-y-1">
				<div class="flex min-w-0 flex-wrap items-center gap-2.5">
					<h1 class="min-w-0 text-xl font-semibold tracking-tight">
						{formatText(name)}
					</h1>
					<span class={cn('size-3 shrink-0 rounded-sm', palette.dot)} aria-hidden="true"></span>
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm text-muted-foreground">{metaLine}</p>
					{#if resolvedViewerLabel}
						<Badge variant="secondary" class="text-[11px]">{resolvedViewerLabel}</Badge>
					{/if}
				</div>
				{#if description?.trim()}
					<p class="text-sm text-muted-foreground line-clamp-2">{formatText(description)}</p>
				{/if}
			</div>

			{#if showDesktopActions}
				<div class="flex shrink-0 items-center justify-end gap-2">
					{#if isOwner && onAddLoans}
						<Button type="button" onclick={onAddLoans}>
							<PlusCircle class="mr-2 size-4" />
							Add loans
						</Button>
					{/if}
					{@render moreMenu(false)}
				</div>
			{/if}
		</div>
	</div>

	{#if showDesktopActions}
		<RegisterMobileHeroActions snippet={heroActions} active={mobileShell.matches} />
	{/if}
</div>
