/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { auth } from '../lib/firebase.ts';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { ShirtIcon } from './icons.tsx';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState(''); // E-mail címként használjuk
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Az e-mail cím és a jelszó megadása kötelező.');
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, username, password);
        // A sikeres bejelentkezést az onAuthStateChanged listener kezeli az App.tsx-ben
      } else {
        await createUserWithEmailAndPassword(auth, username, password);
         // A sikeres regisztrációt és bejelentkezést az onAuthStateChanged listener kezeli az App.tsx-ben
      }
    } catch (err: any) {
      // Részletes hiba logolása a konzolba a hibakereséshez
      console.error('Firebase Auth Hiba:', err);
      
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Érvénytelen e-mail cím formátum.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': // Hozzáadva a modern hibakód
          setError('Érvénytelen e-mail cím vagy jelszó.');
          break;
        case 'auth/email-already-in-use':
          setError('Ez az e-mail cím már regisztrálva van.');
          break;
        case 'auth/weak-password':
          setError('A jelszónak legalább 6 karakter hosszúnak kell lennie.');
          break;
        default:
          setError('Ismeretlen hiba történt. Kérjük, próbáld újra.');
      }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
      <div className="text-center mb-8">
        <ShirtIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <h1 className="text-4xl font-serif font-bold text-gray-900">Gardrób</h1>
        <p className="text-gray-600 mt-2">A te személyes virtuális próbafülkéd.</p>
      </div>
      
      <div className="flex border-b border-gray-200 mb-6">
        <button 
          onClick={() => { setIsLogin(true); setError(null); }}
          className={`w-1/2 py-3 font-semibold text-center transition-colors ${isLogin ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Bejelentkezés
        </button>
        <button 
          onClick={() => { setIsLogin(false); setError(null); }}
          className={`w-1/2 py-3 font-semibold text-center transition-colors ${!isLogin ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Regisztráció
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-mail cím</label>
          <input
            id="email"
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="te@email.com"
            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-800 focus:border-gray-800"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Jelszó</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-800 focus:border-gray-800"
            required
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Folyamatban...' : (isLogin ? 'Bejelentkezés' : 'Regisztráció')}
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-center text-gray-500">
        A fiókod és adataid a Firebase-ben, biztonságosan tárolódnak.
      </p>
    </div>
  );
};

export default AuthScreen;