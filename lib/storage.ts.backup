/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { UserModel, WardrobeItem } from '../types';
import { defaultWardrobe } from '../wardrobe';

const USERS_KEY = 'virtual_try_on_users';

interface UserData {
  passwordHash: string;
  models: UserModel[];
  wardrobe: WardrobeItem[];
  hiddenDefaultGarments?: string[];
}

type UserStore = Record<string, UserData>;

// Helper to hash password with SHA-256 using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const getUsers = (): UserStore => {
  try {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
  } catch (e) {
    console.error("Failed to parse users from localStorage", e);
    return {};
  }
};

const saveUsers = (users: UserStore) => {
    const dataToSave = JSON.stringify(users);
    try {
        localStorage.setItem(USERS_KEY, dataToSave);
        
        // Verification: Immediately read back and compare to ensure the write was successful.
        // This catches silent failures, e.g., in private browsing or due to extensions.
        const dataFromStorage = localStorage.getItem(USERS_KEY);
        if (dataFromStorage !== dataToSave) {
            throw new Error("A mentés utáni ellenőrzés sikertelen. Az adatok nem íródtak ki helyesen a tárhelyre. Ez előfordulhat privát böngészőmódban vagy egy bővítmény miatt.");
        }
    } catch (e) {
        console.error("Failed to save users to localStorage", e);
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            throw new Error("A böngésző tárhelye megtelt. A mentés sikertelen. Próbálj meg helyet felszabadítani a régebbi szettek vagy egyéni ruhadarabok törlésével.");
        }
         if (e instanceof Error) {
            // Re-throw custom verification error or a generic one
            throw e;
        }
        throw new Error("Hiba történt a helyi tárhelyre való mentés során. Lehetséges, hogy egy böngészőbővítmény blokkolja a műveletet.");
    }
};

export const signup = async (username: string, password: string): Promise<boolean> => {
  const users = getUsers();
  if (users[username]) {
    return false; // User already exists
  }
  const passwordHash = await hashPassword(password);
  users[username] = { passwordHash, models: [], wardrobe: [] };
  saveUsers(users);
  return true;
};

export const login = async (username: string, password: string): Promise<boolean> => {
  const users = getUsers();
  const user = users[username];
  if (!user) {
    return false;
  }
  const passwordHash = await hashPassword(password);
  return user.passwordHash === passwordHash;
};

// Model Management
export const getModelsForUser = (username: string): UserModel[] => {
  const users = getUsers();
  return users[username]?.models || [];
};

export const saveModelForUser = (username:string, modelData: { name: string; imageUrl: string; }): UserModel => {
    const users = getUsers();
    if (!users[username]) {
        throw new Error("User not found");
    }
    const newModel: UserModel = {
        ...modelData,
        id: `model-${Date.now()}`
    };
    users[username].models.push(newModel);
    saveUsers(users);
    return newModel;
};

export const deleteModelForUser = (username: string, modelId: string): void => {
    const users = getUsers();
    if (users[username]) {
        users[username].models = users[username].models.filter(m => m.id !== modelId);
        saveUsers(users);
    }
};


// Wardrobe Management
export const getWardrobeForUser = (username: string): WardrobeItem[] => {
    const users = getUsers();
    return users[username]?.wardrobe || [];
};

export const saveGarmentForUser = (username: string, garment: WardrobeItem): void => {
    const users = getUsers();
    if (users[username]) {
        // Add to the beginning of the array
        users[username].wardrobe = [garment, ...users[username].wardrobe];
        saveUsers(users);
    } else {
        throw new Error("User not found while trying to save garment.");
    }
};

export const updateGarmentForUser = (username: string, updatedGarment: WardrobeItem): void => {
    const users = getUsers();
    if (users[username]) {
        const index = users[username].wardrobe.findIndex(g => g.id === updatedGarment.id);
        if (index !== -1) {
            users[username].wardrobe[index] = updatedGarment;
            saveUsers(users);
        }
    }
};

export const deleteGarmentForUser = (username: string, garmentId: string): void => {
    const users = getUsers();
    if (users[username]) {
        const isDefault = defaultWardrobe.some(g => g.id === garmentId);
        if (isDefault) {
            if (!users[username].hiddenDefaultGarments) {
                users[username].hiddenDefaultGarments = [];
            }
            const hidden = users[username].hiddenDefaultGarments!;
            if (!hidden.includes(garmentId)) {
                hidden.push(garmentId);
            }
        } else {
            users[username].wardrobe = users[username].wardrobe.filter(g => g.id !== garmentId);
        }
        saveUsers(users);
    }
};

export const getHiddenDefaultGarmentsForUser = (username: string): string[] => {
    const users = getUsers();
    return users[username]?.hiddenDefaultGarments || [];
};