# 插单模拟 Implementation Plan

> **For agentic workers:** REQUIRED: Use `@superpowers:subagent-driven-development` to implement this plan. Use a fresh subagent for each implementation task and perform the required two-stage review after each task.

**Goal:** 在可视化交互工作台的“历史记录”右侧增加“插单模拟”入口，并实现按参考图展示插单列表、模拟结果和前端演示运行的独立页面。

**Architecture:** `collab.html` 只负责新增入口和独立导航，不改变现有历史记录面板。新增 `insert-simulation.html` 作为浅色独立页面，`insert-simulation.css` 负责页面视觉，`insert-simulation.js` 负责演示数据、确定性计算、表格渲染和选择状态；计算函数通过 `window.InsertSimulation` 暴露，方便 Node VM 行为测试和未来替换 API。

**Tech Stack:** 静态 HTML、CSS、浏览器原生 JavaScript、Node.js 内置 `node:test` / `node:vm`。

---

## 文件边界

- Modify: `/Users/catalpachan/aps-prototype/collab.html` — 工作台入口按钮、按钮样式和导航事件。
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.html` — 独立页面骨架、两个表格、返回入口、运行按钮和可访问性标记。
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.css` — 参考图对应的浅色页面、表格、状态和窄屏横向滚动样式。
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.js` — 5 条以上插单数据、8 条结果模板、选择状态、确定性计算、HTML 转义和 DOM 事件。
- Modify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js` — 入口、页面结构、表头、数据密度和计算/选择行为测试。

## 实现约束

- 不修改 `workbench-history-panel`、`showScheduleHistory()` 或现有历史记录按钮的行为。
- 新页面使用 `data-theme="light"`，不加载会覆盖主题的 `common.js`；只加载 `common.css` 并在页面 CSS 中明确浅色表面，避免主题状态污染。
- 默认显示至少 5 条插单记录和 8 条模拟结果；首 3 条订单默认勾选，这是为了贴近参考图的视觉假设，测试会固定该行为。
- 运行模拟使用规格文档中的确定性规则：求选中订单总量，按每条结果的 `allocationRate` 分配插单产能，计算剩余产能、利用率和状态。8 条 `allocationRate` 之和必须为 1。
- 若使用 `innerHTML` 拼接动态文本，统一先调用 `escapeHTML`；若使用 `textContent` 和 `setAttribute('title', value)`，则直接使用原始值，避免双重转义。

## 每个实现任务的强制复审流程

Task 2–5 每次实现都必须使用 `@superpowers:subagent-driven-development`：

1. 派发一个全新的实现子代理，提供该任务的完整文字、规格文档路径和相关文件路径；子代理自行测试、审查并提交。
2. 只在实现子代理报告完成且测试通过后，派发规格符合性审查子代理，使用 `/Users/catalpachan/.codex/superpowers/skills/subagent-driven-development/spec-reviewer-prompt.md` 的模板，提供该任务完整要求、实现报告、base SHA 和 HEAD SHA。
3. 若规格审查发现问题，由同一个实现子代理修复；重新运行测试并重新进行规格审查，直到 ✅ 通过。
4. 规格审查通过后，派发代码质量审查子代理，使用 `/Users/catalpachan/.codex/superpowers/skills/subagent-driven-development/code-quality-reviewer-prompt.md`，检查职责边界、测试质量、可维护性和无关变更。
5. 若代码质量审查发现问题，由同一个实现子代理修复；重新运行测试并重新审查，直到 ✅ 通过。两阶段均通过后才进入下一个任务。

### Task 1: 为工作台入口写失败测试

**Files:**
- Modify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`
- Test: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`

- [ ] **Step 1: 添加工作台入口测试**

在现有工作台测试附近新增测试，名称固定为 `insert simulation entry sits beside workbench history`。断言 `workbench-history-btn` 存在，`insert-simulation-btn` 紧随其后，按钮文本为“插单模拟”，脚本包含导航到 `insert-simulation.html` 的点击处理；同时断言历史按钮仍绑定 `showScheduleHistory`。

- [ ] **Step 2: 运行失败测试确认测试有效**

Run: `node --test --test-name-pattern="insert simulation entry" tests/operations-pages.test.js`

Expected: FAIL，因为新按钮和监听尚不存在。不要通过放宽断言让空实现通过。

- [ ] **Step 3: 提交聚焦的红测试**

```bash
git add tests/operations-pages.test.js
git commit -m "test: define insert simulation entry"
```

