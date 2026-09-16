<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import AccessPreview from '$lib/components/groups/AccessPreview.svelte';
	import GroupBadgeList from '$lib/components/groups/GroupBadgeList.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import type { AccessPreviewData, WizardLoanRow } from '$lib/components/groups/types';
	import { formatCount, formatCurrency, formatDateShort, formatText } from '$lib/format';
	import { toast } from '$lib/toast';
	import { cn } from '$lib/utils';
	import { Search } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		groupId: number;
		availableLoans?: WizardLoanRow[];
		onAdded?: () => void | Promise<void>;
	}

	let { open, onOpenChange, groupId, availableLoans = [], onAdded }: Props = $props();

	let loadedLoans = $state<WizardLoanRow[]>([]);
	let loansLoading = $state(false);
	let selectedLoanIds = $state<number[]>([]);
	let loanQuery = $state('');
	let showCompleted = $state(false);
	let step = $state<'pick' | 'preview'>('pick');
	let preview = $state<AccessPreviewData | null>(null);
	let previewLoading = $state(false);
	let previewError = $state<string | null>(null);
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);

	$effect(() => {
		if (!open) {
			selectedLoanIds = [];
			loanQuery = '';
			showCompleted = false;
			step = 'pick';
			preview = null;
			previewError = null;
			saveError = null;
			return;
		}

		if (availableLoans.length > 0) {
			loadedLoans = availableLoans;
			return;
		}

		let active = true;
		loansLoading = true;
		void fetch(`/api/groups/${groupId}/addable-loans`)
			.then(async (response) => {
				if (!response.ok) {
					const body = await response.json().catch(() => ({}));
					throw new Error(body.error || 'Failed to load loans');
				}
				return response.json() as Promise<{ addableLoans: WizardLoanRow[] }>;
			})
			.then((body) => {
				if (active) loadedLoans = body.addableLoans;
			})
			.catch((error) => {
				if (active) {
					toast.error(error instanceof Error ? error.message : 'Failed to load loans');
					loadedLoans = [];
				}
			})
			.finally(() => {
				if (active) loansLoading = false;
			});

		return () => {
			active = false;
		};
	});

	const loanChoices = $derived(
		availableLoans.length > 0 ? availableLoans : loadedLoans
	);

	const filteredLoans = $derived.by(() => {
		const q = loanQuery.trim().toLowerCase();
		return loanChoices.filter((loan) => {
			if (!showCompleted && String(loan.status ?? '').toLowerCase() === 'completed') {
				return false;
			}
			if (q) {
				const name = loan.loanName.toLowerCase();
				const borrower = (loan.borrowerName ?? '').toLowerCase();
				if (!name.includes(q) && !borrower.includes(q)) return false;
			}
			return true;
		});
	});

	function toggleLoan(id: number) {
		if (selectedLoanIds.includes(id)) {
			selectedLoanIds = selectedLoanIds.filter((value) => value !== id);
		} else {
			selectedLoanIds = [...selectedLoanIds, id];
		}
	}

	async function fetchPreview() {
		const response = await fetch(`/api/groups/${groupId}/access-preview`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ addLoanIds: selectedLoanIds })
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || 'Access preview failed');
		}
		preview = (await response.json()) as AccessPreviewData;
	}

	async function handleContinue() {
		if (selectedLoanIds.length === 0) return;
		previewLoading = true;
		previewError = null;
		saveError = null;
		try {
			await fetchPreview();
			step = 'preview';
		} catch (error) {
			previewError = error instanceof Error ? error.message : 'Access preview failed';
		} finally {
			previewLoading = false;
		}
	}

	async function handleSave() {
		isSaving = true;
		saveError = null;
		try {
			const response = await fetch(`/api/groups/${groupId}/loans`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ loanIds: selectedLoanIds })
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || 'Failed to add loans');
			}
			toast.success(
				selectedLoanIds.length === 1 ? 'Loan added' : `${formatCount(selectedLoanIds.length)} loans added`
			);
			onOpenChange(false);
			await onAdded?.();
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to add loans';
		} finally {
			isSaving = false;
		}
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	title={step === 'pick' ? 'Add loans' : 'Review access'}
	contentClass="sm:max-w-xl"
	bodyClass="pb-2"
>
	{#if step === 'pick'}
		<div class="space-y-3">
			{#if loansLoading}
				<p class="text-sm text-muted-foreground">Loading loans…</p>
			{:else if loanChoices.length === 0}
				<p class="text-sm text-muted-foreground">All of your loans are already in this group.</p>
			{:else}
				<div class="relative">
					<Search
						class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						class="pl-9"
						placeholder="Search loans"
						bind:value={loanQuery}
						aria-label="Search loans"
					/>
				</div>
				<label class="flex min-h-11 items-center gap-2 text-sm">
					<Checkbox bind:checked={showCompleted} />
					Show completed
				</label>
				<ul class="max-h-[min(45dvh,320px)] space-y-1 overflow-y-auto">
					{#each filteredLoans as loan (loan.id)}
						<li>
							<label
								class={cn(
									'flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 hover:bg-muted/40',
									selectedLoanIds.includes(loan.id) && 'border-primary/30 bg-primary/5'
								)}
							>
								<Checkbox
									checked={selectedLoanIds.includes(loan.id)}
									onCheckedChange={() => toggleLoan(loan.id)}
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate font-medium">{formatText(loan.loanName)}</p>
									<p class="text-xs text-muted-foreground">
										{loan.borrowerName ? formatText(loan.borrowerName) : 'No borrower'}
										{#if loan.dueDate}
											· Due {formatDateShort(loan.dueDate)}
										{/if}
										{#if loan.principal != null}
											· {formatCurrency(loan.principal)}
										{/if}
									</p>
									{#if loan.groupBadges && loan.groupBadges.length > 0}
										<div class="pt-1">
											<GroupBadgeList groups={loan.groupBadges} size="sm" />
										</div>
									{/if}
								</div>
							</label>
						</li>
					{:else}
						<li class="px-2 py-6 text-center text-sm text-muted-foreground">No loans match.</li>
					{/each}
				</ul>
				<p class="text-center text-xs text-muted-foreground">
					{formatCount(selectedLoanIds.length)} selected
				</p>
			{/if}
			{#if saveError}
				<p class="text-sm text-destructive">{saveError}</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-3">
			<AccessPreview
				{preview}
				loading={previewLoading}
				error={previewError}
				loanCount={selectedLoanIds.length}
			/>
			{#if saveError}
				<p class="text-sm text-destructive">{saveError}</p>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			class="touch-target h-12 w-full"
			disabled={isSaving || previewLoading}
			onclick={() => {
				if (step === 'preview') {
					step = 'pick';
					return;
				}
				onOpenChange(false);
			}}
		>
			{step === 'preview' ? 'Back' : 'Cancel'}
		</Button>
		{#if availableLoans.length > 0}
			<Button
				type="button"
				class="touch-target h-12 w-full"
				disabled={
					isSaving ||
					previewLoading ||
					(step === 'pick' && selectedLoanIds.length === 0)
				}
				onclick={() => {
					if (step === 'pick') void handleContinue();
					else void handleSave();
				}}
			>
				{step === 'pick' ? 'Review' : isSaving ? 'Adding…' : 'Add to group'}
			</Button>
		{/if}
	{/snippet}
</ResponsiveModal>
