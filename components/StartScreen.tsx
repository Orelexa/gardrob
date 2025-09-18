import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloudIcon, CheckCircleIcon } from './icons';
import Spinner from './Spinner';
import { generateVirtualTryOnImage } from '../services/geminiService';

// Debug sor a függvény ellenőrzéséhez
console.log('generateVirtualTryOnImage:', generateVirtualTryOnImage);

import { getFriendlyErrorMessage } from '../lib/utils';

interface StartScreenProps {
  onModelFinalized: (name: string, modelUrl: string) => void;
}

const SaveModelStep: React.FC<{
  modelUrl: string;
  onSave: (name: string) => void;
  onBack: () => void;
}> = ({ modelUrl, onSave, onBack }) => {
  const [name, setName] = useState('Modellem');
  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col sm:flex-row items-center gap-4 mt-8"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Modell nevének megadása"
        className="w-full sm:w-auto px-4 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-800 focus:border-transparent transition-all"
      />
      <button
        onClick={handleSave}
        disabled={!name.trim()}
        className="w-full sm:w-auto relative inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-gray-900 rounded-md cursor-pointer group hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        <CheckCircleIcon className="w-5 h-5 mr-2" />
        Mentés és folytatás
      </button>
      <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
        Másik fotó használata
      </button>
    </motion.div>
  );
};

const StartScreen: React.FC<StartScreenProps> = ({ onModelFinalized }) => {
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image')) {
      setError('Kérjük, válassz egy képfájlt.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setUserImageUrl(dataUrl);
      setIsGenerating(true);
      setGeneratedModelUrl(null);
      setError(null);
      try {
        const result = await generateVirtualTryOnImage(dataUrl, '');
        setGeneratedModelUrl(result);
      } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Nem sikerült a modell létrehozása.'));
        setUserImageUrl(null);
      } finally {
        setIsGenerating(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const screenVariants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  };

  const handleSave = (name: string) => {
    if (generatedModelUrl) {
      onModelFinalized(name, generatedModelUrl);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!userImageUrl ? (
        <motion.div
          key="uploader"
          className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="w-full lg:w-1/2 flex flex-col items-center justify-center">
            <img src="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg" alt="Példa" className="w-full max-w-sm aspect-[2/3] rounded-2xl bg-gray-200" />
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="compare"
          className="w-full max-w-6xl mx-auto h-full flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12"
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          <div className="md:w-1/2 w-full flex items-center justify-center">
            <div className={`relative rounded-1.25rem transition-all duration-700 ease-in-out ${isGenerating ? 'border border-gray-300 animate-pulse' : 'border border-transparent'}`}>
              {generatedModelUrl ? (
                <img src={generatedModelUrl} alt="Generált modell" className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200" />
              ) : (
                <img src={userImageUrl} alt="Feltöltött kép" className="w-[280px] h-[420px] sm:w-[320px] sm:h-[480px] lg:w-[400px] lg:h-[600px] rounded-2xl bg-gray-200" />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StartScreen;