### Task 2: 实现工作台入口并保持历史记录回归安全

**Files:**
- Modify: `/Users/catalpachan/aps-prototype/collab.html:49-52, 312-313, 2143-2144`
- Test: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`

- [ ] **Step 1: 增加入口按钮样式**

在现有 `.workbench-history-btn` 样式旁增加 `.insert-simulation-btn` 的基础、hover 和 focus-visible 样式，沿用工具栏高度、圆角和蓝色强调，不改变历史按钮的选择器或 active 状态。

- [ ] **Step 2: 在历史记录右侧插入按钮**

在 `workbench-history-btn` 后直接插入 `<button class="insert-simulation-btn" id="insert-simulation-btn" type="button">插单模拟</button>`，确保它仍位于视角切换器之前。

- [ ] **Step 3: 添加独立导航监听**

在现有 DOMContentLoaded 初始化中，为 `insert-simulation-btn` 添加点击监听，执行 `window.location.href = 'insert-simulation.html'`。不要调用 `showScheduleHistory()`、切换 `workbench-history-panel` 或修改 `currentWorkbenchView`。

- [ ] **Step 4: 运行入口绿测试并检查内联脚本**

Run: `node --test --test-name-pattern="insert simulation entry|collab workbench exposes scheduling history" tests/operations-pages.test.js`

Expected: 入口和历史回归断言 PASS。该测试的末尾必须明确调用 `assertInlineScriptsCompile('collab.html')`，使工作台修改后的内联脚本在此步骤被检查。

- [ ] **Step 5: 提交入口实现**

```bash
git add collab.html
git commit -m "feat: add insert simulation workbench entry"
```

完成提交后执行上面的“每个实现任务的强制复审流程”；两阶段均通过后再进入 Task 3。

### Task 3: 为页面结构写测试并创建参考图风格的独立页面

**Files:**
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.html`
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.css`
- Modify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`

- [ ] **Step 1: 先添加页面结构测试**

新增测试，名称固定为 `insert simulation page exposes required structure`。读取 HTML，断言文件存在、标题/区块标题/返回文案/运行按钮存在、两个表格 ID 稳定、页面声明浅色主题，并用 `readTableHeaders` 精确断言两张表的列顺序。数据源数量和计算行为留到 Task 4 的 JS 测试，不从 HTML 推断。

- [ ] **Step 2: 运行页面结构红测试**

Run: `node --test --test-name-pattern="insert simulation page exposes required structure" tests/operations-pages.test.js`

Expected: FAIL，因为 `insert-simulation.html` 和 CSS 尚不存在。

- [ ] **Step 3: 建立页面骨架**

创建 `lang="zh-CN"`、`data-theme="light"` 的 HTML 页面，加载 `common.css`、`insert-simulation.css` 和 `insert-simulation.js`。页面包含页面标题、`href="collab.html"` 的“返回排产操作”、`插单列表`区块、`模拟结果`区块以及运行按钮。

- [ ] **Step 4: 建立可测试的表格结构**

创建 `id="insert-order-table"` 和 `id="simulation-result-table"` 的表格，并在 `thead` 中按规格写出准确列名。插单表头复选框使用 `id="insert-order-select-all"`、`aria-label="全选插单订单"`；选中数量放在 `id="insert-order-selected-count"` 且 `aria-live="polite"` 的元素中；运行按钮使用 `id="simulation-run-btn"` 并带 `aria-busy="false"`。

- [ ] **Step 5: 添加浅色布局样式**

在 `insert-simulation.css` 中实现浅灰页面背景、白色卡片、蓝色边框/按钮、灰色表头、选中行浅蓝背景和绿色“正常”状态。两张表外层使用 `overflow-x: auto`，长物料编码/描述使用省略号；窄屏保留表格最小宽度，避免列被压缩到不可读。

- [ ] **Step 6: 运行页面结构绿测试并提交**

Run: `node --test --test-name-pattern="insert simulation page exposes required structure" tests/operations-pages.test.js`

Expected: 页面标题、返回入口、表格 ID、表头、主题声明等静态断言 PASS。

```bash
git add insert-simulation.html insert-simulation.css tests/operations-pages.test.js
git commit -m "feat: add insert simulation page shell"
```

完成提交后执行“每个实现任务的强制复审流程”；两阶段均通过后再进入 Task 4。

### Task 4: 为演示数据和交互写行为测试并实现确定性模拟

