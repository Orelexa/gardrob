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
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `A kérés blokkolva lett. Ok: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `A képgenerálás váratlanul leállt. Ok: ${finishReason}. Ez gyakran a biztonsági beállításokkal kapcsolatos.`;
        throw new Error(errorMessage);
    }
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
    const prompt = `You are an expert virtual try-on AI. You will be given a 'model image' and a 'garment image'. Your task is to create a new photorealistic image where the person from the 'model image' is wearing the clothing from the 'garment image'.

**Crucial Rules:**
1.  **Intelligent Placement:** Analyze the 'garment image' to determine its type (e.g., shirt, pants, jacket, dress). Add it to the person in the 'model image' in a realistic way.
2.  **Layering and Replacement:**
    *   If the new garment is of the same type as one already worn by the model (e.g., adding a new shirt when one is already worn), REPLACE the existing garment.
    *   If the new garment is of a different type (e.g., adding pants when a shirt is worn), ADD the new garment while keeping the existing, non-conflicting clothing.
3.  **Preserve the Model:** The person's face, hair, body shape, and pose from the 'model image' MUST remain unchanged.
4.  **Preserve the Background:** The entire background from the 'model image' MUST be preserved perfectly.
5.  **Apply the Garment:** Realistically fit the new garment onto the person. It should adapt to their pose with natural folds, shadows, and lighting consistent with the original scene.
6.  **Output:** Return ONLY the final, edited image. Do not include any text.`;
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