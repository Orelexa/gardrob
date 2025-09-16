/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { XIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';

interface DebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugModal: React.FC<DebugModalProps> = ({ isOpen, onClose }) => {
    const [storageData, setStorageData] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        if (isOpen) {
            try {
                const data = localStorage.getItem('virtual_try_on_users');
                const parsedData = data ? JSON.parse(data) : { message: "Nincs adat a helyi tárhelyen." };
                setStorageData(JSON.stringify(parsedData, null, 2));
            } catch (error) {
                setStorageData(`Hiba a helyi tárhely adatainak olvasása vagy feldolgozása közben: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }, [isOpen]);

    const handleCopy = () => {
        navigator.clipboard.writeText(storageData).then(() => {
            setCopySuccess('Sikeres másolás!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            setCopySuccess('A másolás nem sikerült.');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleClearStorage = () => {
        if (window.confirm("Biztosan törölni szeretnéd az összes felhasználói adatot? Ez a művelet nem vonható vissza, és az oldal újra fog töltődni.")) {
            localStorage.removeItem('virtual_try_on_users');
            window.location.reload();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative bg-gray-800 text-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-600">
                            <h2 className="text-xl font-mono tracking-wider">Helyi Tárhely Adatok</h2>
                            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white">
                                <XIcon className="w-6 h-6"/>
                            </button>
                        </div>
                        <div className="p-4 overflow-auto">
                            <pre className="text-xs bg-gray-900 p-4 rounded-md whitespace-pre-wrap break-all">
                                <code>{storageData}</code>
                            </pre>
                        </div>
                        <div className="p-4 mt-auto border-t border-gray-600 flex flex-wrap gap-3 justify-end">
                            {copySuccess && <span className="text-sm text-green-400 self-center mr-auto">{copySuccess}</span>}
                            <button onClick={handleCopy} className="px-4 py-2 text-sm font-semibold text-white bg-gray-600 hover:bg-gray-500 rounded-md">Adatok másolása</button>
                            <button onClick={handleClearStorage} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md">Minden adat törlése</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DebugModal;