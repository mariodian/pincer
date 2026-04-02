<!-- Context: project-intelligence/guides/getting-started | Priority: high | Version: 1.0 -->

# Getting Started

**Purpose**: Orientation for developers and AI agents working on Pincer.

## Key Directories

| Path            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `src/bun/`      | Main process — RPC, services, storage, native FFI    |
| `src/mainview/` | Svelte UI renderer — components, pages, RPC client   |
| `src/shared/`   | Types shared between main and renderer               |
| `native/macos/` | Objective-C++ window effects (vibrancy, traffic lights) |

## Build First

```bash
bun run build:native-effects   # macOS dylib (required)
bun run dev                     # full dev server
```

## Update Triggers

- Tech stack changes (new dependency, version bump)
- Architecture decisions (new service, RPC method)
- New patterns established in code reviews

## Related Files

- AGENTS.md — full coding standards and build commands
- `concepts/tech-stack.md` — technology overview
- `examples/code-patterns.md` — working code examples
