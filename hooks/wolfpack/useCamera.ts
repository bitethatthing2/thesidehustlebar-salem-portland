import { useState, useRef, useCallback, useEffect } from 'react';

export type CameraStatus = 'idle' | 'loading' | 'ready' | 'error';
export type FacingMode = 'user' | 'environment';

interface UseCameraOptions {
  facingMode?: FacingMode;
  audio?: boolean;
}

interface UseCameraReturn {
  streamRef: React.MutableRefObject<MediaStream | null>;
  hasStream: boolean;
  cameraStatus: CameraStatus;
  errorMessage: string;
  facingMode: FacingMode;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode: initialFacingMode = 'user', audio = true } = options;
  
  const [hasStream, setHasStream] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<FacingMode>(initialFacingMode);
  
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      console.log('=== STARTING CAMERA ===');
      setCameraStatus('loading');
      setErrorMessage('');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio
      });
      
      console.log('✅ Got camera stream:', stream);
      streamRef.current = stream;
      setHasStream(true);
      setCameraStatus('ready');
      console.log('✅ Camera setup complete!');
    } catch (error) {
      console.error('❌ Camera failed:', error);
      setHasStream(false);
      setCameraStatus('error');
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            setErrorMessage('Camera access denied. Please enable camera permissions in your browser settings.');
            break;
          case 'NotFoundError':
            setErrorMessage('No camera found. Please ensure your camera is connected and enabled.');
            break;
          case 'NotReadableError':
            setErrorMessage('Camera is in use by another application. Please close other apps using the camera.');
            break;
          case 'OverconstrainedError':
            setErrorMessage('Camera constraints could not be satisfied. Try adjusting video settings.');
            break;
          default:
            setErrorMessage(`Camera error: ${error.message}`);
        }
      } else {
        setErrorMessage('An unexpected error occurred while starting camera.');
      }
    }
  }, [facingMode, audio]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setHasStream(false);
    setCameraStatus('idle');
    setErrorMessage('');
  }, []);

  const switchCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    // Stop current stream and restart with new facing mode
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setCameraStatus('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio
      });
      
      streamRef.current = stream;
      setHasStream(true);
      setCameraStatus('ready');
    } catch (error) {
      console.error('Camera switch failed:', error);
      setCameraStatus('error');
      setErrorMessage('Failed to switch camera');
    }
  }, [facingMode, audio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    streamRef,
    hasStream,
    cameraStatus,
    errorMessage,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera
  };
}