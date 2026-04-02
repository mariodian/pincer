<!-- Context: project-intelligence/lookup/naming-conventions | Priority: critical | Version: 1.0 -->

# Naming Conventions

**Purpose**: Quick reference for file, variable, and type naming.

## Table

| Type                   | Convention        | Example                    |
| ---------------------- | ----------------- | -------------------------- |
| Files (services/utils) | kebab-case.ts     | windowService.ts           |
| Files (components)     | PascalCase.svelte | AgentForm.svelte           |
| Constants              | UPPER_SNAKE_CASE  | MAC_TRAFFIC_LIGHTS_X       |
| Variables/functions    | camelCase         | applyMacOSWindowEffects    |
| Types/interfaces       | PascalCase        | WindowEffects, AgentStatus |
| Booleans               | is/has/can prefix | isMacOS, hasFocus          |
| Event handlers         | handle prefix     | handleClick, handleSubmit  |
| Database tables        | snake_case        | settings_general           |

**Reference**: See AGENTS.md § Formatting & Naming.
