/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase.ts';
import type { UserModel, WardrobeItem, SavedOutfit, OutfitLayer } from '../types.ts';

// --- User Models ---

export const getModelsForUser = async (userId: string): Promise<UserModel[]> => {
  const modelsRef = collection(db, 'users', userId, 'models');
  const q = query(modelsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserModel));
};

export const saveModelForUser = async (userId: string, name: string, modelImageDataUrl: string): Promise<UserModel> => {
    const modelDocRef = doc(collection(db, 'users', userId, 'models'));
    const modelId = modelDocRef.id;
    const imageRef = ref(storage, `users/${userId}/models/${modelId}.png`);
    
    await uploadString(imageRef, modelImageDataUrl, 'data_url');
    const imageUrl = await getDownloadURL(imageRef);

    const newModelData = {
        name,
        imageUrl,
        createdAt: Date.now(),
    };

    await setDoc(modelDocRef, newModelData);
    
    return { id: modelId, ...newModelData };
};

export const deleteModelForUser = async (userId: string, modelId: string): Promise<void> => {
  const imageRef = ref(storage, `users/${userId}/models/${modelId}.png`);
  try {
      await deleteObject(imageRef);
  } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
          console.error("Error deleting model image from storage:", error);
      }
  }
  
  const modelDocRef = doc(db, 'users', userId, 'models', modelId);
  await deleteDoc(modelDocRef);
};


// --- Wardrobe ---

export const getWardrobeForUser = async (userId: string): Promise<WardrobeItem[]> => {
    const wardrobeRef = collection(db, 'users', userId, 'wardrobe');
    const q = query(wardrobeRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardrobeItem));
};

export const addGarmentToUserWardrobe = async (userId: string, garmentFile: File, category: string): Promise<WardrobeItem> => {
    const imageRef = ref(storage, `users/${userId}/wardrobe/custom-${Date.now()}-${garmentFile.name}`);
    
    // Use uploadBytes for direct file upload, which is much more efficient than base64.
    await uploadBytes(imageRef, garmentFile);
    const imageUrl = await getDownloadURL(imageRef);

    const garmentDocRef = collection(db, 'users', userId, 'wardrobe');
    const newGarment = {
        name: garmentFile.name.split('.').slice(0, -1).join('.') || 'Új ruhadarab',
        url: imageUrl,
        category: category,
        createdAt: Date.now(),
    };

    const docRef = await addDoc(garmentDocRef, newGarment);

    return { id: docRef.id, ...newGarment };
};

export const deleteGarmentFromUserWardrobe = async (userId: string, garment: WardrobeItem): Promise<void> => {
    const imageRef = ref(storage, garment.url);
    try {
        await deleteObject(imageRef);
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting garment image from storage:", error);
        }
    }
    const garmentDocRef = doc(db, 'users', userId, 'wardrobe', garment.id);
    await deleteDoc(garmentDocRef);
};

export const updateGarmentInCategory = async (userId: string, garmentId: string, category: string): Promise<void> => {
    const garmentDocRef = doc(db, 'users', userId, 'wardrobe', garmentId);
    await updateDoc(garmentDocRef, { category });
};


// --- Saved Outfits ---

export const getSavedOutfitsForUser = async (userId: string): Promise<SavedOutfit[]> => {
    const outfitsRef = collection(db, 'users', userId, 'outfits');
    const q = query(outfitsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedOutfit));
};

export const saveOutfitForUser = async (userId: string, name: string, previewImageDataUrl: string, layers: OutfitLayer[]): Promise<SavedOutfit> => {
    const outfitDocRef = doc(collection(db, 'users', userId, 'outfits'));
    const outfitId = outfitDocRef.id;
    const imageRef = ref(storage, `users/${userId}/outfits/${outfitId}.png`);

    await uploadString(imageRef, previewImageDataUrl, 'data_url');
    const previewImageUrl = await getDownloadURL(imageRef);
    
    const newOutfitData = {
        name,
        previewImageUrl,
        layers: layers.map(l => ({ garment: l.garment, imageUrl: '' })), // Clear runtime image URL
        createdAt: Date.now(),
    };
    
    await setDoc(outfitDocRef, newOutfitData);

    return { id: outfitId, ...newOutfitData };
};

export const deleteOutfitForUser = async (userId: string, outfit: SavedOutfit): Promise<void> => {
    const imageRef = ref(storage, outfit.previewImageUrl);
    try {
        await deleteObject(imageRef);
    } catch (error: any) {
        if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting outfit image from storage:", error);
        }
    }
    const outfitDocRef = doc(db, 'users', userId, 'outfits', outfit.id);
    await deleteDoc(outfitDocRef);
};
