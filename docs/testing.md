# Testing Guide

This document covers test patterns, mock strategies, and known pitfalls for the Pincer test suite (`src/__tests__/`).

## Stack

- **Runner**: Bun's built-in test runner (`bun:test`)
- **Style**: Unit tests with mocked dependencies — no real SQLite, no real HTTP, no running server
- **Setup**: `src/__tests__/setup.ts` — shared helpers (`createAgent`, `mockFetchOk`, `mockFetchThrow`)
- **Mocks**: `src/__tests__/mocks/` — reusable module mocks (e.g. `electrobun.ts`)

---

## Module Mocking Rules

### Mocks must come before `await import`

Bun resolves module mocks at import time. Any `mock.module()` call must appear **before** the `await import(...)` of the module under test — otherwise the real module is loaded first and the mock is never applied.

```ts
// ✅ Correct order
mock.module("../../../bun/services/loggerService", () => ({ ... }));
const { myFunction } = await import("../../../bun/services/myModule");

// ❌ Wrong — mock comes after import, has no effect
const { myFunction } = await import("../../../bun/services/myModule");
mock.module("../../../bun/services/loggerService", () => ({ ... }));
```

### Mock the module that is actually imported

Mock the exact path that the **module under test** imports — not a re-export or barrel file.

Example: `daemonSyncService.ts` imports `readAgents` from `./agentService`, not from `../storage/index`. Mocking `storage/index` has no effect.

```ts
// ✅ Correct — matches the import path in daemonSyncService.ts
mock.module("../../../bun/services/agentService", () => ({
  readAgents: mockReadAgents,
  writeAgents: mockWriteAgents,
}));

// ❌ Wrong — daemonSyncService.ts never imports from storage/index
mock.module("../../../bun/storage/index", () => ({
  agentStorage: { readAgents: mockReadAgents },
}));
```

### Always mock `electrobun/bun` and `windowRegistry` for service tests

Any service that imports `loggerService` (directly or transitively) will pull in `electrobun/bun` → `Updater` → tries to read `version.json` → crashes. Always add these two mocks in service test files:

```ts
mock.module("electrobun/bun", () => import("../../mocks/electrobun"));
mock.module("../../../bun/rpc/windowRegistry", () => ({
  getMainWindow: mock(() => null),
}));
```

---

## `beforeEach`: `mockReset` vs `mockClear`

This is the most common source of inter-test contamination.

| Method | Clears call history | Resets implementation |
|---|---|---|
| `mockClear()` | ✅ | ❌ |
| `mockReset()` | ✅ | ✅ |

**The problem with `mockClear()`**: if one test calls `mock.mockImplementation(() => [])` to simulate an empty state, that implementation persists into the next test. The next test then unexpectedly sees `[]` instead of the default.

**Use `mockReset()` + `mockImplementation()` in `beforeEach`** to guarantee each test starts with a clean, known state:

```ts
// ✅ Correct — each test gets a fresh implementation
beforeEach(() => {
  mockReadAgents.mockReset();
  mockReadAgents.mockImplementation(() =>
    Promise.resolve([createAgent({ id: 1, name: "Agent 1" })]),
  );
});

// ❌ Risky — an earlier test's mockImplementation bleeds into later tests
beforeEach(() => {
  mockReadAgents.mockClear(); // only clears call count, NOT the implementation
});
```

Individual tests can still call `mockImplementation()` to override the default for that one test — the `beforeEach` reset ensures it doesn't leak.

---

## Mocking `global.fetch`

Services use `fetch()` directly (not via an injectable client), so tests replace `global.fetch`.

### Always save and restore

```ts
let originalFetch: typeof global.fetch;
beforeEach(() => { originalFetch = global.fetch; });
afterEach(() => { global.fetch = originalFetch; });
```

### Type casting

Bun's `typeof fetch` includes a `preconnect` property that plain async functions don't satisfy. Use double cast:

```ts
global.fetch = (async (url, init) => {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as unknown as typeof fetch;
// ❌ `as typeof fetch` alone causes a TS error — use `as unknown as typeof fetch`
```

### Account for all fetch calls in a function

If the function under test makes **multiple** fetch calls (e.g. a PUT followed by a GET for reconciliation), a naive mock that captures the last call will see the wrong result. Route by method:

```ts
// daemonSyncService.pushAgentsToDaemon makes:
//   1. PUT /agents  (push payload)
//   2. GET /agents  (reconciliation — fetch daemon agents to find orphans)

global.fetch = (async (url, init) => {
  const method = (init as RequestInit | undefined)?.method ?? "GET";
  if (method === "PUT") {
    capturedMethod = method;
    return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
  }
  // Reconciliation GET — return empty array so no orphan deletions occur
  return new Response(JSON.stringify([]), { status: 200 });
}) as unknown as typeof fetch;
```

A reusable helper for this pattern:

```ts
function makeFetchMock(
  onPut: (url: string, init: RequestInit) => Response,
) {
  return (async (url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "PUT") return onPut(url, init!);
    return new Response(JSON.stringify([]), { status: 200 });
  }) as unknown as typeof fetch;
}
```

---

## Test File Structure

```ts
// 1. Imports
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// 2. Create mock functions
const mockFoo = mock(() => Promise.resolve(defaultValue));

// 3. Register module mocks (MUST be before await import)
mock.module("electrobun/bun", () => import("../../mocks/electrobun"));
mock.module("../../../bun/rpc/windowRegistry", () => ({ getMainWindow: mock(() => null) }));
mock.module("../../../bun/services/fooService", () => ({ foo: mockFoo }));

// 4. Dynamic import of the module under test
const { functionUnderTest } = await import("../../../bun/services/myService");

// 5. beforeEach: reset + re-implement all mocks
let originalFetch: typeof global.fetch;
beforeEach(() => {
  originalFetch = global.fetch;
  mockFoo.mockReset();
  mockFoo.mockImplementation(() => Promise.resolve(defaultValue));
});
afterEach(() => {
  global.fetch = originalFetch;
});

// 6. Tests
describe("functionUnderTest", () => {
  it("does the thing", async () => { ... });
});
```
