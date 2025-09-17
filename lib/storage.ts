/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Firebase-alapú storage szolgáltatás
 */

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';
import { UserModel, WardrobeItem } from '../types';
import { defaultWardrobe } from '../wardrobe';

console.log('🔥 Firebase storage.ts betöltve!');

// Helper to hash password with SHA-256 using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Helper függvény képfájl feltöltéshez Firebase Storage-ba
const uploadImageToFirebase = async (
  imageData: string, 
  path: string, 
  filename: string
): Promise<string> => {
  try {
    console.log('🖼️ Kép feltöltése Firebase Storage-ba:', filename);
    
    // Base64 string konvertálása Blob-ba
    const response = await fetch(imageData);
    const blob = await response.blob();
    
    // Firebase Storage referencia
    const imageRef = ref(storage, `${path}/${filename}`);
    
    // Fájl feltöltése
    const snapshot = await uploadBytes(imageRef, blob);
    
    // Letöltési URL lekérése
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Kép sikeresen feltöltve:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Hiba a kép feltöltése során:', error);
    throw new Error('Nem sikerült feltölteni a képet a Firebase Storage-ba');
  }
};

// Helper függvény kép törléshez Firebase Storage-ból
const deleteImageFromFirebase = async (imageUrl: string): Promise<void> => {
  try {
    // Firebase Storage URL-ből referencia kinyerése
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      console.log('🗑️ Kép törölve Firebase Storage-ból');
    }
  } catch (error) {
    console.error('⚠️ Hiba a kép törlése során:', error);
    // Nem dobunk hibát, mert lehet hogy a kép már törölve van
  }
};

// User adatok Firestore-ból
const getUserData = async (username: string) => {
  try {
    const userRef = doc(db, 'users', username);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error('❌ Hiba a felhasználói adatok lekérése során:', error);
    throw new Error('Nem sikerült betölteni a felhasználói adatokat');
  }
};

// User adatok mentése Firestore-ba
const saveUserData = async (username: string, userData: any) => {
  try {
    const userRef = doc(db, 'users', username);
    await setDoc(userRef, userData, { merge: true });
    console.log('💾 Felhasználói adatok mentve:', username);
  } catch (error) {
    console.error('❌ Hiba a felhasználói adatok mentése során:', error);
    throw new Error('Nem sikerült menteni a felhasználói adatokat');
  }
};

// FELHASZNÁLÓ KEZELÉS
export const signup = async (username: string, password: string): Promise<boolean> => {
  try {
    console.log('👤 Regisztráció:', username);
    
    // Ellenőrizzük, hogy létezik-e már a felhasználó
    const existingUser = await getUserData(username);
    if (existingUser) {
      return false; // Felhasználó már létezik
    }
    
    const passwordHash = await hashPassword(password);
    const userData = {
      passwordHash,
      models: [],
      wardrobe: [],
      hiddenDefaultGarments: [],
      createdAt: new Date()
    };
    
    await saveUserData(username, userData);
    console.log('✅ Regisztráció sikeres:', username);
    return true;
  } catch (error) {
    console.error('❌ Hiba a regisztráció során:', error);
    return false;
  }
};

export const login = async (username: string, password: string): Promise<boolean> => {
  try {
    console.log('🔑 Bejelentkezés:', username);
    
    const userData = await getUserData(username);
    if (!userData) {
      return false;
    }
    
    const passwordHash = await hashPassword(password);
    const success = userData.passwordHash === passwordHash;
    console.log(success ? '✅ Bejelentkezés sikeres' : '❌ Helytelen jelszó');
    return success;
  } catch (error) {
    console.error('❌ Hiba a bejelentkezés során:', error);
    return false;
  }
};

// MODEL KEZELÉS
export const getModelsForUser = async (username: string): Promise<UserModel[]> => {
  try {
    console.log('📥 Modellek betöltése:', username);
    const userData = await getUserData(username);
    const models = userData?.models || [];
    console.log(`📊 ${models.length} modell betöltve`);
    return models;
  } catch (error) {
    console.error('❌ Hiba a modellek lekérése során:', error);
    return [];
  }
};

