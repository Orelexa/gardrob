// lib/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCVe5Wm_IaJ7KGvu8cMjv86-CaIzFUVSks",
  authDomain: "orelexa-gardrob.firebaseapp.com",
  projectId: "orelexa-gardrob",
  storageBucket: "orelexa-gardrob.firebasestorage.app",
  messagingSenderId: "146908859931",
  appId: "1:146908859931:web:cb85e119e5da45507432be"
};

// Firebase inicializálása
const app = initializeApp(firebaseConfig);

// Szolgáltatások exportálása
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;