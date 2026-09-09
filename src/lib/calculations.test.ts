import { describe, expect, it } from 'vitest';
import { calculateTotalPrincipal, calculateInterest } from '$lib/calculations';

describe('calculations', () => {
	it('calculates simple interest', () => {
		const interest = calculateInterest(10000, 5, 'rate');
		expect(interest).toBe(500);
	});

	it('sums loan principal from investors', () => {
		const total = calculateTotalPrincipal([{ amount: '10000' }, { amount: '5000' }]);
		expect(total).toBe(15000);
	});
});
