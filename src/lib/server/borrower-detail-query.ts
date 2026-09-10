/** Shared Drizzle `with` clause for borrower detail (stats + loan list). */
export const borrowerDetailLoansWith = {
  loans: {
    columns: {
      id: true,
      loanName: true,
      type: true,
      status: true,
      dueDate: true,
      freeLotSqm: true,
      notes: true,
    },
    with: {
      loanInvestors: {
        columns: {
          amount: true,
          interestRate: true,
          interestType: true,
          hasMultipleInterest: true,
          investorId: true,
        },
        with: {
          interestPeriods: {
            columns: {
              interestRate: true,
              interestType: true,
              dueDate: true,
              status: true,
            },
          },
        },
      },
    },
  },
} as const;
