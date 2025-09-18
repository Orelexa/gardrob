/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import type { UserModel, WardrobeItem, OutfitLayer, SavedOutfit } from './types.ts';
import * as storage from './lib/storage.ts';

import Header from './components/Header.tsx';
import Footer from './components/Footer.tsx';
import AuthScreen from './components/AuthScreen.tsx';
import ModelSelectionScreen from './components/ModelSelectionScreen.tsx';
import StartScreen from './components/StartScreen.tsx';
import Canvas from './components/Canvas.tsx';
import CurrentOutfitPanel from './components/CurrentOutfitPanel.tsx';
import WardrobeModal from './components/WardrobeModal.tsx';
import SavedOutfitsModal from './components/SavedOutfitsModal.tsx';
import DebugModal from './components/DebugModal.tsx';
import Spinner from './components/Spinner.tsx';
import { SaveIcon, LibraryIcon } from './components/icons.tsx';
import { generateVirtualTryOnImage, generatePoseVariation } from './services/geminiService.ts';
import { getFriendlyErrorMessage, imageUrlToDataUrl } from './lib/utils.ts';
import { defaultWardrobe } from './wardrobe.ts';

type AppState =
  | { view: 'loading' }
  | { view: 'auth' }
  | { view: 'model_selection'; userId: string }
  | { view: 'model_creation'; userId: string; file: File | null; }
  | { view: 'dressing_room'; userId: string; model: UserModel };

