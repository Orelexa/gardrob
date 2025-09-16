/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "https://esm.sh/@google/genai@^1.10.0";

// Standard Netlify Function handler
export default async (req: Request): Promise<Response> => {
  // CORS engedélyezése a helyi fejlesztéshez és a Netlify telepítéshez
  const headers = {
    'Access-Control-Allow-Origin': '*', // Vagy add meg a saját domainedet
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // CORS preflight kérések kezelése
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  try {
    // Az API kulcs beolvasása a Netlify környezeti változóiból
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Az API_KEY környezeti változó nincs beállítva a szerveren.");
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const body = await req.json();
    const { model, contents, config } = body;

    if (!model || !contents) {
        return new Response(JSON.stringify({ error: 'Hiányzó kötelező paraméterek: model és contents' }), { status: 400, headers });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // A Gemini válaszának stringgé alakítása és visszaküldése
    return new Response(JSON.stringify(response), { status: 200, headers });

  } catch (error) {
    console.error("Hiba a Netlify funkcióban:", error);
    const errorMessage = error instanceof Error ? error.message : "Ismeretlen hiba történt.";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers
    });
  }
};
