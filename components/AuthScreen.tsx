/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// VÉGLEGES, STABIL VERZIÓ
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/storage'; // A központi auth szolgáltatás importálása
import { getFriendlyErrorMessage } from '../lib/utils';
import Spinner from './Spinner';

interface AuthScreenProps {
  onLoginSuccess: (username: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('ready67@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userCredential = isLogin 
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user.email) {
        onLoginSuccess(userCredential.user.email);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Sikertelen művelet'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Gardrób</h1>
        <p className="text-gray-500">A te személyes virtuális próbafülkéd.</p>
      </div>
      <div className="flex border-b mb-6">
        <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-center font-semibold ${isLogin ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Bejelentkezés</button>
        <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-center font-semibold ${!isLogin ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}>Regisztráció</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Felhasználónév</label>
          <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cim.com" required />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">Jelszó</label>
          <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******************" required />
          {error && <p className="text-red-500 text-xs italic">{error}</p>}
        </div>
        <div className="flex items-center justify-between">
          <button className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full flex justify-center items-center" type="submit" disabled={isLoading}>
            {isLoading ? <Spinner /> : (isLogin ? 'Bejelentkezés' : 'Regisztráció')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AuthScreen;
