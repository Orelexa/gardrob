/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import type { WardrobeItem } from '../types.ts';
import { UploadCloudIcon, CheckCircleIcon, XIcon, Trash2Icon, DotsVerticalIcon } from './icons.tsx';
import { AnimatePresence, motion } from 'framer-motion';
import Spinner from './Spinner.tsx';

interface WardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGarmentSelect: (garmentFile: File, garmentInfo: WardrobeItem) => void;
  onGarmentAdd: (garmentFile: File, category: string) => Promise<void>;
  onGarmentDelete: (garmentId: string) => void;
  onGarmentUpdate: (garment: WardrobeItem) => void;
  wardrobe: WardrobeItem[];
  activeGarmentIds: string[];
  isLoading: boolean;
}

const CATEGORIES = ['Összes', 'Felsők', 'Nadrágok', 'Ruhák', 'Felsőruházat', 'Lábbelik', 'Tréning', 'Kiegészítők', 'Nem kategorizált'];
const EDITABLE_CATEGORIES = CATEGORIES.filter(c => c !== 'Összes');

// Helper to convert image URL to a File object
const urlToFile = async (url: string, filename: string): Promise<File> => {
    // FIX: Use a CORS proxy to fetch images. This is necessary because fetching directly 
    // from Firebase Storage is blocked by CORS policy, which caused the "add garment" feature to fail for user-uploaded items.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image via proxy: ${response.statusText}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type;
    return new File([blob], filename, { type: mimeType });
};

const WardrobeModal: React.FC<WardrobeModalProps> = ({ isOpen, onClose, onGarmentSelect, onGarmentAdd, onGarmentDelete, onGarmentUpdate, wardrobe, activeGarmentIds, isLoading }) => {
    const [error, setError] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<WardrobeItem | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Összes');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const filteredWardrobe = useMemo(() => {
        if (activeCategory === 'Összes') {
            return wardrobe;
        }
        if (activeCategory === 'Nem kategorizált') {
            return wardrobe.filter(item => !item.category || item.category === 'Nem kategorizált');
        }
        return wardrobe.filter(item => item.category === activeCategory);
    }, [wardrobe, activeCategory]);

    const handleGarmentClick = async (item: WardrobeItem) => {
        if (isLoading || activeGarmentIds.includes(item.id)) return;
        setError(null);
        try {
            const file = await urlToFile(item.url, `${item.id}.png`);
            onGarmentSelect(file, item);
        } catch (err) {
            console.error(err); // Log the actual error for debugging
            setError('Nem sikerült betölteni a ruhadarabot. Kérjük, próbáld újra.');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Kérjük, válassz egy képfájlt.');
                return;
            }
            setIsUploading(true);
            setError(null);
            
            const newGarmentCategory = activeCategory === 'Összes' ? 'Nem kategorizált' : activeCategory;

            await onGarmentAdd(file, newGarmentCategory);
            
            setIsUploading(false);
            e.target.value = ''; // Reset file input

            // Switch view to the category where the new item was added
            setActiveCategory(newGarmentCategory);
        }
    };
    
    const confirmDelete = () => {
        if (itemToDelete) {
            onGarmentDelete(itemToDelete.id);
            setItemToDelete(null);
        }
    };

    const handleCategoryChange = (item: WardrobeItem, newCategory: string) => {
        onGarmentUpdate({ ...item, category: newCategory });
        setEditingItemId(null);
    };

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
                    className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl"
                >
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-2xl font-serif tracking-wider text-gray-800">Gardrób</h2>
                        <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                            <XIcon className="w-6 h-6"/>
                        </button>
                    </div>
                    <div className="flex-shrink-0 px-6 pt-4">
                        <div className="flex items-center border-b border-gray-200 overflow-x-auto">
                            {CATEGORIES.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${activeCategory === category ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                            {filteredWardrobe.length === 0 && activeCategory !== 'Összes' && (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    <p className="font-semibold">Nincs találat</p>
                                    <p className="text-sm mt-1">Ebben a kategóriában nincsenek ruhadarabok.</p>
                                </div>
                            )}
                            {filteredWardrobe.map((item) => {
                                const isActive = activeGarmentIds.includes(item.id);
                                const isCustom = item.id.startsWith('custom-');
                                return (
                                    <div key={item.id} className="group relative">
                                        <button
                                            onClick={() => handleGarmentClick(item)}
                                            disabled={isLoading || isActive}
                                            className="w-full aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                                            aria-label={`Select ${item.name}`}
                                        >
                                            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                                            </div>
                                            {isActive && (
                                                <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                                                    <CheckCircleIcon className="w-8 h-8 text-white" />
                                                </div>
                                            )}
                                        </button>
                                        {!isActive && (
                                            <>
                                                <button 
                                                    onClick={() => setItemToDelete(item)}
                                                    className="absolute -top-2 -right-2 p-1 bg-white rounded-full text-gray-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md border z-10"
                                                    aria-label="Ruhadarab törlése"
                                                >
                                                    <Trash2Icon className="w-4 h-4" />
                                                </button>
                                                {isCustom && (
                                                    <div className="absolute -top-2 -left-2 z-20">
                                                        <button 
                                                            onClick={() => setEditingItemId(prev => prev === item.id ? null : item.id)}
                                                            className="p-1 bg-white rounded-full text-gray-500 hover:bg-gray-200 transition-all opacity-0 group-hover:opacity-100 shadow-md border"
                                                            aria-label="Kategória módosítása"
                                                        >
                                                            <DotsVerticalIcon className="w-4 h-4" />
                                                        </button>
                                                         <AnimatePresence>
                                                            {editingItemId === item.id && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.9, y: -5 }}
                                                                    className="absolute top-full mt-1 w-40 bg-white rounded-md shadow-lg border p-1"
                                                                >
                                                                    {EDITABLE_CATEGORIES.map(cat => (
                                                                        <button
                                                                            key={cat}
                                                                            onClick={() => handleCategoryChange(item, cat)}
                                                                            className="w-full text-left text-sm p-2 rounded hover:bg-gray-100"
                                                                        >
                                                                            {cat}
                                                                        </button>
                                                                    ))}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading || isUploading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                                {isUploading ? (
                                    <Spinner className="w-6 h-6" />
                                ) : (
                                    <>
                                        <UploadCloudIcon className="w-6 h-6 mb-1"/>
                                        <span className="text-xs text-center">Feltöltés</span>
                                    </>
                                )}
                                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading || isUploading}/>
                            </label>
                        </div>
                        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                    </div>
                </motion.div>
                
                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {itemToDelete && (
                         <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: -10 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: -10 }}
                                className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm"
                            >
                                <h3 className="text-lg font-bold text-gray-800">Törlés megerősítése</h3>
                                <p className="text-sm text-gray-600 mt-2">Biztosan törlöd a(z) "{itemToDelete.name}" nevű ruhadarabot? Ezt a műveletet nem lehet visszavonni.</p>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button onClick={() => setItemToDelete(null)} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Mégse</button>
                                    <button onClick={confirmDelete} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md">Törlés</button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        )}
    </AnimatePresence>
  );
};

export default WardrobeModal;