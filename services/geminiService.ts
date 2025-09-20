// services/geminiService.ts
// ENV: VITE_GEMINI_API_KEY (kötelező),
//      VITE_GEMINI_MODEL (pl. "gemini-2.5-flash-image"),
//      VITE_ENABLE_GEMINI_IMAGE_OUTPUT = "true" ha image/png kimenetet kérünk.

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
} from "@google/generative-ai";

/* ========= Beállítások / ENV ========= */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL_ID =
  (import.meta.env.VITE_GEMINI_MODEL as string) ?? "gemini-2.0-flash-exp";

const IMAGE_OUTPUT_ENABLED =
  String(import.meta.env.VITE_ENABLE_GEMINI_IMAGE_OUTPUT).toLowerCase() === "true";

const safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/* ========= Segédek ========= */

// File/Blob -> data URL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("FileReader error"));
    r.readAsDataURL(blob);
  });
}

// Bármit kaptunk (string | Blob | File) → data URL string
async function ensureDataUrl(input: unknown, ctx: string): Promise<string> {
  if (typeof input === "string") {
    if (!input.startsWith("data:")) {
      throw new Error(`${ctx}: data URL stringet várok (data:... formátum).`);
    }
    return input;
  }
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return await blobToDataURL(input);
  }
  throw new Error(`${ctx}: ismeretlen bemenet (nem string és nem File/Blob).`);
}

function getGenAI(): GoogleGenerativeAI | null {
  try {
    if (!API_KEY) return null;
    return new GoogleGenerativeAI(API_KEY);
  } catch {
    return null;
  }
}

function requireGenAI(context: string): GoogleGenerativeAI {
  const client = getGenAI();
  if (!client) {
    throw new Error(`${context} nem futtatható: hiányzik a VITE_GEMINI_API_KEY.`);
  }
  return client;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("Érvénytelen data URL.");
  return { mimeType: m[1], base64: m[2] };
}

function formatGeminiError(e: unknown, context: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/allowed mimetypes/i.test(msg)) {
    return new Error(
      `${context}: a jelenlegi modell/projekt ezen az endpointon nem adhat képkimenetet. ` +
      `Kapcsold be: VITE_ENABLE_GEMINI_IMAGE_OUTPUT=true és állíts be image-kimenetes modellt ` +
      `(pl. VITE_GEMINI_MODEL=gemini-2.5-flash-image).`
    );
  }
  if (/SAFETY|HARM|BLOCK|PROHIBITED|POLICY|PERMISSION/i.test(msg)) {
    return new Error(`A kérés biztonsági okból blokkolva lett (${context}).`);
  }
  return new Error(`${context} nem sikerült. Részletek: ${msg}`);
}

async function generateImageFromParts(parts: Content["parts"], outMime: string) {
  if (!IMAGE_OUTPUT_ENABLED) {
    throw new Error(
      "Képkimenet nincs engedélyezve. Állítsd be: VITE_ENABLE_GEMINI_IMAGE_OUTPUT=true " +
      "és használj képkimenetet támogató modellt (pl. gemini-2.5-flash-image)."
    );
  }

  const model = requireGenAI("Kép generálás").getGenerativeModel({
    model: MODEL_ID,
    safetySettings,
    generationConfig: { responseMimeType: outMime },
  });

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });

  const candidate = result.response?.candidates?.[0];
  const inlinePart = candidate?.content?.parts?.find(
    (p: any) => p?.inlineData?.data
  ) as any;

  if (inlinePart?.inlineData?.data) {
    return `data:${outMime};base64,${inlinePart.inlineData.data}`;
  }

  const txt = (result.response as any)?.text?.();
  if (txt) {
    throw new Error("A modell szöveget adott vissza a kép helyett. Valószínűleg nincs engedélyezve a képkimenet.");
  }

  throw new Error("Nem érkezett kép a modeltől.");
}

/* ========= Publikus API ========= */

/** StartScreen – átengedi, de fogad stringet és File/Blob-ot is. */
export async function generateModelImage(baseImage: unknown): Promise<string> {
  const dataUrl = await ensureDataUrl(baseImage, "generateModelImage");
  return dataUrl;
}

export default generateModelImage;

/** Ruhadarab „felpróbálása” – képkimenet kell hozzá */
export async function generateVirtualTryOnImage(
  baseImage: unknown,
  garmentImage: unknown
): Promise<string> {
  try {
    const baseUrl = await ensureDataUrl(baseImage, "Ruhadarab felpróbálása (modell)");
    const garmentUrl = await ensureDataUrl(garmentImage, "Ruhadarab felpróbálása (ruhadarab)");

    const base = parseDataUrl(baseUrl);
    const garment = parseDataUrl(garmentUrl);

    const prompt =
      "You are a virtual try-on engine. Overlay and naturally fit the garment onto the person: " +
      "preserve body pose and proportions, align perspective, keep shadows/lighting coherent. " +
      "Avoid warping the face/hair. Return the final composite as an image.";

    const parts: Content["parts"] = [
      { text: prompt },
      { inlineData: { mimeType: base.mimeType, data: base.base64 } },
      { inlineData: { mimeType: garment.mimeType, data: garment.base64 } },
    ];

    return await generateImageFromParts(parts, "image/png");
  } catch (e) {
    throw formatGeminiError(e, "Ruhadarab felpróbálása");
  }
}

/** Póz variáció – képkimenet kell hozzá */
export async function generatePoseVariation(
  baseImage: unknown,
  instruction: string
): Promise<string> {
  try {
    const baseUrl = await ensureDataUrl(baseImage, "Póz generálása (alapkép)");
    const base = parseDataUrl(baseUrl);

    const prompt =
      "Create a pose variation of the same person and outfit. Keep identity and outfit details. " +
      `Apply this pose instruction: "${instruction}". Return an image.`;

    const parts: Content["parts"] = [
      { text: prompt },
      { inlineData: { mimeType: base.mimeType, data: base.base64 } },
    ];

    return await generateImageFromParts(parts, "image/png");
  } catch (e) {
    throw formatGeminiError(e, "Póz generálása");
  }
}
