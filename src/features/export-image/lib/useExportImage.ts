// features/export-image/lib/useExportImage.ts
// Captures both faces of a prescription card as a single PNG image.
// Supports Web Share API (mobile) and file download (desktop fallback).

import { useState, useRef, useCallback, useEffect } from 'react';
import { toPng } from 'html-to-image';
import type { Prescription, Settings } from '@/entities/prescription/model/types';

const CAPTURE_WIDTH = 280;
const CAPTURE_SCALE = 2;

export function useExportImage(rx: Prescription | null | undefined, settings?: Settings) {
  const [isOpen, setIsOpen]          = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [imageUrl, setImageUrl]      = useState<string | null>(null);
  const [error, setError]            = useState<string | null>(null);
  const captureRef                   = useRef<HTMLDivElement>(null);
  const captureFnRef                 = useRef<() => void>(() => {});

  // Keep a stable ref to capture() so callbacks don't go stale
  async function capture() {
    if (!captureRef.current) return;
    setIsCapturing(true);
    setError(null);
    try {
      const dataUrl = await toPng(captureRef.current, {
        width: CAPTURE_WIDTH,
        pixelRatio: CAPTURE_SCALE,
        backgroundColor: '#E8EDF2',
        cacheBust: true,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
        },
      });
      setImageUrl(dataUrl);
    } catch (err) {
      console.error('Export image capture failed:', err);
      setError('Failed to capture image. Try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  // Store latest capture in ref so openDialog doesn't go stale
  useEffect(() => { captureFnRef.current = capture; });

  // Trigger capture when dialog opens (after DOM paints)
  useEffect(() => {
    if (!isOpen || !rx) return;
    const id = requestAnimationFrame(() => {
      captureFnRef.current();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, rx]);

  const openDialog = useCallback(() => {
    if (!rx) return;
    setImageUrl(null);
    setError(null);
    setIsOpen(true);
  }, [rx]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setImageUrl(null);
    setError(null);
  }, []);

  function download() {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `rxscan-${rx?.reference_number ?? 'card'}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }

  async function share() {
    if (!imageUrl || !rx) return;
    if (navigator.share && navigator.canShare) {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `rxscan-${rx.reference_number}.png`, { type: 'image/png' });
        const shareData = { title: `RxScan — ${rx.loyalty_name ?? rx.reference_number}`, files: [file] };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') download();
        return;
      }
    }
    download();
  }

  return {
    isOpen,
    isCapturing,
    imageUrl,
    error,
    captureRef,
    rx,
    settings,
    openDialog,
    closeDialog,
    download,
    share,
    recapture: capture,
  };
}
