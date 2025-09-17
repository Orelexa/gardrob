import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { modelImageUrl, garmentImageUrl } = JSON.parse(event.body);

    const API_KEY = process.env.VITE_API_KEY;
    if (!API_KEY) {
      throw new Error("API kulcs nincs beállítva a szerver oldalon.");
    }
    
    const ai = new GoogleGenAI(API_KEY);
    const model = 'gemini-1.5-flash';

    const urlToPart = async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Hiba a kép letöltésekor: ${url}`);
        const buffer = await response.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type');
        return { inlineData: { mimeType, data: base64Data } };
    };

    const modelImagePart = await urlToPart(modelImageUrl);
    const garmentImagePart = await urlToPart(garmentImageUrl);

    const prompt = `You are an expert virtual try-on AI...`; // Ide jöhet a te részletes promptod

    const gen_response = await ai.models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    });

    const result = gen_response.response;
    const imagePart = result.candidates[0].content.parts.find(p => p.inlineData);
    if (!imagePart) throw new Error("A modell nem adott vissza képet.");
    
    const imageBase64 = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    
    return {
      statusCode: 200,
      body: JSON.stringify({ imageUrl: imageBase64 }),
    };

  } catch (error) {
    console.error('Hiba a proxy funkcióban:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
