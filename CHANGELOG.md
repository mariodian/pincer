# Changelog

All notable changes to Pincer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.3.6] - 2026-05-03

### Added

- Added auto refresh and manual page refresh support so users can keep data current automatically or fetch the latest data on demand.
- Added namespace-aware daemon synchronization support, including namespace key handling in the sync pipeline.
- Added Linux daemon installation script improvements and Homebrew postflight quarantine-removal support.
- Added broader automated test coverage for daemon client flows, SQLite repositories, shared modules, and status synchronization behavior.
- Added CI workflow configuration and concurrency controls for more reliable pipeline execution.

### Changed

- Refactored refresh-page behavior into a reusable data-page component.
- Refactored status and incident processing by moving core logic into dedicated services and unifying incident recovery checks.
- Refactored daemon sync architecture to support pull/sync flows, cursor-based pagination, and cleaner sync orchestration.
- Refactored test infrastructure by introducing shared mocks and updated test type definitions.
- Updated package scripts, TypeScript project configuration, ESLint setup, and dependency metadata to align desktop and daemon workflows.

### Removed

- Removed the unused daemon server module.

### Fixed

- Fixed incident filtering and handoff-event display behavior in timeline views.
- Fixed incident tracking by propagating namespace identifiers through event recording and non-OK check handling.
- Fixed daemon sync consistency by reconciling orphan agents, syncing namespaced agent data correctly, and aligning sync timestamps to hour boundaries.
- Fixed dashboard status aggregation by correcting failed versus degraded count assignment.
- Fixed icon animation handling for spinning indicators.
- Fixed agent deletion behavior by cascading removal of related records.

## [v0.3.5] - 2026-04-25

### Added

- Added Homebrew installation detection and displayed Homebrew-specific update instructions in Settings > About.

### Changed

- Consolidated platform-specific tray logic into the tray manager for cleaner cross-platform behavior.
- Extracted `centerOnPrimaryDisplay` helper to simplify window positioning code.
- Extracted notification message builder to streamline notification formatting.
- Set log level dynamically from the app channel instead of a fixed default.
- Wrapped RPC handlers with `withErrorLogging` for consistent error logging across endpoints.
- Enhanced HMR protection in status polling by checking the active interval before restarting.
- Optimized daemon synchronization by pushing agent configurations on app startup and reconnect.
- Refactored update check logic into a dedicated `checkAndCacheUpdate` helper.
- Updated Prettier to 3.8.3.

### Fixed

- Corrected log level for poll completion messages to reduce noisy debug output.
- Added a warning when polling starts with no enabled agents to surface configuration issues earlier.
- Fixed README table of contents link formatting.

## [v0.3.4] - 2026-04-24

### Added

- Added linked incident support so related incidents can be connected in incident events.
- Added shared logging and database utilities used across desktop and daemon runtimes.
- Added daemon lifecycle handling improvements for enabling/disabling daemon mode and syncing state transitions.

### Changed

- Updated daemon synchronization architecture with a dedicated daemon client, polling-mode strategy, and more resilient import flow.
- Updated incident timeline processing to use pre-aggregated buckets and optimized reconstruction for better performance at 24h/7d scales.
- Updated LayerChart integration and dashboard styling with refined tooltip, surface-color, and chart domain behavior.
- Updated release and daemon tooling to package daemon artifacts from the root workflow and keep version resolution centralized.

### Fixed

- Fixed daemon sync reliability around connectivity timeouts, disconnect handling, and sync-state recovery.
- Fixed incident lifecycle edge cases when switching polling modes and when reconstructing open incidents.
- Fixed in-memory threshold and status-state handling to preserve runtime consistency during configuration updates.

## [v0.3.4-dev.1] - 2026-04-21

### Added

- Added root-level daemon development, formatting, typechecking, and bundling scripts so daemon workflows run from the main workspace.
- Added shared database core and helper utilities to consolidate SQLite access across the app and daemon codepaths.

### Changed

- Updated daemon packaging to use the root workspace dependencies and root package version metadata instead of a separate daemon package manifest.
- Updated release automation to bundle the Linux daemon from the root scripts and restrict Homebrew tap updates to stable tags.
- Refined daemon and contributor documentation for release tagging, installation, and development commands.

### Fixed

- Fixed daemon sync handling to recover more cleanly from connectivity issues and reset sync timestamps when re-enabling synchronization.
- Fixed SQLite transaction handling by using `sqlite.run` in affected codepaths for more reliable database operations.
- Fixed Bun-process shared imports by replacing `$shared` aliases with relative paths where needed.

## [v0.3.4-dev] - 2026-04-21

### Added

- Added daemon synchronization and incident backfill support so the desktop app can recover monitoring gaps after sleep or downtime.
- Added Linux daemon release packaging so GitHub releases now publish a `pincerd-vX.Y.Z-linux-x64.tar.gz` bundle.
- Added daemon logging controls and release-tagging guidance for validating daemon version metadata before publishing.

