/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// VÉGLEGES, STABIL VERZIÓ
import React, { useState, useCallback, useMemo, useEffect } from 'react';

import Header from './components/Header';
import Footer from './components/Footer';
import AuthScreen from './components/AuthScreen';
import ModelSelectionScreen from './components/ModelSelectionScreen';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import OutfitStack from './components/CurrentOutfitPanel';
import WardrobeModal from './components/WardrobeModal';

import { generateVirtualTryOnImage, generatePoseVariation } from './services/geminiService';
import { db, storageInstance } from './lib/storage';
import { getFriendlyErrorMessage } from './lib/utils';
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { UserModel, OutfitLayer, WardrobeItem } from './types';
import { defaultWardrobe } from './wardrobe';

const SCREENS = { AUTH: 'AUTH', MODEL_SELECTION: 'MODEL_SELECTION', CREATE_MODEL: 'CREATE_MODEL', DRESSING_ROOM: 'DRESSING_ROOM' };
const POSE_INSTRUCTIONS = ["Szemben állva", "Enyhén elfordulva, 3/4-es nézet", "Oldalnézet", "Kamera felé sétálva", "Falnak támaszkodva", "Kéz a zsebben", "Karba tett kézzel", "Magabiztos csípőre tett kéz", "Háttal állva, váll fölött visszanézve"];

