# Side Hustle Bar Wolfpack: TikTok-Style Consolidation Plan

## Executive Summary
Transform the current fragmented Side Hustle Bar PWA into a unified TikTok-style wolfpack platform by consolidating 346 files into a seamless vertical feed experience. The CivicConnect wolfpack components provide excellent foundation patterns for modern mobile-first social feeds.

## Strategic Component Mapping

### CivicConnect → Side Hustle Bar Adaptations

#### 1. Social Feed Components
- **Adapt**: `social-feed.tsx` → `WolfpackVerticalFeed.tsx`
- **Transform**: Card-based layout → Full-screen vertical wolfpack_posts
- **Add**: TikTok-style swipe gestures and video autoplay
- **Integrate**: DJ live indicators, events, and business content

#### 2. Mobile Navigation
- **Adapt**: `mobile-footer-nav.tsx` → Auto-hide bottom navigation
- **Keep**: Scroll direction detection and smooth animations
- **Enhance**: Add gesture-based navigation for content switching

#### 3. Chat & Messaging
- **Adapt**: `MobileOptimizedChat.tsx` → Integrated wolfpack messaging
- **Transform**: Overlay system for seamless chat within feed
- **Maintain**: Real-time messaging and member interactions

## Implementation Tasks

### Phase 1: Foundation Setup (Week 1-2)
- [ ] Remove redundant wolfpack files (`channels/`, `chat/messages/`, `welcome/`)
- [ ] Extract reusable components from CivicConnect
- [ ] Create unified `WolfpackVerticalFeed` component
- [ ] Implement basic TikTok-style vertical scrolling
- [ ] Add gesture detection for swipe navigation

### Phase 2: Content Integration (Week 3-4)
- [ ] Transform DJ interface into live feed indicators
- [ ] Convert events from calendar to video-style cards
- [ ] Transform menu system into business directory feed
- [ ] Implement unified content rendering system
- [ ] Add Pack Dollar integration throughout feed

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement AI content curation
- [ ] Add live DJ overlay system
- [ ] Create business collaboration tools
- [ ] Optimize real-time performance
- [ ] Add advanced social features

### Phase 4: Testing & Launch (Week 7-8)
- [ ] Comprehensive testing with existing users
- [ ] Performance optimization
- [ ] Launch preparation and documentation

## Key Files to Consolidate

### Remove Immediately
```
❌ app/(main)/wolfpack/channels/page.tsx
❌ app/(main)/wolfpack/chat/messages/page.tsx
❌ app/(main)/wolfpack/welcome/page.tsx
❌ app/api/orders/wolfpack (redundant)
```

### Transform & Consolidate
```
🔄 app/(main)/dj/ → Integrated into main wolfpack feed
🔄 app/(main)/events/ → Video-style cards in feed
🔄 app/(main)/menu/ → Business directory within feed
🔄 app/(main)/merch/ → Marketplace integration
```

### Component Restructure
```
components/wolfpack/
├── feed/
│   ├── VerticalFeed.tsx (main TikTok-style interface)
│   ├── ContentCard.tsx (unified post/event/business card)
│   ├── LiveIndicator.tsx (DJ live status)
│   └── InteractionOverlay.tsx (likes, comments, shares)
├── live/
│   ├── DJOverlay.tsx (live DJ controls)
│   ├── AudienceParticipation.tsx (pack engagement)
│   └── LiveChat.tsx (real-time messaging)
├── businesses/
│   ├── BusinessShowcase.tsx (local business wolfpack_posts)
│   ├── PackDollarIntegration.tsx (rewards system)
│   └── BusinessDirectory.tsx (comprehensive listings)
└── social/
    ├── PackChat.tsx (integrated messaging)
    ├── UserProfile.tsx (member profiles)
    └── SocialActions.tsx (engagement actions)
```

## Technical Requirements

### Core Technologies
- **Framework**: Next.js 15 with App Router
- **UI Components**: Radix UI with Tailwind CSS
- **Gestures**: Embla Carousel for vertical scrolling
- **Real-time**: WebSocket connections for live features
- **Performance**: 60fps smooth scrolling optimization

### Mobile-First Patterns
- **Vertical Feed**: Full-screen post display
- **Gesture Navigation**: Swipe up/down for content, left/right for categories
- **Auto-hide UI**: Navigation hides during content consumption
- **Touch Optimization**: Large tap targets and smooth interactions

### Content Types in Feed
1. **Social wolfpack_posts**: Pack member updates and interactions
2. **Live DJ**: Real-time DJ broadcasts with audience participation
3. **Events**: Video-style event announcements and RSVPs
4. **Businesses**: Local business showcases and services
5. **AI Content**: Curated local content and recommendations

## Success Metrics
- **User Engagement**: Increased session duration and daily active users
- **Content Interaction**: Higher rates of likes, comments, and shares
- **Business Activity**: More local business discovery and transactions
- **Community Building**: Stronger pack member connections and collaboration
- **Performance**: Smooth 60fps scrolling and minimal load times

## Risk Mitigation
- **Phased Implementation**: Gradual rollout with feature flags
- **Performance Monitoring**: Continuous optimization during development
- **User Feedback**: Regular testing with existing community
- **Backup Plans**: Maintain old interfaces until new system is validated

## Next Steps
1. Begin Phase 1 foundation work
2. Create unified component architecture
3. Implement TikTok-style vertical feed
4. Integrate existing functionality progressively
5. Test and optimize throughout development

This plan leverages the excellent CivicConnect wolfpack components while transforming the Side Hustle Bar experience into a modern, engaging, TikTok-style platform that serves the local Salem/Portland community.