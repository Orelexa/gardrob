/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// FIX: Implemented the main App component to provide application structure and state management.
import React, { useState, useCallback, useMemo, useEffect } from 'react';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import AuthScreen from './components/AuthScreen';
import ModelSelectionScreen from './components/ModelSelectionScreen';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import OutfitStack from './components/CurrentOutfitPanel';
import WardrobeModal from './components/WardrobeModal';

// Services, Libs, and Types
import { generateVirtualTryOnImage, generatePoseVariation } from './services/geminiService';
import * as storage from './lib/storage';
import { getFriendlyErrorMessage, fileToDataUrl } from './lib/utils';
import type { UserModel, OutfitLayer, WardrobeItem } from './types';
import { defaultWardrobe } from './wardrobe';

const SCREENS = {
  AUTH: 'AUTH',
  MODEL_SELECTION: 'MODEL_SELECTION',
  CREATE_MODEL: 'CREATE_MODEL',
  DRESSING_ROOM: 'DRESSING_ROOM',
};

const POSE_INSTRUCTIONS = [
  "Szemben állva", // This will be the default/initial pose
  "Enyhén elfordulva, 3/4-es nézet",
  "Oldalnézet",
  "Kamera felé sétálva",
  "Falnak támaszkodva",
  "Kéz a zsebben",
  "Karba tett kézzel",
  "Magabiztos csípőre tett kéz",
  "Háttal állva, váll fölött visszanézve",
];

