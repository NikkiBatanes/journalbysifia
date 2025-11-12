# Stacked Cards Implementation Plan

## Current State
- Horizontal FlatList carousel with cards
- Cards can expand/collapse individually
- Uses existing card components (TruthInLoveCard, ActionStepsCard, etc.)

## Target State (from images)
- Vertical stacked cards with cascading headers
- Only ONE card expanded at a time (full screen)
- When collapsed: all cards show headers stacked
- When expanded: ONLY the tapped card shows (no other headers)
- Tap again to collapse back to stacked view

## Card Order (from image 1)
1. Truth in Love (bottom, expanded by default) - Blue #5B7FA6, warning-outline icon
2. 5 Action Steps - Dark blue, list icon, anchor icon on right
3. Affirmations - Green, heart icon
4. Bible Verse - Light blue/teal, book icon
5. Challenge (top) - Coral/pink, flash icon

## Implementation Steps
1. Add `expandedCardId` state (string | null)
2. Create card header component with icon + title
3. Replace FlatList with ScrollView containing stacked cards
4. Add tap handler: 
   - If collapsed → expand (set expandedCardId)
   - If expanded → collapse (set expandedCardId to null)
5. Style:
   - Collapsed: 60px header height, stacked with 8px offset
   - Expanded: Full card content, no other cards visible
6. Use LayoutAnimation for smooth transitions

## Key Differences from Carousel
- NO horizontal scrolling
- NO pagination dots
- Cards stack vertically instead of horizontally
- Only one card can be expanded at a time
- Simpler interaction model
