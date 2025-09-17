export const generateVirtualTryOnImage = async (
  modelImageUrl: string,
  garmentImageUrl: string,
  onProgress?: (fraction: number) => void
): Promise<string> => {
  console.log('🎨 Virtuális felpróbálás indítása a proxy-n keresztül...');
  onProgress?.(0.1);

  try {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelImageUrl, garmentImageUrl }),
    });

    onProgress?.(0.8);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Ismeretlen hiba a proxy szerveren.',
      }));
      throw new Error(errorData.error || `A proxy szerver hibát adott: ${response.statusText}`);
    }

    const data = await response.json();
    onProgress?.(1);

    if (!data.imageUrl) {
      throw new Error('A proxy szerver nem küldött vissza kép URL-t.');
    }
    
    return data.imageUrl;

  } catch (error) {
    console.error('❌ Hiba a virtuális felpróbálás során:', error);
    throw error;
  }
};

export const generatePoseVariation = async (
  tryOnImageUrl: string,
  poseInstruction: string,
  onProgress?: (fraction: number) => void
): Promise<string> => {
  console.warn('A póz variáció funkció jelenleg nem érhető el.');
  throw new Error('Ez a funkció jelenleg nem érhető el.');
};
