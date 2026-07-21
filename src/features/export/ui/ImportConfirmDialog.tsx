// features/export/ui/ImportConfirmDialog.tsx
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Download, X } from 'lucide-react';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { duration, ease } from '@/shared/config/motion-tokens';

interface ImportConfirmDialogProps {
  open: boolean;
  fileName: string;
  onConfirm: () => void;
  onExportFirst: () => void;
  onCancel: () => void;
}

export function ImportConfirmDialog({
  open,
  fileName,
  onConfirm,
  onExportFirst,
  onCancel,
}: ImportConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast / 1000 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          onClick={onCancel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: duration.normal / 1000, ease: ease.standard }}
            onClick={e => e.stopPropagation()}
            className="relative bg-surface rounded-neu-lg shadow-neu-floating p-6 w-full max-w-sm space-y-4"
          >
            {/* Close button */}
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 text-text-muted hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer p-1"
            >
              <X size={16} />
            </button>

            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-danger" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary m-0">
                  Import Backup
                </h3>
                <p className="text-xs text-text-secondary m-0 mt-0.5">
                  {fileName}
                </p>
              </div>
            </div>

            {/* Consequence message */}
            <p className="text-sm text-text-secondary leading-relaxed m-0">
              This will replace your current prescriptions and settings with the backup file.
              This action cannot be undone.
            </p>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <NeumorphicButton
                variant="ghost"
                className="w-full"
                onClick={onExportFirst}
              >
                <Download size={15} />
                Export current data first
              </NeumorphicButton>
              <NeumorphicButton
                variant="danger"
                className="w-full"
                onClick={onConfirm}
              >
                <AlertTriangle size={15} />
                Import anyway
              </NeumorphicButton>
            </div>

            {/* Cancel link */}
            <button
              onClick={onCancel}
              className="w-full text-center text-xs text-text-muted bg-transparent border-none cursor-pointer hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
