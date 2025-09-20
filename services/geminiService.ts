// services/geminiService.ts
// Környezet: VITE_GEMINI_API_KEY (kötelező a híváshoz), VITE_GEMINI_MODEL (opcionális),
//            VITE_ENABLE_GEMINI_IMAGE_OUTPUT = "true" esetén kérünk képkimenetet.

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
} from "@google/generative-ai";

/* ===========================
   Beállítások / ENV
   =========================== */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL_ID =
  (import.meta.env.VITE_GEMINI_MODEL as string) ?? "gemini-2.0-flash-exp";

// Ha NEM true, nem kérünk image/png kimenetet (külön engedélyezd, ha biztosan támogatja a projekted)
const IMAGE_OUTPUT_ENABLED =
  String(import.meta.env.VITE_ENABLE_GEMINI_IMAGE_OUTPUT).toLowerCase() === "true";

// Lazább safety a nem policy-s kategóriákra
const safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
  // Ha a Google „allowed mimetypes” szöveget adja vissza, fordítsuk le emberre:
  if (/allowed mimetypes/i.test(msg)) {
    return new Error(
      `${context}: az aktuális modell/projekt nem enged képkimenetet ezen az endpointon. ` +
      `Kapcsold be a képkimenetet (VITE_ENABLE_GEMINI_IMAGE_OUTPUT=true) és használj ` +
      `olyan modellt, ami ezt tudja (pl. Gemini 2.5 Flash Image).`
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
      "és használj képkimenetet támogató modellt (pl. Gemini 2.5 Flash Image)."
    );
  }

  const model = requireGenAI("Kép generálás").getGenerativeModel({
    model: MODEL_ID,
    safetySettings,
    // A 400-as hiba elkerülésére csak akkor kérünk image/png-t, ha tényleg engedélyezve van
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
    throw new Error("A modell szöveget adott vissza a kép helyett. (Valószínűleg nem engedélyezett a képkimenet.)");
  }

  throw new Error("Nem érkezett kép a modeltől.");
}

/* ===========================
   Publikus API
   =========================== */

/** StartScreen kép-előkészítés — pass-through, hogy kulcs nélkül is betöltsön az app. */
export async function generateModelImage(baseImageDataUrl: string): Promise<string> {
  if (!baseImageDataUrl?.startsWith("data:")) {
    throw new Error("generateModelImage: data URL képet várok.");
  }
  return baseImageDataUrl;
}

// Default export (ha valahol defaultként importálod)
export default generateModelImage;

/** Ruhadarab „felpróbálása” (Gemini kell + képkimenet legyen engedélyezve) */
export async function generateVirtualTryOnImage(
  baseImageDataUrl: string,
  garmentDataUrl: string
): Promise<string> {
  try {
    const base = parseDataUrl(baseImageDataUrl);
    const garment = parseDataUrl(garmentDataUrl);

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

/** Póz variáció (Gemini kell + képkimenet legyen engedélyezve) */
export async function generatePoseVariation(
  baseImageDataUrl: string,
  instruction: string
): Promise<string> {
  try {
    const base = parseDataUrl(baseImageDataUrl);

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
