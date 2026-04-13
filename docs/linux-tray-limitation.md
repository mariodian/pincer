# Linux Tray Limitation

## Summary

Custom popover tray is not supported on Linux. The app always uses native tray menu.

## Root Cause

Electrobun uses `libayatana-appindicator` on Linux, which doesn't properly support tray icon click events. Additionally, the library is deprecated and emits warnings:

```
libayatana-appindicator-WARNING: libayatana-appindicator is deprecated. 
Please use libayatana-appindicator-glib in newly written code.
```

## Impact

When clicking the tray icon on Linux with `useNativeTray=false`:
- The `tray-clicked` event is never fired
- No popover window is created
- Users see a small window with "Electrobun App" text (default window title)

## Workaround

The application forces native tray menu on Linux:

- `useNativeTray` setting is ignored on Linux (always treated as `true`)
- The setting is disabled in the Settings UI with an explanation
- Native tray menu works correctly via `tray.setMenu()`

## Code Location

- `src/bun/trayManager.ts` - `useNativeMenu()` function
- `src/mainview/lib/pages/settings/SettingsAdvanced.svelte` - UI handling

## Future Resolution

This requires a fix in the Electrobun framework. See `docs/electrobun-tray-bug-report.md` for the upstream bug report.
