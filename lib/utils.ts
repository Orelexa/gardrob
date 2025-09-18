/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getFriendlyErrorMessage = (error: unknown, defaultMessage: string = 'An unexpected error occurred.'): string => {
    if (error instanceof Error) {
        if (error.message.includes('blocked')) {
            return 'The request was blocked for safety reasons. Please try a different image or prompt.';
        }
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return defaultMessage;
};

/**
 * Fetches an image from a URL and converts it to a base64 Data URL.
 * This is necessary because the Gemini API requires image data to be sent directly,
 * and fetching from a URL on the client-side would be blocked by CORS policy.
 * @param url The URL of the image to convert.
 * @returns A promise that resolves with the Data URL string.
 */
export const imageUrlToDataUrl = async (url: string): Promise<string> => {
    try {
        // Use a CORS proxy if running on localhost to avoid CORS issues,
        // though the gsutil cors configuration should make this unnecessary.
        // const proxyUrl = window.location.hostname === 'localhost' ? 'https://cors-anywhere.herokuapp.com/' : '';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (reader.result) {
                    resolve(reader.result as string);
                } else {
                    reject(new Error('Failed to read blob as Data URL.'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error converting image URL to Data URL:', error);
        // Provide a more specific error message for the user.
        throw new Error('A kép erőforrásának feldolgozása nem sikerült. Ellenőrizd a hálózati kapcsolatot.');
    }
};