/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string; // Can be a remote URL or a data URL for local items
  category?: string;
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}

export interface UserModel {
  id: string;
  name: string;
  imageUrl: string;
}

// FIX: Add SavedOutfit interface to resolve missing type error in SavedOutfitsModal.tsx.
export interface SavedOutfit {
  id: string;
  name: string;
  previewImageUrl: string;
  createdAt: number;
}
