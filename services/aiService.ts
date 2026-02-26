import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXPECTED_HEADERS, Remark, HeaderMap } from '../types';

let ai: GoogleGenerativeAI | null = null;

function getAI() {
  if (!ai) {
    const key = import.meta.env.VITE_API_KEY;
    if (!key) {
      throw new Error("VITE_API_KEY not found in env");
    }
    ai = new GoogleGenerativeAI(key);
  }
  return ai;
}

export async function getColumnMapping(fileHeaders: string[]): Promise<HeaderMap> {
  const genAI = getAI();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are an expert at understanding spreadsheet formats for financial reconciliation.
Analyze the provided list of column headers from an Excel file and map them to the required standard columns.
The required columns are: ${JSON.stringify(EXPECTED_HEADERS)}.

User's file headers:
${JSON.stringify(fileHeaders)}

Return a JSON object mapping each required column to the best matching header from the user's file.
Format: { "gstin of supplier": "matched_header", "trade/legal name": "matched_header", ... }`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error getting column mapping from AI:", error);
    return EXPECTED_HEADERS.reduce((acc, h) => {
      acc[h] = '';
      return acc;
    }, {} as HeaderMap);
  }
}

export async function getReconciliationAnalysis(
  summary: Record<Remark, number>,
  totals: {
    totalA: number,
    totalB: number,
    totalValueA: number,
    totalValueB: number,
    matchedValue: number
  }
): Promise<string> {
  const genAI = getAI();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a helpful financial analyst assistant. I have just completed an Excel file reconciliation. Here is a summary of the results:
- Total Records in File A: ${totals.totalA} (Total Value: ₹${totals.totalValueA.toFixed(2)})
- Total Records in File B: ${totals.totalB} (Total Value: ₹${totals.totalValueB.toFixed(2)})
- Matched Records: ${summary[Remark.MATCH] || 0} (Total Value: ₹${totals.matchedValue.toFixed(2)})
- Partially Matched Records: ${summary[Remark.PARTIALLY_MATCHED] || 0}
- Records in File A Only: ${summary[Remark.NOT_IN_B] || 0}
- Records in File B Only: ${summary[Remark.NOT_IN_A] || 0}

Based on this data, provide a brief, insightful summary (2-3 sentences). Focus on the financial impact.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error getting analysis from AI:", error);
    return "Could not generate AI analysis due to an error.";
  }
}
   
