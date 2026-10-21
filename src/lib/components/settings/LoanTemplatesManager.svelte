<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import LoanFormGroupsField from '$lib/components/loans/LoanFormGroupsField.svelte';
	import TemplateMultiSelect from '$lib/components/settings/TemplateMultiSelect.svelte';
	import { toLocalDateString } from '$lib/date-utils';
	import { SHOW_GROUPS_UI } from '$lib/feature-flags';
	import { formatCurrency } from '$lib/format';
	import type { GroupsIndexItem } from '$lib/groups/loan-group-filter';
	import {
		addIsoDays,
		DEFAULT_TEMPLATE_TERM_DAYS,
		defaultLoanNamePattern,
		effectiveLoanNamePattern,
		formatInterestInput,
		loanNameHasDateTokens,
		MAX_LOAN_TEMPLATES_PER_USER,
		parseLoanTemplateInput,
		resolveLoanNamePattern,
		type LoanTemplate,
		type LoanTemplateInterestType
	} from '$lib/loan-templates';
	import { toast } from '$lib/toast';
	import type { LoanType } from '$lib/types';
	import { Pencil, Plus, Trash2, X } from 'lucide-svelte';

	interface BorrowerOption {
		id: number;
		name: string;
	}

	interface InvestorOption {
		id: number;
		name: string;
	}

	interface Props {
		initialTemplates?: LoanTemplate[];
		borrowers?: BorrowerOption[];
		investors?: InvestorOption[];
		groups?: GroupsIndexItem[];
	}

	let {
		initialTemplates = [],
		borrowers = [],
		investors = [],
		groups = []
	}: Props = $props();

	const loanTypes: LoanType[] = ['Lot Title', 'OR/CR', 'Agent'];

	let templates = $state<LoanTemplate[]>([...initialTemplates]);
	let formOpen = $state(false);
	let editingId = $state<number | null>(null);
	let isSubmitting = $state(false);
	let deleteTarget = $state<LoanTemplate | null>(null);
	let isDeleting = $state(false);

	let name = $state('');
	let loanName = $state(defaultLoanNamePattern('Lot Title'));
	let type = $state<LoanType>('Lot Title');
	let selectedBorrowerIds = $state<number[]>([]);
	let selectedInvestors = $state<{ investorId: number; interestValue: string }[]>([]);
	let selectedGroupIds = $state<number[]>([]);
	let interestType = $state<LoanTemplateInterestType>('rate');
	let interestValue = $state('10');
	let termDays = $state(String(DEFAULT_TEMPLATE_TERM_DAYS));
	let notes = $state('');
	let freeLotSqm = $state('');

	const namePreview = $derived.by(() => {
		const pattern = loanName.trim();
		if (!loanNameHasDateTokens(pattern)) return '';
		const today = toLocalDateString(new Date());
		const days = Number(termDays);
		const span = Number.isInteger(days) && days > 0 ? days : DEFAULT_TEMPLATE_TERM_DAYS;
		return resolveLoanNamePattern(pattern, today, addIsoDays(today, span));
	});

	const atLimit = $derived(templates.length >= MAX_LOAN_TEMPLATES_PER_USER);

	function resetForm() {
		editingId = null;
		name = '';
		type = 'Lot Title';
		loanName = defaultLoanNamePattern('Lot Title');
		selectedBorrowerIds = [];
		selectedInvestors = [];
		selectedGroupIds = [];
		interestType = 'rate';
		interestValue = '10';
		termDays = String(DEFAULT_TEMPLATE_TERM_DAYS);
		notes = '';
		freeLotSqm = '';
	}

	function handleTypeChange(value: string | undefined) {
		if (value !== 'Lot Title' && value !== 'OR/CR' && value !== 'Agent') return;
		const previous = type;
		if (previous === value) return;
		const current = loanName.trim();
		type = value;
		if (!current || current === defaultLoanNamePattern(previous)) {
			loanName = defaultLoanNamePattern(value);
		}
	}

	function openCreate() {
		resetForm();
		formOpen = true;
	}

	function openEdit(template: LoanTemplate) {
		editingId = template.id;
		name = template.name;
		type = template.type;
		loanName = effectiveLoanNamePattern(template.loanName, template.nameMode);
		selectedBorrowerIds = template.borrowerIds.filter((id) =>
			borrowers.some((borrower) => borrower.id === id)
		);
		selectedInvestors = template.investors
			.filter((investor) => investors.some((option) => option.id === investor.investorId))
			.map((investor) => ({
				investorId: investor.investorId,
				interestValue: formatInterestInput(investor.interestValue)
			}));
		selectedGroupIds = [...template.groupIds];
		interestType = template.interestType;
		interestValue = formatInterestInput(template.interestValue);
		termDays = template.termDays != null ? String(template.termDays) : '';
		notes = template.notes ?? '';
		freeLotSqm = template.freeLotSqm != null ? String(template.freeLotSqm) : '';
		formOpen = true;
	}

	function templateSummary(template: LoanTemplate): string {
		const parts: string[] = [template.type];
		if (template.borrowers.length === 1) parts.push(template.borrowers[0].name);
		else if (template.borrowers.length > 1) parts.push(`${template.borrowers.length} borrowers`);
		const namedInvestors = template.investors.filter(
			(investor): investor is typeof investor & { name: string } => Boolean(investor.name)
		);
		if (namedInvestors.length === 1) parts.push(namedInvestors[0].name);
		else if (namedInvestors.length > 1) parts.push(`${namedInvestors.length} investors`);
		const rates = [
			...new Set(
				(namedInvestors.length > 0 ? namedInvestors : [{ interestValue: template.interestValue }]).map(
					(investor) => formatInterestInput(investor.interestValue)
				)
			)
		];
		if (rates.length === 1) {
			parts.push(template.interestType === 'fixed' ? formatCurrency(rates[0]) : `${rates[0]}%`);
		}
		const groupNames = template.groupIds
			.map((id) => groups.find((group) => group.id === id)?.name)
			.filter((groupName): groupName is string => Boolean(groupName));
		if (groupNames.length > 0) parts.push(groupNames.join(', '));
		return parts.join(' · ');
	}

	function payload() {
		return {
			name,
			loanName,
			type,
			borrowerIds: selectedBorrowerIds,
			investors: selectedInvestors,
			groupIds: SHOW_GROUPS_UI ? selectedGroupIds : [],
			interestType,
			interestValue,
			termDays: termDays.trim() === '' ? null : Number(termDays),
			notes,
			freeLotSqm: freeLotSqm.trim() === '' ? null : Number(freeLotSqm)
		};
	}

	function setBorrowerSelected(id: number, checked: boolean | 'indeterminate') {
		if (checked === true) {
			if (!selectedBorrowerIds.includes(id)) selectedBorrowerIds = [...selectedBorrowerIds, id];
		} else {
			selectedBorrowerIds = selectedBorrowerIds.filter((value) => value !== id);
		}
	}

	function setInvestorSelected(id: number, checked: boolean | 'indeterminate') {
		if (checked === true) {
			if (!selectedInvestors.some((investor) => investor.investorId === id)) {
				selectedInvestors = [
					...selectedInvestors,
					{ investorId: id, interestValue: interestValue || '10' }
				];
			}
		} else {
			selectedInvestors = selectedInvestors.filter((investor) => investor.investorId !== id);
		}
	}

	function setInvestorRate(id: number, value: string) {
		selectedInvestors = selectedInvestors.map((investor) =>
			investor.investorId === id ? { ...investor, interestValue: value } : investor
		);
	}

	function toggleBorrower(value: string) {
		const id = Number(value);
		setBorrowerSelected(id, !selectedBorrowerIds.includes(id));
	}

	function toggleInvestor(value: string) {
		const id = Number(value);
		setInvestorSelected(
			id,
			!selectedInvestors.some((investor) => investor.investorId === id)
		);
	}

	const selectedBorrowerRows = $derived(
		selectedBorrowerIds.flatMap((id) => {
			const borrower = borrowers.find((item) => item.id === id);
			return borrower ? [borrower] : [];
		})
	);
	const selectedInvestorRows = $derived(
		selectedInvestors.flatMap((preset) => {
			const investor = investors.find((item) => item.id === preset.investorId);
			return investor ? [{ ...preset, name: investor.name }] : [];
		})
	);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const parsed = parseLoanTemplateInput(payload());
		if (!parsed.ok) {
			toast.error(parsed.error);
			return;
		}

		isSubmitting = true;
		try {
			const response = await fetch(
				editingId == null ? '/api/loan-templates' : `/api/loan-templates/${editingId}`,
				{
					method: editingId == null ? 'POST' : 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload())
				}
			);
			const body = (await response.json().catch(() => ({}))) as LoanTemplate & { error?: string };
			if (!response.ok) throw new Error(body.error || 'Failed to save template');
			if (editingId == null) {
				templates = [...templates, body].sort((a, b) => a.name.localeCompare(b.name));
			} else {
				templates = templates
					.map((template) => (template.id === body.id ? body : template))
					.sort((a, b) => a.name.localeCompare(b.name));
			}
			formOpen = false;
			resetForm();
			toast.success('Template saved');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save template');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		isDeleting = true;
		try {
			const response = await fetch(`/api/loan-templates/${deleteTarget.id}`, { method: 'DELETE' });
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			if (!response.ok) throw new Error(body.error || 'Failed to delete template');
			templates = templates.filter((template) => template.id !== deleteTarget?.id);
			if (editingId === deleteTarget.id) {
				formOpen = false;
				resetForm();
			}
			toast.success('Template deleted');
			deleteTarget = null;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete template');
		} finally {
			isDeleting = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
		<Card.Title>Loan templates</Card.Title>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="min-h-11"
			disabled={atLimit}
			onclick={openCreate}
		>
			<Plus class="mr-1 h-3.5 w-3.5" />
			Add
		</Button>
	</Card.Header>
	<Card.Content>
		{#if templates.length === 0}
			<p class="text-sm text-muted-foreground">No templates</p>
		{:else}
			<ul class="space-y-2">
				{#each templates as template (template.id)}
					<li class="flex items-start justify-between gap-2 rounded-xl border border-border/60 p-3">
						<div class="min-w-0">
							<p class="text-sm font-medium">{template.name}</p>
							<p class="text-sm text-muted-foreground">{templateSummary(template)}</p>
						</div>
						<div class="flex shrink-0 gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="touch-target"
								aria-label="Edit template"
								onclick={() => openEdit(template)}
							>
								<Pencil class="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								class="touch-target"
								aria-label="Delete template"
								onclick={() => (deleteTarget = template)}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>

<ResponsiveModal
	open={formOpen}
	onOpenChange={(open) => {
		formOpen = open;
		if (!open) resetForm();
	}}
	title={editingId == null ? 'New template' : 'Edit template'}
	contentClass="sm:max-w-lg"
>
	{#snippet footer()}
		<Button
			type="button"
			variant="outline"
			class="min-h-11"
			disabled={isSubmitting}
			onclick={() => {
				formOpen = false;
				resetForm();
			}}
		>
			Cancel
		</Button>
		<Button type="submit" form="loan-template-form" class="min-h-11" disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : 'Save'}
		</Button>
	{/snippet}

	<form id="loan-template-form" class="space-y-4" onsubmit={handleSubmit}>
		<div class="space-y-2">
			<Label for="template-name">Template name</Label>
			<Input id="template-name" bind:value={name} disabled={isSubmitting} required />
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-2 sm:col-span-2">
				<Label for="template-type">Type</Label>
				<Select.Root
					type="single"
					value={type}
					onValueChange={handleTypeChange}
					disabled={isSubmitting}
				>
					<Select.Trigger id="template-type" class="w-full">{type}</Select.Trigger>
					<Select.Content>
						{#each loanTypes as loanType (loanType)}
							<Select.Item value={loanType}>{loanType}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<div class="space-y-2">
			<Label for="template-loan-name">Loan name</Label>
			<Input
				id="template-loan-name"
				bind:value={loanName}
				disabled={isSubmitting}
				placeholder={defaultLoanNamePattern(type)}
				required
			/>
			{#if namePreview}
				<p class="text-sm text-muted-foreground">Example: {namePreview}</p>
			{/if}
		</div>
		<div class="space-y-2">
			<Label for="template-term">Due in (days)</Label>
			<Input
				id="template-term"
				type="number"
				inputmode="numeric"
				min="1"
				max="730"
				class="w-full"
				bind:value={termDays}
				disabled={isSubmitting}
			/>
		</div>
		<div class="space-y-2">
			<Label>{interestType === 'fixed' ? 'Fixed amount' : 'Rate (%)'}</Label>
			<Tabs.Root
				value={interestType}
				onValueChange={(value) => {
					if (value === 'rate' || value === 'fixed') interestType = value;
				}}
			>
				<Tabs.List class="grid h-11 w-full grid-cols-2">
					<Tabs.Trigger value="rate">Rate</Tabs.Trigger>
					<Tabs.Trigger value="fixed">Fixed</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>
			<Input
				type="number"
				inputmode="decimal"
				min="0"
				step="0.01"
				class="w-full"
				bind:value={interestValue}
				disabled={isSubmitting}
				aria-label={interestType === 'fixed' ? 'Fixed interest amount' : 'Interest rate percent'}
			/>
		</div>
		<div class="space-y-2">
			<Label for="template-borrowers">Borrowers</Label>
			{#if borrowers.length === 0}
				<p class="text-sm text-muted-foreground">No borrowers</p>
			{:else}
				<TemplateMultiSelect
					id="template-borrowers"
					options={borrowers.map((borrower) => ({
						value: String(borrower.id),
						label: borrower.name
					}))}
					selectedIds={selectedBorrowerIds.map(String)}
					onToggle={toggleBorrower}
					placeholder="Select borrowers"
					searchPlaceholder="Search borrowers"
					emptyMessage="No borrowers"
					sheetTitle="Borrowers"
					disabled={isSubmitting}
				/>
				{#if selectedBorrowerRows.length > 0}
					<ul class="space-y-2">
						{#each selectedBorrowerRows as borrower (borrower.id)}
							<li class="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-card pr-1 pl-3">
								<span class="min-w-0 flex-1 truncate text-sm font-medium">{borrower.name}</span>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="size-11 shrink-0"
									disabled={isSubmitting}
									aria-label={`Remove ${borrower.name}`}
									onclick={() => setBorrowerSelected(borrower.id, false)}
								>
									<X class="h-4 w-4" />
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
		<div class="space-y-2">
			<Label for="template-investors">Investors</Label>
			{#if investors.length === 0}
				<p class="text-sm text-muted-foreground">No investors</p>
			{:else}
				<TemplateMultiSelect
					id="template-investors"
					options={investors.map((investor) => ({
						value: String(investor.id),
						label: investor.name
					}))}
					selectedIds={selectedInvestors.map((investor) => String(investor.investorId))}
					onToggle={toggleInvestor}
					placeholder="Select investors"
					searchPlaceholder="Search investors"
					emptyMessage="No investors"
					sheetTitle="Investors"
					disabled={isSubmitting}
				/>
				{#if selectedInvestorRows.length > 0}
					<ul class="space-y-2">
						{#each selectedInvestorRows as investor (investor.investorId)}
							<li class="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-card py-1 pr-1 pl-3">
								<span class="min-w-0 flex-1 truncate text-sm font-medium">{investor.name}</span>
								<Input
									type="number"
									inputmode="decimal"
									min="0"
									step="0.01"
									class="h-11 w-24 shrink-0 tabular-nums"
									value={investor.interestValue}
									disabled={isSubmitting}
									aria-label={interestType === 'fixed'
										? `${investor.name} amount`
										: `${investor.name} rate`}
									oninput={(event) => setInvestorRate(investor.investorId, event.currentTarget.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="size-11 shrink-0"
									disabled={isSubmitting}
									aria-label={`Remove ${investor.name}`}
									onclick={() => setInvestorSelected(investor.investorId, false)}
								>
									<X class="h-4 w-4" />
								</Button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
		{#if type === 'Lot Title'}
			<div class="space-y-2">
				<Label for="template-sqm">Free lot (sqm)</Label>
				<Input
					id="template-sqm"
					type="number"
					min="0"
					bind:value={freeLotSqm}
					disabled={isSubmitting}
					placeholder="Optional"
				/>
			</div>
		{/if}
		{#if SHOW_GROUPS_UI}
			<LoanFormGroupsField {groups} bind:selectedGroupIds disabled={isSubmitting} />
		{/if}
		<div class="space-y-2">
			<Label for="template-notes">Notes</Label>
			<Textarea id="template-notes" bind:value={notes} disabled={isSubmitting} rows={2} />
		</div>
	</form>
</ResponsiveModal>

<AlertDialog.Root
	open={deleteTarget !== null}
	onOpenChange={(open) => {
		if (!open && !isDeleting) deleteTarget = null;
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete template</AlertDialog.Title>
			<AlertDialog.Description>
				Delete {deleteTarget?.name ?? 'this template'}?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					void handleDelete();
				}}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
