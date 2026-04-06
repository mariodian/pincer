# Contributing to Pincer

Thanks for your interest in contributing to Pincer.

## Table of Contents

- [Fork the Repository](#fork-the-repository)
- [Clone Your Fork](#clone-your-fork)
- [Create a New Branch](#create-a-new-branch)
- [Development](#development)
- [Code Style](#code-style)
- [Committing Your Work](#committing-your-work)
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

| Command | Description |
| ------- |-------------|
| `bun run dev` | Full desktop dev flow |
| `bun run dev:hmr` | Fast renderer iteration with HMR |
| `bun run build` | Production build |

## Code Style

Pincer uses strict TypeScript and Svelte 5. Before submitting, run:

```bash
bun run format
bun run typecheck
```

See [AGENTS.md](./AGENTS.md) for full coding standards.

## Committing Your Work

Commit your changes:

```bash
git add .
git commit -m "Your commit message"
```

Keep commits focused and clear.

## Open a Pull Request

Open a Pull Request against the main branch. For major changes, open an issue first to discuss the approach.

## Review Process

Your PR will be reviewed by maintainers. You may receive feedback requesting changes. Respond to comments and update your PR as needed.

## Getting Help

Open an issue if you have questions about contributing.