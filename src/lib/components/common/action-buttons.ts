/** Shared ActionButtons props for list grid cards (Open + optional ⋮ menu). */
export const GRID_CARD_ACTION_PROPS = {
  showView: false,
  size: "md" as const,
  quickViewLabel: "Open",
  showQuickViewIcon: false,
  moreLabel: null as null,
  cardPrimaryVariant: "outline" as const,
};

export function createCardQuickViewHandler(
  handler?: () => void,
): ((event: MouseEvent) => void) | undefined {
  if (!handler) return undefined;
  return (event) => {
    event.preventDefault();
    event.stopPropagation();
    handler();
  };
}

export type LoanActionIcon =
  | "fund"
  | "received"
  | "pay"
  | "edit"
  | "duplicate"
  | "contract"
  | "complete"
  | "view"
  | "delete";

export interface RowActionItem {
  label: string;
  onClick: () => void;
  icon?: LoanActionIcon;
  destructive?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
}

function appendGroup(target: RowActionItem[], group: RowActionItem[]) {
  if (group.length === 0) return;
  if (target.length > 0) {
    group[0] = { ...group[0], separatorBefore: true };
  }
  target.push(...group);
}

export interface CreateLoanActionItemsOptions {
  canEdit?: boolean;
  onEdit?: () => void;
  showDuplicate?: boolean;
  onDuplicate?: () => void;
  onAddPayment?: () => void;
  onAddReceivedPayment?: () => void;
  showPayBalance?: boolean;
  onPayBalance?: () => void;
  onContractDetails?: () => void;
  showComplete?: boolean;
  onComplete?: () => void;
  showViewLoan?: boolean;
  onViewLoan?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
}

/** Canonical loan ⋯ menu: Edit/Duplicate | Fund/Received/Pay/Contract/Complete/View | Delete */
export function createLoanActionItems(
  options: CreateLoanActionItemsOptions,
): RowActionItem[] {
  const items: RowActionItem[] = [];

  const managementGroup: RowActionItem[] = [];
  if (options.onEdit && options.canEdit !== false) {
    managementGroup.push({
      label: "Edit",
      onClick: options.onEdit,
      icon: "edit",
    });
  }
  if (options.showDuplicate && options.onDuplicate) {
    managementGroup.push({
      label: "Duplicate",
      onClick: options.onDuplicate,
      icon: "duplicate",
    });
  }
  appendGroup(items, managementGroup);

  const transactionGroup: RowActionItem[] = [];
  if (options.onAddPayment) {
    transactionGroup.push({
      label: "Fund Transfer",
      onClick: options.onAddPayment,
      icon: "fund",
    });
  }
  if (options.onAddReceivedPayment) {
    transactionGroup.push({
      label: "Add Received Payment",
      onClick: options.onAddReceivedPayment,
      icon: "received",
    });
  }
  if (options.showPayBalance && options.onPayBalance) {
    transactionGroup.push({
      label: "Pay",
      onClick: options.onPayBalance,
      icon: "pay",
    });
  }
  if (options.onContractDetails) {
    transactionGroup.push({
      label: "Contract Details",
      onClick: options.onContractDetails,
      icon: "contract",
    });
  }
  if (options.showComplete && options.onComplete) {
    transactionGroup.push({
      label: "Complete",
      onClick: options.onComplete,
      icon: "complete",
    });
  }
  if (options.showViewLoan && options.onViewLoan) {
    transactionGroup.push({
      label: "View Loan",
      onClick: options.onViewLoan,
      icon: "view",
    });
  }
  appendGroup(items, transactionGroup);

  if (options.onDelete && options.canDelete !== false) {
    items.push({
      label: "Delete",
      onClick: options.onDelete,
      icon: "delete",
      destructive: true,
      separatorBefore: items.length > 0,
    });
  }

  return items;
}

export type LoanListScope = "loans" | "investments" | "borrowed" | "witnessed";

/** Row/card ⋯ handlers for loan list pages — scope gates edit/delete vs payments. */
export function loanListRowActionHandlers<T extends { id: number }>(options: {
  scope: LoanListScope;
  canManage: boolean;
  onEdit?: (loan: T) => void;
  onDuplicate?: (loan: T) => void;
  onAddPayment?: (loan: T) => void;
  onAddReceivedPayment?: (loan: T) => void;
  onContractDetails: (loan: T) => void;
  onDelete?: (loan: T) => void;
}) {
  return {
    onEdit: options.canManage ? options.onEdit : undefined,
    onDuplicate: options.canManage ? options.onDuplicate : undefined,
    onAddPayment: options.canManage ? options.onAddPayment : undefined,
    onAddReceivedPayment: options.canManage
      ? options.onAddReceivedPayment
      : undefined,
    onContractDetails: options.onContractDetails,
    onDelete: options.canManage ? options.onDelete : undefined,
  };
}

/** Non-loan list rows (borrowers, debts, etc.) */
export function createRowActionItems(options: {
  onEdit?: () => void;
  onDelete?: () => void;
}): RowActionItem[] {
  const items: RowActionItem[] = [];

  if (options.onEdit) {
    items.push({ label: "Edit", onClick: options.onEdit, icon: "edit" });
  }
  if (options.onDelete) {
    items.push({
      label: "Delete",
      onClick: options.onDelete,
      icon: "delete",
      destructive: true,
      separatorBefore: items.length > 0,
    });
  }

  return items;
}
