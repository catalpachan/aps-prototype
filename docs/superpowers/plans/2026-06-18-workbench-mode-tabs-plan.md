# Workbench Mode Tabs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the scheduling workbench week view into a default Gantt mode and a date-driven list mode without changing the existing month/day views or scheduling interactions.

**Architecture:** Keep the feature inside the existing `collab.html` workbench. Add two mode panels beneath the primary month/week/day controls, share the existing week data caches and `selectedWeekDayIndex`, and use one small state transition function to update tab ARIA state and panel visibility.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner, in-app browser verification.

---

### Task 1: Lock the mode layout contract with tests

**Files:**
- Modify: `tests/operations-pages.test.js`
- Reference: `docs/superpowers/specs/2026-06-18-workbench-mode-tabs-design.md`

- [ ] **Step 1: Write the failing markup test**

Add a test that reads `collab.html` and verifies:

```js
assert.match(html, /id="week-mode-tabs"[^>]*role="tablist"/);
assert.match(html, /data-week-mode="gantt"[^>]*aria-selected="true"[^>]*>甘特图模式<\/button>/);
assert.match(html, /data-week-mode="list"[^>]*aria-selected="false"[^>]*>列表模式<\/button>/);
assert.match(html, /id="week-mode-panel-gantt"[\s\S]*workbench-note-row[\s\S]*id="week-calendar"[\s\S]*week-gantt-wrap/);
assert.match(html, /id="week-mode-panel-list"[\s\S]*id="week-list-calendar"[\s\S]*id="week-day-tables"/);
```

- [ ] **Step 2: Write the failing behavior test**

Verify the page script contains:

```js
let currentWeekMode = 'gantt';
function setWeekMode(mode, opts = {}) {
  const targetMode = ['gantt', 'list'].includes(mode) ? mode : 'gantt';
}
```

Also verify that list-calendar clicks call `onWeekDaySelect(dayIdx)` without `{ openDayView: true }`, while the Gantt calendar retains the existing day-view transition.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
node --test tests/operations-pages.test.js
```

Expected: the new workbench mode test fails because the tablist, mode panels, and mode state do not exist.

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/operations-pages.test.js
git commit -m "test: define workbench mode tabs"
```

### Task 2: Add mode panels and shared week-mode state

**Files:**
- Modify: `collab.html`
- Test: `tests/operations-pages.test.js`

- [ ] **Step 1: Add the mode tab markup**

Inside `#view-panel-week`, add a `role="tablist"` containing:

```html
<button type="button" role="tab" data-week-mode="gantt" aria-selected="true">甘特图模式</button>
<button type="button" role="tab" data-week-mode="list" aria-selected="false">列表模式</button>
```

Create:

- `#week-mode-panel-gantt` containing `.workbench-note-row`, `#week-calendar`, and `.week-gantt-wrap`.
- `#week-mode-panel-list` containing `#week-list-calendar` and `#week-day-tables`.

- [ ] **Step 2: Add restrained mode styles**

Add compact segmented-tab styles, mode panel visibility, and the compact list calendar. The list calendar must:

- Use seven stable columns on desktop.
- Allow horizontal scrolling below the existing responsive breakpoint.
- Keep button dimensions stable.
- Reuse load-level colors without the larger load percentage layout.

- [ ] **Step 3: Add mode state and switching**

Near the existing week state, add:

```js
let currentWeekMode = 'gantt';
```

Implement `setWeekMode(mode, opts = {})` to:

- Validate to `gantt` or `list`.
- Update `currentWeekMode`.
- Toggle tab `.active` and `aria-selected`.
- Toggle the two mode panels.
- Refresh the selected list date when entering list mode.
- Avoid changing `currentWorkbenchView`.

- [ ] **Step 4: Render the compact list calendar**

Add `renderWeekListCalendar()` using `weekDatesCache`, `selectedWeekDayIndex`, and existing load helpers. Each date button calls:

```js
onWeekDaySelect(dayIdx);
```

This updates the shared date and list table but does not enter day view.

- [ ] **Step 5: Synchronize both date controls**

Update `onWeekDaySelect()` so active state is synchronized for:

- `#week-calendar .week-day-card`
- `#week-list-calendar [data-day-idx]`

After `renderWeekView()` populates caches, render the compact calendar before rendering the selected day table.

- [ ] **Step 6: Bind the mode controls**

During `DOMContentLoaded`, bind `[data-week-mode]` buttons to `setWeekMode()`. Initialize Gantt mode silently after the week view has rendered.

- [ ] **Step 7: Run tests and verify GREEN**

Run:

```bash
node --test tests/operations-pages.test.js
node --check aps-optimization.js
git diff --check
```

Expected: all tests pass, JavaScript syntax checks pass, and no whitespace errors are reported.

- [ ] **Step 8: Commit the implementation**

```bash
git add collab.html tests/operations-pages.test.js
git commit -m "feat: split workbench gantt and list modes"
```

### Task 3: Verify behavior and responsive layout

**Files:**
- Verify: `collab.html`
- Verify: `tests/operations-pages.test.js`

- [ ] **Step 1: Start the local static server**

Run the existing local server on an available port and open:

```text
http://127.0.0.1:<port>/collab.html
```

- [ ] **Step 2: Verify desktop behavior**

At a desktop viewport:

- Week view defaults to Gantt mode.
- Only note row, week calendar, and week Gantt are visible in Gantt mode.
- Switching to list mode hides all Gantt-mode content.
- List mode shows the compact seven-day control and `.week-day-table-card`.
- Selecting another list date updates the table and keeps the page in week view.
- Returning to Gantt mode preserves the selected date.
- Plant filtering updates both modes.

- [ ] **Step 3: Verify narrow viewport**

At a mobile/narrow viewport:

- Mode tabs do not wrap incoherently.
- Compact dates are horizontally accessible.
- Table content does not overlap the mode controls.
- Existing month/week/day controls remain usable.

- [ ] **Step 4: Run final verification**

Run:

```bash
node --test tests/operations-pages.test.js
git diff --check
git status --short
```

Expected: all tests pass, no whitespace errors, and only intentional feature files are modified.

- [ ] **Step 5: Commit any verification refinements**

If browser verification required CSS or accessibility corrections:

```bash
git add collab.html tests/operations-pages.test.js
git commit -m "fix: refine workbench mode tabs"
```
