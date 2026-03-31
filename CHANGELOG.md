# Changelog

All notable changes to Pincer will be documented in this file.

The format is based on "Keep a Changelog" — https://keepachangelog.com/en/1.0.0/

## [v0.0.9] - 2026-03-31

### Added

- **Dashboard:** New features and visualizations — KPIs, MetricChart, StatusPieChart, GradientBarChart, and related chart improvements for layout and responsiveness.
- **UI components:** Added ErrorState, EmptyState, PageHeader, and `KpiCard` variants with gradient and color options.
- **Tray & icons:** New tray SVG/resource, updated tray icon path, and removal of obsolete icon resources.
- **Settings:** Added `showDisabledAgents` to control visibility of disabled agents.
- **Build/dev:** Prettier configuration and several Vite/manual-chunk updates; `.tmp/` added to `.gitignore`.

### Changed

- **Refactors:** Styling and structural refactors across the Dashboard, chart components, and navigation for clearer structure and improved reactivity.
- **Branding:** Renamed project references to "Pincer" and updated README images/links.
- **Charts:** Improved chart utilities and KPI computation (compute KPIs from enabled agents only).

### Fixed

- **Visuals:** Body/sidebar background color fixes and import/class ordering issues.
- **Timestamps & charts:** Timestamp handling and chart layout fixes for consistent rendering.

### Removed

- **Icons:** Removed obsolete icon resources (e.g., `icon-32.webp`) and replaced AreaChart/LineChart with GapAreaChart/GapLineChart.

### Documentation

- **Docs:** README updated with dashboard images and clarifications; improvements to `AGENTS.md` formatting.
