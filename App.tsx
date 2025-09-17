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
        poseImages: { [POSE_INSTRUCTIONS[0]]: selectedModel.
