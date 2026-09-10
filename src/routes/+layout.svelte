<script lang="ts">
	import './layout.css';
	import '$lib/styles/accessibility.css';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import PriceVisibilityShell from '$lib/components/common/PriceVisibilityShell.svelte';
	import DashboardSkeleton from '$lib/components/common/DashboardSkeleton.svelte';
	import ListPageSkeleton, {
		type ListPageSkeletonVariant
	} from '$lib/components/common/ListPageSkeleton.svelte';
	import DetailPageSkeleton, {
		type DetailPageSkeletonVariant
	} from '$lib/components/common/DetailPageSkeleton.svelte';
	import NavigationProgress from '$lib/components/common/NavigationProgress.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { navigating } from '$app/state';
	import {
		THEME_COLOR_DARK,
		THEME_COLOR_DASHBOARD,
		THEME_COLOR_LIGHT,
		THEME_STORAGE_KEY
	} from '$lib/theme/preferences';

	let { data, children } = $props();

	$effect(() => {
		const root = document.documentElement;
		if (data.session?.user) {
			root.classList.add('dashboard-shell');
		} else {
			root.classList.remove('dashboard-shell');
		}
		return () => root.classList.remove('dashboard-shell');
	});

	const listRoutes = new Set([
		'/loans',
		'/investments',
		'/borrowed',
		'/witnessed',
		'/investors',
		'/borrowers',
		'/witnesses',
		'/debts',
		'/transactions'
	]);

	const formRoutes = new Set([
		'/debts/new',
		'/loans/new',
		'/transactions/new',
		'/investors/new',
		'/borrowers/new',
		'/witnesses/new'
	]);

	function resolveDetailSkeleton(path: string): DetailPageSkeletonVariant | null {
		if (formRoutes.has(path)) return 'form';
		if (path === '/settings') return 'settings';
		if (/^\/debts\/[^/]+$/.test(path)) return 'debt';
		if (/^\/loans\/[^/]+$/.test(path) && !path.endsWith('/sign')) return 'loan';
		if (/^\/investors\/[^/]+$/.test(path)) return 'investor';
		if (/^\/transactions\/[^/]+$/.test(path)) return 'transaction';
		if (/^\/borrowers\/[^/]+$/.test(path)) return 'borrower';
		if (/^\/witnesses\/[^/]+$/.test(path)) return 'witness';
		return null;
	}

	const showRouteSkeleton = $derived(
		navigating.to?.url.pathname != null &&
			navigating.from?.url.pathname !== navigating.to.url.pathname
	);

	const destinationPath = $derived(navigating.to?.url.pathname ?? '');

	const showDashboardSkeleton = $derived(
		showRouteSkeleton && destinationPath === '/dashboard'
	);

	const detailSkeletonVariant = $derived(resolveDetailSkeleton(destinationPath));

	const showDetailSkeleton = $derived(showRouteSkeleton && detailSkeletonVariant != null);

	const listSkeletonVariant = $derived.by((): ListPageSkeletonVariant => {
		if (destinationPath === '/investors') return 'investors';
		if (destinationPath === '/borrowers') return 'borrowers';
		if (destinationPath === '/witnesses') return 'witnesses';
		if (destinationPath === '/debts') return 'debts';
		if (destinationPath === '/transactions') return 'transactions';
		return 'loans';
	});

	const showListSkeleton = $derived(
		showRouteSkeleton &&
			!showDashboardSkeleton &&
			!showDetailSkeleton &&
			listRoutes.has(destinationPath)
	);

	const themeColors = $derived(
		data.session?.user
			? { light: THEME_COLOR_DASHBOARD, dark: THEME_COLOR_DASHBOARD }
			: { light: THEME_COLOR_LIGHT, dark: THEME_COLOR_DARK }
	);
</script>

<ModeWatcher
	defaultMode="system"
	modeStorageKey={THEME_STORAGE_KEY}
	themeColors={themeColors}
/>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<NavigationProgress />

<Nav user={data.session?.user} navCapabilities={data.navCapabilities}>
	<PriceVisibilityShell>
		{#if showDashboardSkeleton}
			<div class="dashboard-page">
				<DashboardSkeleton />
			</div>
		{:else if showDetailSkeleton && detailSkeletonVariant}
			<DetailPageSkeleton variant={detailSkeletonVariant} />
		{:else if showListSkeleton}
			<ListPageSkeleton variant={listSkeletonVariant} />
		{:else}
			{@render children()}
		{/if}
	</PriceVisibilityShell>
</Nav>

<Toaster />
