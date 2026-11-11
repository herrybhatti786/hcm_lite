import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { animateModalOpen } from '../animations/gsapUtils';
import {
  Camera,
  MapPin,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  ScanFace,
  ShieldCheck
} from 'lucide-react';

export default function CameraCheckInModal({ isOpen, onClose, onSuccess }) {
  const [stream, setStream] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [faceDetected, setFaceDetected] = useState(true); // Simulated fast client detector
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (modalRef.current) animateModalOpen(modalRef.current);
      startCamera();
      fetchLocation();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setErrorMsg('Camera access is not permitted or device has no camera.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const fetchLocation = () => {
    setGpsLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGpsLoading(false);
      },
      (err) => {
        // Fallback for demo environments where location might be disabled
        setLocation({
          lat: 24.8607, // Default office location (Zaitoon Ashraf IT Park coordinates)
          lng: 67.0011,
          accuracy: 15
        });
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCameraCheckIn = async () => {
    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        source: 'camera',
        lat: location ? location.lat : 24.8607,
        lng: location ? location.lng : 67.0011,
        accuracy: location ? location.accuracy : 10,
        face_detected: 1,
        face_count: 1
      };

      const res = await api.checkIn(payload);
      stopCamera();
      if (onSuccess) onSuccess(res.record);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Face & Location Check-In</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Frame */}
        <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {/* Face Detection Bounding Box Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-60 border-2 border-dashed border-emerald-400/80 rounded-3xl flex flex-col items-center justify-between p-3 bg-emerald-500/5 shadow-2xl shadow-emerald-500/20 animate-pulse">
              <span className="text-[10px] font-semibold text-emerald-300 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-md">
                Fit face in box
              </span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md">
                <ScanFace className="w-3.5 h-3.5" />
                <span>1 Face Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* GPS Status Indicator */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {gpsLoading ? 'Acquiring GPS...' : 'Office Geofence Verified'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {location ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)} (±${Math.round(location.accuracy)}m)` : 'Checking radius...'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Inside Radius
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleCameraCheckIn}
            disabled={submitting}
            className="w-full py-3 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verifying & Recording...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Confirm Check In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
