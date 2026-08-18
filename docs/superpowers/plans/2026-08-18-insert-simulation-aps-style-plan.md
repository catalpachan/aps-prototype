# 插单模拟 APS 风格重构 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将插单模拟页面改造为无侧栏的深色 APS 页面，复用历史记录的导航、工具栏、面板和表格视觉语言，同时不改变模拟交互。

**Architecture:** `insert-simulation.html` 提供与 `schedule-history.html` 一致的 APS 顶部导航和一个无侧栏主内容区。`insert-simulation.css` 独立承载深色页面、工具栏和数据表视觉规则；`insert-simulation.js` 继续管理订单选择与计算，只因按钮/计数位置改变而复用现有 ID。测试以静态结构契约和现有 DOM 交互行为共同防止视觉重构破坏功能。

**Tech Stack:** 静态 HTML、CSS、原生 JavaScript、Node.js 内置 `node:test`、现有 `common.css` / `common.js`。

---

## File structure

| 文件 | 责任 |
| --- | --- |
| `insert-simulation.html` | APS 顶部导航、无侧栏的深色页面骨架、工具栏中的选择计数与运行按钮。 |
| `insert-simulation.css` | 仅作用于插单模拟页面的深色布局、面板、表格、状态及响应式规则。 |
| `insert-simulation.js` | 保持订单选择、半选、计算与状态提示逻辑；不修改演示数据和算法。 |
| `tests/operations-pages.test.js` | 验证页面结构、深色 APS 样式契约和既有交互。 |

### Task 1: Lock the APS restyle contract with failing tests

**Files:**
- Modify: `tests/operations-pages.test.js:245-286`
- Reference: `schedule-history.html:1225-1264`, `schedule-history.html:140-173`, `schedule-history.html:1021-1067`

- [ ] **Step 1: Replace the light-page structure expectations with APS shell expectations**

  In `insert simulation page exposes required structure`, replace the light theme/background assertions with assertions for global navigation, a no-sidebar dark main container, a toolbar and its right-aligned action area:

  ```js
  assert.match(html, /<header class="aps-header-layout">/);
  assert.match(html, /<a href="collab\.html" class="nav-item active">排产操作<\/a>/);
  assert.match(html, /<main id="app">[\s\S]*class="insert-simulation-page"/);
  assert.match(html, /class="insert-simulation-main"/);
  assert.doesNotMatch(html, /insert-simulation-side|<aside/);
  assert.match(html, /class="insert-simulation-toolbar"/);
  assert.match(html, /class="insert-simulation-toolbar-actions"/);
  ```

- [ ] **Step 2: Assert the selected count and run action appear in the toolbar in order**

  ```js
  const toolbar = readBetween(html, '<div class="insert-simulation-toolbar">', '</div>\n\n          <section class="simulation-card"');
  assert.match(toolbar, /id="insert-order-selected-count"[^>]*aria-live="polite"/);
  assert.match(toolbar, /<button[^>]*id="simulation-run-btn"[^>]*aria-busy="false"[^>]*>运行模拟<\/button>/);
  assert.ok(
    toolbar.indexOf('insert-order-selected-count') < toolbar.indexOf('simulation-run-btn'),
    'selected count should precede the run action in the toolbar'
  );
  ```

- [ ] **Step 3: Assert dark APS tokens and responsive table behavior**

  ```js
  const css = readHtml('insert-simulation.css');
  assert.match(css, /\.insert-simulation-main\s*\{[\s\S]*background:\s*#0b1321/);
  assert.match(css, /\.insert-simulation-toolbar\s*\{[\s\S]*background:\s*#10192b/);
  assert.match(css, /\.simulation-card\s*\{[\s\S]*background:\s*#0f172a/);
  assert.match(css, /\.simulation-table th\s*\{[\s\S]*background:\s*#17243a/);
  assert.match(css, /\.table-scroll\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.simulation-table\s*\{[\s\S]*min-width:\s*1120px/);
  ```

- [ ] **Step 4: Run the focused test to verify failure**

  Run: `node --test tests/operations-pages.test.js --test-name-pattern="insert simulation page exposes required structure"`

  Expected: FAIL because the current page still has `data-theme="light"`, lacks the APS header/toolbars, and uses light CSS colors.

- [ ] **Step 5: Commit the failing contract**

  ```bash
  git add tests/operations-pages.test.js
  git commit -m "test: define APS insert simulation layout"
  ```

### Task 2: Rebuild the page markup around the APS shell

**Files:**
- Modify: `insert-simulation.html:2-80`
- Reference: `schedule-history.html:1225-1267`, `schedule-history.html:1285-1307`

