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
        const apiKey = import.meta.env.VITE_API_KEY;
        if (!apiKey) {
            // This error will be thrown at runtime, inside an async function, so it can be caught.
            // The app itself will load properly.
            throw new Error("A Gemini API kulcs (VITE_API_KEY) hiányzik. Hozz létre egy .env.local fájlt, és add hozzá a kulcsot.");
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
    const prompt = `You are an expert virtual try-on AI. Your task is to realistically place a new clothing item onto the person in the base image.

**Context:** You will be given two images.
-   **Image 1 (Base Image):** This image contains the person, their pose, the background, and any clothing they are currently wearing.
-   **Image 2 (Garment Image):** This image contains ONLY the new piece of clothing to be added.

**Your Goal:**
Create a new, photorealistic image that combines the two. The person from the Base Image should now be wearing the clothing from the Garment Image.

**Critical Instructions:**
1.  **Layering is Key:** The new garment must be realistically fitted to the person's body. Intelligently layer it on top of or replace existing clothing as appropriate (e.g., a jacket goes over a shirt; a new t-shirt replaces an old t-shirt).
2.  **Preserve the Original:** You MUST preserve the person's identity (face, features, hair, body type), their pose, and the entire background from the Base Image. Do not change anything except for adding the new garment.
3.  **Output:** Return ONLY the final, combined image. Do not include any text, descriptions, or other content in your response.`;
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
