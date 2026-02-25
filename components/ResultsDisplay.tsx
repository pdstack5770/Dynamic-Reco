import React, { useMemo, useState } from 'react';
import { ReconciliationResult, Remark, InvoiceData } from '../types';
import { exportToExcel } from '../services/excelService';
import { DownloadIcon, CheckCircleIcon, ExclamationIcon, InfoIcon, ChevronDownIcon } from './Icons';
import AIAnalysis from './AIAnalysis';

interface ResultsDisplayProps {
  results: ReconciliationResult[];
  onReset: () => void;
}

const remarkStyles: Record<Remark, { icon: React.ReactNode; bg: string; text: string; lightBg: string }> = {
    [Remark.MATCH]: { icon: <CheckCircleIcon />, bg: 'bg-green-100 dark:bg-green-800/20', text: 'text-green-800 dark:text-green-300', lightBg: 'bg-green-50 dark:bg-green-900/20' },
    [Remark.PARTIALLY_MATCHED]: { icon: <ExclamationIcon />, bg: 'bg-yellow-100 dark:bg-yellow-800/20', text: 'text-yellow-800 dark:text-yellow-300', lightBg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    [Remark.NOT_IN_A]: { icon: <InfoIcon />, bg: 'bg-blue-100 dark:bg-blue-800/20', text: 'text-blue-800 dark:text-blue-300', lightBg: 'bg-blue-50 dark:bg-blue-900/20' },
    [Remark.NOT_IN_B]: { icon: <InfoIcon />, bg: 'bg-purple-100 dark:bg-purple-800/20', text: 'text-purple-800 dark:text-purple-300', lightBg: 'bg-purple-50 dark:bg-purple-900/20' },
};

const StatCard: React.FC<{ title: string; value: number; color: string }> = ({ title, value, color }) => (
    <div className={`p-4 rounded-lg shadow ${color}`}>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium opacity-90">{title}</p>
    </div>
);

const ResultRow: React.FC<{ result: ReconciliationResult }> = ({ result }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { remark, dataA, dataB, diffs, matchConfidence } = result;
    const styles = remarkStyles[remark];
    const headers: (keyof InvoiceData)[] = ['GSTIN', 'Name', 'Invoice no.', 'Invoice date', 'taxable value'];

    const renderCell = (data?: InvoiceData, key?: keyof InvoiceData) => {
        if (!data || !key) return <span className="text-slate-400">-</span>;
        const val = data[key];
        const isDiff = diffs?.includes(key as string);

        let displayVal: string;
        if (val instanceof Date) {
            displayVal = val.toLocaleDateString();
        } else if (typeof val === 'number') {
            displayVal = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            displayVal = val?.toString() ?? '';
        }

        return <span className={isDiff ? 'font-bold text-red-500 dark:text-red-400' : ''}>{displayVal}</span>;
    };

    return (
        <>
            <tr onClick={() => setIsExpanded(!isExpanded)} className={`cursor-pointer transition-colors ${styles.lightBg} hover:bg-opacity-50 hover:dark:bg-opacity-50`}>
                <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${styles.bg} ${styles.text}`}>
                        <span className="mr-1.5">{styles.icon}</span>
                        {remark}
                        {matchConfidence === 'Low' && <span className="ml-1 opacity-80">(Low Confidence)</span>}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">{dataA?.GSTIN ?? dataB?.GSTIN}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 truncate max-w-xs">{dataA?.Name ?? dataB?.Name}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{dataA?.['Invoice no.'] ?? dataB?.['Invoice no.']}</td>
                <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 font-medium">{renderCell(dataA, 'taxable value')}{remark === Remark.PARTIALLY_MATCHED && dataB ? ' / ' : ''}{remark === Remark.PARTIALLY_MATCHED && dataB ? renderCell(dataB, 'taxable value') : ''}</td>
                <td className="px-4 py-3 text-center">
                    <button className="text-slate-500">
                        <ChevronDownIcon customClasses={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </td>
            </tr>
            {isExpanded && (
                <tr className={`${styles.lightBg}`}>
                    <td colSpan={6} className="p-0">
                        <div className="p-4 bg-white dark:bg-slate-800/50">
                            <h4 className="font-bold mb-2 text-slate-700 dark:text-slate-200">Detailed Comparison</h4>
                             {remark === Remark.PARTIALLY_MATCHED && <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">Differences found in: {diffs?.join(', ')}</p>}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                {headers.map(header => (
                                    <div key={header} className="grid grid-cols-3 gap-2 items-start border-b border-slate-200 dark:border-slate-700 py-2">
                                        <div className="font-semibold text-slate-500 dark:text-slate-400 col-span-1 capitalize">{header.replace(/ \(₹\)/, '').replace(' no.', ' No.')}</div>
                                        <div className="text-slate-700 dark:text-slate-300 col-span-1">{renderCell(dataA, header)}</div>
                                        <div className="text-slate-700 dark:text-slate-300 col-span-1">{renderCell(dataB, header)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, onReset }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  
  const { summary, financialTotals } = useMemo(() => {
    const summaryData = results.reduce((acc, r) => {
        acc[r.remark] = (acc[r.remark] || 0) + 1;
        return acc;
    }, {} as Record<Remark, number>);
    
    const totals = {
        totalA: results.filter(r => r.dataA).length,
        totalB: results.filter(r => r.dataB).length,
        totalValueA: results.reduce((sum, r) => sum + (r.dataA?.['taxable value'] ?? 0), 0),
        totalValueB: results.reduce((sum, r) => sum + (r.dataB?.['taxable value'] ?? 0), 0),
        matchedValue: results.reduce((sum, r) => (r.remark === Remark.MATCH ? (r.dataA?.['taxable value'] ?? 0) : sum), 0),
    };

    return { summary: summaryData, financialTotals: totals };
  }, [results]);

  const totalPages = Math.ceil(results.length / rowsPerPage);
  const paginatedResults = results.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleDownload = (remark: Remark | 'all', fileName: string) => {
    const filteredResults = remark === 'all' 
      ? results 
      : results.filter(r => r.remark === remark);

    const exportData = filteredResults.map(r => {
      const data = {
        'Remark': r.remark,
        'GSTIN': r.dataA?.GSTIN || r.dataB?.GSTIN || '',
        'Name': r.dataA?.Name || r.dataB?.Name || '',
        'Invoice No.': r.dataA?.['Invoice no.'] || r.dataB?.['Invoice no.'] || '',
        'Invoice Date': r.dataA?.['Invoice date'] || r.dataB?.['Invoice date'] || '',
        'Taxable Value (File A)': r.dataA?.['taxable value'] || 0,
        'Taxable Value (File B)': r.dataB?.['taxable value'] || 0,
        'Difference': (r.dataA?.['taxable value'] || 0) - (r.dataB?.['taxable value'] || 0),
        'Diff Columns': r.diffs?.join(', ') || ''
      };
      return data;
    });

    exportToExcel(exportData, fileName, 'Reconciliation Results');
  };

  return (
    <div>
        <AIAnalysis summary={summary} totals={financialTotals} />

        <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Reconciliation Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center text-white">
                <StatCard title="Matched" value={summary[Remark.MATCH] || 0} color="bg-green-500" />
                <StatCard title="Partially Matched" value={summary[Remark.PARTIALLY_MATCHED] || 0} color="bg-yellow-500" />
                <StatCard title="In File A Only" value={summary[Remark.NOT_IN_B] || 0} color="bg-purple-500" />
                <StatCard title="In File B Only" value={summary[Remark.NOT_IN_A] || 0} color="bg-blue-500" />
            </div>
        </div>

        <div className="mb-8">
             <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Download Reports</h3>
             <div className="flex flex-wrap gap-3">
                <button onClick={() => handleDownload('all', 'Full_Reconciliation_Report.xlsx')} className="flex items-center justify-center gap-2 flex-grow bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"><DownloadIcon /> Full Report</button>
                <button onClick={() => handleDownload(Remark.MATCH, 'Matched_Report.xlsx')} className="flex items-center justify-center gap-2 flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"><DownloadIcon /> Matched</button>
                <button onClick={() => handleDownload(Remark.PARTIALLY_MATCHED, 'Partially_Matched_Report.xlsx')} className="flex items-center justify-center gap-2 flex-grow bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"><DownloadIcon /> Partially Matched</button>
                <button onClick={() => handleDownload(Remark.NOT_IN_B, 'In_File_A_Only.xlsx')} className="flex items-center justify-center gap-2 flex-grow bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"><DownloadIcon /> In File A Only</button>
                <button onClick={() => handleDownload(Remark.NOT_IN_A, 'In_File_B_Only.xlsx')} className="flex items-center justify-center gap-2 flex-grow bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"><DownloadIcon /> In File B Only</button>
            </div>
        </div>

        <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Detailed View</h3>
            <div className="shadow-md rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                <table className="min-w-full bg-white dark:bg-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Remark</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">GSTIN</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Name</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Invoice No.</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Value (A / B)</th>
                            <th scope="col" className="px-4 py-3 w-12"><span className="sr-only">Expand</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {paginatedResults.map((r, index) => (
                           <ResultRow key={`${r.key}-${index}`} result={r} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div className="flex items-center justify-between mt-6">
            <button onClick={onReset} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">Start Over</button>
            <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="px-4 py-2 bg-slate-300 dark:bg-slate-600 rounded-md disabled:opacity-50">Prev</button>
                <span className="text-slate-700 dark:text-slate-300">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-slate-300 dark:bg-slate-600 rounded-md disabled:opacity-50">Next</button>
            </div>
        </div>
    </div>
  );
};

export default ResultsDisplay;