# Contributing to Pincer

Thanks for your interest in contributing to Pincer.

## Table of Contents

- [Fork the Repository](#fork-the-repository)
- [Clone Your Fork](#clone-your-fork)
- [Create a New Branch](#create-a-new-branch)
- [Development](#development)
- [Code Style](#code-style)
- [Committing Your Work](#committing-your-work)
- [Release Tagging](#release-tagging)
- [Open a Pull Request](#open-a-pull-request)
- [Review Process](#review-process)

## Fork the Repository

Fork this repository to your GitHub account by clicking the "Fork" button at the top right.

## Clone Your Fork

Clone your forked repository to your local machine:

```bash
git clone https://github.com/YourUsername/pincer.git
cd pincer
```

## Create a New Branch

Create a new branch for your contribution:

```bash
git checkout -b your-branch-name
```

Choose a branch name related to your work.

## Development

### Setup

```bash
bun install
bun run dev
```

### Commands

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `bun run dev`              | Full desktop dev flow                        |
| `bun run dev:hmr`          | Fast renderer iteration with HMR             |
| `bun run build`            | Production build                             |
| `bun run build:native-libs`| Compile macOS native dylib                   |
| `bun run build:canary`     | Production build (canary channel)            |
| `bun run build:stable`     | Production build (stable channel)            |
| `bun run setup`            | Build native libs + push DB schema           |
| `bun run check`            | Run lint + typecheck + test                  |
| `bun run typecheck`        | Full typecheck (backend + svelte + daemon + tests) |
| `bun run typecheck:backend`| Fast TS check (backend + shared)             |
| `bun run typecheck:svelte` | Typecheck Svelte components                  |
| `bun run test`             | Run tests                                    |
| `bun run test:watch`       | Run tests in watch mode                      |
| `bun run test:coverage`    | Run tests with coverage                      |
| `bun run daemon:start`     | Run daemon in development                    |
| `bun run daemon:bundle`    | Build daemon binary for distribution         |

### Lint Commands

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `bun run lint`             | Lint all code (backend + svelte + daemon + tests) |
| `bun run lint:backend`     | Lint backend code (src/bun + src/shared)     |
| `bun run lint:svelte`      | Lint Svelte components (src/mainview)        |
| `bun run lint:fix`         | Fix lint issues in all code                  |
| `bun run lint:fix:backend` | Fix lint issues in backend code              |
| `bun run lint:fix:svelte`  | Fix lint issues in Svelte components         |
| `bun run test:lint`        | Lint test code                               |
| `bun run test:lint:fix`    | Fix lint issues in test code                 |

### Database

| Command                 | Description                    |
| ----------------------- | ------------------------------ |
| `bun run db:generate`   | Generate app migrations        |
| `bun run db:push`       | Push app schema to database    |
| `bun run db:studio`     | Open Drizzle Studio for app DB |

### Daemon Development

The daemon is a separate TypeScript project in `daemon/`. It uses dependencies from the root `package.json`.

| Command                       | Description                          |
| ----------------------------- | ------------------------------------ |
| `bun run daemon:start`        | Run daemon in development            |
| `bun run daemon:lint`         | Lint daemon code                     |
| `bun run daemon:lint:fix`     | Fix lint issues in daemon code       |
| `bun run daemon:typecheck`    | Typecheck daemon code                |
| `bun run daemon:db:generate`  | Generate daemon migrations           |
| `bun run daemon:db:push`      | Push daemon schema to database       |
| `bun run daemon:bundle`       | Build daemon binary for distribution |

The daemon has its own `schema.ts` and `drizzle/migrations/` directory (separate from the main app's `drizzle/migrations/`) because the daemon and app have different `__drizzle_migrations` tracking tables.

### Development Notes

- Non-main windows should load `http://localhost:5173/...` URLs for HMR updates
- HMR for secondary windows requires Vite URL routing in development
- Run `bun run build:native-libs` if the app crashes on startup (macOS native effects)

### Platform Limitations

- **Linux**: Custom tray popover is not supported due to Electrobun's use of deprecated `libayatana-appindicator`. See [docs/linux-tray-limitation.md](./docs/linux-tray-limitation.md) for details.

## Code Style

Pincer uses strict TypeScript and Svelte 5. Before submitting, run:

```bash
# Format all code (app + daemon)
bun run format

# Check formatting without writing
bun run format:check

# Run all quality checks at once
bun run check

# Or run individual checks:
bun run lint              # Lint all code
bun run typecheck         # Typecheck all code
bun run test              # Run the test suite

# Targeted checks:
bun run lint:backend      # Lint backend only
bun run lint:svelte       # Lint Svelte only
bun run typecheck:backend # Typecheck backend only
bun run typecheck:svelte  # Typecheck Svelte only
bun run test:typecheck    # Typecheck tests only
```

See [AGENTS.md](./AGENTS.md) for full coding standards.

## Testing

See [docs/testing.md](./docs/testing.md) for test patterns, mock strategies, and known pitfalls. Key rules:

- Module mocks must come **before** `await import` of the module under test
- Use `mockReset()` (not `mockClear()`) in `beforeEach` to avoid test contamination
- Always mock `electrobun/bun` and `windowRegistry` in service tests
- Save and restore `global.fetch` when mocking HTTP calls
- Mock the exact module path that the module under test imports (not re-exports or barrel files)
- Mock paths in `mock.module()` are relative to the test file, not the project root
- Only mock exports that actually exist in the source module — Bun throws `SyntaxError` at load time for missing exports
- For circular imports, mock at the storage/dependency layer below the service to break the cycle
- Prefer the factory/DI pattern for new services — eliminates `mock.module` entirely and avoids circular import issues

## Committing Your Work

Commit your changes:

```bash
git add .
git commit -m "Your commit message"
```

Keep commits focused and clear.

## Release Tagging

Release automation runs when a git tag matching `v*` is pushed.

### Tag from `main`

- Merge your feature branch into `main` first.
- Create and push release tags from `main` commits.

### Tag naming and build channel

- `vX.Y.Z` uses stable builds.
- `vX.Y.Z-suffix` (for example `v0.3.4-dev`, `v0.3.4-alpha.1`) uses canary builds and is marked as a prerelease.

### Pre-push validations for version tags

When pushing a `v*` tag, `.githooks/pre-push` validates:

- `package.json` version matches the tag version without the `v` prefix.
- `CHANGELOG.md` contains a matching release heading.

Example: pushing `v0.3.4-dev` requires:

- `package.json` version `0.3.4-dev`
- a changelog heading `## [0.3.4-dev]` or `## [v0.3.4-dev]`

## Open a Pull Request

Open a Pull Request against the main branch. For major changes, open an issue first to discuss the approach.

## Review Process

Your PR will be reviewed by maintainers. You may receive feedback requesting changes. Respond to comments and update your PR as needed.

## Getting Help

Open an issue if you have questions about contributing.
