# KPI Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings-side KPI library with screenshot-inspired filtering and multi-select controls, persist the selection locally, and render the saved metrics in the decision analysis KPI Dashboard.

**Architecture:** Keep the existing `settings.html` same-page subview pattern and add a small shared `kpi-library.js` classic script containing the 40 metric definitions, default IDs, storage key, and pure persistence helpers. `settings.html` owns the edit state and controls; `decision.html` reads the shared saved configuration and owns dashboard card rendering. The existing KPI fusion band and planner todo module remain unchanged.

**Tech Stack:** Static HTML, CSS, browser JavaScript, `localStorage`, Node built-in `node:test` and `node:assert/strict`.

---

## File Map

- Create: `/Users/catalpachan/aps-prototype/kpi-library.js` — shared metric catalog, stable IDs, default selection, storage normalization and persistence helpers.
- Create: `/Users/catalpachan/aps-prototype/tests/kpi-library.test.js` — unit tests for the shared catalog and storage helpers.
- Modify: `/Users/catalpachan/aps-prototype/settings.html` — add the left-menu item, metric-library subview markup/styles, edit-state rendering and save/reset/clear interactions.
- Modify: `/Users/catalpachan/aps-prototype/decision.html` — replace the three configurable hard-coded KPI cards with a dynamic card host, keep the planner todo entry card, and render saved metric definitions while preserving fusion and todo modules.
- Modify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js` — add static integration assertions for the new menu, shared script, storage key, settings controls and decision dashboard host.

### Task 1: Add failing tests for the shared KPI catalog

**Files:**
- Create: `tests/kpi-library.test.js`

- [ ] **Step 1: Write the failing unit tests**

Add Node tests that require `../kpi-library.js` and verify:

- the catalog has exactly 40 metrics;
- every metric has a unique `id`, `category`, `name`, `description`, `unit`, `value`, `trend` and `note`;
- category counts match the spec (8/4/3/2/8/3/2/4/5/1);
- the ordered catalog IDs and names match the approved 40-item spec table;
- `DEFAULT_KPI_IDS` has exactly the five stable IDs `production-total`, `line-utilization`, `theoretical-capacity`, `actual-capacity`, and `production-utilization`;
- the storage key is `aps.kpi.library.config.v1`;
- `loadKpiLibraryConfig()` returns defaults with an empty storage object, ignores malformed JSON and filters unknown IDs;
- `saveKpiLibraryConfig()` writes a JSON payload containing `selectedIds` and `updatedAt`.
- no-argument load/save calls use a mocked `globalThis.localStorage`, invalid payloads fall back to defaults, and a storage write failure is surfaced to the caller.

Use a tiny in-memory storage double with `getItem` and `setItem` methods so tests do not depend on a browser.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/kpi-library.test.js`

Expected: FAIL because `kpi-library.js` does not exist yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/kpi-library.test.js
git commit -m "test: define KPI library catalog contract"
```

### Task 2: Implement the shared KPI catalog and persistence helpers

**Files:**
- Create: `kpi-library.js`
- Test: `tests/kpi-library.test.js`

- [ ] **Step 1: Add the 40 metric definitions from the approved spec**

Define the exact stable IDs, categories, names, descriptions, units, display values, trend values and notes from `docs/superpowers/specs/2026-08-17-kpi-library-design.md`. Keep the catalog as a frozen or otherwise non-mutated array so page-level selection state cannot alter metadata.

- [ ] **Step 2: Add the shared API**

Expose these classic-script globals and CommonJS exports for tests:

```js
KPI_LIBRARY_STORAGE_KEY
KPI_METRICS
DEFAULT_KPI_IDS
getDefaultKpiLibraryConfig()
loadKpiLibraryConfig(storage)
saveKpiLibraryConfig(config, storage)
```

`loadKpiLibraryConfig(storage = globalThis.localStorage)` and `saveKpiLibraryConfig(config, storage = globalThis.localStorage)` must default to browser `localStorage` when available, safely handle missing storage, malformed JSON, invalid payloads and unknown metric IDs, and return/write only valid known IDs. When storage is unavailable, loading falls back to defaults and saving throws so the page can show its failure toast. Both functions must return/copy data without mutating the catalog.

- [ ] **Step 3: Run the focused tests**

Run: `node --test tests/kpi-library.test.js`

Expected: PASS for all catalog and storage tests.

- [ ] **Step 4: Commit the shared module**

```bash
git add kpi-library.js tests/kpi-library.test.js
git commit -m "feat: add shared KPI library catalog"
```

### Task 3: Add the settings-side KPI library UI

**Files:**
- Modify: `settings.html:6-205` for KPI library styles.
- Modify: `settings.html:255-265` for the left-menu item.
- Modify: `settings.html:415-480` for the new subview markup.
- Modify: `settings.html:547-575` and the end-of-file inline script for behavior.

- [ ] **Step 1: Add the shared script before settings inline code**

Load `<script src="kpi-library.js"></script>` after `common.js` and before the settings inline script so the settings functions can use the catalog and storage helpers.

- [ ] **Step 2: Add menu and subview markup**

Add a `data-settings-sub="kpi-library"` left-menu button and an `#settings-sub-kpi-library` panel containing:

