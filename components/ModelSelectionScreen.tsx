/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import * as storage from '../lib/storage';
import { UserModel } from '../types';
import { PlusIcon, Trash2Icon } from './icons';

interface ModelSelectionScreenProps {
  username: string;
  onModelSelect: (model: UserModel) => void;
  onCreateModel: () => void;
  onLogout: () => void;
}

const ModelSelectionScreen: React.FC<ModelSelectionScreenProps> = ({ username, onModelSelect, onCreateModel, onLogout }) => {
  const [models, setModels] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);

  // FIREBASE ASYNC VERZIÓ - Modellek betöltése
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        const userModels = await storage.getModelsForUser(username);
        setModels(userModels);
      } catch (error) {
        console.error('Hiba a modellek betöltése során:', error);
        setModels([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadModels();
  }, [username]);
  
  // FIREBASE ASYNC VERZIÓ - Modell törlése
  const handleDelete = async (modelId: string) => {
    if (window.confirm("Biztosan törölni szeretnéd ezt a modellt?")) {
      try {
        setLoading(true);
        await storage.deleteModelForUser(username, modelId);
        
        // Modellek újra betöltése
        const updatedModels = await storage.getModelsForUser(username);
        setModels(updatedModels);
      } catch (error) {
        console.error('Hiba a modell törlése során:', error);
        alert('Nem sikerült törölni a modellt');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Modellek betöltése...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center p-8">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-serif font-bold text-gray-900">Válassz egy modellt</h1>
        <p className="mt-2 text-lg text-gray-600">Válassz egy meglévő modellt, vagy hozz létre egy újat a virtuális próba elindításához.</p>
        <button onClick={onLogout} className="text-sm text-gray-500 hover:underline mt-4">Kijelentkezés</button>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {models.map((model) => (
          <div key={model.id} className="group relative rounded-lg overflow-hidden border border-gray-200/80 shadow-sm transition-shadow hover:shadow-xl">
              <button onClick={() => onModelSelect(model)} className="w-full aspect-[2/3] block">
                <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <h3 className="absolute bottom-3 left-3 text-white font-bold text-lg">{model.name}</h3>
              </button>
              <button
                onClick={() => handleDelete(model.id)}
                className="absolute top-2 right-2 p-1.5 bg-white/70 rounded-full text-gray-600 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                aria-label="Modell törlése"
                disabled={loading}
              >
                  <Trash2Icon className="w-4 h-4" />
              </button>
          </div>
        ))}

        <button
          onClick={onCreateModel}
          className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <PlusIcon className="w-10 h-10 mb-2" />
          <span className="font-semibold">Új modell létrehozása</span>
        </button>
      </div>
      
      {models.length === 0 && !loading && (
        <div className="text-center mt-8">
          <p className="text-gray-500 text-lg">Még nincsenek modellek</p>
          <p className="text-gray-400 text-sm mt-2">Hozd létre az első modelldet a virtuális próba elkezdéséhez</p>
        </div>
      )}
    </div>
  );
};

export default ModelSelectionScreen;