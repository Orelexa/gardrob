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
        // Workaround for CORS issue: Use a proxy to fetch images from Firebase Storage.
        // The root cause is that the storage bucket's CORS policy is not configured
        // to allow requests from this web application's origin. This is a common solution for client-side only fixes.
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Network response was not ok via proxy: ${response.statusText}`);
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
        console.error('Error converting image URL to Data URL via proxy:', error);
        // Provide a more specific error message for the user.
        throw new Error('A kép erőforrásának feldolgozása nem sikerült. Ellenőrizd a hálózati kapcsolatot.');
    }
};


/**
 * Resizes an image file to a maximum dimension while maintaining aspect ratio.
 * @param file The image file to resize.
 * @param maxSize The maximum width or height.
 * @returns A promise that resolves with the resized image as a File object.
 */
export const resizeImage = (file: File, maxSize: number): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (!event.target?.result) {
                return reject(new Error('FileReader failed to load file.'));
            }
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        return reject(new Error('Canvas toBlob failed'));
                    }
                    // Preserve original file name, but use jpeg for compression.
                    const newFileName = file.name.replace(/\.[^/.]+$/, ".jpg");
                    const newFile = new File([blob], newFileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                }, 'image/jpeg', 0.9); // 90% quality JPEG
            };
            img.onerror = (err) => reject(new Error(`Image failed to load: ${err}`));
        };
        reader.onerror = (err) => reject(new Error(`FileReader error: ${err}`));
    });
};