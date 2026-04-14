---
phase: 04-heatmap-foundations
plan: '01'
subsystem: ui
tags: [svelte, css, heatmap, component]

# Dependency graph
requires: []
provides:
  - Heatmap CSS variable system (--heatmap through --heatmap-5)
  - Heatmap.svelte component with error intensity calculation
  - Props interface supporting checks, columns, cellSize, class
affects:
  - 04-02-grid-views
  - 04-03-horizontal-scroll

tech-stack:
  added: []
  patterns:
    - "Svelte 5 runes: $props(), $derived() for reactivity"
    - "CSS custom properties for theming (light/dark mode)"
    - "Error intensity formula: (failed + 0.5 * degraded) / total"

key-files:
  created:
    - src/mainview/lib/components/incidents/Heatmap.svelte
  modified:
    - src/mainview/app.css

key-decisions:
  - "Error intensity formula: failed counts full weight, degraded counts half weight, unknown/offline treated as degraded per D-06"
  - "CSS variables use oklch() color space for perceptually uniform gradients"
  - "Dark mode variants use slightly adjusted values for better contrast"
  - "columns prop reserved for future grid layout (currently single cell)"

patterns-established:
  - "Heatmap intensity mapping: 0→--heatmap, 0-20%→--heatmap-1, 20-40%→--heatmap-2, 40-60%→--heatmap-3, 60-80%→--heatmap-4, 80-100%→--heatmap-5"
  - "Component accepts optional class prop for external styling via cn() utility"

requirements-completed:
  - HEAT-04
  - HEAT-05
  - HEAT-06
  - HEAT-09

duration: 5min
completed: 2026-04-14
---

# Phase 04 Plan 01: Heatmap Foundations Summary

**Heatmap component with CSS variable system and error intensity calculation using (failed + 0.5 * degraded) / total formula**

## Performance

- **Duration:** 5min
- **Started:** 2026-04-14T08:44:34Z
- **Completed:** 2026-04-14T08:50:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- CSS custom properties --heatmap through --heatmap-5 defined for both light and dark modes
- Heatmap.svelte component with Props interface (checks, columns?, cellSize?, class?)
- Error intensity calculation implementing HEAT-05/HEAT-06 requirements
- Color mapping from intensity (0-1) to 6-tier CSS variable system

## Task Commits

Each task was committed atomically:

1. **Task 1: Add heatmap CSS variables** - `0e60b80` (feat)
2. **Task 2: Create Heatmap.svelte component** - `b26c245` (feat)

## Files Created/Modified
- `src/mainview/app.css` - Added --heatmap, --heatmap-1 through --heatmap-5 variables in :root and .dark blocks
- `src/mainview/lib/components/incidents/Heatmap.svelte` - Heatmap component with error intensity calculation and CSS variable mapping

## Decisions Made
- Error intensity formula: (failed + 0.5 * degraded) / total_checks per HEAT-05/HEAT-06
- Unknown/offline status treated as degraded per D-06
- CSS variables use oklch() color space for perceptual uniformity
- columns prop included in Props interface for future grid layout support (currently single cell)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 04-02: Grid Views (HeatmapGrid component using Heatmap cells)
- Heatmap component can be imported and used with check arrays
- CSS variables available for other components

---
*Phase: 04-heatmap-foundations*
*Completed: 2026-04-14*
