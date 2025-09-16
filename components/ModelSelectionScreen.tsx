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

  useEffect(() => {
    setModels(storage.getModelsForUser(username));
  }, [username]);
  
  const handleDelete = (modelId: string) => {
    if (window.confirm("Biztosan törölni szeretnéd ezt a modellt?")) {
        storage.deleteModelForUser(username, modelId);
        setModels(storage.getModelsForUser(username));
    }
  };

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
              >
                  <Trash2Icon className="w-4 h-4" />
              </button>
          </div>
        ))}

        <button
          onClick={onCreateModel}
          className="aspect-[2/3] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-600 transition-colors"
        >
          <PlusIcon className="w-10 h-10 mb-2" />
          <span className="font-semibold">Új modell létrehozása</span>
        </button>
      </div>
    </div>
  );
};

export default ModelSelectionScreen;
