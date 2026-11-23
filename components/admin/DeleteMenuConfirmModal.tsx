'use client';

import React from 'react';
import { AlertTriangle, Trash2, X, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface AffectedCombo {
  id: string;
  name: string;
  outlet_name?: string;
}

interface DeleteMenuConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  itemName: string;
  itemType: 'item' | 'combo';
  scope: 'all' | 'single';
  outletsCount?: number;
  outletName?: string;
  affectedCombos?: AffectedCombo[];
}

export function DeleteMenuConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  itemName,
  itemType,
  scope,
  outletsCount = 1,
  outletName,
  affectedCombos = [],
}: DeleteMenuConfirmModalProps) {
  if (!isOpen) return null;

  const hasCombos = affectedCombos.length > 0;

  // Exact confirmation prompt phrasing
  const confirmationPrompt =
    scope === 'all'
      ? `Delete ${itemName} from all ${outletsCount} outlets? This cannot be undone.`
      : `Delete ${itemName} from ${outletName || 'this outlet'}? This cannot be undone.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 overflow-hidden">
        {/* Top Warning Icon Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-brandRed/10 border border-brandRed/20 flex items-center justify-center text-brandRed shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 rounded-xl text-espresso/40 hover:text-espresso hover:bg-sand/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="font-display font-black text-lg text-espresso tracking-tight">
              Delete {itemType === 'combo' ? 'Combo' : 'Menu Item'}
            </h3>
            <p className="text-sm font-semibold text-espresso/80 mt-1.5 leading-relaxed">
              {confirmationPrompt}
            </p>
          </div>

          {/* Warning banner if item is used inside combos */}
          {hasCombos && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-espresso space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Included in Combos</span>
              </div>
              <p className="text-xs text-espresso/80 font-medium">
                Combos require a 2-item minimum. Deleting this item will also delete the following{' '}
                <strong>{affectedCombos.length}</strong> combo
                {affectedCombos.length === 1 ? '' : 's'}:
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                {affectedCombos.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-card border border-border/80 font-bold"
                  >
                    <span className="text-espresso truncate">{c.name}</span>
                    {c.outlet_name && (
                      <span className="text-[10px] font-extrabold text-espresso/60 bg-sand/60 px-2 py-0.5 rounded-full ml-2 shrink-0">
                        {c.outlet_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="h-10 px-4 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="h-10 px-5 rounded-xl text-xs font-bold bg-brandRed hover:bg-brandRed/90 text-white shadow-xs"
            >
              {isDeleting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
                </div>
              ) : hasCombos ? (
                `Delete Item & ${affectedCombos.length} Combo${affectedCombos.length === 1 ? '' : 's'}`
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