- [ ] **Step 1: Replace the root document/body structure with the shared APS header**

  Remove `data-theme="light"` from `<html>`. Copy the existing APS header semantics from `schedule-history.html`, retaining the shared `brand-block`, `aps-main-nav`, base selector, date chip, notification button and user dropdown. Mark the `collab.html` nav item active.

  ```html
  <header class="aps-header-layout">
    <div class="brand-block">
      <img class="header-logo" src="1c5703c9-aca0-43d1-9843-9d502cb66fd0.png" alt="APS Logo" width="143" height="44" />
      <div class="aps-console-title">
        <div class="aps-console-title-main">排产智能体</div>
        <div class="aps-console-title-sub">格力高级计划排程系统</div>
      </div>
    </div>
    <nav class="nav aps-main-nav" id="nav">
      <a href="decision.html" class="nav-item">决策分析</a>
      <a href="collab.html" class="nav-item active">排产操作</a>
      <a href="settings.html" class="nav-item">系统设置</a>
    </nav>
    <!-- 保留 schedule-history.html 同款 header-meta 内容和 ID，供 common.js 复用 -->
  </header>
  ```

- [ ] **Step 2: Add the no-sidebar dark content skeleton and toolbar**

  Wrap the page in `main#app > section.view.insert-simulation-page > section.insert-simulation-main`. Place title/description at the left of `.insert-simulation-toolbar`; place the existing `#insert-order-selected-count`, `#simulation-run-btn`, and return link within `.insert-simulation-toolbar-actions` at the right. The count must precede the run button; do not leave the run button inside the results panel.

  ```html
  <div class="insert-simulation-toolbar">
    <div class="insert-simulation-title">
      <span class="insert-simulation-title-mark" aria-hidden="true"></span>
      <div>
        <strong>插单模拟</strong>
        <p>选择待插入订单，预览其对当前产能的影响。</p>
      </div>
    </div>
    <div class="insert-simulation-toolbar-actions">
      <span id="insert-order-selected-count" class="selected-count-badge" aria-live="polite">已选 0 条</span>
      <button class="simulation-run-btn" id="simulation-run-btn" type="button" aria-busy="false">运行模拟</button>
      <a href="collab.html" class="module-return-link">返回排产操作</a>
    </div>
  </div>
  ```

- [ ] **Step 3: Retain both tables and their JavaScript contract**

  Keep every existing table ID, `<tbody>` ID, select-all input ID and header label exactly unchanged. Keep `simulation-card` as the two panel class names, but remove the old per-panel count span and result-panel run button. Put status output under the results heading by adding a dedicated host:

  ```html
  <div class="section-heading">
    <div>
      <h2 id="simulation-result-heading">模拟结果</h2>
      <p>查看插单后各分厂与工作中心的产能变化。</p>
      <div id="simulation-status-host"></div>
    </div>
  </div>
  ```

- [ ] **Step 4: Load shared header behavior before page behavior**

  Preserve `insert-simulation.js`, and append the common runtime before it:

  ```html
  <script src="common.js"></script>
  <script src="insert-simulation.js"></script>
  ```

- [ ] **Step 5: Run the focused structural test**

  Run: `node --test tests/operations-pages.test.js --test-name-pattern="insert simulation page exposes required structure"`

  Expected: still FAIL until Task 3 provides the required dark CSS declarations.

- [ ] **Step 6: Commit the shell**

  ```bash
  git add insert-simulation.html
  git commit -m "feat: add APS shell to insert simulation"
  ```

### Task 3: Implement the dark history-style visual system

**Files:**
- Modify: `insert-simulation.css:1-195`
- Reference: `schedule-history.html:140-173`, `schedule-history.html:1021-1067`

- [ ] **Step 1: Replace the light body and constrained page rules with the dark no-sidebar layout**

  ```css
  body { background: #0b1321; color: #dbe7f6; }

  .insert-simulation-page {
    min-height: calc(100vh - 96px);
    padding: 14px;
  }

  .insert-simulation-main {
    min-width: 0;
    min-height: calc(100vh - 124px);
    border: 1px solid #334155;
    border-radius: 10px;
    background: #0b1321;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.28);
    padding: 14px;
  }
  ```

- [ ] **Step 2: Define the history-style toolbar and action hierarchy**

  ```css
  .insert-simulation-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 62px;
    margin-bottom: 14px;
    padding: 12px 14px;
    border: 1px solid #334155;
    border-radius: 10px;
    background: #10192b;
  }

  .insert-simulation-toolbar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .simulation-run-btn {
    min-height: 34px;
    border: 1px solid #2563eb;
    border-radius: 7px;
    background: #2563eb;
    color: #fff;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 0 14px;
    cursor: pointer;
  }
  .simulation-run-btn:hover { background: #1d4ed8; }
  .simulation-run-btn:disabled { cursor: wait; opacity: .72; }
  ```

- [ ] **Step 3: Style title, selected-count, panels and secondary link**

  Implement a compact title mark and light title/subtitle colors consistent with `.schedule-history-title`; use a blue translucent `.selected-count-badge`; render `.module-return-link` as a dark ghost action. Replace the old white card/shadow styles with:

  ```css
  .simulation-card {
    min-width: 0;
    overflow: hidden;
    margin-bottom: 14px;
    border: 1px solid #334155;
    border-radius: 10px;
    background: #0f172a;
    box-shadow: 0 8px 20px rgba(2, 6, 23, 0.22);
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 62px;
    padding: 12px 16px;
    border-bottom: 1px solid #334155;
  }

  .section-heading h2 { color: #f8fafc; font-size: 15px; font-weight: 900; }
  .section-heading p { margin-top: 4px; color: #94a3b8; font-size: 12px; }
  ```

