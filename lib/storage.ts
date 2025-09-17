/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { WardrobeItem, UserModel } from '../types';

// Firebase konfiguráció
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "orelexa-gardrob.firebaseapp.com",
  projectId: "orelexa-gardrob",
  // *** VÉGLEGES JAVÍTÁS: A helyes storageBucket név használata ***
  storageBucket: "orelexa-gardrob.firebasestorage.app",
  messagingSenderId: "32555940559",
  appId: "1:32555940559:web:8672049d584340d0f622f6"
};

// Firebase inicializálása
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storageInstance = getStorage(app);

console.log('🔥 Firebase storage.ts betöltve!');

// --- FELHASZNÁLÓI FUNKCIÓK ---

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);

// --- MODELL FUNKCIÓK ---

export const getModelsForUser = async (username: string): Promise<UserModel[]> => {
  console.log(`📥 Modellek betöltése: ${username}`);
  const modelsCollection = collection(db, 'users', username, 'models');
  const snapshot = await getDocs(modelsCollection);
  const models = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserModel));
  console.log(`📊 ${models.length} modell betöltve`);
  return models;
};

export const saveModelForUser = async (username: string, modelData: { name: string, imageUrl: string }): Promise<UserModel> => {
  console.log(`💾 Modell mentése: ${username}`);
  const docRef = doc(collection(db, 'users', username, 'models'));
  const newModel: UserModel = { id: docRef.id, ...modelData };
  await setDoc(docRef, modelData);
  console.log(`✅ Modell sikeresen mentve: ${newModel.id}`);
  return newModel;
};


// --- RUHADARAB FUNKCIÓK ---

export const uploadGarment = async (username: string, file: File, category: string): Promise<WardrobeItem> => {
  console.log(`📤 Kép feltöltése Firebase Storage-ba: ${file.name}`);
  const uniqueId = `custom-${Date.now()}`;
  const storagePath = `users/${username}/wardrobe/${uniqueId}.jpg`;
  const storageRef = ref(storageInstance, storagePath);

  await uploadBytes(storageRef, file);
  console.log('✅ Kép sikeresen feltöltve');

  const imageUrl = await getDownloadURL(storageRef);
  console.log(`🔗 Kép URL-je: ${imageUrl}`);

  const newGarment: Omit<WardrobeItem, 'id'> = {
    name: file.name.split('.')[0],
    category: category,
    imageUrl: imageUrl,
    isDefault: false,
    lastModified: new Date().toISOString(),
  };

  const docRef = doc(db, 'users', username, 'wardrobe', uniqueId);
  await setDoc(docRef, newGarment);
  console.log(`✅ Ruhadarab sikeresen mentve: ${uniqueId}`);

  return { id: uniqueId, ...newGarment };
};


export const getWardrobeForUser = async (username: string): Promise<WardrobeItem[]> => {
    console.log(`👗 Gardrób betöltése: ${username}`);
    const wardrobeCollection = collection(db, 'users', username, 'wardrobe');
    const snapshot = await getDocs(wardrobeCollection);
    const wardrobe = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardrobeItem));
    console.log(`📊 ${wardrobe.length} ruhadarab betöltve`);
    return wardrobe;
};

export const updateGarmentForUser = async (username: string, garment: WardrobeItem): Promise<void> => {
    console.log(`🔄 Ruhadarab frissítése: ${garment.id}`);
    const docRef = doc(db, 'users', username, 'wardrobe', garment.id);
    const dataToUpdate = { ...garment };
    delete dataToUpdate.id;
    await updateDoc(docRef, dataToUpdate);
    console.log('✅ Ruhadarab sikeresen frissítve');
};

export const deleteGarmentForUser = async (username: string, garmentId: string): Promise<void> => {
    console.log(`🗑️ Ruhadarab törlése: ${garmentId}`);
    
    if (garmentId.startsWith('custom-')) {
        console.log('🗑️ Kép törlése Firebase Storage-ból');
        const storagePath = `users/${username}/wardrobe/${garmentId}.jpg`;
        const storageRef = ref(storageInstance, storagePath);
        try {
            await deleteObject(storageRef);
            console.log('✅ Kép sikeresen törölve');
        } catch (error) {
            if (error.code === 'storage/object-not-found') {
                console.warn('A kép nem létezett a Storage-ben, de a törlés folytatódik.');
            } else {
                throw error;
            }
        }
    }

    const docRef = doc(db, 'users', username, 'wardrobe', garmentId);
    await deleteDoc(docRef);
    console.log('✅ Ruhadarab sikeresen törölve az adatbázisból');
};


export const getHiddenDefaultGarmentsForUser = async (username: string): Promise<string[]> => {
  const docRef = doc(db, 'users', username, 'settings', 'visibility');
  return [];
};
