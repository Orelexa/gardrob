/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Érvénytelen adat URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Nem sikerült a MIME típus kiolvasása az adat URL-ből");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    // Check for a top-level block reason first.
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `A kérés blokkolva lett. Ok: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Ensure there are candidates to process.
    if (!response.candidates || response.candidates.length === 0) {
        const textFeedback = response.text?.trim();
        const errorMessage = `Az MI modell nem adott vissza érvényes választ. ` + (textFeedback ? `A modell szöveggel válaszolt: "${textFeedback}"` : "Ez előfordulhat biztonsági szűrők vagy hálózati problémák miatt.");
        throw new Error(errorMessage);
    }

    // Check the first candidate for a non-stop finish reason.
    const firstCandidate = response.candidates[0];
    if (firstCandidate.finishReason && firstCandidate.finishReason !== 'STOP') {
        const errorMessage = `A képgenerálás váratlanul leállt. Ok: ${firstCandidate.finishReason}. Ez gyakran a biztonsági beállításokkal kapcsolatos.`;
        throw new Error(errorMessage);
    }
    
    // Now, safely look for an image part in the candidates.
    // The candidate content might be missing if the response was blocked.
    const imagePart = firstCandidate.content?.parts?.find(part => part.inlineData);

    if (imagePart?.inlineData) {
        const { mimeType, data } = imagePart.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    // If no image is found after all checks, throw a generic error.
    const textFeedback = response.text?.trim();
    const errorMessage = `Az MI modell nem adott vissza képet. ` + (textFeedback ? `A modell szöveggel válaszolt: "${textFeedback}"` : "Ez előfordulhat biztonsági szűrők miatt, vagy ha a kérés túl összetett. Kérjük, próbálkozz másik képpel.");
    throw new Error(errorMessage);
};

// --- Lazy Initialized AI Instance ---
let aiInstance: GoogleGenAI | null = null;
const model = 'gemini-2.5-flash-image-preview';

/**
 * Lazily initializes and returns the GoogleGenAI instance.
 * This prevents the app from crashing on startup if the API key is not yet available.
 */
const getAiInstance = (): GoogleGenAI => {
    if (!aiInstance) {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            // This error will be thrown at runtime, inside an async function, so it can be caught.
            // The app itself will load properly.
            throw new Error("A Gemini API kulcs (VITE_API_KEY) hiányzik. Ellenőrizd a .env fájlt, és indítsd újra a fejlesztői szervert.");
        }
        aiInstance = new GoogleGenAI({ apiKey });
    }
    return aiInstance;
};


// --- Exported Functions ---

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = "You are an expert fashion photographer AI. Transform the person in this image into a full-body fashion model photo suitable for an e-commerce website. The background must be a clean, neutral studio backdrop (light gray, #f0f0f0). The person should have a neutral, professional model expression. Preserve the person's identity, unique features, and body type, but place them in a standard, relaxed standing model pose. The final image must be photorealistic. Return ONLY the final image.";
    const response = await getAiInstance().models.generateContent({
        model,
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generateVirtualTryOnImage = async (modelImageUrl: string, garmentImage: File): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentImagePart = await fileToPart(garmentImage);
    const prompt = `You are an expert virtual try-on AI. Your ONLY task is to place the clothing from the 'garment image' onto the person in the 'model image'.

**Instructions:**
1.  **IDENTIFY THE GARMENT:** The 'garment image' contains the ONLY piece of clothing you should add.
2.  **IDENTIFY THE PERSON:** The 'model image' contains the person and the scene.
3.  **COMBINE:** Create a new, photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.
4.  **PERFECT FIT:** The garment must be realistically fitted to the person's body and pose, with natural folds, shadows, and lighting. The AI should intelligently layer or replace existing clothing as appropriate (e.g., a jacket goes over a shirt, a new shirt replaces an old one).
5.  **PRESERVE EVERYTHING ELSE:** The person's identity (face, body, hair), their existing clothing (if it doesn't conflict with the new garment), the pose, and the entire background from the 'model image' MUST be preserved exactly.
6.  **OUTPUT:** Return ONLY the final, combined image. Do not add any text or other elements.`;
    const response = await getAiInstance().models.generateContent({
        model,
        contents: { parts: [modelImagePart, garmentImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};

export const generatePoseVariation = async (tryOnImageUrl: string, poseInstruction: string): Promise<string> => {
    const tryOnImagePart = dataUrlToPart(tryOnImageUrl);
    const prompt = `You are an expert fashion photographer AI. Take this image and regenerate it from a different perspective. The person, clothing, and background style must remain identical. The new perspective should be: "${poseInstruction}". Return ONLY the final image.`;
    const response = await getAiInstance().models.generateContent({
        model,
        contents: { parts: [tryOnImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response);
};