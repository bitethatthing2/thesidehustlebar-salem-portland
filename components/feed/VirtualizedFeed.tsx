/**
 * Virtualized Wolf Pack Feed Component
 * High-performance virtual scrolling feed that can handle thousands of videos
 * with smooth scrolling and minimal DOM manipulation
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useOptimizedFeed, type OptimizedVideoItem } from '@/lib/hooks/useOptimizedFeed';
import { VideoCard } from './VideoCard';
import { FeedSkeleton } from './FeedSkeleton';

interface VirtualizedFeedProps {
  className?: string;
  itemHeight?: number;
  overscan?: number; // Number of items to render outside visible area
  onVideoSelect?: (video: OptimizedVideoItem) => void;
  showDebugInfo?: boolean;
}

export function VirtualizedFeed({
  className = '',
  itemHeight = 600, // Estimated height per video card
  overscan = 5,
  onVideoSelect,
  showDebugInfo = false
}: VirtualizedFeedProps) {
  
  const {
    videos,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refreshFeed,
    updateVideoStats,
    totalCount,
    cacheStats
  } = useOptimizedFeed({
    pageSize: 20,
    prefetchPages: 2,
    enableVirtualization: true
  });

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const loadMoreTriggeredRef = useRef(false);

  // Calculate visible range based on scroll position
  const visibleRange = useMemo(() => {
    if (!containerHeight || !itemHeight) {
      return { start: 0, end: Math.min(10, videos.length) };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(videos.length, start + visibleCount + overscan * 2);

    return { start, end };
  }, [scrollTop, containerHeight, itemHeight, overscan, videos.length]);

  // Get visible videos
  const visibleVideos = useMemo(() => {
    return videos.slice(visibleRange.start, visibleRange.end);
  }, [videos, visibleRange.start, visibleRange.end]);

  // Handle scroll events with throttling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    
    setScrollTop(newScrollTop);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounced load more check
    scrollTimeoutRef.current = setTimeout(() => {
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      const scrollBottom = newScrollTop + clientHeight;
      const threshold = scrollHeight - clientHeight * 0.5; // Load when 50% from bottom

      if (scrollBottom >= threshold && hasMore && !loadingMore && !loadMoreTriggeredRef.current) {
        loadMoreTriggeredRef.current = true;
        loadMore().finally(() => {
          loadMoreTriggeredRef.current = false;
        });
      }
    }, 100);
  }, [hasMore, loadingMore, loadMore]);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    
    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refreshFeed();
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [refreshFeed]);

  // Handle video interactions
  const handleLike = useCallback(async (videoId: string, isLiked: boolean) => {
    // Optimistic update
    updateVideoStats(videoId, {
      is_liked: isLiked,
      likes_count: videos.find(v => v.id === videoId)?.likes_count + (isLiked ? 1 : -1) || 0
    });

    // TODO: Make API call to actually like/unlike
  }, [updateVideoStats, videos]);

  const handleComment = useCallback((videoId: string) => {
    const video = videos.find(v => v.id === videoId);
    if (video && onVideoSelect) {
      onVideoSelect(video);
    }
  }, [videos, onVideoSelect]);

  if (loading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="text-6xl mb-4">🐺</div>
        <h2 className="text-xl font-bold text-white mb-2">Feed Error</h2>
        <p className="text-gray-400 text-center mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalHeight = videos.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Debug Info */}
      {showDebugInfo && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs z-50">
          <div>Videos: {videos.length}/{totalCount}</div>
          <div>Visible: {visibleRange.start}-{visibleRange.end}</div>
          <div>Cache: {cacheStats.hits}H/{cacheStats.misses}M ({cacheStats.size})</div>
          <div>Scroll: {Math.round(scrollTop)}px</div>
        </div>
      )}

      {/* Pull to Refresh Indicator */}
      {scrollTop < -50 && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-red-600/20 text-white text-center py-2">
          Release to refresh
        </div>
      )}

      {/* Virtual Scroll Container */}
      <div
        ref={containerRef}
        className="h-full overflow-auto overscroll-y-contain"
        onScroll={handleScroll}
        style={{ height: '100vh' }}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items container */}
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleVideos.map((video, index) => (
              <div
                key={video.id}
                style={{
                  height: itemHeight,
                  marginBottom: '1rem'
                }}
              >
                <VideoCard
                  video={video}
                  onLike={handleLike}
                  onComment={handleComment}
                  lazy={true}
                  priority={index < 3} // High priority for first 3 videos
                />
              </div>
            ))}
          </div>
        </div>

        {/* Loading More Indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            <span className="ml-3 text-gray-400">Loading more videos...</span>
          </div>
        )}

        {/* End of Feed */}
        {!hasMore && videos.length > 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🐺</div>
            <p>You've reached the end of the pack!</p>
            <button
              onClick={handleRefresh}
              className="mt-4 text-red-400 hover:text-red-300 transition-colors"
            >
              Refresh Feed
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && videos.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <div className="text-6xl mb-4">🐺</div>
            <h2 className="text-xl font-bold text-white mb-2">No Videos Yet</h2>
            <p className="text-gray-400 text-center mb-4">
              Be the first to share something with the Wolf Pack!
            </p>
            <button
              onClick={handleRefresh}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}