import { useState, useRef, useCallback } from 'react';

export type RecordingMode = 'photo' | 'video';

interface UseRecordingOptions {
  maxDuration?: number;
  onMaxDurationReached?: () => void;
}

interface UseRecordingReturn {
  isRecording: boolean;
  recordingTime: number;
  recordingProgress: number;
  recordingMode: RecordingMode;
  maxDuration: number;
  capturedMedia: Blob | null;
  mediaUrl: string;
  startRecording: (stream: MediaStream) => void;
  stopRecording: () => void;
  takePhoto: (videoElement: HTMLVideoElement) => void;
  setRecordingMode: (mode: RecordingMode) => void;
  setMaxDuration: (duration: number) => void;
  resetMedia: () => void;
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const { maxDuration: initialMaxDuration = 60, onMaxDurationReached } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('video');
  const [maxDuration, setMaxDuration] = useState(initialMaxDuration);
  const [capturedMedia, setCapturedMedia] = useState<Blob | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetMedia = useCallback(() => {
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
    }
    setCapturedMedia(null);
    setMediaUrl('');
    setRecordingTime(0);
    setRecordingProgress(0);
  }, [mediaUrl]);

  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) return;
    
    console.log('Starting recording...');
    
    // Try to use a supported MIME type for video recording
    const options: MediaRecorderOptions = {};
    const supportedTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8', 
      'video/webm',
      'video/mp4'
    ];
    
    for (const mimeType of supportedTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType;
        console.log('🎥 Using MIME type:', mimeType);
        break;
      }
    }
    
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    
    intervalRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        setRecordingProgress((newTime / maxDuration) * 100);
        
        // Auto-stop when max duration reached
        if (newTime >= maxDuration) {
          stopRecording();
          onMaxDurationReached?.();
        }
        
        return newTime;
      });
    }, 1000);
  }, [maxDuration, onMaxDurationReached]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setCapturedMedia(event.data);
          setMediaUrl(URL.createObjectURL(event.data));
        }
      };
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingProgress(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, []);

  const takePhoto = useCallback((videoElement: HTMLVideoElement) => {
    if (!videoElement) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          setCapturedMedia(blob);
          setMediaUrl(URL.createObjectURL(blob));
          console.log('Photo taken');
        }
      }, 'image/jpeg', 0.9);
    }
  }, []);

  return {
    isRecording,
    recordingTime,
    recordingProgress,
    recordingMode,
    maxDuration,
    capturedMedia,
    mediaUrl,
    startRecording,
    stopRecording,
    takePhoto,
    setRecordingMode,
    setMaxDuration,
    resetMedia
  };
}