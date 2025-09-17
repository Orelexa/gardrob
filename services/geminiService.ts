/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, GenerativePart } from "@google/genai";

// Környezeti változók beolvasása
const API_KEY = import.meta.env.VITE_API_KEY!;
const PROXY_URL = import.meta.env.VITE_PROXY_URL; // Opcionális, CORS problémákhoz

// Segédfüggvény: File objektum átalakítása Gemini 'Part'-ra
const fileToPart = async (file: File): Promise<GenerativePart> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

// Segédfüggvény: Data URL feldarabolása mime típusra és base64 adatra
const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Érvénytelen adat URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Nem sikerült a MIME típus kiolvasása az adat URL-ből");
    return { mimeType: mimeMatch[1], data: arr[1] };
};

// --- JAVÍTOTT FÜGGVÉNY ---
// Ez a függvény kezeli a Firebase URL-eket és a Data URL-eket is,
// anélkül, hogy végtelen rekurziót okozna.
const urlToPart = async (
  url: string,
  onProgress?: (fraction: number) => void
): Promise<GenerativePart> => {
  onProgress?.(0);

  // Ha Firebase Storage URL-t kapunk...
  if (url.startsWith('https://firebasestorage.googleapis.com')) {
    console.log('🔥 Firebase URL letöltése és konvertálása...');
    
    // CORS problémák elkerülése érdekében proxyn keresztül is fetchelhetünk
    const fetchUrl = PROXY_URL ? `${PROXY_URL}${encodeURIComponent(url)}` : url;
    const headers = PROXY_URL && API_KEY ? { 'x-api-key': API_KEY } : undefined;
    
    const response = await fetch(fetchUrl, { headers });
    if (!response.ok) {
      throw new Error(`Hiba a kép letöltésekor: ${response.statusText}`);
    }
    const blob = await response.blob();
    onProgress?.(0.5);

    // A letöltött képet (blob) közvetlenül Data URL-lé alakítjuk.
    // Ez a kulcsa a rekurzió elkerülésének.
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    onProgress?.(1);
    
    // A Data URL-t feldolgozzuk és visszaadjuk a Gemini számára.
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
  }

  // Ha már eleve Data URL-t kapunk, csak feldolgozzuk.
  if (url.startsWith('data:')) {
    console.log('📄 Data URL közvetlen feldolgozása...');
    onProgress?.(1);
    const { mimeType, data } = dataUrlToParts(url);
    return { inlineData: { mimeType, data } };
  }
  
  throw new Error('Ismeretlen URL formátum a feldolgozáshoz.');
};

// Segédfüggvény: A Gemini API válaszának egységes kezelése
const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        throw new Error(`A kérés blokkolva. Ok: ${blockReason}. ${blockReasonMessage || ''}`);
    }

    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        throw new Error(`A képgenerálás leállt. Ok: ${finishReason}.`);
    }

    const textFeedback = response.text?.trim();
    throw new Error(`Az MI modell nem adott vissza képet. ${textFeedback ? `Válasz: "${textFeedback}"` : 'Próbálkozz másik képpel.'}`);
};


// Firebase inicializálás
const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-1.5-flash';

// --- EXPORTÁLT FÜGGVÉNYEK ---

export const generateVirtualTryOnImage = async (
  modelImageUrl: string, 
  garmentImage: File,
  onProgress?: (fraction: number) => void
): Promise<string> => {
    console.log('🎨 Virtuális felpróbálás indítása...');
    try {
        const modelImagePart = await urlToPart(modelImageUrl, (p) => onProgress?.(p * 0.4));
        const garmentImagePart = await fileToPart(garmentImage);
        onProgress?.(0.5);

        const prompt = `You are a virtual try-on AI. Create a new photorealistic image where the person from the 'model image' wears the clothing from the 'garment image'.
          1. **Intelligent Placement:** Determine the garment type and place it realistically.
          2. **Layering/Replacement:** Replace existing garments of the same type, add new ones of a different type.
          3. **Preserve Model:** The person's face, hair, body, and pose MUST remain unchanged.
          4. **Preserve Background:** The background MUST be preserved.
          5. **Output:** Return ONLY the final image.`;
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        
        onProgress?.(1);
        console.log('✅ Virtuális felpróbálás sikeres');
        return handleApiResponse(response);

    } catch (error) {
        console.error('❌ Hiba a virtuális felpróbálás során:', error);
        throw error;
    }
};

export const generatePoseVariation = async (
  tryOnImageUrl: string, 
  poseInstruction: string,
  onProgress?: (fraction: number) => void
): Promise<string> => {
    console.log('🤸 Póz variáció generálása...');
    try {
        const tryOnImagePart = await urlToPart(tryOnImageUrl, (p) => onProgress?.(p * 0.5));
        
        const prompt = `You are a fashion photographer AI. Regenerate this image from a new perspective: "${poseInstruction}". The person, clothing, and background must remain identical. Return ONLY the final image.`;
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [tryOnImagePart, { text: prompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        
        onProgress?.(1);
        console.log('✅ Póz variáció sikeres');
        return handleApiResponse(response);

    } catch (error) {
        console.error('❌ Hiba a póz variáció során:', error);
        throw error;
    }
};
