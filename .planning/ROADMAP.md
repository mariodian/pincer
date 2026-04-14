# Roadmap: Pincer

## Milestones

- **v0.3.0 Stability & Memory** - Phases 1-3 (shipped 2026-04-14)
- **v0.3.1 Incident Heatmap** - Phases 4-6 (in progress)

## Phases

- [ ] **Phase 4: Heatmap Foundations** - Component structure, CSS variables, error calculation, props
- [ ] **Phase 5: Grid Views & Tooltip** - 24h/7d views with hover tooltip
- [ ] **Phase 6: Horizontal Scroll** - Grid overflow handling

## Phase Details

### Phase 4: Heatmap Foundations
**Goal**: Heatmap component exists with correct styling system and calculation
**Depends on**: Nothing
**Requirements**: HEAT-01, HEAT-04, HEAT-05, HEAT-06, HEAT-09
**Success Criteria** (what must be TRUE):
  1. User sees heatmap component on incidents page instead of raw check dots
  2. Heatmap cells use CSS variables --heatmap (ok) and --heatmap-1 through --heatmap-5 (error gradient)
  3. Error intensity calculated as (failed + 0.5 * degraded) / total_checks, mapped to --heatmap-1 through --heatmap-5
  4. Unknown/no-result status treated as degraded in the calculation
  5. Component accepts columns prop (optional, auto-wrap if unset) and cellSize prop (default size-4)
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — CSS variables + Heatmap component
- [x] 04-02-PLAN.md — Timeline integration

### Phase 5: Grid Views & Tooltip
**Goal**: Both view modes render correctly with data tooltips
**Depends on**: Phase 4
**Requirements**: HEAT-02, HEAT-03, HEAT-07
**Success Criteria** (what must be TRUE):
  1. 24h view renders 24x6 grid of 10-minute cells (144 total)
  2. 7d view renders 24x7 grid of hourly cells (168 total)
  3. Tooltip shows per cell breakdown: "N checks | ok | degraded | failed"
**Plans**: TBD

### Phase 6: Horizontal Scroll
**Goal**: Heatmap handles overflow with horizontal scrolling
**Depends on**: Phase 5
**Requirements**: HEAT-08
**Success Criteria** (what must be TRUE):
  1. Grid scrolls horizontally when content exceeds container width
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Heatmap Foundations | 0/2 | Planning | - |
| 5. Grid Views & Tooltip | 0/TBD | Not started | - |
| 6. Horizontal Scroll | 0/TBD | Not started | - |

---

*Roadmap created: 2026-04-14 for v0.3.1 milestone*
