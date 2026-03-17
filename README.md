# Native macOS Vibrancy Electrobun App

This project is centered on a custom native macOS window experience in Electrobun:

- Native macOS vibrancy (`NSVisualEffectView`)
- Native traffic-light button alignment with a custom draggable header
- Native window shadow restoration on transparent windows
- React/Tailwind UI kept simple so native effects stay visible

<img width="1073" height="867" alt="image" src="https://github.com/user-attachments/assets/e6635725-9989-409e-a982-b0e469838d97" />


## What makes this app special

The default Electrobun APIs provide `titleBarStyle: "hiddenInset"` and `transparent: true`, but not a full public vibrancy API.  
This project adds a tiny Objective-C bridge loaded via Bun FFI to apply:

- `enableWindowVibrancy(windowPtr)`
- `ensureWindowShadow(windowPtr)`
- `setWindowTrafficLightsPosition(windowPtr, x, yFromTop)`

## Key files

- `src/bun/index.ts`: Electrobun `BrowserWindow` setup, FFI loading, traffic-light + native drag region tuning constants, app menu shortcuts.
- `native/macos/window-effects.mm`: Cocoa native implementation (`NSVisualEffectView`, shadow, button positioning, native drag region).
- `scripts/build-macos-effects.sh`: Builds `libMacWindowEffects.dylib`.
- `electrobun.config.ts`: Copies the built dylib into the app bundle.
- `src/mainview/App.tsx`: Header UI geometry aligned with native controls; native drag is handled by Cocoa overlay.

## Build and run

```bash
bun install

# Development (bundled assets flow)
bun run dev

# Development with Vite HMR
bun run dev:hmr

# Production-style build
bun run build

# Build for prod channel
bun run build:prod
```

## Build pipeline details

`bun run build` does:

1. `bun run build:native-effects`
2. `vite build`
3. `electrobun build`

`build:native-effects` compiles:

- Source: `native/macos/window-effects.mm`
- Output: `src/bun/libMacWindowEffects.dylib`
- Compiler: `xcrun clang++ -dynamiclib -fobjc-arc -framework Cocoa`

On non-macOS hosts, the script creates a placeholder dylib so Electrobun copy steps still succeed.

## Traffic-light and header alignment

Tune these constants in `src/bun/index.ts`:

- `MAC_TRAFFIC_LIGHTS_X`
- `MAC_TRAFFIC_LIGHTS_Y`

Tune header geometry in `src/mainview/App.tsx`:

- Header height (`h-*`)
- Left padding reserved for native buttons (`pl-24`)

If you change header height/padding, adjust `MAC_TRAFFIC_LIGHTS_Y` (and possibly `X`) to keep native buttons visually centered in the faux title area.

## Draggable behavior

This project uses a native drag-region overlay (Cocoa view) for titlebar dragging:

- Native function: `setNativeWindowDragRegion(windowPtr, x, height)`
- Constants:
  - `MAC_NATIVE_DRAG_REGION_X`
  - `MAC_NATIVE_DRAG_REGION_HEIGHT`

Why: this gives native titlebar drag behavior (including moving across Spaces) and avoids limitations of class-based JS drag forwarding.

Note: `electrobun-webkit-app-region-drag` is intentionally not used in the current header.

## Runtime notes

- Native vibrancy depends on macOS transparency settings. If blur looks weak/off, check:
  - System Settings -> Accessibility -> Display -> `Reduce transparency` (should be off)
- This native bridge is macOS-specific. Other platforms fall back to normal behavior.
- `Cmd+W` close behavior is wired through macOS application menu config in `src/bun/index.ts`.

## Libraries and APIs used

- `electrobun` for desktop runtime and `BrowserWindow`
- Bun FFI (`bun:ffi`) for loading custom native dylib
- Cocoa/AppKit (`NSWindow`, `NSVisualEffectView`) in Objective-C++
- `react`, `react-dom`, `tailwindcss`, `vite` for renderer UI