- [ ] **Step 4: Rebuild the tables with the APS dark table contract**

  Keep the existing widths and truncation selectors. Add dark table wrappers, separators, selected/hover states and semantic status colors:

  ```css
  .table-scroll {
    margin: 14px 16px 16px;
    border: 1px solid #2c3a51;
    border-radius: 8px;
    overflow-x: auto;
    background: #0b1321;
  }

  .simulation-table { width: 100%; min-width: 1120px; border-collapse: collapse; table-layout: fixed; background: #10192b; }
  .simulation-result-table { min-width: 920px; }
  .simulation-table th,
  .simulation-table td {
    border-right: 1px solid #1e2d43;
    border-bottom: 1px solid #23334b;
    padding: 12px 14px;
    color: #dbe7f6;
    font-size: 12px;
    line-height: 1.45;
    text-align: left;
    white-space: nowrap;
  }
  .simulation-table th { background: #17243a; color: #f8fafc; font-weight: 900; }
  .simulation-table tbody tr:nth-child(odd) { background: #0d1525; }
  .simulation-table tbody tr:hover { background: #132037; }
  .simulation-table tbody tr.selected { background: rgba(37, 99, 235, .16); }
  .simulation-status-normal { color: #4ade80 !important; font-weight: 800; }
  .simulation-status-attention { color: #fbbf24 !important; font-weight: 800; }
  ```

- [ ] **Step 5: Add mobile rules without moving the primary action out of the toolbar**

  At `max-width: 700px`, reduce page/main padding, stack the toolbar and section heading, and retain `.table-scroll { overflow-x: auto; }`. Keep action controls inside `.insert-simulation-toolbar-actions`; do not duplicate the run button.

- [ ] **Step 6: Run the focused contract test**

  Run: `node --test tests/operations-pages.test.js --test-name-pattern="insert simulation page exposes required structure"`

  Expected: PASS.

- [ ] **Step 7: Commit the visual system**

  ```bash
  git add insert-simulation.css
  git commit -m "style: align insert simulation with APS history"
  ```

### Task 4: Keep dynamic status output in the results panel and verify all behavior

**Files:**
- Modify: `insert-simulation.js:242-252` (only if needed)
- Test: `tests/operations-pages.test.js:245-<insert-simulation test block end>`

- [ ] **Step 1: Write a failing DOM test for the dedicated status host if the test harness can expose it**

  Extend the page structure test with:

  ```js
  assert.match(html, /id="simulation-status-host"/);
  ```

- [ ] **Step 2: Update `createStatusElement` to prefer the static host**

  ```js
  const host = documentRef.getElementById('simulation-status-host')
    || runButton.parentNode
    || documentRef.body
    || documentRef.documentElement;
  ```

  Keep the existing `simulation-status` ID, `aria-live="polite"`, class name, and no-selection behavior.

- [ ] **Step 3: Run focused interaction tests**

  Run: `node --test tests/operations-pages.test.js --test-name-pattern="insert simulation"`

  Expected: PASS, including deterministic result computation, empty-selection preservation, selection accessibility and escaping contract.

- [ ] **Step 4: Run broader static checks**

  Run: `node --check insert-simulation.js && node --test tests/kpi-library.test.js tests/operations-pages.test.js && git diff --check`

  Expected: syntax check exits 0; all tests pass; `git diff --check` prints no whitespace errors.

- [ ] **Step 5: Commit behavior-safe status placement**

  ```bash
  git add insert-simulation.html insert-simulation.js tests/operations-pages.test.js
  git commit -m "fix: retain insert simulation status feedback"
  ```

### Task 5: Perform local visual acceptance

**Files:**
- Verify only: `insert-simulation.html`, `insert-simulation.css`, `insert-simulation.js`

- [ ] **Step 1: Start or reuse a static local server from the feature worktree**

  Run: `python3 -m http.server 4173 --directory /Users/catalpachan/aps-prototype/.worktrees/insert-simulation`

  Expected: the server reports it is serving HTTP on port 4173.

- [ ] **Step 2: Verify desktop layout at `http://localhost:4173/insert-simulation.html`**

  Confirm: APS global header is present; no sidebar exists; body/toolbars/cards/tables are dark; selected count and blue “运行模拟” button are right-aligned in the top toolbar; the return link is secondary.

- [ ] **Step 3: Verify functional UI states**

  Confirm initial state has 3 selected orders and an indeterminate select-all checkbox. Clear selection and click “运行模拟” to observe “请先选择插单订单” while results remain. Select two orders and click again; first result should be `10 / 1790 / 0.6%`.

- [ ] **Step 4: Verify narrow layout**

  At approximately 390px viewport width, confirm toolbar actions wrap without overlap, both tables use horizontal scrolling, and no body-level horizontal overflow appears.

- [ ] **Step 5: Record completion status**

  Run: `git status --short --branch && git log --oneline -5`

  Expected: clean feature worktree on `codex/insert-simulation`, with the APS styling commits included.
