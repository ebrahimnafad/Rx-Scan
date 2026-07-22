// features/export-image/ui/ExportImageDialog.tsx
// Full-screen dialog: hidden capture container + preview + share/download buttons.

import { AnimatePresence, motion } from 'motion/react';
import { X, Download, Share, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/widgets/prescription-card';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import type { Prescription, Settings } from '@/entities/prescription/model/types';

interface ExportImageDialogProps {
  isOpen: boolean;
  isCapturing: boolean;
  imageUrl: string | null;
  error: string | null;
  captureRef: React.Ref<HTMLDivElement>;
  rx: Prescription | null | undefined;
  settings?: Settings;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRecapture: () => void;
}

const CARD_WIDTH = 280;
const WHITE_BORDER = '6px solid rgba(255,255,255,0.5)';

export function ExportImageDialog({
  isOpen,
  isCapturing,
  imageUrl,
  error,
  captureRef,
  rx,
  settings,
  onClose,
  onDownload,
  onShare,
  onRecapture,
}: ExportImageDialogProps) {
  return (
    <>
      {/* Hidden capture container — always rendered when rx exists, positioned off-screen */}
      {rx && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          <div
            ref={captureRef}
            style={{
              width: CARD_WIDTH,
              padding: 0,
              background: '#E8EDF2',
              border: WHITE_BORDER,
              borderRadius: 28,
              overflow: 'hidden',
            }}
          >
            {/* Front Face */}
            <div style={{ padding: '16px' }}>
              <Card
                variant="front"
                rx={rx}
                style={{ height: 'auto', border: 'none', boxShadow: 'none' }}
              />
            </div>

            {/* Dashed Divider */}
            <div
              style={{
                borderTop: '2px dashed #A0AEC0',
                margin: '0 20px',
              }}
            />

            {/* Back Face — hideHeader skips duplicate name/drug */}
            <div style={{ padding: '16px' }}>
              <Card
                variant="back"
                rx={rx}
                settings={settings}
                hideHeader
                style={{ height: 'auto', border: 'none', boxShadow: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Dialog Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-surface rounded-t-3xl sm:rounded-neu-lg shadow-neu-floating w-full max-w-sm flex flex-col"
              style={{
                maxHeight: 'min(85vh, 640px)',
                marginBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header — fixed */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <h2 className="text-base font-bold text-text-primary m-0">Export Card</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-surface shadow-neu-btn text-text-muted border-none cursor-pointer hover:shadow-neu-btn-pressed transition-shadow"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 min-h-0">
                <div
                  className="rounded-neu-md overflow-hidden shadow-neu-card mx-auto"
                  style={{ background: '#E8EDF2', maxWidth: 320 }}
                >
                  {isCapturing ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <Loader2 size={24} className="text-primary animate-spin" />
                      <span className="text-xs text-text-muted">Capturing…</span>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <span className="text-xs text-danger">{error}</span>
                      <NeumorphicButton onClick={onRecapture} variant="ghost" size="sm">
                        <RefreshCw size={14} /> Retry
                      </NeumorphicButton>
                    </div>
                  ) : imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Card preview"
                      className="w-full h-auto block"
                    />
                  ) : null}
                </div>
              </div>

              {/* Actions — fixed at bottom with nav clearance */}
              <div className="flex gap-2 px-5 pt-3 pb-28 sm:pb-5 shrink-0">
                <NeumorphicButton
                  onClick={onShare}
                  disabled={!imageUrl || isCapturing}
                  variant="primary"
                  size="md"
                  className="flex-1 justify-center"
                >
                  <Share size={15} /> Share
                </NeumorphicButton>
                <NeumorphicButton
                  onClick={onDownload}
                  disabled={!imageUrl || isCapturing}
                  variant="ghost"
                  size="md"
                  className="flex-1 justify-center"
                >
                  <Download size={15} /> Download
                </NeumorphicButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