export const saveModelForUser = async (
  username: string, 
  modelData: { name: string; imageUrl: string; }
): Promise<UserModel> => {
  try {
    console.log('💾 Model mentése:', modelData.name);
    
    const userData = await getUserData(username);
    if (!userData) {
      throw new Error("Felhasználó nem található");
    }
    
    const modelId = `model-${Date.now()}`;
    const filename = `${modelId}.jpg`;
    
    // Kép feltöltése Firebase Storage-ba
    const firebaseImageUrl = await uploadImageToFirebase(
      modelData.imageUrl,
      `users/${username}/models`,
      filename
    );
    
    const newModel: UserModel = {
      id: modelId,
      name: modelData.name,
      imageUrl: firebaseImageUrl
    };
    
    // Model hozzáadása a felhasználó adataihoz
    const updatedModels = [...(userData.models || []), newModel];
    await saveUserData(username, { ...userData, models: updatedModels });
    
    console.log('✅ Model sikeresen mentve:', modelId);
    return newModel;
  } catch (error) {
    console.error('❌ Hiba a model mentése során:', error);
    throw error;
  }
};

export const deleteModelForUser = async (username: string, modelId: string): Promise<void> => {
  try {
    console.log('🗑️ Model törlése:', modelId);
    
    const userData = await getUserData(username);
    if (!userData) return;
    
    // Kép URL megkeresése törléshez
    const modelToDelete = userData.models?.find((m: UserModel) => m.id === modelId);
    if (modelToDelete?.imageUrl) {
      await deleteImageFromFirebase(modelToDelete.imageUrl);
    }
    
    // Model eltávolítása a listából
    const updatedModels = userData.models?.filter((m: UserModel) => m.id !== modelId) || [];
    await saveUserData(username, { ...userData, models: updatedModels });
    
    console.log('✅ Model sikeresen törölve:', modelId);
  } catch (error) {
    console.error('❌ Hiba a model törlése során:', error);
    throw error;
  }
};

// GARDRÓB KEZELÉS
export const getWardrobeForUser = async (username: string): Promise<WardrobeItem[]> => {
  try {
    console.log('👗 Gardrób betöltése:', username);
    const userData = await getUserData(username);
    const wardrobe = userData?.wardrobe || [];
    console.log(`📊 ${wardrobe.length} ruhadarab betöltve`);
    return wardrobe;
  } catch (error) {
    console.error('❌ Hiba a gardrób lekérése során:', error);
    return [];
  }
};

export const saveGarmentForUser = async (username: string, garment: WardrobeItem): Promise<void> => {
  try {
    console.log('💾 Ruhadarab mentése:', garment.name);
    
    const userData = await getUserData(username);
    if (!userData) {
      throw new Error("Felhasználó nem található a ruhadarab mentése közben.");
    }
    
    // Ha van url (base64), feltöltjük Firebase Storage-ba
    let firebaseImageUrl = garment.url;
    if (garment.url && garment.url.startsWith('data:')) {
      const filename = `${garment.id}.jpg`;
      firebaseImageUrl = await uploadImageToFirebase(
        garment.url,
        `users/${username}/wardrobe`,
        filename
      );
    }
    
    const updatedGarment = { ...garment, url: firebaseImageUrl };
    
    // Hozzáadás a lista elejére
    const updatedWardrobe = [updatedGarment, ...(userData.wardrobe || [])];
    await saveUserData(username, { ...userData, wardrobe: updatedWardrobe });
    
    console.log('✅ Ruhadarab sikeresen mentve:', garment.id);
  } catch (error) {
    console.error('❌ Hiba a ruhadarab mentése során:', error);
    throw error;
  }
};

export const updateGarmentForUser = async (username: string, updatedGarment: WardrobeItem): Promise<void> => {
  try {
    console.log('🔄 Ruhadarab frissítése:', updatedGarment.id);
    
    const userData = await getUserData(username);
    if (!userData) return;
    
    const wardrobe = userData.wardrobe || [];
    const index = wardrobe.findIndex((g: WardrobeItem) => g.id === updatedGarment.id);
    
    if (index !== -1) {
      // Ha új kép van (base64), feltöltjük Firebase Storage-ba
      let firebaseImageUrl = updatedGarment.url;
      if (updatedGarment.url && updatedGarment.url.startsWith('data:')) {
        const filename = `${updatedGarment.id}.jpg`;
        firebaseImageUrl = await uploadImageToFirebase(
          updatedGarment.url,
          `users/${username}/wardrobe`,
          filename
        );
      }
      
      wardrobe[index] = { ...updatedGarment, url: firebaseImageUrl };
      await saveUserData(username, { ...userData, wardrobe });
      
      console.log('✅ Ruhadarab sikeresen frissítve:', updatedGarment.id);
    }
  } catch (error) {
    console.error('❌ Hiba a ruhadarab frissítése során:', error);
    throw error;
  }
};

