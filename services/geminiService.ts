export const generateVirtualTryOnImage = async (
  modelImageUrl: string,
  garmentImageUrl: string,
  onProgress?: ((fraction: number) => void) | null // legyen null is elfogadható
): Promise<string> => {
  if (typeof onProgress === "function") onProgress(0.1);
  try {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelImageUrl, garmentImageUrl }),
    });
    if (typeof onProgress === "function") onProgress(0.8);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Ismeretlen hiba a proxy szerveren.',
      }));
      throw new Error(errorData.error || `A proxy szerver hibát adott: ${response.statusText}`);
    }
    const data = await response.json();
    if (typeof onProgress === "function") onProgress(1);
    if (!data.imageUrl) {
      throw new Error('A proxy szerver nem küldött vissza kép URL-t.');
    }
    return data.imageUrl;
  } catch (error) {
    console.error('❌ Hiba a virtuális felpróbálás során:', error);
    throw error;
  }
};
