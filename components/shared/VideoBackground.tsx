"use client";

import React, { useEffect, useRef } from 'react';
import Script from 'next/script';

interface VideoBackgroundProps {
  wolfpack_videosrc?: string;
  instagramReelUrl?: string;
  posterSrc?: string;
  className?: string;
  overlay?: boolean;
  overlayOpacity?: number;
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  wolfpack_videosrc,
  instagramReelUrl,
  posterSrc,
  className = '',
  overlay = true,
  overlayOpacity = 0.4
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wolfpack_videosrc && videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.log('Video autoplay failed:', error);
      });
    }
  }, [wolfpack_videosrc]);

  useEffect(() => {
    if (instagramReelUrl && containerRef.current && window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [instagramReelUrl]);

  if (instagramReelUrl) {
    return (
      <>
        <Script 
          src="//www.instagram.com/embed.js" 
          strategy="lazyOnload"
          onLoad={() => {
            if (window.instgrm) {
              window.instgrm.Embeds.process();
            }
          }}
        />
        <div className={`relative w-full h-full overflow-hidden ${className}`} ref={containerRef}>
          <div className="absolute inset-0 scale-150 translate-y-[-10%]">
            <blockquote 
              className="instagram-media" 
              data-instgrm-captioned 
              data-instgrm-permalink={instagramReelUrl}
              data-instgrm-version="14" 
              style={{ 
                background: '#000',
                border: '0',
                borderRadius: '0',
                boxShadow: 'none',
                margin: '0',
                width: '100%',
                height: '100vh',
                minWidth: '100%',
                maxWidth: '100%'
              }}
            />
          </div>
          {overlay && (
            <div 
              className="absolute inset-0 bg-black pointer-events-none" 
              style={{ opacity: overlayOpacity }}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={wolfpack_videosrc}
        poster={posterSrc}
        muted
        loop
        playsInline
        autoPlay
      />
      {overlay && (
        <div 
          className="absolute inset-0 bg-black" 
          style={{ opacity: overlayOpacity }}
        />
      )}
    </div>
  );
};