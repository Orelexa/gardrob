// services/geminiService.ts
// VITE_GEMINI_API_KEY kötelező. Opcionális: VITE_GEMINI_MODEL.

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
} from "@google/generative-ai";

/* ===========================
   Alapbeállítások
   =========================== */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
if (!API_KEY) {
  throw new Error("Hiányzik a VITE_GEMINI_API_KEY. Add meg az ENV-ben vagy .env fájlban.");
}

const MODEL_ID =
  (import.meta.env.VITE_GEMINI_MODEL as string) ?? "gemini-2.0-flash-exp";

const genAI = new GoogleGenerativeAI(API_KEY);

// Lazább szűrés a NEM policy-s kategóriákban.
// FIGYELEM: a szolgáltató policy-tiltásait ez NEM írja felül.
const safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/* ===========================
   Segédfüggvények
   =========================== */

// DataURL -> { mimeType, base64 }
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("Érvénytelen data URL kép.");
  return { mimeType: m[1], base64: m[2] };
}

// Gemini hibák barátságos üzenetre fordítása
function formatGeminiError(e: unknown, context: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/SAFETY|HARM|BLOCK|PROHIBITED|POLICY|PERMISSION/i.test(msg)) {
    return new Error(`A kérés blokkolva lett (${context}). Ok: PROHIBITED_CONTENT.`);
  }
  return new Error(`${context} nem sikerült. Részletek: ${msg}`);
}

// Képes output kérése a modeltől
async function generateImageFromParts(parts: Content["parts"], outMime: string) {
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    safetySettings,
    generationConfig: { responseMimeType: outMime },
  });

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });

  // 1) Közvetlen képes válasz (inlineData)
  const candidate = result.response?.candidates?.[0];
  const inlinePart = candidate?.content?.parts?.find(
    (p: any) => p?.inlineData?.data
  ) as any;

  if (inlinePart?.inlineData?.data) {
    return `data:${outMime};base64,${inlinePart.inlineData.data}`;
  }

  // 2) Ha szöveget kaptunk, az hiba ebben a flow-ban
  const txt = result.response?.text?.();
  if (txt) {
    throw new Error("A modell szöveges választ adott vissza a kép helyett. Próbáld újra.");
  }

  throw new Error("Nem érkezett kép a modeltől.");
}

/* ===========================
   Publikus függvények
   =========================== */

/**
 * Modellkép előkészítése a StartScreen számára.
 * Most „pass-through”: visszaadja a bemeneti képet (data URL),
 * így a modell létrehozás nem akad fenn policy-n.
 */
export async function generateModelImage(baseImageDataUrl: string): Promise<string> {
  if (!baseImageDataUrl?.startsWith("data:")) {
    throw new Error("generateModelImage: data URL képet várok.");
  }
  // Ha később akarsz méretezést/normalizálást, ide kerül.
  return baseImageDataUrl;
}

// DEFAULT export is: a StartScreen default importja is működjön
export default generateModelImage;

/**
 * Virtuális „felpróbálás”: garment képet illeszti a modellre.
 */
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
      "Avoid warping the face/hair. Return the final composite as a clean image.";

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

/**
 * Új póz variáció ugyanarra a személyre/öltözetre.
 */
export async function generatePoseVariation(
  baseImageDataUrl: string,
  instruction: string
): Promise<string> {
  try {
    const base = parseDataUrl(baseImageDataUrl);

    const prompt =
      "Create a pose variation of the same person and outfit. " +
      "Keep identity, outfit details, and overall style. Apply this pose instruction: " +
      `"${instruction}". Return a full image as output.`;

    const parts: Content["parts"] = [
      { text: prompt },
      { inlineData: { mimeType: base.mimeType, data: base.base64 } },
    ];

    return await generateImageFromParts(parts, "image/png");
  } catch (e) {
    throw formatGeminiError(e, "Póz generálása");
  }
}
