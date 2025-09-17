/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
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
      const loadUserData = async () => {
        try {
          setIsLoading(true);
          setLoadingMessage('Felhasználói adatok betöltése...');
          const [wardrobe, hidden] = await Promise.all([
            storage.getWardrobeForUser(currentUser),
            storage.getHiddenDefaultGarmentsForUser(currentUser)
          ]);
          setUserWardrobe(wardrobe);
          setHiddenGarments(hidden);
        } catch (error) {
          console.error('Hiba a felhasználói adatok betöltése során:', error);
          alert(getFriendlyErrorMessage(error, 'Nem sikerült betölteni a felhasználói adatokat'));
          setUserWardrobe([]);
          setHiddenGarments([]);
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
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

  const handleCreateModel = () => {
    setScreen(SCREENS.CREATE_MODEL);
  };

  const handleModelFinalized = async (name: string, imageUrl: string) => {
    if (currentUser) {
      try {
        setIsLoading(true);
        setLoadingMessage('Modell mentése...');
        const newModel = await storage.saveModelForUser(currentUser, { name, imageUrl });
        setSelectedModel(newModel);
        setScreen(SCREENS.DRESSING_ROOM);
      } catch (error) {
        console.error('Hiba a modell mentése során:', error);
        alert(getFriendlyErrorMessage(error, 'Nem sikerült menteni a modellt'));
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    }
  };

  const handleStartOver = () => {
    setSelectedModel(null);
    setOutfitHistory([]);
    setScreen(SCREENS.MODEL_SELECTION);
  };

  // VÉGLEGES JAVÍTÁS: A függvény most már helyesen csak egy WardrobeItem-et fogad,
  // és annak az `url` tulajdonságát adja tovább.
  const handleGarmentSelectForTryOn = (garment: WardrobeItem) => {
    setIsWardrobeOpen(false);
    if (!selectedModel || outfitHistory.length === 0) return;

    setIsLoading(true);
    setLoadingMessage(`A(z) "${garment.name}" ruhadarab felpróbálása...`);

    const lastLayer = outfitHistory[outfitHistory.length - 1];
    const baseImageUrl = lastLayer.poseImages[POSE_INSTRUCTIONS[0]];

    if (!baseImageUrl) {
      alert("Az előző réteg alapképe nem található. A folyamat alaphelyzetbe áll.");
      setIsLoading(false);
      resetDressingRoom();
      return;
    }

    generateVirtualTryOnImage(baseImageUrl, garment.url)
      .then(newImageUrl => {
        const newLayer: OutfitLayer = {
          garment: garment,
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
      setIsLoading(true);
      setLoadingMessage('Ruhadarab mentése...');
      // A kép feltöltése és URL lekérése
      const newGarment = await storage.uploadGarment(currentUser, garmentFile, category);
      setUserWardrobe(prev => [newGarment, ...prev]);
    } catch (error) {
      console.error('Hiba a ruhadarab mentése során:', error);
      alert(getFriendlyErrorMessage(error, "Nem sikerült a ruhadarabot menteni"));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleGarmentUpdate = async (updatedGarment: WardrobeItem) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Ruhadarab frissítése...');
      await storage.updateGarmentForUser(currentUser, updatedGarment);
      setUserWardrobe(prev => prev.map(g => g.id === updatedGarment.id ? updatedGarment : g));
    } catch (error) {
      console.error('Hiba a ruhadarab frissítése során:', error);
      alert(getFriendlyErrorMessage(error, 'Nem sikerült frissíteni a ruhadarabot'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleGarmentDelete = async (garmentId: string) => {
    if (!currentUser) return;
    try {
      setIsLoading(true);
      setLoadingMessage('Ruhadarab törlése...');
      await storage.deleteGarmentForUser(currentUser, garmentId);
      const isDefault = defaultWardrobe.some(g => g.id === garmentId);
      if (isDefault) {
        setHiddenGarments(prev => [...prev, garmentId]);
      } else {
        setUserWardrobe(prev => prev.filter(g => g.id !== garmentId));
      }
    } catch (error) {
      console.error('Hiba a ruhadarab törlése során:', error);
      alert(getFriendlyErrorMessage(error, 'Nem sikerült törölni a ruhadarabot'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleRemoveLastGarment =
