# 插单模拟设计规格

## 背景

在“可视化交互工作台”中，用户需要快速查看插单对当前产能的演示影响。当前工具栏已有“历史记录”按钮，但没有插单模拟入口。需要在其右侧增加“插单模拟”，并提供与参考图一致的独立页面。

## 目标

- 在 `collab.html` 的“历史记录”按钮右侧增加“插单模拟”按钮。
- 新增独立的 `insert-simulation.html` 页面，呈现插单列表和模拟结果。
- 支持订单勾选、全选/取消全选、选中数量反馈和前端演示运行。
- 保持现有历史记录入口和页面行为不变。
- 为后续接入真实模拟接口保留清晰的数据边界。

## 非目标

- 本次不接入后端接口、数据库或真实排产算法。
- 本次不修改真实排产结果，也不将模拟结果写入 KPI 或其他业务数据。
- 本次不把插单模拟并入历史记录页签，也不制作弹窗/抽屉版本。

## 方案选择

采用“工作台入口 + 独立页面”的方案：

1. 在工作台标题栏保留现有“历史记录”按钮，并在其右侧放置“插单模拟”按钮。
2. 点击按钮跳转至 `insert-simulation.html`。
3. 页面使用项目已有的公共样式和轻量静态页面模式，局部采用浅色表格卡片以贴近参考图。
4. 页面通过独立的前端状态保存订单选择和模拟结果，未来可将演示数据替换为 API 响应。

独立页面适合两张宽表的展示，也能避免历史记录页面与模拟流程产生状态耦合。

## 页面与交互

### 工作台入口

- 修改 `collab.html` 的工具栏。
- `workbench-history-btn` 保持原有文本、ID 和点击行为。
- 在其右侧新增 `insert-simulation-btn`，文本为“插单模拟”，类型为 `button`。
- 点击后导航至 `insert-simulation.html`。

### 插单模拟页面

页面依次包含：

1. 页面标题“插单模拟”。
2. “插单列表”区块。
3. “模拟结果”区块及右上角“运行模拟”按钮。
4. 页面顶部或标题栏提供“返回排产操作”入口，返回 `collab.html`。

插单列表表格列：

- 选择框
- 序号
- `row_index`
- `company`
- `planned_order_code`
- `order_category`
- `source_order_code`
- `material_code`
- `material_description`
- `order_qty`

模拟结果表格列：

- 序号
- 分厂编号
- 物料编码
- 工作中心
- 已排产能
- 插单产能
- 剩余产能
- 插单利用率
- 状态

### 选择与运行

- 每条订单有独立复选框，表头复选框支持全选和取消全选。
- 表头复选框支持未选、全选和部分选中三种状态，部分选中通过原生 `indeterminate` 属性表达。
- 页面显示当前选中数量，数量随单选和全选操作实时更新。
- 未选择订单时，运行按钮保持可见但不可执行；若通过键盘或脚本触发，提示“请先选择插单订单”。
- 选择订单并点击运行后，根据选择生成演示结果，更新结果表并显示“正常”状态及绿色利用率。
- 再次运行会替换结果，不追加重复行；取消全部订单后运行不会清空上一次结果，而是提示先选择订单并保留结果。
- 运行只更新当前页面内存状态，刷新页面恢复默认演示数据。
- 点击“插单模拟”不得触发历史记录面板逻辑；返回工作台后使用工作台默认视角，不承诺恢复离开前的月/周/日视角。

## 数据与状态模型

页面准备两组静态数据。为匹配参考图的数据密度，默认至少提供 5 条插单记录和 8 条模拟结果记录；结果表初始展示默认演示结果，即使 `hasRun` 尚未变为 `true`。

插单数据结构示例：

```js
const insertOrders = [
  {
    id: 'order-1',
    rowIndex: 0,
    company: '1688',
    plannedOrderCode: 'CNX000001',
    orderCategory: '内销',
    sourceOrderCode: 'G003测试',
    materialCode: 'CA444W12200',
    materialDescription: '物料说明测试',
    orderQty: 34
  }
];

// 实际实现需提供至少 5 条记录，字段结构与该示例一致。

const simulationResults = [
  {
    sequence: 1,
    plantCode: '200',
    materialCode: '20000106009001',
    workCenter: 'ZS301/29557F',
    scheduledCapacity: 0,
    insertCapacity: 32,
    remainingCapacity: 1800,
    utilization: '1.8%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.15
  }
];

// 实际实现需提供至少 8 条记录；capacityLimit 和 allocationRate 为内部计算字段，
// 不要求作为可见表格列展示，所有 allocationRate 之和为 1。
```

实现时可按项目现有命名习惯调整字段命名，但需保持页面列与数据含义一一对应。

状态包括：

- `selectedOrderIds`: 当前勾选订单 ID 集合。
- `isAllSelected`: 由 `selectedOrderIds.size === insertOrders.length` 派生，不单独保存。
- `isIndeterminate`: 由 `selectedOrderIds.size > 0 && !isAllSelected` 派生。
- `visibleResults`: 当前结果表展示数据。
- `hasRun`: 是否已经执行过演示模拟。

模拟计算采用确定性的前端演示规则，不声称代表真实排产计算。规则如下：

1. `selectedTotalQty = sum(selectedOrders.orderQty)`。
2. 结果表保留固定的 8 条工作中心记录，每条记录有内部 `capacityLimit` 和 `allocationRate`。
3. `insertCapacity = round(selectedTotalQty * allocationRate)`。
4. `remainingCapacity = max(0, capacityLimit - scheduledCapacity - insertCapacity)`。
5. `utilization = round(insertCapacity / capacityLimit * 100, 1) + '%'`。
6. `status` 在利用率不超过 80% 时为“正常”，超过 80% 时为“需关注”；状态同时输出文字，不依赖颜色表达。

例如选择前两条默认订单（数量 34 和 32），`selectedTotalQty = 66`；若第一条结果的 `allocationRate = 0.15`、`capacityLimit = 1800`、`scheduledCapacity = 0`，则 `insertCapacity = 10`、`remainingCapacity = 1790`、`utilization = 0.6%`、`status = '正常'`。初始结果使用默认样例，合法运行后替换为按上述规则计算的结果。

结果结构独立于订单结构，便于未来替换为后端响应。无选择、运行失败或取消全部后再次运行时，结果保留最近一次有效结果；首次无选择运行时保留默认结果。

## 视觉与响应式要求

- 页面整体延续项目的公共字体、圆角、边框和按钮风格。
- 模拟页面固定使用参考图风格的浅色主题：页面自身设置 `data-theme="light"`，不修改或覆盖其他页面的主题存储值。
- 页面使用白色/浅灰内容区域、蓝色强调色和清晰的表头分隔线，接近参考图。
- 表格在窄屏下允许横向滚动，不能压缩到无法阅读。
- 选中行使用浅蓝背景和蓝色边框/复选框状态；正常状态使用绿色文字。
- 表格单元格对长物料编码和描述采用省略号，并通过 `title` 保留完整内容。
- 控件应具有可见的键盘焦点样式，按钮和复选框使用原生语义。
- 表头复选框有明确的 `aria-label`；选中数量使用 `aria-live="polite"`；运行期间按钮禁用并标记忙碌状态。
- 所有写入 `innerHTML` 或 HTML 属性的动态字段必须统一 HTML 转义；完整值可通过安全的 `title` 属性查看。

## 验收标准

### 入口与页面

- [ ] `collab.html` 中“插单模拟”位于“历史记录”右侧。
- [ ] 点击“插单模拟”可以打开 `insert-simulation.html`。
- [ ] 历史记录按钮仍可正常打开原历史页面。
- [ ] 新页面包含“插单模拟”“插单列表”“模拟结果”标题。

### 表格与数据

- [ ] 插单列表包含参考图对应的 10 列。
- [ ] 模拟结果包含参考图对应的 9 列。
- [ ] 页面初始显示可读的演示订单和结果数据。
- [ ] 默认至少显示 5 条插单记录和 8 条模拟结果记录。
- [ ] 初始结果表显示默认演示结果；合法运行后替换为确定性计算结果。
- [ ] 长文本不会破坏表格布局。

### 交互

- [ ] 单行勾选、取消勾选和全选/取消全选可用。
- [ ] 表头复选框正确表现未选、全选和部分选中状态。
- [ ] 选中数量会实时更新。
- [ ] 未选择订单时不能运行模拟并给出明确提示。
- [ ] 选择订单运行后，结果表会刷新并显示绿色“正常”状态。
- [ ] 选择前两条默认订单时，第一条结果按规格得到 `insertCapacity = 10`、`remainingCapacity = 1790`、`utilization = 0.6%`。
- [ ] 页面提供“返回排产操作”入口，返回 `collab.html`；插单模拟入口不会打开历史记录面板。
- [ ] 刷新页面后恢复默认演示状态，不产生持久化副作用。

### 回归与质量

- [ ] 通过新增行为相关测试或静态检查：文件存在、入口顺序/目标正确、历史入口不回归、两张表头顺序和数量正确、选择状态可验证、模拟公式可验证。
- [ ] 通过 `node --check` 检查新增/修改脚本。
- [ ] 通过 `git diff --check`。
- [ ] 不改变与本功能无关的既有文件和用户未提交内容。