const POSE_INSTRUCTIONS = [
  "Standing, facing forward, relaxed pose",
  "Slightly turned, 3/4 view",
  "Walking towards camera, in motion",
  "Side profile view",
  "Leaning against a neutral wall",
  "Hands in pockets, casual stance",
];

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({ view: 'loading' });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [user, setUser] = useState<User | null>(null);

  // Dressing Room State
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [poseVariations, setPoseVariations] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Modals State
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isSavedOutfitsOpen, setIsSavedOutfitsOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  // Data State
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([...defaultWardrobe]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);


  // --- Authentication ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setAppState({ view: 'model_selection', userId: currentUser.uid });
      } else {
        setAppState({ view: 'auth' });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setAppState({ view: 'auth' });
  };
  
  // --- Data Fetching ---
  useEffect(() => {
      if (appState.view === 'dressing_room' || appState.view === 'model_selection') {
          const fetchUserData = async () => {
              const [userWardrobe, userOutfits] = await Promise.all([
                  storage.getWardrobeForUser(appState.userId),
                  storage.getSavedOutfitsForUser(appState.userId)
              ]);
              setWardrobe([...defaultWardrobe, ...userWardrobe]);
              setSavedOutfits(userOutfits);
          };
          fetchUserData();
      }
  }, [appState]);

  // --- Debug Key Combination ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsDebugOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Core Logic ---
  const transitionToDressingRoom = (userId: string, model: UserModel) => {
    setOutfitHistory([{ garment: null, imageUrl: model.imageUrl }]);
    setPoseVariations({ 0: model.imageUrl });
    setCurrentPoseIndex(0);
    setAppState({ view: 'dressing_room', userId: userId, model });
  };

  const handleModelSelect = (model: UserModel) => {
    if (appState.view === 'model_selection') {
        transitionToDressingRoom(appState.userId, model);
    }
  };

  const handleModelCreated = async (name: string, modelUrl: string) => {
      if (appState.view === 'model_creation') {
          const newModel = await storage.saveModelForUser(appState.userId, name, modelUrl);
          transitionToDressingRoom(appState.userId, newModel);
      }
  };

  const handleStartOver = () => {
    if (appState.view === 'dressing_room') {
      setAppState({ view: 'model_selection', userId: appState.userId });
    }
  };

  const handleAddGarment = async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (appState.view !== 'dressing_room') return;
    setIsWardrobeOpen(false);
    setIsLoading(true);
    setLoadingMessage(`A(z) ${garmentInfo.name} felpróbálása...`);
    
    try {
      const baseImage = outfitHistory[outfitHistory.length - 1].imageUrl;
      // Convert the https:// URL from Firebase Storage to a data URL for Gemini
      const baseImageAsDataUrl = await imageUrlToDataUrl(baseImage);
  
      const newImageUrl = await generateVirtualTryOnImage(baseImageAsDataUrl, garmentFile);
      const newLayer: OutfitLayer = { garment: garmentInfo, imageUrl: newImageUrl };
      setOutfitHistory(prev => [...prev, newLayer]);
      setCurrentPoseIndex(0);
      setPoseVariations({ 0: newImageUrl });

    } catch(err) {
      alert(`Hiba a ruhadarab felpróbálásakor: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleGarmentAdd = async (garmentFile: File, category: string) => {
      if (appState.view !== 'dressing_room') return;
      const newGarment = await storage.addGarmentToUserWardrobe(appState.userId, garmentFile, category);
      setWardrobe(prev => [...prev, newGarment]);
  };
  
  const handleGarmentDelete = async (garmentId: string) => {
      if (appState.view !== 'dressing_room') return;
      const garmentToDelete = wardrobe.find(g => g.id === garmentId);
      if (garmentToDelete) {
          await storage.deleteGarmentFromUserWardrobe(appState.userId, garmentToDelete);
          setWardrobe(prev => prev.filter(g => g.id !== garmentId));
      }
  };
    
  const handleGarmentUpdate = async (garment: WardrobeItem) => {
      if (appState.view !== 'dressing_room' || !garment.category) return;
      await storage.updateGarmentInCategory(appState.userId, garment.id, garment.category);
      setWardrobe(prev => prev.map(g => g.id === garment.id ? garment : g));
  }

  const handleRemoveLastGarment = () => {
    if (outfitHistory.length > 1) {
      setOutfitHistory(prev => prev.slice(0, -1));
      setCurrentPoseIndex(0);
      setPoseVariations({}); // Poses are specific to the top layer
    }
  };
  
  const handleSelectPose = async (index: number) => {
    if (isLoading) return;
    setCurrentPoseIndex(index);
    if (poseVariations[index]) return; // Already generated

    setIsLoading(true);
    setLoadingMessage('Új póz generálása...');
    
    try {
      const baseImage = outfitHistory[outfitHistory.length - 1].imageUrl;
      // Convert the https:// URL from Firebase Storage to a data URL for Gemini
      const baseImageAsDataUrl = await imageUrlToDataUrl(baseImage);
      const instruction = POSE_INSTRUCTIONS[index];
      
      const newImageUrl = await generatePoseVariation(baseImageAsDataUrl, instruction);
      setPoseVariations(prev => ({ ...prev, [index]: newImageUrl }));
    } catch (err) {
      alert(`Hiba a póz generálásakor: ${getFriendlyErrorMessage(err)}`);
      setCurrentPoseIndex(0); // Revert to a valid pose
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleSaveOutfit = async () => {
    if (appState.view !== 'dressing_room' || outfitHistory.length <= 1) {
      alert("Adj hozzá legalább egy ruhadarabot a mentéshez.");
      return;
    }
    const outfitName = prompt("Add meg a szett nevét:", "Új Szett");
    if (outfitName) {
      setIsLoading(true);
      setLoadingMessage("Szett mentése...");
      try {
        const currentImage = poseVariations[currentPoseIndex] || outfitHistory[outfitHistory.length - 1].imageUrl;
        const newOutfit = await storage.saveOutfitForUser(appState.userId, outfitName, currentImage, outfitHistory);
        setSavedOutfits(prev => [newOutfit, ...prev]);
        alert(`"${outfitName}" sikeresen mentve!`);
      } catch (err) {
        alert(`Hiba a szett mentésekor: ${getFriendlyErrorMessage(err)}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }
  };
  
  const handleLoadOutfit = async (outfitId: string) => {
    if (appState.view !== 'dressing_room') return;
    const outfitToLoad = savedOutfits.find(o => o.id === outfitId);
    if (outfitToLoad) {
      // Rehydrate garment info from current wardrobe
      const rehydratedLayers: OutfitLayer[] = outfitToLoad.layers.map(layer => ({
          garment: layer.garment ? wardrobe.find(w => w.id === layer.garment!.id) || layer.garment : null,
          imageUrl: '' // This will be replaced
      }));
      if (rehydratedLayers.length > 0) {
        rehydratedLayers[rehydratedLayers.length - 1].imageUrl = outfitToLoad.previewImageUrl;
      }
      

      setOutfitHistory(rehydratedLayers);
      setPoseVariations({ 0: outfitToLoad.previewImageUrl });
      setCurrentPoseIndex(0);
      setIsSavedOutfitsOpen(false);
    }
  };
  
  const handleDeleteOutfit = async (outfitId: string) => {
    // FIX: Add a guard to ensure appState has userId before proceeding. This resolves a TypeScript error where appState could be in a state without a userId property.
    if (appState.view !== 'dressing_room') return;
    const outfitToDelete = savedOutfits.find(o => o.id === outfitId);
    if (outfitToDelete && window.confirm(`Biztosan törölni szeretnéd a(z) "${outfitToDelete.name}" szettet?`)) {
      await storage.deleteOutfitForUser(appState.userId, outfitToDelete);
      setSavedOutfits(prev => prev.filter(o => o.id !== outfitId));
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    switch (appState.view) {
      case 'loading':
        return <div className="flex-grow flex items-center justify-center"><Spinner /></div>;
      case 'auth':
        return <div className="flex-grow flex items-center justify-center"><AuthScreen /></div>;
      case 'model_selection':
        return (
          <ModelSelectionScreen
            userId={appState.userId}
            onModelSelect={handleModelSelect}
            onFileForModelCreation={(file) => setAppState({ view: 'model_creation', userId: appState.userId, file })}
            onLogout={handleLogout}
          />
        );
      case 'model_creation':
        return (
          <div className="flex-grow flex items-center justify-center w-full">
            <StartScreen
              onModelFinalized={handleModelCreated}
              initialFile={appState.file}
              onProcessingStart={() => {
                  if (appState.file) setAppState(s => ({ ...s, file: null }))
              }}
            />
          </div>
        );
      case 'dressing_room':
        const activeGarmentIds = outfitHistory.map(l => l.garment?.id).filter(Boolean) as string[];
        const displayImageUrl = poseVariations[currentPoseIndex] || outfitHistory[outfitHistory.length - 1]?.imageUrl;
        return (
          <div className="w-full h-full flex flex-col md:flex-row gap-4 p-4 flex-grow">
            <main className="flex-grow h-full md:w-3/5">
              <Canvas 
                displayImageUrl={displayImageUrl}
                onStartOver={handleStartOver}
                isLoading={isLoading}
                loadingMessage={loadingMessage}
                onSelectPose={handleSelectPose}
                poseInstructions={POSE_INSTRUCTIONS}
                currentPoseIndex={currentPoseIndex}
              />
            </main>
            <aside className="w-full md:w-2/5 md:max-w-sm flex-shrink-0 bg-gray-100/60 p-4 rounded-lg flex flex-col gap-6">
                <CurrentOutfitPanel 
                    outfitHistory={outfitHistory} 
                    onRemoveLastGarment={handleRemoveLastGarment}
                    onAddGarment={() => setIsWardrobeOpen(true)}
                />
                <div className="mt-auto flex gap-3">
                  <button 
                    onClick={handleSaveOutfit}
                    disabled={isLoading || outfitHistory.length <= 1}
                    className="flex-grow flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-200 active:scale-95 disabled:opacity-50"
                  >
                    <SaveIcon className="w-5 h-5 mr-2" />
                    Szett Mentése
                  </button>
                  <button 
                    onClick={() => setIsSavedOutfitsOpen(true)}
                    disabled={isLoading}
                    className="flex-grow flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-200 active:scale-95 disabled:opacity-50"
                  >
                    <LibraryIcon className="w-5 h-5 mr-2" />
                    Mentett Szettek
                  </button>
                </div>
            </aside>
            <WardrobeModal 
                isOpen={isWardrobeOpen}
                onClose={() => setIsWardrobeOpen(false)}
                onGarmentSelect={handleAddGarment}
                onGarmentAdd={handleGarmentAdd}
                onGarmentDelete={handleGarmentDelete}
                onGarmentUpdate={handleGarmentUpdate}
                wardrobe={wardrobe}
                activeGarmentIds={activeGarmentIds}
                isLoading={isLoading}
            />
            <SavedOutfitsModal
              isOpen={isSavedOutfitsOpen}
              onClose={() => setIsSavedOutfitsOpen(false)}
              outfits={savedOutfits}
              onLoadOutfit={handleLoadOutfit}
              onDeleteOutfit={handleDeleteOutfit}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-sans antialiased">
        {appState.view !== 'auth' && <Header />}
        <div className="flex-grow flex items-center justify-center w-full">
            {renderContent()}
        </div>
        <Footer isOnDressingScreen={appState.view === 'dressing_room'} />
        <DebugModal isOpen={isDebugOpen} onClose={() => setIsDebugOpen(false)} />
    </div>
  );
};

export default App;