function App() {
  const [screen, setScreen] = useState(SCREENS.AUTH);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<UserModel | null>(null);
  
  // Dressing Room State
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [userWardrobe, setUserWardrobe] = useState<WardrobeItem[]>([]);
  const [hiddenGarments, setHiddenGarments] = useState<string[]>([]);

  const combinedWardrobe = useMemo(() => {
    // Prevent duplicates by ID, giving user's items precedence
    const wardrobeMap = new Map<string, WardrobeItem>();
    const visibleDefaultWardrobe = defaultWardrobe.filter(item => !hiddenGarments.includes(item.id));
    [...userWardrobe, ...visibleDefaultWardrobe].forEach(item => {
      if (!wardrobeMap.has(item.id)) {
        wardrobeMap.set(item.id, item);
      }
    });
    return Array.from(wardrobeMap.values());
  }, [userWardrobe, hiddenGarments]);


  const resetDressingRoom = useCallback(() => {
    if (selectedModel) {
      setOutfitHistory([{
        garment: null,
        poseImages: { [POSE_INSTRUCTIONS[0]]: selectedModel.imageUrl },
      }]);
      setCurrentPoseIndex(0);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (screen === SCREENS.DRESSING_ROOM && selectedModel) {
      resetDressingRoom();
    }
  }, [screen, selectedModel, resetDressingRoom]);

  useEffect(() => {
    if (currentUser) {
      setUserWardrobe(storage.getWardrobeForUser(currentUser));
      setHiddenGarments(storage.getHiddenDefaultGarmentsForUser(currentUser));
    } else {
      setUserWardrobe([]);
      setHiddenGarments([]);
    }
  }, [currentUser]);


  const handleLoginSuccess = (username: string) => {
    setCurrentUser(username);
    setScreen(SCREENS.MODEL_SELECTION);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedModel(null);
    setScreen(SCREENS.AUTH);
  };
  
  const handleModelSelect = (model: UserModel) => {
    setSelectedModel(model);
    setScreen(SCREENS.DRESSING_ROOM);
  };

  const handleCreateModel = () => {
    setScreen(SCREENS.CREATE_MODEL);
  };

  const handleModelFinalized = (name: string, imageUrl: string) => {
    if (currentUser) {
      const newModel = storage.saveModelForUser(currentUser, { name, imageUrl });
      setSelectedModel(newModel);
      setScreen(SCREENS.DRESSING_ROOM);
    }
  };
  
  const handleStartOver = () => {
    setSelectedModel(null);
    setOutfitHistory([]);
    setScreen(SCREENS.MODEL_SELECTION);
  };

  const handleGarmentSelectForTryOn = (garmentFile: File, garmentInfo: WardrobeItem) => {
    setIsWardrobeOpen(false);
    if (!selectedModel || outfitHistory.length === 0) return;
    
    setIsLoading(true);
    setLoadingMessage(`A(z) "${garmentInfo.name}" ruhadarab felpróbálása...`);
    
    const lastLayer = outfitHistory[outfitHistory.length - 1];
    const baseImageUrl = lastLayer.poseImages[POSE_INSTRUCTIONS[0]];

    if (!baseImageUrl) {
      alert("Az előző réteg alapképe nem található. A folyamat alaphelyzetbe áll.");
      setIsLoading(false);
      resetDressingRoom();
      return;
    }

    generateVirtualTryOnImage(baseImageUrl, garmentFile)
      .then(newImageUrl => {
        const newLayer: OutfitLayer = {
          garment: garmentInfo,
          poseImages: { [POSE_INSTRUCTIONS[0]]: newImageUrl },
        };
        setOutfitHistory(prev => [...prev, newLayer]);
        setCurrentPoseIndex(0);
      })
      .catch(err => alert(getFriendlyErrorMessage(err, 'Nem sikerült a ruhadarabot hozzáadni')))
      .finally(() => setIsLoading(false));
  };
  
  const handleGarmentAdd = async (garmentFile: File, category: string): Promise<void> => {
    if (!currentUser) return;
    try {
        const dataUrl = await fileToDataUrl(garmentFile);
        const newGarment: WardrobeItem = {
            id: `custom-${Date.now()}`,
            name: garmentFile.name,
            url: dataUrl,
            category: category,
        };
        storage.saveGarmentForUser(currentUser, newGarment);
        setUserWardrobe(prev => [newGarment, ...prev]);
    } catch (error) {
        alert(getFriendlyErrorMessage(error, "Nem sikerült a ruhadarab mentése"));
    }
  };

  const handleGarmentUpdate = (updatedGarment: WardrobeItem) => {
    if (!currentUser) return;
    storage.updateGarmentForUser(currentUser, updatedGarment);
    setUserWardrobe(prev => prev.map(g => g.id === updatedGarment.id ? updatedGarment : g));
  };

  const handleGarmentDelete = (garmentId: string) => {
    if (!currentUser) return;
    storage.deleteGarmentForUser(currentUser, garmentId);

    const isDefault = defaultWardrobe.some(g => g.id === garmentId);
    if (isDefault) {
        setHiddenGarments(prev => [...prev, garmentId]);
    } else {
        setUserWardrobe(prev => prev.filter(g => g.id !== garmentId));
    }
  };


  const handleRemoveLastGarment = () => {
    if (outfitHistory.length > 1) {
      setOutfitHistory(prev => prev.slice(0, -1));
      setCurrentPoseIndex(0);
    }
  };

  const handlePoseSelect = async (poseIndex: number) => {
    const targetPoseInstruction = POSE_INSTRUCTIONS[poseIndex];
    const currentLayer = outfitHistory[outfitHistory.length - 1];

    if (currentLayer.poseImages[targetPoseInstruction]) {
      setCurrentPoseIndex(poseIndex);
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage(`Póz váltása: ${targetPoseInstruction}...`);
    
    const sourceImageUrl = currentLayer.poseImages[POSE_INSTRUCTIONS[0]];
    if (!sourceImageUrl) {
      alert("Hiányzik az alap kép a jelenlegi szetthez.");
      setIsLoading(false);
      return;
    }

    try {
      const newPoseImageUrl = await generatePoseVariation(sourceImageUrl, targetPoseInstruction);
      setOutfitHistory(prev => {
        // Create a shallow copy of the history array
        const newHistory = [...prev];
        const lastLayerIndex = newHistory.length - 1;

        // Ensure there is a layer to update
        if (lastLayerIndex < 0) {
          return prev;
        }

        const originalLastLayer = newHistory[lastLayerIndex];

        // Create a new layer object with a new poseImages object
        const updatedLastLayer = {
          ...originalLastLayer,
          poseImages: {
            ...originalLastLayer.poseImages,
            [targetPoseInstruction]: newPoseImageUrl,
          },
        };

        // Replace the old layer with the updated one
        newHistory[lastLayerIndex] = updatedLastLayer;

        return newHistory;
      });
      setCurrentPoseIndex(poseIndex);
    } catch (err) {
      alert(getFriendlyErrorMessage(err, 'Nem sikerült az új pózt létrehozni'));
    } finally {
      setIsLoading(false);
    }
  };

  const currentLayer = useMemo(() => outfitHistory.length > 0 ? outfitHistory[outfitHistory.length - 1] : null, [outfitHistory]);
  const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
  const displayImageUrl = useMemo(() => currentLayer?.poseImages[currentPoseInstruction] || null, [currentLayer, currentPoseInstruction]);
  const activeGarmentIds = useMemo(() => outfitHistory.map(l => l.garment?.id).filter(Boolean) as string[], [outfitHistory]);


  const renderScreen = () => {
    switch(screen) {
      case SCREENS.AUTH:
        return (
          <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <AuthScreen onLoginSuccess={handleLoginSuccess} />
          </main>
        );
      case SCREENS.MODEL_SELECTION:
        if (!currentUser) return null;
        return (
            <main className="w-full min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
              <ModelSelectionScreen 
                username={currentUser}
                onModelSelect={handleModelSelect}
                onCreateModel={handleCreateModel}
                onLogout={handleLogout}
              />
            </main>
        );
      case SCREENS.CREATE_MODEL:
        return (
          <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <StartScreen onModelFinalized={handleModelFinalized} />
          </main>
        );
      case SCREENS.DRESSING_ROOM:
        return (
          <>
            <Header />
            <main className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 md:p-8">
              <div className="lg:col-span-2 h-[calc(100vh-200px)] min-h-[500px]">
                <Canvas
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                />
              </div>
              <div className="lg:col-span-1">
                <OutfitStack
                  outfitHistory={outfitHistory}
                  onRemoveLastGarment={handleRemoveLastGarment}
                  onAddGarment={() => setIsWardrobeOpen(true)}
                />
              </div>
            </main>
            <Footer isOnDressingScreen />
            <WardrobeModal
              isOpen={isWardrobeOpen}
              onClose={() => setIsWardrobeOpen(false)}
              onGarmentSelect={handleGarmentSelectForTryOn}
              onGarmentAdd={handleGarmentAdd}
              onGarmentDelete={handleGarmentDelete}
              onGarmentUpdate={handleGarmentUpdate}
              wardrobe={combinedWardrobe}
              activeGarmentIds={activeGarmentIds}
              isLoading={isLoading}
            />
          </>
        );
      default:
        return (
            <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4">
              <AuthScreen onLoginSuccess={handleLoginSuccess} />
            </main>
        );
    }
  };

  return <div className="antialiased font-sans text-gray-800">{renderScreen()}</div>;
}

export default App;