- page heading and description;
- global selected count and `清空选择` control in the heading row;
- search input `#kpi-library-search`;
- category filter buttons or select using the exact 11 category names;
- count text showing `匹配数量 / 40` and global selected count;
- `#kpi-library-grid` card host and a no-results empty state;
- bottom action bar with `#kpi-library-reset` and `#kpi-library-save`.

Do not include the removed top tabs “总览 / 指标库 / 数据查看 / 插单模拟”.

- [ ] **Step 3: Add responsive light/dark theme styles**

Use existing CSS variables and card/button patterns. Match the screenshot’s blue selection state, light surface, 4-column desktop grid, and responsive 2-column/1-column breakpoints. Keep controls keyboard-focusable and use visible labels/`aria-label`s for search, category controls, cards and actions.

- [ ] **Step 4: Implement edit-state rendering**

Add a small settings-page state object with:

- `selectedIds` initialized from `loadKpiLibraryConfig()`;
- `savedIds` as the last persisted snapshot;
- `query` and `category` filter state.

Implement `renderKpiLibrary()` to filter by name/description and category without changing selections, update the global selected count, update `匹配数量 / 全库总数`, render all visible cards, and render `未找到匹配指标` when appropriate. Every card must include its current checkbox/selected visual state, metric name, description and unit. Cards should toggle selection without submitting forms and expose an accessible name/state.

- [ ] **Step 5: Implement clear, reset and save actions**

Implement:

- `clearKpiLibrarySelection()` — clear only the current edit state and rerender;
- `resetKpiLibrarySelection()` — restore `savedIds` and rerender;
- `saveKpiLibrarySettings()` — call `saveKpiLibraryConfig`, update `savedIds`, show `已应用到决策分析 KPI 看板`, and catch storage failures with `指标配置保存失败，请重试` without discarding edit state.

Update `switchSettingsSub()` to render when `targetSub === 'kpi-library'`, and keep the existing URL synchronization behavior so `settings.html?sub=kpi-library` opens the new panel directly.

- [ ] **Step 6: Add the shared script to the settings page and run static checks**

Run: `node --check kpi-library.js`

Run: `node --test tests/kpi-library.test.js`

Expected: syntax check and focused tests pass.

- [ ] **Step 7: Commit the settings UI**

```bash
git add settings.html
git commit -m "feat: add KPI library settings view"
```

### Task 4: Render saved metrics in the decision analysis KPI Dashboard

**Files:**
- Modify: `decision.html:1108-1490` for dynamic-card layout support and empty state styles.
- Modify: `decision.html:1600-1677` to replace hard-coded metric cards with a dynamic host.
- Modify: `decision.html:1715-1720` to load `kpi-library.js` before the decision inline script.
- Modify: `decision.html:1751-1755` and `decision.html:2191-2196` for render integration.

- [ ] **Step 1: Replace only the configurable metric-card block with a host**

Keep `.kpi-fusion-band`, `.decision-top-grid`, the right-side planner todo panel and the existing `#planner-todo-entry-card` intact. Replace only the three hard-coded configurable metric cards (inventory turnover, today plan completion and WIP) with `<div id="decision-kpi-cards" ...></div>` so the saved KPI selection controls only the configurable card region and the planner todo entry remains unchanged.

- [ ] **Step 2: Add dynamic card rendering**

