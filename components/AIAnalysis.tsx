import React, { useState, useEffect } from 'react';
import { getReconciliationAnalysis } from '../services/aiService';
import { Remark } from '../types';
import { SparklesIcon } from './Icons';

interface AIAnalysisProps {
  summary: Record<Remark, number>;
  totals: {
    totalA: number,
    totalB: number,
    totalValueA: number,
    totalValueB: number,
    matchedValue: number
  };
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ summary, totals }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const generateAnalysis = async () => {
      setIsLoading(true);
      try {
        const result = await getReconciliationAnalysis(summary, totals);
        setAnalysis(result);
      } catch (error) {
        console.error(error);
        setAnalysis("An error occurred while generating the AI analysis.");
      } finally {
        setIsLoading(false);
      }
    };
    generateAnalysis();
  }, [summary, totals]);

  return (
    <div className="mb-8 p-6 bg-blue-50 dark:bg-slate-800/50 border border-blue-200 dark:border-slate-700 rounded-xl shadow-md">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-3">
        <SparklesIcon />
        AI-Powered Analysis
      </h3>
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-300 dark:bg-slate-600 rounded w-full"></div>
            <div className="h-4 bg-slate-300 dark:bg-slate-600 rounded w-5/6"></div>
        </div>
      ) : (
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          {analysis}
        </p>
      )}
    </div>
  );
};

export default AIAnalysis;