# Changelog

All notable changes to Pincer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.1] - 2026-04-04

### Added

- Added update management features and related settings.
- Added an `openExternalUrl` RPC method and improved alert components.
- Added toast notifications for agent feedback with `svelte-sonner`.
- Added a `useNativeTray` setting and updated related components.

### Changed

- Updated README content for clarity and additional project details.
- Updated changelog tooling rules and release-workflow extraction behavior.
- Updated `@hugeicons/core-free-icons` and `tailwindcss` dependencies.

### Fixed

- Simplified import paths in the settings about page.
- Improved the description for the native tray setting in advanced settings.

## [v0.1.0] - 2026-04-03

### Added

- **Agent editing:** Implemented save support in the agent form.
- **RPC/settings:** Added `maxRequestTime` in shared RPC definitions and implemented `getSettings` handling.
- **Observability:** Added broader application logging, including error logging in RPC handlers and status sync.

### Changed

- **Routing:** Improved initial-route and pending-route handling to make renderer startup/navigation more reliable.
- **UI behavior:** Updated tray interaction so agent clicks open/show the main window.
- **Menu system:** Refactored application/tray menu flows and improved configuration action labeling.
- **Runtime init:** Simplified RPC initialization by removing Electrobun runtime checks.
- **Settings UI:** Removed the privacy tab and related content from settings.

### Fixed

- **Agents page reactivity:** Wrapped conditional rendering in a keyed block to improve update behavior.
- **Type issues:** Corrected type import ordering and `navigateTo` casting in main RPC initialization.

### Removed

- **Project artifacts:** Removed `.opencode` project-specific files and added ignore rules.

### Documentation

- **Docs refresh:** Updated project docs (`AGENTS.md`) and expanded repository documentation sections.
- **Release automation:** Updated release workflow to extract and publish changelog notes.
- **Changelog tooling:** Added changelog generator skill and initial changelog tracking.

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