export const deleteGarmentForUser = async (username: string, garmentId: string): Promise<void> => {
  try {
    console.log('🗑️ Ruhadarab törlése:', garmentId);
    
    const userData = await getUserData(username);
    if (!userData) return;
    
    const isDefault = defaultWardrobe.some(g => g.id === garmentId);
    
    if (isDefault) {
      // Alapértelmezett ruhadarab rejtése
      const hiddenList = userData.hiddenDefaultGarments || [];
      if (!hiddenList.includes(garmentId)) {
        hiddenList.push(garmentId);
        await saveUserData(username, { ...userData, hiddenDefaultGarments: hiddenList });
        console.log('👻 Alapértelmezett ruhadarab elrejtve:', garmentId);
      }
    } else {
      // Felhasználói ruhadarab törlése
      const garmentToDelete = userData.wardrobe?.find((g: WardrobeItem) => g.id === garmentId);
      if (garmentToDelete?.url && !garmentToDelete.url.startsWith('data:')) {
        await deleteImageFromFirebase(garmentToDelete.url);
      }
      
      const updatedWardrobe = userData.wardrobe?.filter((g: WardrobeItem) => g.id !== garmentId) || [];
      await saveUserData(username, { ...userData, wardrobe: updatedWardrobe });
      
      console.log('✅ Ruhadarab sikeresen törölve:', garmentId);
    }
  } catch (error) {
    console.error('❌ Hiba a ruhadarab törlése során:', error);
    throw error;
  }
};

export const getHiddenDefaultGarmentsForUser = async (username: string): Promise<string[]> => {
  try {
    const userData = await getUserData(username);
    const hidden = userData?.hiddenDefaultGarments || [];
    console.log(`👻 ${hidden.length} rejtett alapértelmezett ruhadarab`);
    return hidden;
  } catch (error) {
    console.error('❌ Hiba a rejtett alapértelmezett ruhadarabok lekérése során:', error);
    return [];
  }
};

// MIGRÁCIÓ SEGÉDFÜGGVÉNY localStorage-ról Firebase-re
export const migrateFromLocalStorage = async (): Promise<void> => {
  try {
    console.log('🔄 Migráció indítása localStorage-ról Firebase-re...');
    
    const localData = localStorage.getItem('virtual_try_on_users');
    if (!localData) {
      console.log('ℹ️ Nincs adat localStorage-ban a migrációhoz');
      return;
    }
    
    const users = JSON.parse(localData);
    let migratedUsers = 0;
    
    for (const [username, userData] of Object.entries(users as any)) {
      console.log(`🔄 Migráció: ${username}`);
      
      try {
        // Felhasználó alapadatok mentése
        await saveUserData(username, {
          passwordHash: userData.passwordHash,
          models: [],
          wardrobe: [],
          hiddenDefaultGarments: userData.hiddenDefaultGarments || [],
          migratedAt: new Date(),
          migratedFrom: 'localStorage'
        });
        
        // Modellek migrálása
        if (userData.models && userData.models.length > 0) {
          console.log(`📱 ${userData.models.length} modell migrálása...`);
          for (const model of userData.models) {
            try {
              await saveModelForUser(username, {
                name: model.name,
                imageUrl: model.imageUrl
              });
            } catch (error) {
              console.error(`❌ Hiba a model migrálása során: ${model.id}`, error);
            }
          }
        }
        
        // Gardrób migrálása
        if (userData.wardrobe && userData.wardrobe.length > 0) {
          console.log(`👗 ${userData.wardrobe.length} ruhadarab migrálása...`);
          for (const garment of userData.wardrobe) {
            try {
              await saveGarmentForUser(username, garment);
            } catch (error) {
              console.error(`❌ Hiba a ruhadarab migrálása során: ${garment.id}`, error);
            }
          }
        }
        
        migratedUsers++;
        console.log(`✅ ${username} sikeresen migrálva`);
        
      } catch (error) {
        console.error(`❌ Hiba a felhasználó migrálása során: ${username}`, error);
      }
    }
    
    console.log(`🎉 Migráció befejezve! ${migratedUsers} felhasználó migrálva.`);
    
    // Opcionális: localStorage törlése migráció után
    // localStorage.removeItem('virtual_try_on_users');
    
  } catch (error) {
    console.error('❌ Hiba a migráció során:', error);
    throw error;
  }
};