function App() {
  const [screen, setScreen] = useState(SCREENS.AUTH);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<UserModel | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [userWardrobe, setUserWardrobe] = useState<WardrobeItem[]>([]);
  const [hiddenGarments, setHiddenGarments] = useState<string[]>([]);

  const getModelsForUser = async (username: string): Promise<UserModel[]> => {
    const modelsCollection = collection(db, 'users', username, 'models');
    const snapshot = await getDocs(modelsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserModel));
  };
  
  const getWardrobeForUser = async (username: string): Promise<WardrobeItem[]> => {
      const wardrobeCollection = collection(db, 'users', username, 'wardrobe');
      const snapshot = await getDocs(wardrobeCollection);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardrobeItem));
  };

  const combinedWardrobe = useMemo(() => {
    const wardrobeMap = new Map<string, WardrobeItem>();
    const visibleDefaultWardrobe = defaultWardrobe.filter(item => !hiddenGarments.includes(item.id));
    [...userWardrobe, ...visibleDefaultWardrobe].forEach(item => {
      if (!wardrobeMap.has(item.id)) wardrobeMap.set(item.id, item);
    });
    return Array.from(wardrobeMap.values());
  }, [userWardrobe, hiddenGarments]);

  const resetDressingRoom = useCallback(() => {
    if (selectedModel) {
      setOutfitHistory([{ garment: null, poseImages: { [POSE_INSTRUCTIONS[0]]: selectedModel.imageUrl } }]);
      setCurrentPoseIndex(0);
    }
  }, [selectedModel]);

  useEffect(() => { if (screen === SCREENS.DRESSING_ROOM && selectedModel) resetDressingRoom(); }, [screen, selectedModel, resetDressingRoom]);

  useEffect(() => {
    if (currentUser) {
      const loadUserData = async () => {
        try {
          setIsLoading(true);
          setLoadingMessage('Felhasználói adatok betöltése...');
          const wardrobe = await getWardrobeForUser(currentUser);
          setUserWardrobe(wardrobe);
        } catch (error) {
          alert(getFriendlyErrorMessage(error, 'Nem sikerült betölteni a felhasználói adatokat'));
        } finally {
          setIsLoading(false);
        }
      };
      loadUserData();
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
  
  const handleCreateModel = () => setScreen(SCREENS.CREATE_MODEL);

  const handleModelFinalized = async (name: string, imageUrl: string) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Modell mentése...');
      const docRef = doc(collection(db, 'users', currentUser, 'models'));
      const newModel: UserModel = { id: docRef.id, name, imageUrl };
      await setDoc(docRef, { name, imageUrl });
      setSelectedModel(newModel);
      setScreen(SCREENS.DRESSING_ROOM);
    } catch (error) {
      alert(getFriendlyErrorMessage(error, 'Nem sikerült menteni a modellt'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOver = () => {
    setSelectedModel(null);
    setOutfitHistory([]);
    setScreen(SCREENS.MODEL_SELECTION);
  };

  const handleGarmentSelectForTryOn = (garment: WardrobeItem) => {
    setIsWardrobeOpen(false);
    const garmentUrl = garment.imageUrl;
    if (!garmentUrl) {
      alert(`Hiba: A kiválasztott ruhadarabnak (${garment.name}) nincs kép címe (URL).`);
      return;
    }
    if (!selectedModel || outfitHistory.length === 0) return;
    setIsLoading(true);
    setLoadingMessage(`A(z) "${garment.name}" ruhadarab felpróbálása...`);
    const lastLayer = outfitHistory[outfitHistory.length - 1];
    const baseImageUrl = lastLayer.poseImages[POSE_INSTRUCTIONS[0]];
    if (!baseImageUrl) {
      alert("Az előző réteg alapképe nem található.");
      setIsLoading(false);
      resetDressingRoom();
      return;
    }
    generateVirtualTryOnImage(baseImageUrl, garmentUrl)
      .then(newImageUrl => {
        setOutfitHistory(prev => [...prev, { garment, poseImages: { [POSE_INSTRUCTIONS[0]]: newImageUrl } }]);
        setCurrentPoseIndex(0);
      })
      .catch(err => alert(getFriendlyErrorMessage(err, 'Nem sikerült a ruhadarabot hozzáadni')))
      .finally(() => setIsLoading(false));
  };

  const handleGarmentAdd = async (garmentFile: File, category: string): Promise<void> => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Ruhadarab mentése...');
      const uniqueId = `custom-${Date.now()}`;
      const storagePath = `users/${currentUser}/wardrobe/${uniqueId}.jpg`;
      const storageRef = ref(storageInstance, storagePath);
      await uploadBytes(storageRef, garmentFile);
      const imageUrl = await getDownloadURL(storageRef);
      const newGarment: Omit<WardrobeItem, 'id'> = {
        name: garmentFile.name.split('.').slice(0, -1).join('.') || garmentFile.name,
        category,
        imageUrl,
        isDefault: false,
        lastModified: new Date().toISOString(),
      };
      const docRef = doc(db, 'users', currentUser, 'wardrobe', uniqueId);
      await setDoc(docRef, newGarment);
      setUserWardrobe(prev => [{ id: uniqueId, ...newGarment }, ...prev]);
    } catch (error) {
      alert(getFriendlyErrorMessage(error, "Nem sikerült a ruhadarabot menteni"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGarmentDelete = async (garmentId: string) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Ruhadarab törlése...');
      if (garmentId.startsWith('custom-')) {
          const storagePath = `users/${currentUser}/wardrobe/${garmentId}.jpg`;
          const storageRef = ref(storageInstance, storagePath);
          try { await deleteObject(storageRef); } catch (error) { if (error.code !== 'storage/object-not-found') throw error; }
      }
      const docRef = doc(db, 'users', currentUser, 'wardrobe', garmentId);
      await deleteDoc(docRef);
      setUserWardrobe(prev => prev.filter(g => g.id !== garmentId));
    } catch (error) {
      alert(getFriendlyErrorMessage(error, 'Nem sikerült törölni a ruhadarabot'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLastGarment = () => {
    if (outfitHistory.length > 1) {
      setOutfitHistory(prev => prev.slice(0, -1));
      setCurrentPoseIndex(0);
    }
  };

  const currentLayer = useMemo(() => outfitHistory.length > 0 ? outfitHistory[outfitHistory.length - 1] : null, [outfitHistory]);
  const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
  const displayImageUrl = useMemo(() => currentLayer?.poseImages[currentPoseInstruction] || null, [currentLayer, currentPoseInstruction]);
  const activeGarmentIds = useMemo(() => outfitHistory.map(l => l.garment?.id).filter(Boolean) as string[], [outfitHistory]);

  const renderScreen = () => {
    switch(screen) {
      case SCREENS.AUTH:
        return <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4"><AuthScreen onLoginSuccess={handleLoginSuccess} /></main>;
      case SCREENS.MODEL_SELECTION:
        return currentUser ? <main className="w-full min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4"><ModelSelectionScreen username={currentUser} onModelSelect={handleModelSelect} onCreateModel={handleCreateModel} onLogout={handleLogout} getModelsForUser={getModelsForUser} /></main> : null;
      case SCREENS.CREATE_MODEL:
        return <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4"><StartScreen onModelFinalized={handleModelFinalized} /></main>;
      case SCREENS.DRESSING_ROOM:
        return (
          <>
            <Header />
            <main className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 md:p-8">
              <div className="lg:col-span-2 h-[calc(100vh-200px)] min-h-[500px]">
                <Canvas displayImageUrl={displayImageUrl} onStartOver={handleStartOver} isLoading={isLoading} loadingMessage={loadingMessage} onSelectPose={() => {}} poseInstructions={POSE_INSTRUCTIONS} currentPoseIndex={currentPoseIndex} />
              </div>
              <div className="lg:col-span-1">
                <OutfitStack outfitHistory={outfitHistory} onRemoveLastGarment={handleRemoveLastGarment} onAddGarment={() => setIsWardrobeOpen(true)} />
              </div>
            </main>
            <Footer isOnDressingScreen />
            <WardrobeModal isOpen={isWardrobeOpen} onClose={() => setIsWardrobeOpen(false)} onGarmentSelect={handleGarmentSelectForTryOn} onGarmentAdd={handleGarmentAdd} onGarmentDelete={handleGarmentDelete} onGarmentUpdate={() => {}} wardrobe={combinedWardrobe} activeGarmentIds={activeGarmentIds} isLoading={isLoading} />
          </>
        );
      default: return <main className="w-full min-h-screen flex items-center justify-center bg-gray-50 p-4"><AuthScreen onLoginSuccess={handleLoginSuccess} /></main>;
    }
  };

  return <div className="antialiased font-sans text-gray-800">{renderScreen()}</div>;
}

export default App;
