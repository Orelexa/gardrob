/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import type { SavedOutfit } from '../types';
import { XIcon, Trash2Icon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';

interface SavedOutfitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  outfits: SavedOutfit[];
  onLoadOutfit: (outfitId: string) => void;
  onDeleteOutfit: (outfitId: string) => void;
}

const SavedOutfitsModal: React.FC<SavedOutfitsModalProps> = ({ isOpen, onClose, outfits, onLoadOutfit, onDeleteOutfit }) => {
    
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl"
                    >
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-2xl font-serif tracking-wider text-gray-800">Mentett szettek</h2>
                            <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                                <XIcon className="w-6 h-6"/>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {outfits.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500">Még nincsenek mentett szettjeid.</p>
                                    <p className="text-sm text-gray-400 mt-2">Próbálj össze egy szettet, és mentsd el, hogy itt megjelenjen.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {outfits.map(outfit => (
                                        <div key={outfit.id} className="group relative border rounded-lg overflow-hidden flex flex-col bg-gray-50">
                                            <div className="aspect-[3/4] overflow-hidden">
                                                <img src={outfit.previewImageUrl} alt={outfit.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"/>
                                            </div>
                                            <div className="p-3 flex-grow flex flex-col justify-between">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 truncate">{outfit.name}</h3>
                                                    <p className="text-xs text-gray-500">{new Date(outfit.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <div className="mt-3 flex flex-col gap-2">
                                                     <button 
                                                        onClick={() => onLoadOutfit(outfit.id)}
                                                        className="w-full px-3 py-2 text-sm font-semibold text-white bg-gray-800 rounded-md hover:bg-gray-600 transition-colors"
                                                    >
                                                        Betöltés
                                                    </button>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => onDeleteOutfit(outfit.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full text-gray-500 hover:bg-red-500 hover:text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 shadow"
                                                aria-label="Szett törlése"
                                            >
                                                <Trash2Icon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SavedOutfitsModal;