**Files:**
- Create: `/Users/catalpachan/aps-prototype/insert-simulation.js`
- Modify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`

- [ ] **Step 1: 先添加 Node VM 和轻量 DOM 行为测试**

新增测试，名称固定为 `insert simulation calculates deterministic capacity results`、`insert simulation preserves results without a selection` 和 `insert simulation keeps selection state accessible`。读取 JS 而非 HTML，在提供 `window`、`document.addEventListener()` 和 `Set` 的 VM 上下文中执行脚本，从 `window.InsertSimulation` 读取数据和函数。

纯函数测试使用字段断言，避免跨 VM realm 的 `assert.deepEqual`：

```js
assert.ok(api.insertOrders.length >= 5);
const totalCount = api.insertOrders.length;
const emptyState = api.getSelectionState(new Set(), totalCount);
assert.equal(emptyState.isAllSelected, false);
assert.equal(emptyState.isIndeterminate, false);
const partialState = api.getSelectionState(new Set(['order-1']), totalCount);
assert.equal(partialState.isAllSelected, false);
assert.equal(partialState.isIndeterminate, true);
const allState = api.getSelectionState(new Set(api.insertOrders.map(({ id }) => id)), totalCount);
assert.equal(allState.isAllSelected, true);
assert.equal(allState.isIndeterminate, false);
assert.equal(api.simulationResultTemplates.length, 8);
const allocationTotal = api.simulationResultTemplates.reduce((sum, row) => sum + row.allocationRate, 0);
assert.ok(Math.abs(allocationTotal - 1) < 1e-10);
const results = api.calculateSimulationResults(api.insertOrders, new Set(['order-1', 'order-2']), api.simulationResultTemplates);
assert.equal(results[0].insertCapacity, 10);
assert.equal(results[0].remainingCapacity, 1790);
assert.equal(results[0].utilization, '0.6%');
```

轻量 DOM mock 至少验证：初始化渲染 5 条订单和 8 条结果、默认结果先显示、空选择运行提示且不改变结果、二次有效运行替换结果而不是追加、运行按钮存在 `aria-busy` 状态、选中数量和 `indeterminate` 同步，以及动态 `<img/onerror>` 试值不会被当作 HTML 执行且 `title` 保留完整文本。若实现使用 `textContent`/`setAttribute`，测试验证这些 API 的调用结果而不是重复 HTML 转义。

- [ ] **Step 2: 运行行为红测试**

Run: `node --test --test-name-pattern="insert simulation calculates|insert simulation preserves|insert simulation keeps" tests/operations-pages.test.js`

Expected: FAIL，因为 `insert-simulation.js` 和 `window.InsertSimulation` 尚不存在。

- [ ] **Step 3: 定义静态数据和纯函数 API**

定义至少 5 条 `insertOrders` 和 8 条 `simulationResultTemplates`。第一条结果使用 `capacityLimit: 1800`、`scheduledCapacity: 0`、`allocationRate: 0.15`；前两条订单数量固定为 34 和 32。实现并暴露 `getSelectionState(selectedIds, totalCount)`、`calculateSimulationResults(orders, selectedIds, templates)` 和 `escapeHTML(value)`。

- [ ] **Step 4: 实现确定性计算**

在 `calculateSimulationResults` 中求选中订单的 `orderQty` 总和，按 `Math.round(total * allocationRate)` 得到 `insertCapacity`，按 `Math.max(0, capacityLimit - scheduledCapacity - insertCapacity)` 得到 `remainingCapacity`，按 `Math.round(insertCapacity / capacityLimit * 1000) / 10` 拼接百分号得到利用率；利用率不超过 80% 时状态为“正常”，否则为“需关注”。计算函数返回新对象，不能修改模板数据。

- [ ] **Step 5: 实现渲染和安全文本处理**

实现订单行、结果行和选中数量渲染。统一使用 DOM `textContent` 和 `setAttribute('title', value)` 写入动态值；`escapeHTML` 作为测试和未来 `innerHTML` 渲染的安全边界保留。初始使用前 3 条订单的选中状态和默认结果模板，确保页面打开即接近参考图。

- [ ] **Step 6: 实现选择与全选状态**

实现单行复选框和表头全选事件。每次更新都从 `selectedOrderIds` 派生 `checked`、`indeterminate` 和选中数量，并同步 `aria-checked`/`aria-label`；取消全部后运行按钮保持可见且仍可触发 handler，handler 提示“请先选择插单订单”并保留最近一次有效结果，不把按钮永久设为 `disabled`。

- [ ] **Step 7: 实现运行按钮和返回行为**

运行按钮点击时先检查选择集合；为空时显示提示，不覆盖结果。有效运行时短暂设置 `disabled=true` 和 `aria-busy=true`，生成新结果、替换结果表而非追加、恢复按钮状态，并将状态文字渲染为“正常”或“需关注”。返回链接直接导航到 `collab.html`。

- [ ] **Step 8: 暴露浏览器测试 API 并通过 VM 测试**

将数据和纯函数挂到 `window.InsertSimulation`，DOM 初始化放在 `DOMContentLoaded` 回调中，保证 Node VM 不需要真实浏览器即可测试。运行：

```bash
node --test --test-name-pattern="insert simulation calculates|insert simulation preserves|insert simulation keeps" tests/operations-pages.test.js
node --check insert-simulation.js
```

Expected: 插单模拟行为测试全部 PASS，脚本语法检查 PASS。

- [ ] **Step 9: 提交交互实现**

```bash
git add insert-simulation.js tests/operations-pages.test.js
git commit -m "feat: add insert simulation interactions"
```

完成提交后执行“每个实现任务的强制复审流程”；两阶段均通过后再进入 Task 5。

### Task 5: 集成验证和视觉检查

**Files:**
- Verify: `/Users/catalpachan/aps-prototype/collab.html`
- Verify: `/Users/catalpachan/aps-prototype/insert-simulation.html`
- Verify: `/Users/catalpachan/aps-prototype/insert-simulation.css`
- Verify: `/Users/catalpachan/aps-prototype/insert-simulation.js`
- Verify: `/Users/catalpachan/aps-prototype/tests/operations-pages.test.js`

- [ ] **Step 1: 运行完整测试**

Run: `node --test tests/kpi-library.test.js tests/operations-pages.test.js`

Expected: 全部测试 PASS。

- [ ] **Step 2: 检查新增和修改脚本及 diff**

Run: `node --check insert-simulation.js && git diff --check`

Expected: 无语法错误、无空白错误；`operations-pages.test.js` 同时通过已有的 `assertInlineScriptsCompile('collab.html')` 检查工作台内联脚本。

- [ ] **Step 3: 启动本地页面并完成桌面视觉检查**

Run: `python3 -m http.server 4173`

在 `http://localhost:4173/collab.html`、1440×900 视口中确认“插单模拟”紧邻“历史记录”；点击后确认页面标题、5 条订单、8 条结果、首 3 条选中、部分选中表头、返回入口和按钮层级。记录人工验收结果或保留截图，不改动项目资源。

