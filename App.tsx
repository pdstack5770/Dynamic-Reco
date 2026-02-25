import React, { useState, useCallback } from 'react';
import { InvoiceData, ReconciliationResult, Remark, HeaderMap, FileProcessStatus } from './types';
import { readExcelHeaders, readExcelFile } from './services/excelService';
import { reconcileFiles } from './services/reconciliationService';
import { getColumnMapping } from './services/aiService';
import FileUpload from './components/FileUpload';
import ResultsDisplay from './components/ResultsDisplay';
import ColumnMappingModal from './components/ColumnMappingModal';
import { AppIcon } from './components/Icons';

function App() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [fileAStatus, setFileAStatus] = useState<FileProcessStatus>('idle');
  const [fileBStatus, setFileBStatus] = useState<FileProcessStatus>('idle');
  const [fileAData, setFileAData] = useState<InvoiceData[] | null>(null);
  const [fileBData, setFileBData] = useState<InvoiceData[] | null>(null);
  
  const [results, setResults] = useState<ReconciliationResult[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [mappingState, setMappingState] = useState<{
    isOpen: boolean;
    fileKey: 'A' | 'B' | null;
    file: File | null;
    headers: string[];
    aiSuggestion: HeaderMap | null;
    headerRowIndex: number;
  }>({ isOpen: false, fileKey: null, file: null, headers: [], aiSuggestion: null, headerRowIndex: -1 });

  const handleFileSelect = async (file: File | null, fileKey: 'A' | 'B') => {
    setError(null);
    if (!file) {
      if (fileKey === 'A') {
        setFileA(null);
        setFileAStatus('idle');
        setFileAData(null);
      } else {
        setFileB(null);
        setFileBStatus('idle');
        setFileBData(null);
      }
      return;
    }
    
    const setStatus = fileKey === 'A' ? setFileAStatus : setFileBStatus;
    const setFile = fileKey === 'A' ? setFileA : setFileB;

    setFile(file);
    setStatus('loading');

    try {
      const { headers, headerRowIndex } = await readExcelHeaders(file);
      const aiSuggestion = await getColumnMapping(headers);
      setMappingState({
        isOpen: true,
        fileKey,
        file,
        headers,
        aiSuggestion,
        headerRowIndex
      });
    } catch (err: any) {
      setError(`Error processing ${file.name}: ${err.message}`);
      setStatus('error');
    }
  };

  const handleMappingConfirm = async (confirmedMap: HeaderMap) => {
    if (!mappingState.fileKey || !mappingState.file) return;

    const { fileKey, file, headerRowIndex } = mappingState;
    const setData = fileKey === 'A' ? setFileAData : setFileBData;
    const setStatus = fileKey === 'A' ? setFileAStatus : setFileBStatus;

    try {
      const data = await readExcelFile(file, confirmedMap, headerRowIndex);
      if (data.length === 0) {
        throw new Error("No data could be extracted from the file after mapping.");
      }
      setData(data);
      setStatus('processed');
    } catch (err: any) {
      setError(`Error reading file data from ${file.name}: ${err.message}`);
      setStatus('error');
    } finally {
      setMappingState({ isOpen: false, fileKey: null, file: null, headers: [], aiSuggestion: null, headerRowIndex: -1 });
    }
  };

  const handleMappingCancel = () => {
    const { fileKey } = mappingState;
    if (fileKey === 'A') {
      setFileA(null);
      setFileAStatus('idle');
    } else if (fileKey === 'B') {
      setFileB(null);
      setFileBStatus('idle');
    }
    setMappingState({ isOpen: false, fileKey: null, file: null, headers: [], aiSuggestion: null, headerRowIndex: -1 });
  }

  const handleReconcile = useCallback(() => {
    if (!fileAData || !fileBData) {
      setError('Both files must be processed before reconciling.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    // Using setTimeout to allow the UI to update to the loading state before the heavy computation starts
    setTimeout(() => {
        try {
            const reconciliationResults = reconcileFiles(fileAData, fileBData);
            setResults(reconciliationResults);
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred during reconciliation.');
            setResults(null);
        } finally {
            setIsLoading(false);
        }
    }, 50);

  }, [fileAData, fileBData]);
  
  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setFileAData(null);
    setFileBData(null);
    setFileAStatus('idle');
    setFileBStatus('idle');
    setResults(null);
    setError(null);
    setIsLoading(false);
  };


  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-200 bg-slate-100 dark:bg-slate-900 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
            <div className="flex justify-center items-center gap-4 mb-2">
                <AppIcon />
                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
                    AI-Powered Excel Reconciliation
                </h1>
            </div>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Intelligently reconcile two Excel sheets with AI-assisted mapping and analysis.
          </p>
        </header>

        <main className="bg-white dark:bg-slate-800 shadow-2xl rounded-2xl p-6 sm:p-8">
          {!results ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <FileUpload title="Upload Source File A" file={fileA} onFileSelect={(f) => handleFileSelect(f, 'A')} status={fileAStatus} recordCount={fileAData?.length} />
                <FileUpload title="Upload Source File B" file={fileB} onFileSelect={(f) => handleFileSelect(f, 'B')} status={fileBStatus} recordCount={fileBData?.length} />
              </div>

              {error && (
                <div className="text-center bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={handleReconcile}
                  disabled={fileAStatus !== 'processed' || fileBStatus !== 'processed' || isLoading}
                  className="px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:cursor-not-allowed transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
                >
                  {isLoading ? 'Reconciling...' : 'Reconcile Files'}
                </button>
              </div>
            </div>
          ) : (
            <ResultsDisplay results={results} onReset={handleReset} />
          )}
        </main>
        
        {mappingState.isOpen && mappingState.file && (
          <ColumnMappingModal
            isOpen={mappingState.isOpen}
            onClose={handleMappingCancel}
            onConfirm={handleMappingConfirm}
            fileName={mappingState.file.name}
            fileHeaders={mappingState.headers}
            aiSuggestion={mappingState.aiSuggestion}
          />
        )}

        <footer className="text-center mt-8 text-slate-500 dark:text-slate-400 text-sm">
            <p>&copy; {new Date().getFullYear()} AI Reconciliation App. All rights reserved.</p>
            <p className="mt-1 font-medium">Made by Pritesh Dobariya</p>
        </footer>
      </div>
    </div>
  );
}

export default App;