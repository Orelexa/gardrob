/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// VÉGLEGES, STABIL VERZIÓ

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "orelexa-gardrob.firebaseapp.com",
  projectId: "orelexa-gardrob",
  storageBucket: "orelexa-gardrob.firebasestorage.app", // A HELYES BUCKET NÉV
  messagingSenderId: "32555940559",
  appId: "1:32555940559:web:8672049d584340d0f622f6"
};

// Egyetlen, központi inicializálás
const app = initializeApp(firebaseConfig);

// A szolgáltatások exportálása, amit a többi fájl használni fog
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storageInstance = getStorage(app);

console.log('🔥 Firebase storage.ts betöltve! Verzió: VÉGLEGES ÉS STABIL');
