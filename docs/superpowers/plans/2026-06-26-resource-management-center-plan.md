# Resource Management Center Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the resource center entry and refactor the resource management center to match the order management center style with a three-level resource menu.

**Architecture:** Keep the collab entry in `aps-optimization.js`. Rebuild `resource-center.html` as a standalone static page that mirrors `order-center.html` shell/sidebar/workspace styling while rendering the requested factory → area → table hierarchy.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js built-in test runner, in-app browser verification.

---

### Task 1: Update the contract tests

**Files:**
- Modify: `tests/operations-pages.test.js`

- [ ] Verify `#aps-resource-center-btn` appears before `#aps-resource-match-btn`.
- [ ] Verify the resource center click listener navigates to `resource-center.html`.
- [ ] Verify `resource-center.html` contains order-center-like shell/sidebar styles.
- [ ] Verify five first-level factories: 总装、两器、注塑、钣金、控制器.
- [ ] Verify second-level groups: 设备管理、人力资源.
- [ ] Verify equipment third-level tables: 品目表、资源表、制造BOM表、配套分厂提前期、生产订单表.
- [ ] Verify labor third-level tables: 出勤模式表、日历表.
- [ ] Verify the table headers: 序号、资源编码、资源名称、所属分厂、资源类型、状态、产能/班、负责人.

### Task 2: Reorder the collab entry

**Files:**
- Modify: `aps-optimization.js`

- [ ] Move “资源管理中心” to the left of “执行资源匹配”.
- [ ] Keep both event handlers unchanged except for the button order.

### Task 3: Refactor `resource-center.html`

**Files:**
- Modify: `resource-center.html`

- [ ] Replace the screenshot-style blue resource tree with an order-center-like sidebar.
- [ ] Add first-level factory buttons.
- [ ] Add equipment/labor second-level groups under each factory.
- [ ] Add the requested third-level table items.
- [ ] Rebuild the right workspace as an order-center-like content area with title, description, search, table, and pager.
- [ ] Add simple local interactivity for factory/table switching, search, and pagination.

### Task 4: Verify and publish

**Files:**
- Verify: `collab.html`
- Verify: `resource-center.html`

- [ ] Run `node --test tests/operations-pages.test.js`.
- [ ] Run `node --check aps-optimization.js`.
- [ ] Run `git diff --check`.
- [ ] Browser verify local entry order, menu hierarchy, order-center visual style, search, and table switching.
- [ ] Publish to GitHub Pages and verify the online script/page contain the new structure.
