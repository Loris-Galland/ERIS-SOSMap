/*
 * Reusable modal dialog component for the ERIS app.
 * Exports AlertModal (default) and the AlertType union type.
 * Supports three modes: simple alert (info/danger/success), confirmation dialog,
 * and prompt (text input). Keyboard shortcuts (Escape, Enter) are handled internally.
 * Used throughout the app wherever user feedback or destructive-action confirmation is needed.
 */

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
      iconBg: 'bg-eris-primary/10 text-eris-primary',
      btnBg: 'bg-eris-primary hover:bg-eris-primary shadow-eris-primary/20',
      defaultConfirmText: 'OK',
    },
    danger: {
      icon: 'warning',
      iconBg: 'bg-eris-danger/10 text-eris-danger',
      btnBg: 'bg-eris-danger hover:bg-eris-danger shadow-eris-danger/20',
      defaultConfirmText: 'Supprimer',
    },
    success: {
      icon: 'check_circle',
      iconBg: 'bg-eris-success/10 text-eris-success',
      btnBg: 'bg-eris-success hover:bg-eris-success shadow-eris-success/20',
      defaultConfirmText: 'Continuer',
    },
  }[type];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-eris-bg/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
      ></div>

      <div className="relative bg-eris-surface border border-eris-border/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${theme.iconBg}`}>
            <span className="material-symbols-outlined text-3xl">{theme.icon}</span>
          </div>
          <h3 className="text-eris-text text-lg font-bold mb-2 tracking-wide">{title}</h3>
          <p className="text-eris-text-muted text-sm leading-relaxed">{message}</p>

          {/* NOUVEAU : Champ de texte si isPrompt est true */}
          {isPrompt && (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-4 w-full bg-eris-surface-alt/80 border border-eris-border rounded-xl px-4 py-3 text-eris-text text-sm outline-none focus:border-eris-primary transition-colors text-center"
              autoFocus
            />
          )}
        </div>

        <div className="flex gap-3 w-full">
          {(isConfirm || isPrompt) && (
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-eris-surface-alt border border-eris-border text-eris-text rounded-2xl text-sm font-bold hover:bg-gray-700 transition-colors active:scale-95"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm(inputValue);
              if (!isConfirm && !isPrompt) onCancel();
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg text-eris-text ${theme.btnBg}`}
          >
            {confirmText || theme.defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
