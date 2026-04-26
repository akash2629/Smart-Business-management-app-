import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function translateText(text: string, targetLang: 'en' | 'bn'): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional bilingual translator for Bangla (Bengali) and English.
Task: Translate the following text into ${targetLang === 'bn' ? 'Bangla' : 'English'}.
Context: This is for a business/shop management application.
Rules:
1. Preserve exactly all formatting, HTML tags, and placeholders if present.
2. Maintain a professional yet natural tone.
3. If the input is empty or just whitespace, return it as is.
4. Output ONLY the translated text. Do not provide explanations or meta-commentary.

Text to translate:
"${text}"`,
    });

    return response.text?.trim() || text;
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return text; // Fallback to original text on error
  }
}
