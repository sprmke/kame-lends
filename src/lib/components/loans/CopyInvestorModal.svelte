<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import * as ScrollArea from '$lib/components/ui/scroll-area';
	import { Copy } from 'lucide-svelte';
	import type { Investor } from '$lib/types';
	import {
		configurationsMatch,
		findInvestorsWithSameConfig,
		type InvestorConfiguration
	} from './copy-investor-utils';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		sourceInvestor: Investor;
		sourceInvestorConfig: InvestorConfiguration;
		availableInvestors: Investor[];
		onCopy: (targetInvestorIds: number[]) => void;
		selectedInvestorIds?: number[];
		selectedInvestorsConfigs?: Map<number, InvestorConfiguration>;
	}

	let {
		open,
		onOpenChange,
		sourceInvestor,
		sourceInvestorConfig,
		availableInvestors,
		onCopy,
		selectedInvestorIds = [],
		selectedInvestorsConfigs = new Map()
	}: Props = $props();

	let checkedInvestorIds = $state<number[]>([]);
	let autoCheckedInvestorIds = $state(new Set<number>());

	$effect(() => {
		if (!open) {
			checkedInvestorIds = [];
			autoCheckedInvestorIds = new Set();
			return;
		}

		const matchingIds = findInvestorsWithSameConfig(
			sourceInvestorConfig,
			availableInvestors.map((investor) => investor.id),
			selectedInvestorsConfigs
		);
		autoCheckedInvestorIds = new Set(matchingIds);
		checkedInvestorIds = matchingIds;
	});

	function hasMatchingConfig(investorId: number): boolean {
		const investorConfig = selectedInvestorsConfigs.get(investorId);
		if (!investorConfig) return false;
		return configurationsMatch(sourceInvestorConfig, investorConfig);
	}

	function handleToggleInvestor(investorId: number) {
		const investorConfig = selectedInvestorsConfigs.get(investorId);
		const isCurrentlyChecked = checkedInvestorIds.includes(investorId);
		const currentlyMatches = hasMatchingConfig(investorId);

		if (isCurrentlyChecked && currentlyMatches) return;

		if (isCurrentlyChecked) {
			checkedInvestorIds = checkedInvestorIds.filter((id) => id !== investorId);
			autoCheckedInvestorIds.delete(investorId);
			autoCheckedInvestorIds = new Set(autoCheckedInvestorIds);
			return;
		}

		if (investorConfig) {
			const matchingIds = findInvestorsWithSameConfig(
				investorConfig,
				availableInvestors.map((investor) => investor.id),
				selectedInvestorsConfigs
			);
			checkedInvestorIds = Array.from(new Set([...checkedInvestorIds, ...matchingIds]));
			autoCheckedInvestorIds = new Set([...autoCheckedInvestorIds, ...matchingIds]);
		} else {
			const matchingIds = findInvestorsWithSameConfig(
				sourceInvestorConfig,
				availableInvestors.map((investor) => investor.id),
				selectedInvestorsConfigs
			);
			checkedInvestorIds = Array.from(new Set([...checkedInvestorIds, investorId, ...matchingIds]));
			autoCheckedInvestorIds = new Set([...autoCheckedInvestorIds, investorId, ...matchingIds]);
		}
	}

	function handleCopy() {
		if (checkedInvestorIds.length === 0) return;
		onCopy(checkedInvestorIds);
		checkedInvestorIds = [];
		onOpenChange(false);
	}

	function handleCancel() {
		checkedInvestorIds = [];
		onOpenChange(false);
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Copy Investor Configuration</Dialog.Title>
			<Dialog.Description>
				Select investors to copy all configurations from
				<strong>{sourceInvestor.name}</strong>. This copies principal payments, received payments,
				interest settings, and multiple interest periods.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label class="text-sm font-semibold">Select Investors</Label>
				{#if availableInvestors.length === 0}
					<p class="py-4 text-center text-sm text-muted-foreground">
						No other investors available to copy to
					</p>
				{:else}
					<ScrollArea.Root class="h-[300px] rounded-md border p-4">
						<div class="space-y-3">
							{#each availableInvestors as investor (investor.id)}
								{@const isChecked = checkedInvestorIds.includes(investor.id)}
								{@const currentlyMatches = hasMatchingConfig(investor.id)}
								{@const isDisabled = isChecked && currentlyMatches}
								{@const isAlreadyAdded = selectedInvestorIds.includes(investor.id)}
								<div class="flex items-center space-x-3">
									<Checkbox
										id={`investor-${investor.id}`}
										checked={isChecked}
										disabled={isDisabled}
										onCheckedChange={() => handleToggleInvestor(investor.id)}
									/>
									<Label
										for={`investor-${investor.id}`}
										class="flex-1 text-sm {isDisabled
											? 'cursor-not-allowed opacity-60'
											: 'cursor-pointer'}"
									>
										<div class="flex flex-wrap items-center gap-2">
											<span>{investor.name}</span>
											{#if isAlreadyAdded}
												<span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
													Added
												</span>
											{/if}
											{#if currentlyMatches && isChecked}
												<span class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
													Same config
												</span>
											{/if}
										</div>
										{#if investor.email}
											<span class="text-xs text-muted-foreground">{investor.email}</span>
										{/if}
									</Label>
								</div>
							{/each}
						</div>
					</ScrollArea.Root>
				{/if}
			</div>

			<div class="flex justify-end gap-3">
				<Button type="button" variant="outline" onclick={handleCancel}>Cancel</Button>
				<Button type="button" disabled={checkedInvestorIds.length === 0} onclick={handleCopy}>
					<Copy class="mr-2 h-4 w-4" />
					Copy to {checkedInvestorIds.length} investor{checkedInvestorIds.length !== 1 ? 's' : ''}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
