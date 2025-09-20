// services/geminiService.ts
// VITE_GEMINI_API_KEY (opcionális, de a generáláshoz kell). Opcionális: VITE_GEMINI_MODEL.

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
} from "@google/generative-ai";

/* ===========================
   Alapbeállítások
   =========================== */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL_ID =
  (import.meta.env.VITE_GEMINI_MODEL as string) ?? "gemini-2.0-flash-exp";

// Lazább szűrés (policy-t nem írja felül)
const safetySettings: { category: HarmCategory; threshold: HarmBlockThreshold }[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Csak akkor hozunk létre klienst, ha van kulcs – így nem hal el az app betöltéskor.
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
    throw new Error(
      `${context} nem futtatható: nincs beállítva Gemini API kulcs (VITE_GEMINI_API_KEY).`
    );
  }
  return client;
}

/* ===========================
   Segédfüggvények
   =========================== */

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("Érvénytelen data URL kép.");
  return { mimeType: m[1], base64: m[2] };
}

function formatGeminiError(e: unknown, context: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/SAFETY|HARM|BLOCK|PROHIBITED|POLICY|PERMISSION/i.test(msg)) {
    return new Error(`A kérés blokkolva lett (${context}). Ok: PROHIBITED_CONTENT.`);
  }
  return new Error(`${context} nem sikerült. Részletek: ${msg}`);
}

async function generateImageFromParts(parts: Content["parts"], outMime: string) {
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
    throw new Error("A modell szöveges választ adott vissza a kép helyett. Próbáld újra.");
  }

  throw new Error("Nem érkezett kép a modeltől.");
}

/* ===========================
   Publikus API
   =========================== */

/** StartScreen: pass-through, hogy kulcs nélkül is betöltsön az app */
export async function generateModelImage(baseImageDataUrl: string): Promise<string> {
  if (!baseImageDataUrl?.startsWith("data:")) {
    throw new Error("generateModelImage: data URL képet várok.");
  }
  return baseImageDataUrl;
}

// Default export (StartScreen defaultként importálja)
export default generateModelImage;

/** Ruhadarab „felpróbálása” (Gemini szükséges) */
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

/** Póz variáció (Gemini szükséges) */
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