### Changed

- Updated daemon channel resolution and bundling to derive version and release context more reliably.
- Renamed the daemon package and bundled output to `pincerd` for consistent release and deployment naming.
- Improved daemon settings feedback in the app for connection testing and synchronization visibility.

### Fixed

- Fixed daemon timestamp normalization for synced checks to keep status history aligned after import.
- Fixed daemon request handling around server imports and date parsing for more reliable runtime behavior.

## [v0.3.3] - 2026-04-18

### Added

- Added Homebrew uninstall instructions to complement the installation flow.
- Added additional README screenshots to improve product walkthrough coverage.

### Changed

- Updated GitHub Actions workflow permissions to read-only for tighter default security.
- Updated macOS troubleshooting instructions for quarantined app launch behavior.

### Fixed

- Fixed Linux autostart handling and added BSD support in the autostart flow.

## [v0.3.2] - 2026-04-16

### Added

- Added Homebrew installation instructions in README.

### Changed

- Enhanced UI component styling with improved shadow treatment and visual polish.
- Updated the README features section for clearer wording and structure.
- Updated Homebrew tap workflow to support release publishing flow.

## [v0.3.1] - 2026-04-15

### Added

- Added heatmap component with CSS variable system (`--heatmap` through `--heatmap-5`) for color-coded status visualization.
- Added HeatmapCell component with time-period tooltip showing status breakdown (ok/degraded/failed counts).
- Added 24h view (144 ten-minute cells) and 7d view (168 hourly cells) for incident heatmap.
- Added error intensity formula: `(failed + 0.5 * degraded) / total_checks` for perceptual weighting.
- Added horizontal scroll for heatmap grid overflow.

### Changed

- Replaced raw CheckDot grid with glanceable Heatmap component in Timeline.
- Updated heatmap CSS variables to use Tailwind CSS color palette with oklch() color space.
- Enhanced tooltip content layout and styling in HeatmapCell.

### Fixed

- Fixed heatmap lightness for light mode visibility.

## [v0.3.0] - 2026-04-14

### Added

- Added `stopStatusUpdates()` export and integrated into quit handler to prevent dangling timers.
- Added `internalNetworkWarning` field for agents on private/internal networks with security-conscious user notifications.
- Added `Semaphore` class with `MAX_CONCURRENT_HEALTH_CHECKS=10` for concurrency limiting.
- Added incident retention with configurable cleanup (`runIncidentRetentionCleanup()`) unified with settings.retentionDays.

### Changed

- Wrapped all `parseStatus` functions in try/catch for graceful error handling.
- Exported magic number constants (`DEFAULT_FAILURE_THRESHOLD`, `DEFAULT_RECOVERY_THRESHOLD`, `TITLE_BAR_OFFSET`) for maintainability.
- Refactored `getStatusSyncService()` to lazy-initialize instead of throwing on missing dependency.

### Fixed

- Fixed memory leaks on agent deletion — `removeAgentState`, `removeAgentStatus`, `removeAgentStatusTracking` now wired to `deleteAgent` handler.
- Fixed unbounded status map growth by cleaning up tracking on agent deletion.
- Fixed unbounded incident events table growth with configurable retention (unified with settings.retentionDays).
- Fixed electrobun compatibility by using static imports instead of `require()`.

## [v0.2.0] - 2026-04-13

### Added

- Added Linux tray icon support and updated tray manager behavior for Linux environments.
- Added support for Hermes and OpenCode agent types across agent configuration and listing flows.

### Changed

- Refactored incident status rendering by removing `CheckDotWithTooltip` to improve renderer performance.

### Fixed

- Fixed AgentForm URL input behavior by disabling browser autocomplete and spellcheck.
- Fixed OpenClaw default port configuration and aligned OpenCode agent type handling.
- Fixed Linux tray behavior by enforcing native tray usage and documenting platform limitations.

## [v0.1.9] - 2026-04-12

### Added

- Added enhanced incident timeline behavior with unified day-level sorting and improved empty-state handling.

### Changed

- Refactored status presentation in `CheckDot`, `IncidentBadge`, and `IncidentCard` to use tone-based class handling for more consistent UI states.

### Fixed

- Fixed report handling behavior to improve stability in report-related flows.

## [v0.1.8] - 2026-04-12

### Added

- Added incident tracking persistence with new SQLite schema/migration support (`incident_events`) and repository/storage wiring.
- Added incident RPC endpoints and main-process services for incident lifecycle handling, grouping, and retention cleanup.
- Added reusable UI primitives for incidents, including `Timeline` and `Badge` components.
- Added incident-focused renderer components and pages (`IncidentCard`, `Timeline`, `CheckDotWithTooltip`, and Incidents page integration).
- Added shared status configuration utilities to centralize status labels, colors, and icon mappings.

