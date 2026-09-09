<script lang="ts">
	import './layout.css';
	import '$lib/styles/accessibility.css';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import PriceVisibilityShell from '$lib/components/common/PriceVisibilityShell.svelte';
	import DashboardSkeleton from '$lib/components/common/DashboardSkeleton.svelte';
	import ListPageSkeleton, {
		type ListPageSkeletonVariant
	} from '$lib/components/common/ListPageSkeleton.svelte';
	import NavigationProgress from '$lib/components/common/NavigationProgress.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { navigating } from '$app/state';

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

	const streamableRoutes = new Set([
		'/dashboard',
		'/loans',
		'/investors',
		'/debts',
		'/transactions'
	]);

	const showRouteSkeleton = $derived(
		navigating.to?.url.pathname != null &&
			streamableRoutes.has(navigating.to.url.pathname) &&
			navigating.from?.url.pathname !== navigating.to.url.pathname
	);

	const showDashboardSkeleton = $derived(
		showRouteSkeleton && navigating.to?.url.pathname === '/dashboard'
	);

	const listSkeletonVariant = $derived.by((): ListPageSkeletonVariant => {
		const path = navigating.to?.url.pathname;
		if (path === '/investors') return 'investors';
		if (path === '/debts') return 'debts';
		if (path === '/transactions') return 'transactions';
		return 'loans';
	});

	const showListSkeleton = $derived(showRouteSkeleton && !showDashboardSkeleton);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<NavigationProgress />

<Nav user={data.session?.user}>
	<PriceVisibilityShell>
		{#if showDashboardSkeleton}
			<div class="dashboard-page">
				<DashboardSkeleton />
			</div>
		{:else if showListSkeleton}
			<ListPageSkeleton variant={listSkeletonVariant} />
		{:else}
			{@render children()}
		{/if}
	</PriceVisibilityShell>
</Nav>

<Toaster />
