/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// This is reverted to the hardcoded version to ensure the app connects to the correct project,
// fixing the "data loss" issue caused by incorrect environment variable setup.
const firebaseConfig = {
  apiKey: "AIzaSyCVe5Wm_IaJ7KGvu8cMjv86-CaIzFUVSks",
  authDomain: "orelexa-gardrob.firebaseapp.com",
  projectId: "orelexa-gardrob",
  storageBucket: "orelexa-gardrob.firebasestorage.app",
  messagingSenderId: "146908859931",
  appId: "1:146908859931:web:cb85e119e5da45507432be"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };