import { InvoiceData, ReconciliationResult, Remark } from '../types';

const createKey = (item: InvoiceData): string => {
    const gstin = item.GSTIN?.trim().toUpperCase() || '';
    const invoiceNo = item['Invoice no.']?.trim().toUpperCase() || '';
    return `${gstin}-${invoiceNo}`;
};

const areDatesClose = (dateA: any, dateB: any, daysTolerance: number = 7): boolean => {
    if (dateA === null || dateA === undefined || dateB === null || dateB === undefined) {
        return false;
    }
    const d1 = new Date(dateA);
    const d2 = new Date(dateB);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        return false;
    }
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= daysTolerance;
};

const areValuesClose = (valA: number, valB: number, tolerance: number = 1.0): boolean => {
    return Math.abs(valA - valB) <= tolerance;
};

const areValuesEqual = (valA: number, valB: number): boolean => {
    return Math.abs(valA - valB) < 0.001;
};

const areNamesSimilar = (nameA: string, nameB: string): boolean => {
    if (!nameA || !nameB) return false;
    const simplify = (s: string) => s.toLowerCase().replace(/[\s.,-]/g, ''); // remove spaces and common punctuation
    const simpleA = simplify(nameA);
    const simpleB = simplify(nameB);
    if (!simpleA || !simpleB) return false;
    // Check if one name is a substring of the other, which handles cases like 'Co' vs 'Company'
    return simpleA.includes(simpleB) || simpleB.includes(simpleA);
};

const getDiffs = (itemA: InvoiceData, itemB: InvoiceData): string[] => {
    const diffs: string[] = [];
    if (itemA.GSTIN?.trim().toUpperCase() !== itemB.GSTIN?.trim().toUpperCase()) {
      diffs.push('GSTIN');
    }
    if (itemA['Invoice no.']?.trim().toUpperCase() !== itemB['Invoice no.']?.trim().toUpperCase()) {
      diffs.push('Invoice no.');
    }
    if (!areNamesSimilar(itemA.Name, itemB.Name)) {
        diffs.push('Name');
    }
    const d1 = new Date(itemA['Invoice date']);
    const d2 = new Date(itemB['Invoice date']);
    if (!d1 || !d2 || d1.toDateString() !== d2.toDateString()) {
        diffs.push('Invoice date');
    }
    if (!areValuesEqual(itemA['taxable value'], itemB['taxable value'])) {
        diffs.push('taxable value');
    }
    return diffs;
};


export const reconcileFiles = (dataA: InvoiceData[], dataB: InvoiceData[]): ReconciliationResult[] => {
    const results: ReconciliationResult[] = [];
    const mapB = new Map<string, InvoiceData>();
    
    dataB.forEach(item => {
        const key = createKey(item);
        if (key && key !== '-') {
            mapB.set(key, item);
        }
    });

    // Step 1: High-Confidence matching (VLOOKUP on GSTIN + Invoice No.)
    const unmatchedA: InvoiceData[] = [];
    dataA.forEach(itemA => {
        const key = createKey(itemA);
        if (!key || key === '-') return;

        const itemB = mapB.get(key);

        if (itemB) {
            const valuesMatch = areValuesEqual(itemA['taxable value'], itemB['taxable value']);
            const allDiffs = getDiffs(itemA, itemB);

            results.push({
                key,
                dataA: itemA,
                dataB: itemB,
                remark: valuesMatch ? Remark.MATCH : Remark.PARTIALLY_MATCHED,
                matchConfidence: 'High',
                diffs: allDiffs.length > 0 ? allDiffs : undefined
            });

            mapB.delete(key);
        } else {
            unmatchedA.push(itemA);
        }
    });
    
    let unmatchedB = Array.from(mapB.values());

    // Step 2: Intelligent fuzzy matching using a scoring system for remaining items.
    const finalUnmatchedA: InvoiceData[] = [];
    const unmatchedBIndexes = new Set(unmatchedB.map((_, i) => i));

    unmatchedA.forEach(itemA => {
        let bestMatch: { item: InvoiceData, index: number, score: number } | null = null;

        for (const i of unmatchedBIndexes) {
            const itemB = unmatchedB[i];
            
            // Prerequisite: GSTIN must match.
            if (itemA.GSTIN?.trim().toUpperCase() !== itemB.GSTIN?.trim().toUpperCase()) {
                continue;
            }

            // Calculate a similarity score based on other fields.
            const namesSimilar = areNamesSimilar(itemA.Name, itemB.Name);
            const valuesClose = areValuesClose(itemA['taxable value'], itemB['taxable value']);
            const datesClose = areDatesClose(itemA['Invoice date'], itemB['Invoice date']);
            
            let currentScore = 0;
            if (namesSimilar) currentScore += 2; // Matching name is a strong indicator.
            if (valuesClose) currentScore += 1;
            if (datesClose) currentScore += 1;
            
            // A score of 2 or more indicates a likely partial match.
            // This means (Name is similar) OR (Value and Date are both close).
            if (currentScore >= 2) {
                if (!bestMatch || currentScore > bestMatch.score) {
                    bestMatch = { item: itemB, index: i, score: currentScore };
                }
            }
        }

        if (bestMatch) {
            const key = `fuzzy-${createKey(itemA)}-${createKey(bestMatch.item)}`;
            results.push({
                key,
                dataA: itemA,
                dataB: bestMatch.item,
                remark: Remark.PARTIALLY_MATCHED,
                matchConfidence: 'Low',
                diffs: getDiffs(itemA, bestMatch.item)
            });
            // Remove the matched item from the pool of unmatched B items
            unmatchedBIndexes.delete(bestMatch.index); 
        } else {
            finalUnmatchedA.push(itemA);
        }
    });
    
    const finalUnmatchedB = Array.from(unmatchedBIndexes).map(i => unmatchedB[i]);

    // Step 3: Add remaining unmatched items
    finalUnmatchedA.forEach(itemA => {
        results.push({ key: createKey(itemA), dataA: itemA, remark: Remark.NOT_IN_B });
    });

    finalUnmatchedB.forEach(itemB => {
        results.push({ key: createKey(itemB), dataB: itemB, remark: Remark.NOT_IN_A });
    });

    return results;
};