### Changed

- Refactored time-related constants and range utilities to improve consistency between main and renderer code paths.
- Refactored dashboard and report views to incorporate incident-aware KPI/stat presentations and updated component organization.
- Refactored KPI card placement into the `ui/kpi-card` module and updated dependent imports/exports.
- Updated icon registry and sidebar/navigation wiring to support new incident and timeline visualization flows.
- Unified date parsing logic by introducing a shared `normalizeDateInput` helper in shared date utilities.
- Refactored renderer datetime utilities to use the shared date normalizer while preserving existing timestamp-unit behavior.

## [v0.1.7] - 2026-04-10

### Added

- Added per-agent uptime reporting with detailed status breakdowns.
- Added HTML export functionality for uptime reports.
- Added shared time range helpers and formatting utilities for consistent report data handling.
- Added a reusable table component for structured data display.

### Changed

- Refactored report generation by moving HTML export logic to a dedicated service.
- Refactored uptime report components to use shared time range helpers.
- Unified status type across agent-related components and reports.
- Improved agent color assignment in reports for consistency.
- Enhanced uptime report sorting and formatting for improved clarity.
- Refactored reports and stats RPCs to use `TimeRange` type with shared utility functions.
- Streamlined agent guidelines and command descriptions for clarity.

### Fixed

- Fixed sorting behavior for report columns to improve user experience.

## [v0.1.6] - 2026-04-08

### Added

- Added notification settings and management functionality for customizing agent alerts.
- Added settings migration for advanced and notification configurations.

### Changed

- Enhanced notification logic and batching for improved agent status change handling.
- Refactored status update polling to use `setTimeout` for better control and reliability.
- Improved code formatting and readability across multiple files.
- Simplified notification threshold descriptions for improved clarity.

### Fixed

- Fixed gitignore to properly exclude mempalace state files from version control.

## [v0.1.5] - 2026-04-07

### Added

- Added stronger validation and error handling in the agent form flow.
- Added database migrations to align update-settings schema changes.

### Changed

- Updated application UI layout and styling across app shell, navigation, and settings pages for better consistency.
- Updated page-header formatting and responsive layout behavior in agent-related views.
- Renamed update setting field usage from `autoCheckEnabled` to `autoCheckUpdate` across shared types, RPC, storage, and settings UI.
- Refactored chart helper naming by renaming `getAlonePointIndices` to `getIsolatedPointIndices` for clarity.

### Fixed

- Fixed native tray behavior so `useNativeTray` setting changes correctly take effect after restart.
- Fixed tooltip visibility logic in sidebar menu interactions.
- Fixed skeleton placeholder sizing for improved layout consistency in the agent list.
- Fixed temporary LayerChart tooltip container styling to stabilize dashboard tooltip display.

## [v0.1.4] - 2026-04-07

### Added

- Added reusable `seriesDot` and `seriesLine` chart snippets for more consistent series rendering.

### Changed

- Refactored `GapAreaChart` and `GapLineChart` to use `LineSpline` and `SeriesDot` components.
- Enhanced gap-chart rendering with improved opacity handling, line highlighting, and full-range time-series padding.
- Updated `GapLineChart` behavior with improved `xDomainPadding` handling and x-axis configuration.
- Updated `GradientBarChart` to use computed gradient stops and adjusted corner radius behavior.

### Fixed

- Fixed single-point handling and gap-path rendering in `GapAreaChart` and `GapLineChart`.
- Fixed development script behavior to improve local build reliability.

## [v0.1.3] - 2026-04-06

### Added

- Added a CSS module type declaration to improve TypeScript support for stylesheet imports.

### Changed

- Updated tray icon resources and configuration to improve visual consistency.
- Refactored code structure in key UI paths for clearer organization and maintainability.

### Fixed

- Fixed chart components to read series properties from chart context and handle data more reliably.

## [v0.1.2] - 2026-04-05

### Added

- Added Escape-key shortcuts in the agent form to close discard dialogs and navigate back.
- Added keyboard accessibility improvements across controls, including explicit `tabindex` support.
- Added a loading spinner in settings to improve feedback during asynchronous states.
- Added app state persistence for window bounds and UI preferences.
- Added a Windows `icon.ico` asset for platform-specific packaging.

### Changed

- Replaced Hugeicons usage with Lucide icons and unified icon handling through a shared icon component.
- Migrated settings into an advanced settings structure and updated related RPC handling.
- Refactored empty-state, chart, and icon code paths for cleaner structure and more consistent rendering.
- Updated package dependencies to improve compatibility and stability.

### Fixed

- Fixed chart robustness by improving guarded context handling, gradient bar rendering, and line-series fallbacks.
- Fixed agent loading so disabled-agent visibility respects local preference state.
- Fixed window bounds saving behavior to work around Electrobun bug #182.
- Fixed release download metadata by updating the release `baseUrl`.

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
