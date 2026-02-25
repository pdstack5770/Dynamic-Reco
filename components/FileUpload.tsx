import React, { useCallback, useState } from 'react';
import { UploadCloudIcon, FileIcon, XIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { FileProcessStatus } from '../types';

interface FileUploadProps {
  title: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  status: FileProcessStatus;
  recordCount?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ title, file, onFileSelect, status, recordCount }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || droppedFile.type === 'application/vnd.ms-excel') {
        onFileSelect(droppedFile);
      } else {
        alert("Please upload a valid Excel file (.xlsx or .xls)");
      }
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onFileSelect(null);
  };
  
  const baseClasses = "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg transition-colors duration-300";
  const idleClasses = "bg-slate-50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700";
  const dragClasses = "bg-blue-50 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500";
  
  const statusConfig = {
    idle: { bg: idleClasses, icon: <UploadCloudIcon />, text: 'Click to upload', subtext: 'XLSX or XLS files' },
    loading: { bg: 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-400 dark:border-yellow-500', icon: <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-600"></div>, text: 'Processing file...', subtext: 'Analyzing columns with AI' },
    processed: { bg: 'bg-green-50 dark:bg-green-900/50 border-green-400 dark:border-green-500', icon: <CheckCircleIcon customClasses="w-12 h-12 text-green-500" />, text: 'File ready!', subtext: `${recordCount || 0} records loaded` },
    error: { bg: 'bg-red-50 dark:bg-red-900/50 border-red-400 dark:border-red-500', icon: <XCircleIcon />, text: 'Upload failed', subtext: 'Please try a different file' }
  };

  const currentStatus = statusConfig[status];

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <h3 className="text-xl font-semibold mb-3 text-slate-700 dark:text-slate-300">{title}</h3>
      {file && status !== 'idle' ? (
         <div className={`${baseClasses} ${currentStatus.bg} p-4`}>
            <div className="text-center">
                {currentStatus.icon}
                <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100 break-all">{file.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
                {status === 'processed' && <p className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">{currentStatus.subtext}</p>}
                <button onClick={handleRemoveFile} className="mt-4 inline-flex items-center px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm font-semibold">
                    <XIcon />
                    Remove
                </button>
            </div>
        </div>
      ) : (
        <label htmlFor={`dropzone-file-${title.replace(/\s+/g, '-')}`} className="w-full">
          <div 
            onDragEnter={handleDragEnter} 
            onDragLeave={handleDragLeave} 
            onDragOver={handleDragOver} 
            onDrop={handleDrop}
            className={`${baseClasses} ${isDragging ? dragClasses : currentStatus.bg}`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              {currentStatus.icon}
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-semibold">{currentStatus.text}</span>
                {status === 'idle' && ' or drag and drop'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentStatus.subtext}</p>
            </div>
            <input id={`dropzone-file-${title.replace(/\s+/g, '-')}`} type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls" disabled={status === 'loading'} />
          </div>
        </label>
      )}
    </div>
  );
};

export default FileUpload;