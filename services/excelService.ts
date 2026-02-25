import { InvoiceData, EXPECTED_HEADERS, HeaderMap } from '../types';

declare var XLSX: any; // Using XLSX from CDN

const normalizeHeaders = (headers: string[]): string[] => {
    return headers.map(h => h.toString().trim().toLowerCase());
};

const findHeaderIndex = (normalizedHeaders: string[], targetHeader: string): number => {
    const simplify = (s: string): string => {
        if (typeof s !== 'string') return '';
        return s.toLowerCase().replace(/[^a-z0-9]/gi, '');
    };

    const simplifiedTarget = simplify(targetHeader);
    if (!simplifiedTarget) return -1;

    return normalizedHeaders.findIndex(h => {
        const simplifiedHeader = simplify(h);
        return simplifiedHeader && simplifiedHeader === simplifiedTarget;
    });
}

// Aggregates invoice data by grouping rows with the same GSTIN and Invoice No.,
// and summing their 'taxable value'.
const aggregateInvoiceData = (data: InvoiceData[]): InvoiceData[] => {
    if (!data || data.length === 0) {
        return [];
    }
    
    const aggregationMap = new Map<string, InvoiceData>();

    data.forEach(item => {
        const gstin = item.GSTIN?.trim().toUpperCase() || '';
        const invoiceNo = item['Invoice no.']?.trim().toUpperCase() || '';
        
        if (!gstin || !invoiceNo) {
            return;
        }
        
        const key = `${gstin}-${invoiceNo}`;

        const existingEntry = aggregationMap.get(key);

        if (existingEntry) {
            existingEntry['taxable value'] += item['taxable value'];
        } else {
            // Take a copy to avoid mutating the original array objects
            aggregationMap.set(key, { ...item });
        }
    });

    return Array.from(aggregationMap.values());
};

export const readExcelHeaders = (file: File): Promise<{ headers: string[], headerRowIndex: number }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            if (!e.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (json.length === 0) {
                    return reject(new Error("File is empty or contains no data."));
                }
                
                let headerRowIndex = -1;
                let headerRow: any[] | null = null;
                
                const MAX_HEADER_SEARCH_ROWS = 10;
                for (let i = 0; i < Math.min(json.length, MAX_HEADER_SEARCH_ROWS); i++) {
                    const potentialHeaderRow = json[i];
                    if (!potentialHeaderRow || !Array.isArray(potentialHeaderRow) || potentialHeaderRow.every(cell => String(cell).trim() === '')) {
                        continue;
                    }

                    const potentialNormalizedHeaders = normalizeHeaders(potentialHeaderRow);
                    const foundHeaders = EXPECTED_HEADERS.filter(expected => findHeaderIndex(potentialNormalizedHeaders, expected) !== -1);
                    
                    if (foundHeaders.length >= 3) { 
                        headerRowIndex = i;
                        headerRow = potentialHeaderRow;
                        break;
                    }
                }

                if (headerRowIndex === -1 || !headerRow) {
                    // Fallback to first non-empty row if intelligent search fails
                    for (let i = 0; i < Math.min(json.length, MAX_HEADER_SEARCH_ROWS); i++) {
                        if (json[i] && Array.isArray(json[i]) && json[i].some(cell => String(cell).trim() !== '')) {
                            headerRowIndex = i;
                            headerRow = json[i];
                            break;
                        }
                    }
                }
                
                if (headerRowIndex === -1 || !headerRow) {
                     return reject(new Error(`Could not find any valid header row within the first ${MAX_HEADER_SEARCH_ROWS} rows.`));
                }

                resolve({ headers: headerRow.map(h => String(h)), headerRowIndex });

            } catch (error: any) {
                reject(new Error(`Error processing Excel file: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error("Error reading file."));
        reader.readAsBinaryString(file);
    });
};

export const readExcelFile = (file: File, headerMap: HeaderMap, headerRowIndex: number): Promise<InvoiceData[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            if (!e.target?.result) {
                return reject(new Error("Failed to read file."));
            }
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                const fileHeaders: string[] = json[headerRowIndex].map(h => String(h));
                
                const columnIndexMap = {
                    gstin: fileHeaders.indexOf(headerMap['gstin of supplier']),
                    name: fileHeaders.indexOf(headerMap['trade/legal name']),
                    invoiceNo: fileHeaders.indexOf(headerMap['invoice number']),
                    invoiceDate: fileHeaders.indexOf(headerMap['invoice date']),
                    taxableValue: fileHeaders.indexOf(headerMap['taxable value (₹)']),
                };

                if (Object.values(columnIndexMap).some(index => index === -1)) {
                    return reject(new Error("Column mapping is invalid. One or more columns were not found in the file."));
                }
                
                const dataRows = json.slice(headerRowIndex + 1);
                
                const rawData: InvoiceData[] = dataRows.map((row: any[]) => {
                    if (!Array.isArray(row) || row.every(cell => cell === '')) return null;
                    
                    const originalRow: any = {};
                    fileHeaders.forEach((header: string, i: number) => {
                        originalRow[header] = row[i];
                    });
                    
                    const rawTaxableValue = row[columnIndexMap.taxableValue];
                    const taxableValueStr = String(rawTaxableValue ?? '').replace(/[₹$,]/g, '').trim();
                    const parsedTaxableValue = parseFloat(taxableValueStr);

                    return {
                        _originalRow: originalRow,
                        _normalizedHeaders: fileHeaders,
                        GSTIN: String(row[columnIndexMap.gstin] ?? ''),
                        Name: String(row[columnIndexMap.name] ?? ''),
                        'Invoice no.': String(row[columnIndexMap.invoiceNo] ?? ''),
                        'Invoice date': row[columnIndexMap.invoiceDate] ?? '',
                        'taxable value': isNaN(parsedTaxableValue) ? 0 : parsedTaxableValue,
                    };
                }).filter((row): row is InvoiceData => row !== null);
                
                // Aggregate the data before returning it
                const aggregatedData = aggregateInvoiceData(rawData);
                resolve(aggregatedData);

            } catch (error: any) {
                reject(new Error(`Error processing Excel file: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error("Error reading file."));
        reader.readAsBinaryString(file);
    });
};

export const exportToExcel = (data: any[], fileName: string, sheetName: string): void => {
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName);
    } catch (error) {
        console.error("Failed to export to Excel:", error);
        alert("An error occurred while creating the Excel file.");
    }
};