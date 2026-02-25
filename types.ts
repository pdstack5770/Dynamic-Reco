export interface InvoiceData {
  _originalRow: any;
  _normalizedHeaders: any;
  GSTIN: string;
  Name: string;
  'Invoice no.': string;
  'Invoice date': any; // Can be string, number, or Date from xlsx
  'taxable value': number;
}

export enum Remark {
  MATCH = 'Match',
  PARTIALLY_MATCHED = 'Partially Matched',
  NOT_IN_B = 'In File A only',
  NOT_IN_A = 'In File B only',
}

export interface ReconciliationResult {
  key: string;
  dataA?: InvoiceData;
  dataB?: InvoiceData;
  remark: Remark;
  matchConfidence?: 'High' | 'Low';
  diffs?: string[];
}

export const EXPECTED_HEADERS = [
  'gstin of supplier',
  'trade/legal name',
  'invoice number',
  'invoice date',
  'taxable value (₹)'
];

// Map from the standard required header to the actual header in the user's file.
// e.g., { 'gstin of supplier': 'GST No.', 'invoice number': 'Bill No' }
export type HeaderMap = Record<string, string>;

export type FileProcessStatus = 'idle' | 'loading' | 'processed' | 'error';