/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Trash2, X, Archive } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getColors = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-500/10 text-rose-500 border border-rose-550/20',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500',
          icon: <Trash2 className="h-5 w-5" />,
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/10 text-amber-505 border border-amber-500/20',
          confirmBtn: 'bg-amber-500 hover:bg-amber-400 text-black focus:ring-amber-500',
          icon: <AlertTriangle className="h-5 w-5" />,
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
          confirmBtn: 'bg-zinc-805 hover:bg-zinc-750 text-white focus:ring-[#333333]',
          icon: <Archive className="h-5 w-5" />,
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
      />

      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div className="relative transform overflow-hidden rounded-xl bg-[#111111] border border-zinc-800 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md animate-in fade-in zoom-in-95 duration-200">
          
          {/* Top header line / close button */}
          <div className="absolute right-4 top-4">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-zinc-900 text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl shrink-0 ${colors.iconBg}`}>
                {colors.icon}
              </div>
              
              <div className="flex-1 mt-1">
                <h3 className="text-sm font-bold font-sans text-zinc-200 uppercase tracking-wide">
                  {title}
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-sans">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Actions panel */}
          <div className="bg-[#161618] border-t border-zinc-805 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold font-sans uppercase rounded-lg border border-zinc-800 bg-[#1A1A1D] hover:bg-zinc-800 text-zinc-300 transition cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
              }}
              className={`w-full sm:w-auto px-4 py-2 text-xs font-bold font-sans uppercase rounded-lg transition shadow cursor-pointer ${colors.confirmBtn}`}
            >
              {confirmLabel}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
