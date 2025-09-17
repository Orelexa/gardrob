/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import type { WardrobeItem, UserModel } from '../types';

// *** VÉGLEGES, JAVÍTOTT FIREBASE KONFIGURÁCIÓ ***
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "orelexa-gardrob.firebaseapp.com",
  projectId: "orelexa-gardrob",
  storageBucket: "orelexa-gardrob.firebasestorage.app", // A helyes bucket név
  messagingSenderId: "32555940559",
  appId: "1:32555940559:web:8672049d584340d0f622f6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storageInstance = getStorage(app);

console.log('🔥 Firebase storage.ts betöltve!');

// --- EXPORTÁLT FUNKCIÓK ---

export {
  auth,
  db,
  storageInstance,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};