- [ ] **Step 4: 完成窄屏、键盘和回归检查**

在 390×844 视口确认两张表可以横向滚动、物料长文本省略且 `title` 可用；使用 Tab 检查按钮和复选框焦点；取消全部后运行确认提示，再选前两条运行确认第一条结果为 10 / 1790 / 0.6%；返回工作台确认历史记录仍打开原面板，月/周/日视角未被改动。

- [ ] **Step 5: 处理并复审仅属于本功能的验证问题**

如果视觉检查发现间距、溢出、可访问性或行为问题，只修改本功能文件，重新运行对应测试；若修改了 HTML/JS 行为，必须重新执行 Task 2–5 的两阶段复审流程后再提交：

```bash
git add collab.html insert-simulation.html insert-simulation.css insert-simulation.js tests/operations-pages.test.js
git commit -m "polish: verify insert simulation flow"
```

- [ ] **Step 6: 完成 Task 5 的最终双阶段复审**

即使没有代码修复，也派发一个新的验证子代理，提供规格文档、计划、最终 HEAD SHA 和测试结果，确认所有验收项已验证；随后按强制流程依次派发规格符合性审查和代码质量审查。两项均 ✅ 后才标记 Task 5 完成，并进入最终整体验收。

## 完成前检查清单

- [ ] 使用 `@superpowers:subagent-driven-development`：每个实现任务均使用新鲜实现子代理，并完成规格符合性和代码质量两阶段复审。
- [ ] 遵循 `@superpowers:test-driven-development`：每个功能单元都有可验证的红测试和绿实现。
- [ ] 未修改用户未提交的无关文件。
- [ ] 规格中的页面、数据密度、公式、返回入口、主题和可访问性要求均已实现。
