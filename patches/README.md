# React Native 0.79.2 patches

## Text input selection color

Backports the one-line native fix from
[React Native #57748](https://github.com/react/react-native/pull/57748)
(`56c284e152aedd3155ae34ed959fc745f970a451`). Fabric replaces the backing input
when `multiline` changes, but 0.79.2 does not copy its `tintColor`. An unchanged
`selectionColor` prop is then skipped by the native prop diff, leaving system blue.
Copying the tint preserves it before the replacement field can focus.

Rebuild iOS; Metro/Fast Refresh cannot apply this native fix. Verify first focus,
title editing, inserted Write/column blocks, list rows, non-first table cells,
and switching/reopening guided steps. JavaScript tests cannot verify UIKit's
visible caret color. Remove this hunk once the installed RN includes the fix.

## iOS LogBox teardown

`react-native+0.79.2.patch` addresses the LogBox window lifecycle implicated in
the September 22, 2026 iOS 27 simulator crash: `objc_storeWeak` aborts during
UIKit keyboard-shortcut enumeration, with `RCTLogBoxView` in the crash registers.

The patch restores the previous window and resigns the overlay's responders
before releasing it, instead of changing the key window from `dealloc`. It also
dismisses LogBox on module invalidation (reload), keeping cleanup on the main
queue. The previous window is captured weakly from the same scene. LogBox
remains enabled.

The existing `postinstall` script applies this patch. Rebuild the native iOS app
after applying it; a Metro reload alone does not update native code. Reassess
the patch when upgrading React Native.

Runtime regression checks on the affected simulator:

1. Open a LogBox warning/error, dismiss it, and confirm the app accepts typing.
2. Reload with LogBox open, then confirm the app accepts typing and shortcuts.
3. Repeat both paths and confirm LogBox can still display subsequent errors.

A successful build verifies compilation, but does not by itself confirm that
the original crash is resolved. The supplied report does not identify the
JavaScript warning/error that originally opened LogBox.
