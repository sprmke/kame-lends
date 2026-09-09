import type { Snippet } from 'svelte';

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<TData> {
	id: string;
	header: string;
	accessorKey?: keyof TData;
	accessorFn?: (row: TData) => unknown;
	cell?: Snippet<[TData]>;
	sortable?: boolean;
	sortFn?: (a: TData, b: TData, direction: SortDirection) => number;
	className?: string;
	headerClassName?: string;
	hidden?: boolean;
}
