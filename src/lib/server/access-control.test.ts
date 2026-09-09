import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
	const mockLimit = vi.fn();
	const mockWhere = vi.fn();
	const mockLeftJoin = vi.fn();
	const mockInnerJoin = vi.fn();
	const mockFrom = vi.fn();
	const mockSelect = vi.fn();

	mockLimit.mockReturnValue([]);
	mockWhere.mockReturnValue({ limit: mockLimit });
	const joinTarget = {
		leftJoin: mockLeftJoin,
		innerJoin: mockInnerJoin,
		where: mockWhere
	};
	mockLeftJoin.mockReturnValue(joinTarget);
	mockInnerJoin.mockReturnValue(joinTarget);
	mockFrom.mockReturnValue(joinTarget);
	mockSelect.mockReturnValue({ from: mockFrom });

	return { mockLimit, mockWhere, mockLeftJoin, mockInnerJoin, mockFrom, mockSelect };
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: mocks.mockSelect
	}
}));

import { hasDebtAccess, hasLoanAccess, hasTransactionAccess } from '$lib/server/access-control';

function mockQueryChain(result: unknown[]) {
	mocks.mockLimit.mockReturnValue(result);
}

describe('access-control', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockLimit.mockReturnValue([]);
		mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
		const joinTarget = {
			leftJoin: mocks.mockLeftJoin,
			innerJoin: mocks.mockInnerJoin,
			where: mocks.mockWhere
		};
		mocks.mockLeftJoin.mockReturnValue(joinTarget);
		mocks.mockInnerJoin.mockReturnValue(joinTarget);
		mocks.mockFrom.mockReturnValue(joinTarget);
		mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
	});

	it('grants loan access when a matching row exists', async () => {
		mockQueryChain([{ id: 1 }]);
		await expect(hasLoanAccess(10, 'user-1')).resolves.toBe(true);
		expect(mocks.mockSelect).toHaveBeenCalled();
	});

	it('denies loan access when no row matches', async () => {
		mockQueryChain([]);
		await expect(hasLoanAccess(10, 'user-1')).resolves.toBe(false);
	});

	it('grants transaction access when a matching row exists', async () => {
		mockQueryChain([{ id: 2 }]);
		await expect(hasTransactionAccess(5, 'user-1')).resolves.toBe(true);
	});

	it('grants debt access when a matching row exists', async () => {
		mockQueryChain([{ id: 3 }]);
		await expect(hasDebtAccess(7, 'user-1')).resolves.toBe(true);
	});
});