Load `kpi-library.js` and implement `renderConfiguredKpiCards()` using `loadKpiLibraryConfig()`. The `#decision-kpi-cards` host must use `display: contents` (or an equivalent explicit grid rule) so its rendered metric cards remain direct visual grid items of the existing four-column `.kpi-dashboard`; the unchanged planner todo entry card must continue to occupy the dashboard grid as its own item. For each selected ID, find the catalog item and render a card using the existing `.kpi-card`, `.kpi-card-bg`, `.kpi-card-content`, `.kpi-trend`, `.kpi-value`, `.kpi-unit`, `.kpi-label` and `.kpi-sub` visual language. Cycle the existing blue/green/orange/purple card classes for variety; do not add new business semantics or mutate the catalog.

Use the metric’s `value`, `unit`, `name`, `trend` and `note` fields. Render `↑`, `↓` or `→` consistently for `up`, `down` and `stable`. When there are no selected IDs, render an accessible empty state that says the user can go to 系统设置 → 指标库 to select KPIs.

- [ ] **Step 3: Wire rendering into the existing lifecycle**

Call `renderConfiguredKpiCards()` from `renderDecisionCenter()` before `renderTodoList()`, and keep the existing `DOMContentLoaded` call unchanged apart from the new render being included through that function.

- [ ] **Step 4: Verify decision page behavior**

Run: `node --check kpi-library.js`

Run: `node --test tests/kpi-library.test.js`

Expected: all focused tests pass; the decision page source contains the shared script, dynamic card host, empty-state copy and shared storage key usage through the module.

- [ ] **Step 5: Commit the decision integration**

```bash
git add decision.html
git commit -m "feat: apply KPI library selection to dashboard"
```

### Task 5: Add page-level regression assertions and verify the complete flow

**Files:**
- Modify: `tests/operations-pages.test.js`

- [ ] **Step 1: Add static integration assertions**

Assert that:

- `settings.html` contains the `kpi-library` menu item and subview;
- `settings.html` includes `kpi-library.js`, search/filter/grid/save/reset/clear IDs, the 11 category labels and no removed top-tab markup inside the KPI library subview;
- `decision.html` includes `kpi-library.js`, `decision-kpi-cards`, the empty-state copy, keeps `planner-todo-entry-card`, and no longer contains the three configurable hard-coded card IDs `d-kpi-oee`, `d-kpi-plan` or `d-kpi-wip`;
- `kpi-library.js` exposes the storage key and default IDs.

Add a syntax-only compile check using `node:vm.Script` for every inline script extracted from `settings.html` and `decision.html`; this validates HTML-embedded JavaScript without executing browser-only DOM code.

- [ ] **Step 2: Run all automated checks**

Run: `node --test tests/kpi-library.test.js tests/operations-pages.test.js`

Expected: PASS with zero failures.

- [ ] **Step 3: Run manual browser verification**

Open `settings.html?sub=kpi-library` and verify:

1. “指标库” is highlighted in the system settings sidebar.
2. The page starts at search/filter/card content, with no four removed top tabs.
3. Five defaults are selected; search and category counts use `匹配数量 / 40`; selection count is global.
4. Clear and reset affect only the edit state until save.
5. Save shows the success toast.
6. Open `decision.html` and confirm only the saved cards render.
7. Clear all, save, reload `decision.html`, and confirm the empty state.
8. Reload settings and decision pages and switch themes without losing saved state.

- [ ] **Step 4: Commit regression coverage**

```bash
git add tests/operations-pages.test.js
git commit -m "test: cover KPI library integration"
```

### Task 6: Final verification before handoff

**Files:**
- Verify: `kpi-library.js`, `settings.html`, `decision.html`, `tests/kpi-library.test.js`, `tests/operations-pages.test.js`

- [ ] **Step 1: Inspect the final diff and status**

Run: `git diff HEAD~5..HEAD --stat`

Run: `git diff HEAD~5..HEAD -- kpi-library.js settings.html decision.html tests/kpi-library.test.js tests/operations-pages.test.js`

Review every changed hunk for scope, preservation of the planner todo card, and consistency with the approved spec.

Run: `git diff --check HEAD~5..HEAD`

Run: `git status --short`

Expected: the complete intended diff is reviewed, `git diff --check` reports no whitespace errors, and only the intended KPI library files are committed; pre-existing unrelated untracked files remain untouched.

- [ ] **Step 2: Run the final test command**

Run: `node --test tests/kpi-library.test.js tests/operations-pages.test.js`

Expected: PASS with zero failures.

- [ ] **Step 3: Verify no removed UI tabs were introduced**

Run: `rg -n "总览|数据查看|插单模拟" settings.html decision.html`

Expected: no KPI-library top-tab markup; if unrelated existing product copy matches, review it rather than deleting it automatically.
