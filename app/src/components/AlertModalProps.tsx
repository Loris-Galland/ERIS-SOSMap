import { useEffect, useState } from 'react';

export type AlertType = 'info' | 'danger' | 'success';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: AlertType;
  isConfirm?: boolean;
  isPrompt?: boolean;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export default function AlertModal({
  isOpen,
  title,
  message,
  type = 'info',
  isConfirm = false,
  isPrompt = false,
  defaultValue = '',
  confirmText,
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
}: AlertModalProps) {
  // État interne pour gérer la saisie de texte du prompt
  const [inputValue, setInputValue] = useState(defaultValue);

  // Mettre à jour l'input interne si la defaultValue change
  useEffect(() => {
    if (isOpen) setInputValue(defaultValue);
  }, [isOpen, defaultValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
      if (e.key === 'Enter' && isOpen && !isConfirm) onConfirm(inputValue);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, inputValue, isConfirm]);

  if (!isOpen) return null;

  const theme = {
    info: {
      icon: 'info',
      iconBg: 'bg-blue-500/10 text-blue-400',
      btnBg: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
      defaultConfirmText: 'OK',
    },
    danger: {
      icon: 'warning',
      iconBg: 'bg-red-500/10 text-red-500',
      btnBg: 'bg-red-600 hover:bg-red-500 shadow-red-900/20',
      defaultConfirmText: 'Supprimer',
    },
    success: {
      icon: 'check_circle',
      iconBg: 'bg-green-500/10 text-green-400',
      btnBg: 'bg-green-600 hover:bg-green-500 shadow-green-900/20',
      defaultConfirmText: 'Continuer',
    },
  }[type];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0f141e]/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
      ></div>

      <div className="relative bg-gray-900 border border-gray-700/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${theme.iconBg}`}>
            <span className="material-symbols-outlined text-3xl">{theme.icon}</span>
          </div>
          <h3 className="text-white text-lg font-bold mb-2 tracking-wide">{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{message}</p>

          {/* NOUVEAU : Champ de texte si isPrompt est true */}
          {isPrompt && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-4 w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors text-center"
              autoFocus
            />
          )}
        </div>

        <div className="flex gap-3 w-full">
          {(isConfirm || isPrompt) && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-gray-800 border border-gray-700 text-white rounded-2xl text-sm font-bold hover:bg-gray-700 transition-colors active:scale-95"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm(inputValue);
              if (!isConfirm && !isPrompt) onCancel();
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg text-white ${theme.btnBg}`}
          >
            {confirmText || theme.defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
