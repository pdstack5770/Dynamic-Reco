import React, { useState, useEffect } from 'react';
import { EXPECTED_HEADERS, HeaderMap } from '../types';
import { WandIcon } from './Icons';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: HeaderMap) => void;
  fileName: string;
  fileHeaders: string[];
  aiSuggestion: HeaderMap | null;
}

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({ isOpen, onClose, onConfirm, fileName, fileHeaders, aiSuggestion }) => {
  const [mapping, setMapping] = useState<HeaderMap>({});

  useEffect(() => {
    if (aiSuggestion) {
      setMapping(aiSuggestion);
    } else {
      // Initialize with empty strings if no suggestion
      const initialMap = EXPECTED_HEADERS.reduce((acc, h) => {
        acc[h] = '';
        return acc;
      }, {} as HeaderMap);
      setMapping(initialMap);
    }
  }, [aiSuggestion]);

  const handleSelectChange = (requiredHeader: string, event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFileHeader = event.target.value;
    setMapping(prev => ({ ...prev, [requiredHeader]: selectedFileHeader }));
  };
  
  const isMappingComplete = Object.values(mapping).every(v => v && v !== '');
  const hasDuplicates = new Set(Object.values(mapping).filter(v => v)).size !== Object.values(mapping).filter(v => v).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity" aria-modal="true" role="dialog">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] flex flex-col">
        <header className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <WandIcon />
            Confirm Column Mapping
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">AI has suggested a mapping for <span className="font-semibold">{fileName}</span>. Please review and confirm.</p>
        </header>

        <main className="p-6 overflow-y-auto">
          <div className="space-y-4">
            {EXPECTED_HEADERS.map(requiredHeader => (
              <div key={requiredHeader} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label htmlFor={requiredHeader} className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                  {requiredHeader.replace(/ \(₹\)/, '')}
                </label>
                <select
                  id={requiredHeader}
                  value={mapping[requiredHeader] || ''}
                  onChange={(e) => handleSelectChange(requiredHeader, e)}
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select a column...</option>
                  {fileHeaders.map(fileHeader => (
                    <option key={fileHeader} value={fileHeader}>{fileHeader}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {hasDuplicates && (
            <p className="text-red-500 dark:text-red-400 mt-4 text-sm font-semibold">
              Warning: A file column cannot be mapped to more than one required field.
            </p>
          )}
        </main>
        
        <footer className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(mapping)} 
            disabled={!isMappingComplete || hasDuplicates}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:dark:bg-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            Confirm and Process
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ColumnMappingModal;