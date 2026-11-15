<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import SearchableSelect from '$lib/components/common/SearchableSelect.svelte';
	import LoanFormGroupsField from '$lib/components/loans/LoanFormGroupsField.svelte';
	import { UserPlus } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { DropdownOption } from '$lib/dropdown-ux';
	import type { Borrower, LoanType } from '$lib/types';
	import type {
		LoanTemplate,
		LoanTemplateBorrower
	} from '$lib/loan-templates';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';

	interface Props {
		isEditMode: boolean;
		hasDuplicateData: boolean;
		isSubmitting: boolean;
		loanTemplates: LoanTemplate[];
		templateOptions: DropdownOption[];
		selectedTemplateId: string;
		onTemplateChange: (value: string) => void;
		useTemplateBorrowers: boolean;
		templateBorrowerChoices: LoanTemplateBorrower[];
		borrowerId: string;
		borrowerOptions: DropdownOption[];
		borrowerList: Borrower[];
		onBorrowerSelect: (value: string) => void;
		onTemplateBorrower: (
			id: number,
			checked: boolean | 'indeterminate'
		) => void;
		loanName: string;
		onLoanNameInput: (value: string) => void;
		errors: Record<string, string>;
		type: LoanType;
		loanTypes: LoanType[];
		dueDate: string;
		freeLotSqm: string;
		notes: string;
		showGroupsField: boolean;
		groupsIndex: GroupsIndexItem[];
		selectedGroupIds: number[];
	}

	let {
		isEditMode,
		hasDuplicateData,
		isSubmitting,
		loanTemplates,
		templateOptions,
		selectedTemplateId,
		onTemplateChange,
		useTemplateBorrowers,
		templateBorrowerChoices,
		borrowerId,
		borrowerOptions,
		borrowerList,
		onBorrowerSelect,
		onTemplateBorrower,
		loanName,
		onLoanNameInput,
		errors,
		type = $bindable(),
		loanTypes,
		dueDate = $bindable(),
		freeLotSqm = $bindable(),
		notes = $bindable(),
		showGroupsField,
		groupsIndex,
		selectedGroupIds = $bindable()
	}: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Loan Details</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<div class="grid gap-4 sm:grid-cols-2">
			{#if !isEditMode && !hasDuplicateData && loanTemplates.length > 0}
				<div class="space-y-2 sm:col-span-2">
					<Label for="loanTemplate">Template</Label>
					<SearchableSelect
						id="loanTemplate"
						options={templateOptions}
						value={selectedTemplateId}
						onValueChange={onTemplateChange}
						placeholder="None"
						searchPlaceholder="Search templates..."
						searchable={loanTemplates.length > 8}
						disabled={isSubmitting}
						triggerClassName="w-full"
					/>
				</div>
			{/if}
			<div id="field-borrower" class="scroll-mt-24 space-y-2">
				<Label for={useTemplateBorrowers ? undefined : 'borrowerId'}>Borrower *</Label>
				{#if useTemplateBorrowers && templateBorrowerChoices.length > 0}
					<ul class="space-y-2">
						{#each templateBorrowerChoices as borrower (borrower.id)}
							{@const selected = borrowerId === String(borrower.id)}
							<li>
								<label
									class={cn(
										'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3',
										selected
											? 'border-primary/45 bg-primary/[0.06]'
											: 'border-border/60'
									)}
								>
									<span class="min-w-0 flex-1 truncate text-sm font-medium">{borrower.name}</span>
									<Checkbox
										checked={selected}
										disabled={isSubmitting}
										aria-label={borrower.name}
										onCheckedChange={(checked) => onTemplateBorrower(borrower.id, checked)}
									/>
								</label>
							</li>
						{/each}
					</ul>
				{:else}
					<SearchableSelect
						id="borrowerId"
						options={borrowerOptions}
						value={borrowerId}
						onValueChange={onBorrowerSelect}
						placeholder="Select a borrower..."
						searchPlaceholder="Search borrowers..."
						searchable={true}
						disabled={isSubmitting}
						triggerClassName="w-full"
					>
						{#snippet header({ select })}
							<button
								type="button"
								class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
								onclick={() => select('new')}
							>
								<UserPlus class="h-4 w-4" />
								Add New Borrower
							</button>
							{#if borrowerList.length > 0}
								<div class="my-1 h-px bg-border"></div>
							{/if}
						{/snippet}
					</SearchableSelect>
				{/if}
				{#if errors.borrowerId}<p id="borrower-error" class="text-sm font-medium text-destructive" role="alert">{errors.borrowerId}</p>{/if}
			</div>
			<div id="field-loan-name" class="scroll-mt-24 space-y-2">
				<Label for="loanName">Loan Name / Label *</Label>
				<Input
					id="loanName"
					value={loanName}
					oninput={(event) => onLoanNameInput(event.currentTarget.value)}
					disabled={isSubmitting}
					placeholder="e.g., Mexico, Pampanga"
					required
					aria-invalid={errors.loanName ? 'true' : undefined}
					aria-describedby={errors.loanName ? 'loan-name-error' : undefined}
				/>
				{#if errors.loanName}<p id="loan-name-error" class="text-sm font-medium text-destructive" role="alert">{errors.loanName}</p>{/if}
			</div>
			<div class="space-y-2">
				<Label for="type">Type *</Label>
				<Select.Root type="single" bind:value={type} disabled={isSubmitting}>
					<Select.Trigger id="type" class="w-full">{type}</Select.Trigger>
					<Select.Content>
						{#each loanTypes as loanType}
							<Select.Item value={loanType}>{loanType}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div id="field-due-date" class="scroll-mt-24 space-y-2">
				<Label for="dueDate">Due Date *</Label>
				<Input
					id="dueDate"
					type="date"
					bind:value={dueDate}
					disabled={isSubmitting}
					aria-invalid={errors.dueDate ? 'true' : undefined}
					aria-describedby={errors.dueDate ? 'due-date-error' : undefined}
				/>
				{#if errors.dueDate}<p id="due-date-error" class="text-sm font-medium text-destructive" role="alert">{errors.dueDate}</p>{/if}
			</div>
			{#if type === 'Lot Title'}
				<div class="space-y-2">
					<Label for="freeLotSqm">Free Lot (sqm)</Label>
					<Input
						id="freeLotSqm"
						type="number"
						min="0"
						bind:value={freeLotSqm}
						disabled={isSubmitting}
						placeholder="Optional"
					/>
				</div>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="notes">Notes</Label>
			<Textarea
				id="notes"
				bind:value={notes}
				disabled={isSubmitting}
				placeholder="Additional notes..."
				rows={3}
			/>
		</div>

		{#if showGroupsField}
			<LoanFormGroupsField
				groups={groupsIndex}
				bind:selectedGroupIds
				disabled={isSubmitting}
			/>
		{/if}
	</Card.Content>
</Card.Root>

