/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface UserModel {
  id: string;
  name: string;
  imageUrl: string;
  createdAt?: number;
}

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  category?: string; // e.g., 'Tops', 'Bottoms', 'Dresses'
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null for the base model layer
  imageUrl: string; // The URL of the image for this layer (e.g., model with garment on)
}

export interface SavedOutfit {
  id: string;
  name: string;
  createdAt: number; // timestamp
  previewImageUrl: string; // URL of the final outfit image
  layers: OutfitLayer[]; // The layers that make up the outfit
}
