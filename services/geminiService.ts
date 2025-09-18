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
};/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { WardrobeItem } from '../types.ts';
import { imageUrlToDataUrl, fileToDataUrl } from '../lib/utils.ts';

// This function is defined within the module scope so it's only created once.
const getClient = (() => {
    let client: GoogleGenAI | null = null;
    return () => {
        if (!client) {
            const apiKey = import.meta.env.VITE_API_KEY;
            if (!apiKey) {
                throw new Error("VITE_API_KEY environment variable not set.");
            }
            client = new GoogleGenAI({ apiKey });
        }
        return client;
    };
})();


// Helper to convert a File object to a GoogleGenerativeAI.Part object
const fileToGenerativePart = async (file: File) => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
};

// FIX: The `safetySettings` property in the `config` object must be an array of `SafetySetting` objects. The previous format was an object, which is not assignable to the expected array type.
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
];


/**
 * Generates a photorealistic model image from a user-uploaded photo.
 */
export const generateModelImage = async (userImageFile: File): Promise<string> => {
    const ai = getClient();
    const userImagePart = await fileToGenerativePart(userImageFile);
    
    const textPart = {
        text: `From the provided image of a person, generate a full-body, photorealistic virtual model. The model should be standing in a standard A-pose against a clean, plain, off-white studio background. They should be wearing neutral, simple, tight-fitting gray clothes (like a tank top and leggings) to clearly show their body shape. Ensure the lighting is even and soft, avoiding harsh shadows. The final image must be high-resolution and suitable for a virtual try-on application. Do not include any text, logos, or watermarks. The output must only be the image.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [userImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            safetySettings,
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }

    const blockReason = response.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY') {
        const reasonDetails = response.candidates?.[0]?.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
        throw new Error(`A kérés biztonsági okokból blokkolva lett. Ok: ${reasonDetails || 'Ismeretlen'}. Kérjük, próbálj meg egy másik képet.`);
    }
    
    throw new Error('No image was generated. The response may have been blocked or the format was unexpected.');
};

/**
 * Applies a garment to a model image (provided as a data URL).
 */
export const generateVirtualTryOnImage = async (modelImageDataUrl: string, garmentItem: WardrobeItem): Promise<string> => {
    const ai = getClient();
    
    const modelImageMimeType = modelImageDataUrl.substring(modelImageDataUrl.indexOf(":") + 1, modelImageDataUrl.indexOf(";"));
    const modelImageDataBase64 = modelImageDataUrl.split(',')[1];

    const modelImagePart = {
        inlineData: { data: modelImageDataBase64, mimeType: modelImageMimeType }
    };

    const garmentDataUrl = await imageUrlToDataUrl(garmentItem.url);
    const garmentMimeType = garmentDataUrl.substring(garmentDataUrl.indexOf(":") + 1, garmentDataUrl.indexOf(";"));
    const garmentDataBase64 = garmentDataUrl.split(',')[1];
    
    const garmentImagePart = {
        inlineData: { data: garmentDataBase64, mimeType: garmentMimeType }
    };
    
    const textPart = {
        text: `Virtually try this garment on the model. Ensure the garment fits realistically, accounting for drape, folds, and lighting. Maintain the model's appearance and the background. The output should only be the image of the model wearing the garment.`
    };
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [modelImagePart, garmentImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            safetySettings,
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    
    const blockReason = response.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY') {
        const reasonDetails = response.candidates?.[0]?.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
        throw new Error(`A kérés biztonsági okokból blokkolva lett. Ok: ${reasonDetails || 'Ismeretlen'}. Kérjük, próbálj meg egy másik képet.`);
    }

    throw new Error('Could not generate the try-on image.');
};

/**
 * Generates a new pose for the model wearing the last applied garment.
 */
export const generatePoseVariation = async (baseModelDataUrl: string, lastGarment: WardrobeItem, poseInstruction: string): Promise<string> => {
    const ai = getClient();
    
    const baseModelMimeType = baseModelDataUrl.substring(baseModelDataUrl.indexOf(":") + 1, baseModelDataUrl.indexOf(";"));
    const baseModelDataBase64 = baseModelDataUrl.split(',')[1];
    const baseModelPart = {
        inlineData: { data: baseModelDataBase64, mimeType: baseModelMimeType }
    };

    const garmentDataUrl = await imageUrlToDataUrl(lastGarment.url);
    const garmentMimeType = garmentDataUrl.substring(garmentDataUrl.indexOf(":") + 1, garmentDataUrl.indexOf(";"));
    const garmentDataBase64 = garmentDataUrl.split(',')[1];
    const garmentPart = {
        inlineData: { data: garmentDataBase64, mimeType: garmentMimeType }
    };

    const textPart = {
        text: `Take the provided base model and the garment, and render the model wearing the garment in the following pose: "${poseInstruction}". Ensure the fit and drape are realistic for the new pose. The background must remain a plain, off-white studio background.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [baseModelPart, garmentPart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            safetySettings,
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    
    const blockReason = response.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY') {
        const reasonDetails = response.candidates?.[0]?.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ');
        throw new Error(`A kérés biztonsági okokból blokkolva lett. Ok: ${reasonDetails || 'Ismeretlen'}. Kérjük, próbálj meg egy másik képet.`);
    }

    throw new Error('Could not generate the new pose.');
};