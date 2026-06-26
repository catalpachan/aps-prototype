# Resource Management Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a resource management center entry beside resource matching and build a screenshot-inspired resource master data page.

**Architecture:** Keep the collab entry in `aps-optimization.js`, matching the existing order center navigation pattern. Add a standalone static `resource-center.html` that reuses global APS header assets and implements a local resource hierarchy/tree plus a resource master table.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner, in-app browser verification.

---

### Task 1: Lock the entry and page contract with tests

**Files:**
- Modify: `tests/operations-pages.test.js`
- Reference: `docs/superpowers/specs/2026-06-26-resource-management-center-design.md`

- [ ] **Step 1: Write the failing entry test**

Add assertions that `aps-optimization.js` contains `#aps-resource-center-btn` after `#aps-resource-match-btn`, and that the click listener navigates to `resource-center.html`.

- [ ] **Step 2: Write the failing page test**

Add assertions that `resource-center.html` exists and contains:

```js
['资源管理中心', '资源层级', '品目表', '输入关键词查询']
```

Also verify the resource tree, search box, table, pager, and key table headers.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
node --test tests/operations-pages.test.js
```

Expected: the new resource center test fails because the button and page do not exist.

### Task 2: Add the collab entry

**Files:**
- Modify: `aps-optimization.js`
- Test: `tests/operations-pages.test.js`

- [ ] **Step 1: Update resource card markup**

Wrap the resource card actions in a `.row` and add:

```html
<button class="btn sm primary" id="aps-resource-center-btn">资源管理中心</button>
```

immediately after the resource match button.

- [ ] **Step 2: Bind click navigation**

Add:

```js
const resourceCenterBtn = document.getElementById('aps-resource-center-btn');
resourceCenterBtn?.addEventListener('click', () => {
  window.location.href = 'resource-center.html';
});
```

- [ ] **Step 3: Run tests**

Run:

```bash
node --test tests/operations-pages.test.js
```

Expected: entry assertions pass, page assertions still fail until the page is created.

### Task 3: Build `resource-center.html`

**Files:**
- Create: `resource-center.html`
- Test: `tests/operations-pages.test.js`

- [ ] **Step 1: Create the page shell**

Reuse the APS header structure from `order-center.html`, with the 排产操作 nav item active.

- [ ] **Step 2: Add resource layout**

Create a two-column `.resource-center-shell` with:

- `.resource-center-sidebar`
- `.resource-center-workspace`

- [ ] **Step 3: Add screenshot-inspired tree and table**

Implement the resource tree, active 品目表 item, centered search input, data table, five rows, and pager.

- [ ] **Step 4: Add minimal interactivity**

Add search filtering for the static rows and pager button disabled states. Left tree buttons should update active state and keep the page in place.

- [ ] **Step 5: Run tests and syntax checks**

Run:

```bash
node --test tests/operations-pages.test.js
node --check aps-optimization.js
git diff --check
```

Expected: all tests pass and syntax checks are clean.

### Task 4: Browser verify and publish

**Files:**
- Verify: `collab.html`
- Verify: `resource-center.html`

- [ ] **Step 1: Open collab page locally**

Verify the resource card has both buttons and clicking “资源管理中心” opens the new page.

- [ ] **Step 2: Verify resource center layout**

Verify the left tree, active 品目表, search box, table headers/rows, pagination, and responsive behavior.

- [ ] **Step 3: Publish**

Use the same GitHub API publication flow if `git push` remains unavailable, then verify GitHub Pages contains the new page and entry.
