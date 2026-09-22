/**
 * List-export PDF routes (`/api/export/loans|investors|transactions`) accept a
 * client-supplied `data` array rather than re-querying the DB. Cap the row
 * count so a very large filtered view (or a malformed/abusive request) can't
 * exhaust function memory or blow past `maxDuration` while `@react-pdf/renderer`
 * lays out thousands of rows.
 */
export const MAX_PDF_EXPORT_ROWS = 5000;
