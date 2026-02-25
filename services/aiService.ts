import { GoogleGenAI, Type } from "@google/genai";
import { EXPECTED_HEADERS, Remark, HeaderMap } from '../types';

let ai: GoogleGenAI | null = null;

function getAI() {
  if (!ai) {
    if (!import.meta.env.VITE_API_KEY) {
      throw new Error("VITE_API_KEY not found in env");
    }
    ai = new GoogleGenerativeAI(import.meta.env.VITE_API_KEY);
  }
  return ai;
}

export async function getColumnMapping(fileHeaders: string[]): Promise<HeaderMap> {
  const model = getAI().models;

  const schema = {
    type: Type.OBJECT,
    properties: EXPECTED_HEADERS.reduce((acc, h) => {
      acc[h] = { type: Type.STRING, description: `The header from the user's file that maps to "${h}". Should be one of [${fileHeaders.map(fh => `"${fh}"`).join(', ')}] or empty string if no match.` };
      return acc;
    }, {} as any),
    required: EXPECTED_HEADERS,
  };

  const prompt = `You are an expert at understanding spreadsheet formats for financial reconciliation.
Analyze the provided list of column headers from an Excel file and map them to the required standard columns.
The required columns are: ${JSON.stringify(EXPECTED_HEADERS)}.

Your response MUST be a valid JSON object matching the provided schema. For each required column, find the best matching header from the user's file. If no suitable match is found, the value should be an empty string.

User's file headers:
${JSON.stringify(fileHeaders)}`;

  try {
    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });
    
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error getting column mapping from AI:", error);
    // Fallback to an empty map in case of API error
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
  const model = getAI().models;

  const prompt = `You are a helpful financial analyst assistant. I have just completed an Excel file reconciliation. Here is a summary of the results:
- Total Records in File A: ${totals.totalA} (Total Value: ₹${totals.totalValueA.toFixed(2)})
- Total Records in File B: ${totals.totalB} (Total Value: ₹${totals.totalValueB.toFixed(2)})
- Matched Records: ${summary[Remark.MATCH] || 0} (Total Value: ₹${totals.matchedValue.toFixed(2)})
- Partially Matched Records: ${summary[Remark.PARTIALLY_MATCHED] || 0}
- Records in File A Only: ${summary[Remark.NOT_IN_B] || 0}
- Records in File B Only: ${summary[Remark.NOT_IN_A] || 0}

Based on this data, provide a brief, insightful summary (2-3 sentences). Focus on the financial impact. Comment on the percentage of value reconciled and the financial significance of any discrepancies. Provide actionable insights in a professional tone. Do not just list the numbers back to me.`;

  try {
    const response = await model.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error getting analysis from AI:", error);
    return "Could not generate AI analysis due to an error.";
  }
}
