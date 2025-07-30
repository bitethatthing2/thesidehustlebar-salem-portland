# PostCreator Camera Implementation Guide

## ⚠️ CRITICAL: Do NOT modify camera logic without reading this guide

The camera implementation in `PostCreator.tsx` is working correctly after fixing several critical timing and state management issues. This guide documents the working implementation to prevent future regressions.

## Key Working Principles

### 1. Camera Initialization Flow
```
isOpen=true → useEffect triggers → startCamera() → getUserMedia → stream assigned → video element receives stream
```

**CRITICAL:** Camera starts immediately when `isOpen=true`, NOT when video element is ready. This prevents race conditions.

### 2. State Management
- `cameraStatus`: 'idle' | 'loading' | 'ready' | 'error'
- `hasStream`: boolean (true when stream is active)
- `errorMessage`: string (specific error descriptions)

### 3. Video Element Ref Management
```typescript
const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
  videoRef.current = element;
  
  // Only apply existing stream, don't start camera here
  if (element && streamRef.current) {
    element.srcObject = streamRef.current;
    setHasStream(true);
    setCameraStatus('ready');
  }
}, []); // No dependencies - prevents circular calls
```

## Common Pitfalls to Avoid

### ❌ DON'T: Start camera in setVideoRef callback
```typescript
// BAD - causes race conditions
const setVideoRef = useCallback((element) => {
  if (element && isOpen) {
    startCamera(); // DON'T DO THIS
  }
}, [isOpen]); // Creates circular dependency
```

### ❌ DON'T: Wait for video element before starting camera
```typescript
// BAD - causes timing issues
useEffect(() => {
  if (isOpen && videoRef.current) { // DON'T CHECK videoRef.current
    startCamera();
  }
}, [isOpen]);
```

### ❌ DON'T: Use generic error handling
```typescript
// BAD - doesn't help users
catch (error) {
  console.error('Camera failed'); // Too generic
}
```

## Error Handling Requirements

Always handle these specific `getUserMedia` errors:

1. **NotAllowedError**: Permission denied
2. **NotFoundError**: No camera hardware
3. **NotReadableError**: Camera in use by another app
4. **OverconstrainedError**: Constraints can't be satisfied

## UI States

1. **idle**: Initial state, shows "Camera not ready"
2. **loading**: Shows spinner, "Starting camera..."
3. **ready**: Shows video stream
4. **error**: Shows specific error message with retry button

## Testing Checklist

Before making camera changes, test:

- [ ] Camera starts when component opens
- [ ] Camera stops when component closes
- [ ] Error handling for denied permissions
- [ ] Error handling for camera in use
- [ ] Loading state appears briefly
- [ ] Manual retry button works
- [ ] Video stream appears correctly
- [ ] Component cleanup on unmount

## File Location
`components/wolfpack/PostCreator.tsx`

## Last Working Version
Fixed on: 2025-07-19
Key fixes: Timing issues, error handling, state management

---

**Remember: If camera breaks again, the issue is likely timing/state related, not permissions.**