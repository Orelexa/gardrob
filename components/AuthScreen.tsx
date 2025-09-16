/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import * as storage from '../lib/storage';
import { ShirtIcon } from './icons';

interface AuthScreenProps {
  onLoginSuccess: (username: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('A felhasználónév és a jelszó megadása kötelező.');
      return;
    }

    try {
      if (isLogin) {
        if (await storage.login(username, password)) {
          onLoginSuccess(username);
        } else {
          setError('Érvénytelen felhasználónév vagy jelszó.');
        }
      } else {
        if (await storage.signup(username, password)) {
          onLoginSuccess(username);
        } else {
          setError('A felhasználónév már létezik.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.');
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
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Bejelentkezés
        </button>
        <button 
          onClick={() => { setIsLogin(false); setError(null); }}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Regisztráció
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">Felhasználónév</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-gray-800 focus:border-gray-800 transition-colors"
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Jelszó</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-gray-800 focus:border-gray-800 transition-colors"
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          className="w-full mt-2 px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors"
        >
          {isLogin ? 'Bejelentkezés' : 'Fiók létrehozása'}
        </button>
      </form>
       <p className="text-xs text-gray-400 text-center mt-6">
        Megjegyzés: Ez egy demó. Minden adat helyileg, a böngésződben tárolódik.
      </p>
    </div>
  );
};

export default AuthScreen;