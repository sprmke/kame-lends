export interface RowActionItem {
	label: string;
	onClick: () => void;
	destructive?: boolean;
	separatorBefore?: boolean;
	disabled?: boolean;
}

export function createRowActionItems(options: {
	onEdit?: () => void;
	onAddPayment?: () => void;
	onAddReceivedPayment?: () => void;
	onDuplicate?: () => void;
	onDownloadContract?: () => void;
	isDownloadingContract?: boolean;
	onDelete?: () => void;
}): RowActionItem[] {
	const items: RowActionItem[] = [];

	if (options.onAddPayment) {
		items.push({ label: 'Fund Transfer', onClick: options.onAddPayment });
	}
	if (options.onAddReceivedPayment) {
		items.push({ label: 'Add Received Payment', onClick: options.onAddReceivedPayment });
	}
	if (options.onEdit) {
		items.push({ label: 'Edit', onClick: options.onEdit, separatorBefore: items.length > 0 });
	}
	if (options.onDuplicate) {
		items.push({
			label: 'Duplicate',
			onClick: options.onDuplicate,
			separatorBefore: items.length > 0 && !options.onEdit
		});
	}
	if (options.onDownloadContract) {
		items.push({
			label: options.isDownloadingContract ? 'Generating Contract...' : 'Download Contract',
			onClick: () => {
				if (!options.isDownloadingContract) options.onDownloadContract?.();
			},
			separatorBefore: items.length > 0 && !options.onEdit && !options.onDuplicate,
			disabled: options.isDownloadingContract
		});
	}
	if (options.onDelete) {
		items.push({
			label: 'Delete',
			onClick: options.onDelete,
			destructive: true,
			separatorBefore: items.length > 0
		});
	}

	return items;
}
