# Moments date-header scroll loop — September 22, 2026

## Symptom and confirmed cause

Moments jumped back and forth between the same dates while scrolling. Reproduced
in JournalBySiFia on the iPhone 18 Pro Max simulator, iOS 27, React Native 0.79.2.

The list recorded every sticky section header at content offset `0`, including
headers thousands of points down the list. The header's inner CellRenderer sits
at `y=0` inside ScrollViewStickyHeader. Its `onCellLayout` callback sent that local
coordinate to VirtualizedList instead of the sticky wrapper's position in the
scroll content. Incorrect offsets corrupted virtualization spacer calculations,
changing content height and jumping the viewport as cells mounted/unmounted.

Before the fix, a diagnostic scroll toward offset 5800 reached 5631 and then
jumped backward to 4688 while the measured content height dropped. Header metrics
showed zero offsets for every date.

## Saved implementation

- [MomentsStickyHeader.tsx](../src/components/moments/MomentsStickyHeader.tsx)
  wraps React Native's existing ScrollViewStickyHeader. It forwards the outer
  wrapper's layout event to both ScrollView's `onLayout` and the child's
  `onCellLayout(event, cellKey, index)`, then disables the inner cell callback so
  local `y=0` cannot overwrite the correct measurement.
- The forwarded ref preserves `setNextHeaderY`, native pinning, and header touch
  handling. Sticky headers remain enabled.
- [EnhancedMomentsRenderer.tsx](../src/systems/journal/renderers/EnhancedMomentsRenderer.tsx)
  installs the adapter through `StickyHeaderComponent={MomentsStickyHeader}` and
  renders section headers without a Reanimated entrance transform. Card entrance
  animations remain. Removing header animations alone was not verified as a fix
  for the coordinate bug.
- [MomentsStickyHeader.test.tsx](../src/components/moments/__tests__/MomentsStickyHeader.test.tsx)
  uses RN's actual CellRenderer and sticky wrapper to check content coordinates,
  ignored inner coordinates, changed cell indices, touch callbacks, and the
  forwarded header-collision ref.

This adapter depends on RN 0.79's internal CellRenderer and ScrollViewStickyHeader
contracts. Recheck them on a React Native upgrade. The fix is JavaScript and does
not require a native rebuild; reload the development bundle to test it.

## Verification performed

- 80 programmatic animated scroll steps down and back across September 14–22
  (nine dates) in the iOS simulator: zero unexpected reversals greater than
  10 points in the recorded scroll events.
- Correct header offsets after the fix, for example September 18 at 9432 and
  September 14 at approximately 23873.67, instead of zero.
- 10 tests passed across the sticky-header regression, Heart Journal, Bible
  Study, and Prayer Moments rendering suites. The latter two suites needed the
  same Reanimated mock already used by the Heart Journal suite.
- `npx tsc --noEmit --pretty false` passed. ESLint passed for the adapter and its
  regression test.
- This verification did not cover a physical device or Android.

## Related siFia issue

The user reports the same symptom in the sibling `siFia` app. That app also uses
React Native 0.79.2 and sticky SectionList headers in
`src/systems/journal/renderers/EnhancedMomentsRenderer.tsx`. It does not yet have
this adapter. Its section headers already render without the entrance wrapper.
The coordinate bug is a strong candidate there; reproduce and measure before
claiming that its root cause or fix is confirmed.

Also inspect siFia's section-derived `listKey`: it is used as the SectionList key
and to reset scrolling. Refreshes that discover another date can therefore remount
or reset the list. JournalBySiFia already had a separate working-tree change to
keep the list mounted by grouping and reset only for explicit view/filter changes
when this investigation began. Preserve that behavior when porting the fix.

The siFia implementation has not been changed as part of saving these notes.
