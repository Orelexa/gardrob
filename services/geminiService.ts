console.log("GEMINISERVICE DEBUG VERZIÓ", Date.now());

export const generateVirtualTryOnImage = async (
  modelImageUrl: string,
  garmentImageUrl: string,
  onProgress?: ((fraction: number) => void) | null,
): Promise<string> => {
  console.log("onProgress típusa:", typeof onProgress);
  if (typeof onProgress === "function") onProgress(0.1);
  try {
    const response = await fetch("/api/gemini-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelImageUrl, garmentImageUrl }),
    });
    if (typeof onProgress === "function") onProgress(0.8);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "Ismeretlen hiba a proxy szerveren.",
      }));
      throw new Error(errorData.error || `A proxy hibája: ${response.statusText}`);
    }
    const data = await response.json();
    if (typeof onProgress === "function") onProgress(1);
    if (!data.imageUrl) {
      throw new Error("A szerver nem küldött vissza kép URL-t.");
    }
    return data.imageUrl;
  } catch (error) {
    console.error("Hiba a virtuális próbánál:", error);
    throw error;
  }
};

export const generatePoseVariation = async (
  tryOnImageUrl: string,
  poseInstruction: string,
  onProgress?: ((fraction: number) => void) | null,
): Promise<string> => {
  console.warn("A póz variáció funkció jelenleg nem elérhető.");
  throw new Error("Jelenleg nem elérhető.");
};
