import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Camera, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (qrData: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScan
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
      setHasScanned(false);
      setCameraError(null);
      return;
    }

    let isMounted = true;

    const initScanner = async () => {
      setCameraError(null);
      setHasScanned(false);

      const hasCamera = await QrScanner.hasCamera();
      if (!isMounted) return;

      if (!hasCamera) {
        setCameraError('No camera detected on this device. Please use manual code entry.');
        return;
      }

      if (videoRef.current) {
        try {
          const scanner = new QrScanner(
            videoRef.current,
            (result) => {
              if (isMounted && !hasScanned) {
                setHasScanned(true);
                scanner.stop();
                onScan(result.data);
              }
            },
            {
              returnDetailedScanResult: true,
              highlightScanRegion: true,
              highlightCodeOutline: true,
              preferredCamera: 'environment'
            }
          );

          scannerRef.current = scanner;
          await scanner.start();
        } catch (err: any) {
          if (!isMounted) return;
          console.error('Camera initialization error:', err);
          if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
            setCameraError('Camera access was denied. Please grant camera permissions in your browser or use manual verification.');
          } else {
            setCameraError('Unable to start camera stream. Please use manual code entry.');
          }
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Scan Officer QR Code</h3>
              <p className="text-[11px] text-slate-400">Point your camera at the official TrustGov badge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Video Area */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
              <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
              >
                Use Manual Code Entry
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Scanning Target Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-cyan-400/80 rounded-2xl relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br" />
                </div>
              </div>

              {hasScanned && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-2 text-emerald-400">
                  <CheckCircle2 className="h-10 w-10 animate-bounce" />
                  <span className="text-xs font-bold font-mono">QR Code Detected!</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Note */}
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            The QR code contains a secure TrustGov verification reference (<span className="font-mono text-cyan-300">TRUSTGOV://verify/...</span>). It never contains passwords or private keys.
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
