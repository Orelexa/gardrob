/**
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

// FIX: The `safetySettings` property must be a top-level property in the `generateContent` call, not nested within the `config` object.
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

    // FIX: Moved `safetySettings` to be a top-level property, outside of `config`.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [userImagePart, textPart] },
        safetySettings,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
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
    
    // FIX: Moved `safetySettings` to be a top-level property, outside of `config`.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [modelImagePart, garmentImagePart, textPart] },
        safetySettings,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
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

    // FIX: Moved `safetySettings` to be a top-level property, outside of `config`.
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [baseModelPart, garmentPart, textPart] },
        safetySettings,
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
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
