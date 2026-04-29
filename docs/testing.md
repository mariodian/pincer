
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

**Note**: Services built with the [factory / DI pattern](#factory--dependency-injection-pattern) don't need these mocks because dependencies are passed in, not imported.

### Breaking circular imports in tests

When module A imports module B and module B imports module A, loading either module in a test will trigger the full cycle and may cause crashes or unexpected behavior.

**The fix**: mock at one level below the circular boundary. Instead of mocking the service that has the cycle, mock its underlying storage/dependency directly.

Example: `daemonSyncService` ↔ `agentService` circular import.
- `agentService.readAgents` and `writeAgents` both delegate to `agentStorage`
- Mocking `agentStorage` directly breaks the cycle without needing to mock `agentService`

```ts
// ✅ Correct — mock agentStorage (one level below agentService) to break the cycle
mock.module("../../../bun/storage", () => ({
  agentStorage: {
    readAgents: mockReadAgents,
    writeAgents: mockWriteAgents,
    insertAgent: mock(() => Promise.resolve()),
  },
}));

// ❌ Problematic — mocking agentService may still trigger the circular load
mock.module("../../../bun/services/agentService", () => ({
  readAgents: mockReadAgents,
}));
```

This approach also removes the need to refactor production code just to make tests pass — mock at the storage layer, not the service layer.

**Alternative**: if the service exports a data-only variant (e.g. `pushAgentsToDaemonWith(settings, agents, machineId)`), test that directly with plain data instead of loading the full module. This avoids the circular import entirely without any mocks.

### Mock paths are relative to the test file

`mock.module()` resolves paths from the test file's location, not the project root. A service imported at `../../../bun/services/fooService` in one test file may be `../../bun/services/fooService` in another.

Always use the exact relative path from the test file to the source module.

### Only mock exports that actually exist

If a test imports a named export that doesn't exist in the source module, Bun throws a `SyntaxError` at load time:

```
SyntaxError: Export named 'writeAgents' not found in module agentService.ts
```

Always verify the export name in the source file before writing the mock or the import in the test. Common causes:
- Function was renamed or removed
- It was never exported (only used internally)
- It lives in a different module than expected

### Plain functions vs `mock()` in `mock.module`

You don't need `mock()` for every export in a `mock.module` block. Use plain functions when you never assert on them (e.g. logger methods in repo tests):

```ts
// ✅ Fine — no assertions on these methods
mock.module("../../../../bun/services/loggerService", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// ✅ Required — test asserts mockShowNotification was called
mock.module("electrobun/bun", () => ({
  Utils: { showNotification: mockShowNotification },
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

Bun's `typeof fetch` includes a `preconnect` property that plain async functions don't satisfy. Use double cast as the safe default:

```ts
global.fetch = (async (url, init) => {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}) as unknown as typeof fetch;
```

A single `as typeof fetch` can compile when the mock function structurally matches fetch closely enough, but the double cast avoids brittle TS errors when Bun's fetch type changes.

```ts
// ✅ Safe default — works regardless of fetch type shape
global.fetch = (async (url, init) => { ... }) as unknown as typeof fetch;

// ⚠️ May compile today, but breaks if Bun adds new properties to fetch
// global.fetch = (async (url, init) => { ... }) as typeof fetch;
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

## Repo tests with a shared DB connection

Repo tests (e.g. `settingsRepo`, `daemonSettingsRepo`, `appMetaRepo`) that use a real SQLite DB via `setupTestDB()` must **not** share state with other tests. Common failure modes:

### Default values vs. seeded values

If `getSettings()` returns a hardcoded default when no row exists, a test asserting the default must not seed a row first — and vice versa. Ensure `setupTestDB()` starts with a completely empty table.

```ts
// ❌ Fails if setupTestDB pre-seeds a row with defaults
it("should return defaults when row is missing", () => {
  const s = getDaemonSettings();
  expect(s.enabled).toBe(false); // but DB was seeded with enabled=true
});
```

### Missing exports

If a test imports a function that isn't exported from the source module yet (`updateDaemonSettings`, `updateDaemonSettingsWithLifecycle`, etc.), every test in that file will fail with:

```
TypeError: updateDaemonSettings is not a function
```

Write the export in the source before writing tests that depend on it. Alternatively, check what's actually exported with a quick grep before writing the test file.

### Accessing raw `sqlite` in repo tests

`setupTestDB()` returns `{ db, sqlite }`. Call it again inside a test to get the raw `bun:sqlite` handle for seeding or verification:

```ts
it("should return values from DB after seeding", () => {
  const { sqlite } = setupTestDB();
  sqlite.run(`INSERT INTO settings_general (...) VALUES (...)`);
  const s = getSettings();
  expect(s.retentionDays).toBe(30);
});
```

`beforeEach` already calls `setupTestDB()`; calling it again in the test body returns the same in-memory instance (with its tables already created) and gives you access to `sqlite` for raw SQL.

### Async repo functions

Some repo functions are sync (return a value directly); others are async (return a Promise). If a function is async and the test doesn't `await` it, assertions run against the unresolved Promise:

```ts
// ❌ Returns Promise, not the value
expect(getOpenIncidents).toEqual([]);

// ✅ Await the result
expect(await getOpenIncidents()).toEqual([]);
```

Check the function signature before writing assertions.

---

## Refactoring for testability

### Factory / dependency injection pattern

The most robust way to make a service testable is to export a factory function that accepts all dependencies as an object. This eliminates the need for `mock.module` entirely and avoids circular import issues.

```ts
// ❌ Hard to test — imports its own dependencies
export function startStatusUpdates() {
  const agents = await readAgents();
  setTimeout(() => poll(), getAdvancedSettings().pollingInterval);
}

// ✅ Fully testable — dependencies are injected
export function createStatusCore(deps: StatusCoreDeps) {
  return {
    beginStatusUpdates() { ... },
    refreshAndPush() { ... },
    stopStatusUpdates() { ... },
  };
}
```

Test files import the factory directly and pass mock dependencies:

```ts
import { createStatusCore } from "../../../bun/services/statusCore";

const deps = {
  checkAllAgentsStatus: mock(() => Promise.resolve([])),
  notifier: { checkAndNotify: mock(() => Promise.resolve()), removeAgent: mock(() => {}) },
  setTimeoutFn: mock((cb: () => void) => { ... }) as unknown as typeof setTimeout,
  // ... etc
};

const service = createStatusCore(deps);
await service.beginStatusUpdates();
expect(deps.checkAllAgentsStatus).toHaveBeenCalledTimes(1);
```

Services using this pattern (`statusCore`, `retentionCore`) require **no `mock.module` calls at all**.

### Mocking timers via dependency injection

When a service uses `setTimeout`/`setInterval`/`clearTimeout`, inject them as dependencies instead of relying on the globals. This makes timing fully deterministic without fake-timer libraries.

```ts
// In the service
export function createStatusCore(deps: {
  setTimeoutFn: typeof setTimeout;
  clearTimeoutFn: typeof clearTimeout;
  // ...
}) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return {
    beginStatusUpdates() {
      timeoutId = deps.setTimeoutFn(() => poll(), interval);
    },
    stopStatusUpdates() {
      if (timeoutId !== null) deps.clearTimeoutFn(timeoutId);
    },
  };
}
```

In tests, capture the callback and invoke it manually:

```ts
let latestCallback: (() => void) | null = null;
const deps = {
  setTimeoutFn: mock((cb: () => void) => {
    latestCallback = cb;
    return 1;
  }) as unknown as typeof setTimeout,
  clearTimeoutFn: mock(() => { latestCallback = null; }),
};

// Trigger the next scheduled poll
if (latestCallback) await latestCallback();
```

### Move side effects out of service layer

When a service function triggers a side effect (e.g. `agentService.addAgent` calling `pushAgentsToDaemon`), testing that service in isolation forces you to mock the side-effect module — which can create circular import problems.

**Preferred pattern**: keep service functions as pure data operations; move orchestration (calling multiple services in sequence) to the handler/RPC layer that already imports both.

```ts
// ❌ agentService.addAgent orchestrates its own side effect
export async function addAgent(agent) {
  const result = await agentStorage.insertAgent(agent);
  pushAgentsToDaemon().catch(...); // ← pulls in daemonSyncService → circular
  return result;
}

// ✅ RPC handler orchestrates both
async function handleAddAgent(agent) {
  const result = await addAgent(agent);           // pure data op
  pushAgentsToDaemon().catch(...);                // side effect lives here
  return result;
}
```

This also makes each layer independently testable without circular mock workarounds.

---

## Tests without module mocking

Not every test file needs `mock.module()`. Many modules are pure logic and can be imported directly:

| Test file | What it tests | Mocking needed |
|---|---|---|
| `statusSyncService.test.ts` | In-memory status map | None |
| `agentRPC.test.ts` | Pure helper functions | None |
| `incidentCore.test.ts` | State machine logic | None |
| `machineIdService.test.ts` | Regex / string parsing | None |
| `shared/*.test.ts` | Utility functions | None |

If a module has no side effects, no native dependencies, and no hard-wired imports, write the test with a direct import. It runs faster and has less ceremony.

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
