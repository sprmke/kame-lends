<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Tabs from '$lib/components/ui/tabs';
	import LoanContractParticipantsEditor from '$lib/components/loans/LoanContractParticipantsEditor.svelte';
	import type { ContractCustomization } from '$lib/loan-contract-customization';
	import type { ContractLender } from '$lib/loan-contract-data';
	import type { Borrower, Investor } from '$lib/types';
	import { FileText, RotateCcw, UsersRound } from 'lucide-svelte';

	interface Props {
		value: ContractCustomization;
		borrowerName: string;
		borrowerHasSignature: boolean;
		lenders: ContractLender[];
		borrowers: Borrower[];
		investors: Investor[];
		onChange: (
			field: keyof ContractCustomization,
			nextValue: ContractCustomization[keyof ContractCustomization]
		) => void;
		onChanges: (changes: Partial<ContractCustomization>) => void;
		onReset: () => void;
	}

	let {
		value,
		borrowerName,
		borrowerHasSignature,
		lenders,
		borrowers,
		investors,
		onChange,
		onChanges,
		onReset
	}: Props = $props();
</script>

<div class="overflow-hidden rounded-xl border border-border bg-muted/20">
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
		<p class="text-sm font-medium">Contract setup</p>
		<Button type="button" variant="outline" size="sm" onclick={onReset}>
			<RotateCcw class="mr-2 h-3.5 w-3.5" />
			Reset defaults
		</Button>
	</div>

	<Tabs.Root value="participants" class="p-4">
		<Tabs.List class="grid h-auto w-full grid-cols-2">
			<Tabs.Trigger value="participants" class="gap-2 py-2">
				<UsersRound class="h-4 w-4" />
				Parties & signatures
			</Tabs.Trigger>
			<Tabs.Trigger value="terms" class="gap-2 py-2">
				<FileText class="h-4 w-4" />
				Contract terms
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="participants" class="mt-4">
			<LoanContractParticipantsEditor
				{value}
				{borrowerName}
				{borrowerHasSignature}
				{lenders}
				{borrowers}
				{investors}
				{onChange}
				{onChanges}
			/>
		</Tabs.Content>

		<Tabs.Content value="terms" class="mt-4">
			<div class="space-y-5 rounded-xl border border-border bg-background p-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2 sm:col-span-2">
						<Label for="contractTitle">Document title</Label>
						<Input
							id="contractTitle"
							value={value.contractTitle}
							oninput={(e) => onChange('contractTitle', e.currentTarget.value)}
						/>
					</div>

					<div class="space-y-2 sm:col-span-2">
						<Label for="collateralSummary">Collateral summary</Label>
						<Textarea
							id="collateralSummary"
							value={value.collateralSummary}
							oninput={(e) => onChange('collateralSummary', e.currentTarget.value)}
							rows={3}
						/>
					</div>

					<div class="space-y-2 sm:col-span-2">
						<Label for="securityClause">Security & collateral clause</Label>
						<Textarea
							id="securityClause"
							value={value.securityClause}
							oninput={(e) => onChange('securityClause', e.currentTarget.value)}
							rows={10}
						/>
					</div>

					<div class="space-y-2">
						<Label for="disputeVenue">Dispute venue</Label>
						<Input
							id="disputeVenue"
							value={value.disputeVenue}
							oninput={(e) => onChange('disputeVenue', e.currentTarget.value)}
						/>
					</div>

					<div class="space-y-2 sm:col-span-2">
						<Label for="additionalTerms">Additional terms (optional)</Label>
						<Textarea
							id="additionalTerms"
							value={value.additionalTerms}
							oninput={(e) => onChange('additionalTerms', e.currentTarget.value)}
							rows={4}
						/>
					</div>
				</div>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
