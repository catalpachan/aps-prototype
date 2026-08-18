const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function readHtml(fileName) {
  return readFileSync(path.join(root, fileName), 'utf8');
}

function readInlineScripts(fileName) {
  const html = readHtml(fileName);
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
}

function readCssRuleBody(html, selector) {
  let selectorIndex = html.indexOf(selector);
  while (selectorIndex !== -1) {
    const afterSelector = html.slice(selectorIndex + selector.length);
    if (/^\s*\{/.test(afterSelector)) break;
    selectorIndex = html.indexOf(selector, selectorIndex + selector.length);
  }
  if (selectorIndex === -1) return '';
  const openIndex = html.indexOf('{', selectorIndex);
  const closeIndex = html.indexOf('}', openIndex);
  if (openIndex === -1 || closeIndex === -1) return '';
  return html.slice(openIndex + 1, closeIndex);
}

function readTableHeaders(html, tableId) {
  const table = html.match(new RegExp(`<table[^>]*id="${tableId}"[\\s\\S]*?<thead>[\\s\\S]*?<tr>([\\s\\S]*?)<\\/tr>[\\s\\S]*?<\\/thead>`));
  if (!table) return [];
  return [...table[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

function readBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  if (start === -1) return '';
  const end = html.indexOf(endMarker, start);
  return end === -1 ? '' : html.slice(start, end);
}

function assertInlineScriptsCompile(fileName) {
  const scripts = readInlineScripts(fileName);
  assert.ok(scripts.length > 0, `${fileName} should contain an inline script`);

  scripts.forEach((script, index) => {
    new vm.Script(script, { filename: `${fileName}#inline-${index + 1}` });
  });
}

function evalResourceCenterScript() {
  const [script] = readInlineScripts('resource-center.html');
  return require('node:vm').runInNewContext(
    `${script}\n({ factoryLabels, tableLabels, resourceRows, moldInfoRows, moldTransferRows });`,
    {
      document: {
        addEventListener() {},
        querySelectorAll() { return []; },
        getElementById() { return null; }
      },
      Object,
      Set,
      console
    }
  );
}

function maxDepth(nodes, depth = 1) {
  return nodes.reduce((max, node) => {
    const childDepth = Array.isArray(node.children) && node.children.length
      ? maxDepth(node.children, depth + 1)
      : depth;
    return Math.max(max, childDepth);
  }, depth);
}

test('site root opens the scheduling operations workspace', () => {
  const html = readHtml('index.html');

  assert.match(html, /<meta http-equiv="refresh" content="0; url=collab\.html"\s*\/>/);
  assert.match(html, /正在跳转到排产操作/);
  assert.match(html, /<a href="collab\.html">点击这里<\/a>/);
  assert.doesNotMatch(html, /url=decision\.html|href="decision\.html"/);
});

test('system version badge is updated to v3.7', () => {
  const common = readHtml('common.css');
  const optimization = readHtml('aps-optimization.js');

  assert.match(common, /content:\s*"v3\.7"/);
  assert.match(optimization, /content:\s*"v3\.7"/);
  assert.doesNotMatch(common, /content:\s*"v3\.6"/);
  assert.doesNotMatch(optimization, /content:\s*"v3\.6"/);
});

test('settings wires the KPI library subview and its controls', () => {
  const html = readHtml('settings.html');
  const kpiLibraryView = readBetween(
    html,
    '<div class="settings-subview" id="settings-sub-kpi-library">',
    '<div class="settings-subview" id="settings-sub-rule-create">'
  );

  assert.match(
    html,
    /<button class="resource-menu-item" data-settings-sub="kpi-library" onclick="switchSettingsSub\('kpi-library', this\)">指标库<\/button>/,
    'settings should expose the KPI library menu item'
  );
  assert.ok(kpiLibraryView, 'settings should contain the KPI library subview');
  assert.match(html, /<script src="kpi-library\.js"><\/script>/, 'settings should load the shared KPI library module');

  for (const id of [
    'kpi-library-search',
    'kpi-library-category-list',
    'kpi-library-grid',
    'kpi-library-selected-count',
    'kpi-library-clear',
    'kpi-library-reset',
    'kpi-library-save'
  ]) {
    assert.match(kpiLibraryView, new RegExp(`id="${id}"`), `KPI library should expose ${id}`);
  }
  assert.match(
    kpiLibraryView,
    /<button[^>]*onclick="clearKpiLibrarySelection\(\)"[^>]*>清空选择<\/button>/,
    'KPI library should expose a clear-selection control'
  );

  const categories = html.match(/const KPI_LIBRARY_CATEGORIES = \[([^\]]+)\];/);
  assert.ok(categories, 'KPI library should declare its category filter labels');
  assert.deepEqual(
    [...categories[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
    ['全部', '产能类', '设备类', '人员类', '柔性类', '效率类', '排序质量类', '计划类', '瓶颈类', '库存类', '订单类']
  );

  assert.doesNotMatch(
    kpiLibraryView,
    /<[^>]+class="[^"]*\b(?:top-tabs?|tabs?|tab-nav)\b[^"]*"/i,
    'KPI library should not retain removed top-tab markup'
  );
});

test('decision uses configured KPI cards while preserving the planner todo entry', () => {
  const html = readHtml('decision.html');
  const dashboard = readBetween(html, '<div class="kpi-dashboard">', '<div class="decision-top-side">');

  assert.match(html, /<script src="kpi-library\.js"><\/script>/, 'decision should load the shared KPI library module');
  assert.match(dashboard, /<div id="decision-kpi-cards" class="decision-kpi-cards"><\/div>/);
  assert.match(html, /当前未选择 KPI，请前往系统设置 → 指标库选择要展示的指标。/);
  assert.match(dashboard, /id="planner-todo-entry-card"/, 'planner todo entry card should remain in the KPI dashboard');
  assert.doesNotMatch(dashboard, /id="d-kpi-(?:oee|plan|wip)"/, 'configurable hard-coded KPI IDs should be removed from the dashboard');
});

test('settings and decision inline scripts syntax-compile without DOM execution', () => {
  assertInlineScriptsCompile('settings.html');
  assertInlineScriptsCompile('decision.html');
});

test('page enhancements support Cloudflare extensionless routes', () => {
  const optimization = readHtml('aps-optimization.js');

  assert.match(optimization, /function getCurrentPageName\(\)/);
  assert.match(optimization, /replace\(\/\\\.html\$\/, ''\)/);
  assert.match(optimization, /const current = getCurrentPageName\(\)/);
  assert.match(optimization, /const pageName = getCurrentPageName\(\)/);
  assert.match(optimization, /if \(pageName === 'collab'\)/);
  assert.match(optimization, /else if \(pageName === 'decision'\)/);
  assert.match(optimization, /else if \(pageName === 'settings'\)/);
});

test('collab uses the order management center entry and removes legacy workbench and WIP controls', () => {
  const html = readHtml('collab.html');
  const optimization = readHtml('aps-optimization.js');
  const allOrdersIndex = optimization.indexOf('id="aps-all-preplan-orders-btn"');
  const centerIndex = optimization.indexOf('id="aps-order-center-btn"');

  assert.doesNotMatch(html, /wip-orders-card|wip-order-view-mask|查看所有在制订单/, 'WIP module should be removed');
  assert.doesNotMatch(html, /window\.location\.href='(?:smart-bom|order-management|inventory-board)\.html'/, 'legacy workbench buttons should be removed');
  assert.ok(allOrdersIndex > -1, 'all preplan orders button should remain');
  assert.ok(centerIndex > allOrdersIndex, 'order management center should sit to the right of all preplan orders');
  assert.match(optimization, /orderCenterBtn\.addEventListener\('click',[\s\S]*window\.location\.href = 'order-center\.html'/);
  assert.doesNotMatch(
    readBetween(
      optimization,
      '<div class="aps-order-footer-actions">',
      '<div class="aps-order-pager">'
    ),
    /id="aps-resource-center-btn"/,
    'resource management center should not sit in the preplan order footer'
  );
});

test('collab places resource management center at the lower-left of the resource card', () => {
  const optimization = readHtml('aps-optimization.js');
  const resourceMarkup = readBetween(
    optimization,
    '<article class="aps-upgrade-card" id="aps-resource-check-card">',
    '<article class="aps-upgrade-card" id="aps-smart-schedule-card">'
  );
  const resourceListIndex = resourceMarkup.indexOf('id="aps-resource-list"');
  const resourceCenterIndex = resourceMarkup.indexOf('id="aps-resource-center-btn"');
  const resourceActionsIndex = resourceMarkup.indexOf('class="aps-card-bottom-actions"');

  assert.match(
    resourceMarkup,
    /<button class="btn sm primary" id="aps-resource-center-btn">资源管理中心<\/button>/,
    'resource management center should match the order management center button style'
  );
  assert.ok(resourceActionsIndex > resourceListIndex, 'resource management center actions should sit below the resource list');
  assert.ok(resourceCenterIndex > resourceActionsIndex, 'resource management center should sit inside the lower-left action row');
  assert.match(optimization, /resourceCenterBtn\.addEventListener\('click',[\s\S]*window\.location\.href = 'resource-center\.html'/);
});

test('resource management center mirrors the referenced standalone page', () => {
  assert.ok(existsSync(path.join(root, 'resource-center.html')), 'resource-center.html should exist');
  const html = readHtml('resource-center.html');

  for (const label of [
    '资源管理中心',
    '总装',
    '两器',
    '注塑',
    '钣金',
    '控制器',
    '模具管理',
    '模具信息查询',
    '模具调拨查询',
    '返回排产操作'
  ]) {
    assert.match(html, new RegExp(label), `missing resource center label: ${label}`);
  }

  assert.match(html, /class="resource-center-shell"/);
  assert.match(html, /id="resource-master-table"/);
  assert.match(html, /id="mold-group-table"/);
  assert.match(html, /id="mold-detail-table"/);
  assert.match(html, /id="mold-transfer-table"/);
  assert.match(html, /href="collab\.html" class="btn sm module-return-link">返回排产操作<\/a>/);
});

test('collab exposes schedule history beside one-click scheduling', () => {
  const optimization = readHtml('aps-optimization.js');
  const scheduleMarkup = readBetween(
    optimization,
    '<article class="aps-upgrade-card" id="aps-smart-schedule-card">',
    '</article>'
  );
  const optionsIndex = scheduleMarkup.indexOf('id="aps-schedule-options"');
  const historyIndex = scheduleMarkup.indexOf('id="aps-schedule-history-btn"');
  const scheduleActionsIndex = scheduleMarkup.indexOf('class="aps-card-bottom-actions"');

  assert.match(
    scheduleMarkup,
    /<button class="btn sm primary" id="aps-schedule-history-btn">排产结果<\/button>/,
    'schedule result should match the order management center button style'
  );
  assert.doesNotMatch(scheduleMarkup, /排产历史/, 'the collab entry should no longer use the legacy history label');
  assert.ok(scheduleActionsIndex > optionsIndex, 'schedule history actions should sit below the schedule options');
  assert.ok(historyIndex > scheduleActionsIndex, 'schedule history should sit inside the lower-left action row');
  assert.match(optimization, /scheduleHistoryBtn\.addEventListener\('click',[\s\S]*window\.location\.href = 'schedule-history\.html'/);
});

test('schedule history page mirrors the referenced scheduling snapshot layout', () => {
  assert.ok(existsSync(path.join(root, 'schedule-history.html')), 'schedule-history.html should exist');
  const html = readHtml('schedule-history.html');

  for (const label of [
    '排产结果',
    '排产管理',
    '排产规则配置',
    '交期优先',
    '订单明细',
    '甘特视图',
    '历史记录',
    '总订单数',
    '可排产',
    '已排产',
    '延期订单',
    '排产策略'
  ]) {
    assert.match(html, new RegExp(label), `missing schedule history label: ${label}`);
  }

  assert.match(html, /<title>排产结果 - 格力高级计划排程系统<\/title>/);
  assert.match(html, /class="schedule-history-shell"/);
  assert.match(html, /\.schedule-history-shell\s*{[\s\S]*?background:\s*#0d1525/, 'schedule history should use the platform dark center shell');
  assert.match(html, /\.schedule-history-side\s*{[\s\S]*?background:\s*#10192b/, 'schedule history sidebar should match center/sidebar styling');
  assert.doesNotMatch(readCssRuleBody(html, '.schedule-history-shell'), /background:\s*#f3f6fa/, 'schedule history shell should not use the reference image light background');
  assert.match(html, /data-history-id="21"/);
  assert.match(html, /<span class="history-run-id">排产结果 ID：202607071347<\/span>/, 'visible history run ids should use the time-based result id naming');
  assert.match(html, /current-run-badge" id="current-run-badge">当前生效: 排产结果 ID：202607071347<\/span>/, 'current run badge should use the time-based result id naming');
  assert.doesNotMatch(html, /AST-\d{6}|resultId:/, 'schedule history should no longer use randomized AST ids');
  assert.match(html, /function buildScheduleResultId\(record\)/, 'schedule history should derive result ids from record time');
  assert.match(html, /function formatScheduleResultId\(record\)/, 'schedule history should format result ids through one helper');
  assert.match(html, /return `2026\$\{month\.padStart\(2, '0'\)\}\$\{day\.padStart\(2, '0'\)\}\$\{hour\.padStart\(2, '0'\)\}\$\{minute\.padStart\(2, '0'\)\}`/, 'schedule result ids should use YYYYMMDDHHmm formatting');
  assert.match(html, /<span class="history-run-id">\$\{formatScheduleResultId\(record\)\}<\/span>/, 'rendered history list should use the shared result id formatter');
  assert.match(html, /current-run-badge'\)\.textContent = `当前生效: \$\{formatScheduleResultId\(record\)\}`/, 'current run badge should use the shared result id formatter');
  assert.doesNotMatch(html, /history-run-id">#|当前生效: #/, 'old visible # run ids should be removed');
  assert.match(html, /id="schedule-history-table"/);
  assert.match(html, /scheduleHistoryRecords/);
  assert.match(html, /scheduleHistoryRules/);
  assert.match(html, /href="collab\.html"[^>]*>返回排产操作<\/a>/);
  assert.deepEqual(readTableHeaders(html, 'schedule-history-table'), [
    '排名',
    '计划订单号',
    '物料编码',
    '成品码',
    '订单量',
    '计划量',
    '壳体',
    '冷媒',
    '产品类型',
    '报关日期',
    '交货期',
    '需求交期'
  ]);
});

test('schedule result page keeps platform styling across toolbar, gantt, and history records', () => {
  const html = readHtml('schedule-history.html');

  assert.match(html, /<strong>排产结果<\/strong>/, 'the schedule page should use the result naming');
  assert.match(html, /排产结果已导出 Excel/, 'result export copy should use the result naming');
  assert.match(html, /\.schedule-history-toolbar\s*\{[\s\S]*?background:\s*#10192b/, 'toolbar should use the platform panel background');
  assert.match(html, /\.schedule-history-toolbar\s*\{[\s\S]*?box-shadow:\s*none/, 'toolbar should avoid a separate heavy shadow treatment');
  assert.match(html, /\.execute-btn\s*\{[\s\S]*?background:\s*#1f2937/, 'execute plan should use the platform secondary button surface');
  assert.match(html, /\.schedule-gantt-preview\s*\{[\s\S]*?background:\s*#0b1321/, 'gantt should use the platform dark surface');
  assert.match(html, /\.schedule-gantt-head-cell\s*\{[\s\S]*?background:\s*#17243a/, 'gantt headers should match platform table headers');
  assert.match(html, /\.schedule-gantt-cell\s*\{[\s\S]*?background:\s*#10192b/, 'gantt cells should match platform data cards');
  assert.match(html, /\.schedule-record-table-shell\s*\{[\s\S]*?border:\s*1px solid #2c3a51/, 'history records should use platform borders');
  assert.match(html, /\.schedule-history-record-table\s*\{[\s\S]*?background:\s*#10192b/, 'history records should use platform panel background');
  assert.match(html, /\.schedule-history-record-table th\s*\{[\s\S]*?background:\s*#17243a/, 'history record headers should match platform table headers');
  assert.match(html, /\.schedule-history-record-table tbody tr:hover\s*\{[\s\S]*?background:\s*#132037/, 'history record rows should match platform hover styling');
});

test('schedule history supports strategy switching and execution flow controls', () => {
  const html = readHtml('schedule-history.html');

  assert.match(html, /data-schedule-strategy="交期优先"[^>]*class="active"/, 'delivery priority should be the default active strategy');
  assert.match(html, /data-schedule-strategy="效率优先"/, 'efficiency priority should be clickable');
  assert.match(html, /function setScheduleStrategy\(strategy\)/, 'strategy switch should have a state updater');
  assert.match(html, /querySelectorAll\('\[data-schedule-strategy\]'\)/, 'strategy buttons should be wired by data attribute');
  assert.match(html, /id="schedule-run-btn"[^>]*class="schedule-action primary"/, 'one-click scheduling should keep the primary action style');
  assert.match(html, /id="schedule-execute-btn"[^>]*class="execute-btn"/, 'execute plan button should sit beside one-click scheduling');
  assert.match(html, /schedule-run-btn'\)\?\.addEventListener\('click', \(\) => runScheduleExecutionFlow/, 'one-click scheduling should open the execution flow');
  assert.match(html, /class="modal-card aps-sync-flow-card"/, 'execution flow should reuse the platform sync flow modal card');
  assert.match(html, /id="schedule-system-flow-mask"/, 'execution flow modal mask should exist');
  assert.match(html, /function runScheduleExecutionFlow\(/, 'schedule execution flow should have a runner');
  assert.doesNotMatch(html, /\.rules-title::before/, 'rules title dropdown icon should be removed');
});

test('schedule history gantt view mirrors the referenced resource load matrix', () => {
  const html = readHtml('schedule-history.html');

  for (const label of [
    '线体',
    'CK1N04',
    'CK1N06',
    'PH: 240',
    '7/8',
    '延36',
    '延68',
    '90 / 5080',
    '每日总利用率'
  ]) {
    assert.match(html, new RegExp(label), `missing gantt reference label: ${label}`);
  }

  assert.match(html, /class="schedule-gantt-matrix"/);
  assert.match(html, /class="schedule-gantt-resource-row"/);
  assert.match(html, /type:\s*'delay'/);
  assert.match(html, /type:\s*'ahead'/);
  assert.match(html, /class="schedule-gantt-load-bar \$\{load\.type\}"/);
  assert.match(html, /class="schedule-gantt-tooltip"/);
  assert.match(html, /const ganttRows = \[/, 'gantt rows should be data-driven');
  assert.match(html, /const ganttHoverOrders = \[/, 'gantt tooltip orders should be data-driven');
});

test('schedule history records tab mirrors the referenced execution table', () => {
  const html = readHtml('schedule-history.html');

  assert.match(html, /id="schedule-history-record-table"/);
  assert.match(html, /const scheduleExecutionRecords = \[/, 'history records should be data-driven');
  assert.match(html, /function renderHistoryRecordsTable\(\)/, 'history records tab should render a table');
  assert.deepEqual(readTableHeaders(html, 'schedule-history-record-table'), [
    '#',
    '执行时间',
    '策略',
    '状态',
    '总订单',
    '可排产',
    '已排产',
    '生效',
    '执行人'
  ]);
  assert.match(html, /2026-07-07 13:47:59/);
  assert.match(html, /class="history-strategy-pill"/);
  assert.match(html, /class="history-status-pill"/);
  assert.match(html, /class="history-effective-check"/);
  assert.match(html, />admin</);
});

test('collab week view separates gantt and list modes with shared date state', () => {
  const html = readHtml('collab.html');
  const [script] = readInlineScripts('collab.html').slice(-1);

  assert.match(html, /id="week-mode-tabs"[^>]*role="tablist"/);
  assert.match(html, /data-week-mode="gantt"[^>]*aria-selected="true"[^>]*>甘特图模式<\/button>/);
  assert.match(html, /data-week-mode="list"[^>]*aria-selected="false"[^>]*>列表模式<\/button>/);
  assert.match(
    html,
    /id="week-mode-panel-gantt"[\s\S]*class="workbench-note-row"[\s\S]*id="week-calendar"[\s\S]*class="week-gantt-wrap"/
  );
  assert.match(
    html,
    /id="week-mode-panel-list"[\s\S]*id="week-list-calendar"[\s\S]*id="week-day-tables"/
  );

  assert.match(script, /let currentWeekMode = 'gantt'/);
  assert.match(script, /function setWeekMode\(mode, opts = \{\}\)/);
  assert.match(script, /const targetMode = \['gantt', 'list'\]\.includes\(mode\) \? mode : 'gantt'/);
  assert.match(script, /function renderWeekListCalendar\(\)/);
  assert.match(script, /week-list-calendar[\s\S]*onWeekDaySelect\(dayIdx\)/);
  assert.doesNotMatch(script, /week-list-calendar[\s\S]*onWeekDaySelect\(dayIdx, \{ openDayView: true \}\)/);
  assert.match(script, /#week-calendar \.week-day-card[\s\S]*#week-list-calendar \[data-day-idx\]/);
});

test('collab workbench exposes scheduling history before the date view switch', () => {
  const html = readHtml('collab.html');
  const [script] = readInlineScripts('collab.html').slice(-1);
  const historyButtonIndex = html.indexOf('id="workbench-history-btn"');
  const viewSwitchIndex = html.indexOf('id="gantt-view-switch"');
  const headers = readTableHeaders(html, 'workbench-history-table');

  assert.ok(historyButtonIndex > -1, 'history button should exist');
  assert.ok(viewSwitchIndex > -1, 'date view switch should exist');
  assert.ok(historyButtonIndex < viewSwitchIndex, 'history button should sit to the left of the date view switch');
  assert.match(html, /id="workbench-history-panel"/, 'history panel should exist');
  assert.match(html, /id="workbench-history-tbody"/, 'history table body should have stable id');

  for (const heading of ['位置', '线体', '执行时间', '排产策略', '状态', '总订单', '可排产数量', '已排产数量', '是否生效', '执行人']) {
    assert.ok(headers.includes(heading), `missing history table heading: ${heading}`);
  }

  assert.match(script, /const scheduleHistoryRecords = \[[\s\S]*?\n\s*\];/);
  const scheduleHistoryBlock = script.match(/const scheduleHistoryRecords = \[([\s\S]*?)\n\s*\];/)?.[1] || '';
  assert.equal((scheduleHistoryBlock.match(/\bexecutedAt:/g) || []).length, 5, 'history should default to 5 mock records');
  assert.match(script, /function showScheduleHistory\(\)/);
  assert.match(script, /renderScheduleHistoryRecords\(\)/);
  assert.match(script, /workbench-history-btn[\s\S]*addEventListener\('click', showScheduleHistory\)/);
});

test('insert simulation entry sits beside workbench history', () => {
  const html = readHtml('collab.html');
  const [script] = readInlineScripts('collab.html').slice(-1);

  assert.match(
    html,
    /<button[^>]*id="workbench-history-btn"[^>]*>历史记录<\/button>\s*<button[^>]*id="insert-simulation-btn"[^>]*>插单模拟<\/button>/,
    'insert simulation button should follow the workbench history button'
  );
  assert.match(
    script,
    /getElementById\('insert-simulation-btn'\)\?\.addEventListener\('click', openInsertSimulation\)/
  );
  const openInsertSimulation = script.match(/function openInsertSimulation\(\) \{[\s\S]*?\n    \}/)?.[0];
  const insertSimulationRegistration = script.match(/document\.getElementById\('insert-simulation-btn'\)\?\.addEventListener\('click', openInsertSimulation\);/)?.[0];
  assert.ok(openInsertSimulation, 'insert simulation navigation should have a named function');
  assert.ok(insertSimulationRegistration, 'insert simulation navigation should register the named function');

  let clickHandler;
  const button = {
    addEventListener(eventName, handler) {
      assert.equal(eventName, 'click');
      clickHandler = handler;
    }
  };
  const navigationContext = {
    document: {
      getElementById(elementId) {
        assert.equal(elementId, 'insert-simulation-btn');
        return button;
      }
    },
    window: { location: { href: 'collab.html' } }
  };
  vm.runInNewContext(`${openInsertSimulation}\n${insertSimulationRegistration}`, navigationContext);
  assert.equal(typeof clickHandler, 'function', 'insert simulation click handler should be registered');
  clickHandler();
  assert.equal(navigationContext.window.location.href, 'insert-simulation.html');
  assert.match(script, /workbench-history-btn[\s\S]*addEventListener\('click', showScheduleHistory\)/);
  assertInlineScriptsCompile('collab.html');
});

test('collab workbench shows the active result and unsaved execution hint', () => {
  const html = readHtml('collab.html');
  const optimization = readHtml('aps-optimization.js');
  const [script] = readInlineScripts('collab.html').slice(-1);
  const executePreplanBlock = readBetween(script, 'function executePreplan() {', 'function closeExecuteConfirm');

  assert.match(html, /class="workbench-title-group"[\s\S]*可视化交互工作台/);
  assert.match(html, /class="current-run-badge" id="workbench-current-run-badge">当前生效: 排产结果 ID：202607071347<\/span>/);
  assert.match(html, /class="workbench-unsaved-hint" id="workbench-unsaved-hint"[^>]*hidden[^>]*>当前排产结果未保存执行<\/span>/);
  assert.match(html, /\.workbench-result-state\s*\{/);
  assert.match(html, /\.workbench-unsaved-hint\s*\{/);
  assert.match(html, /\.workbench-unsaved-hint\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(script, /function setWorkbenchSchedulePending\(pending\)/);
  assert.match(script, /window\.setWorkbenchSchedulePending = setWorkbenchSchedulePending/);
  assert.match(executePreplanBlock, /setWorkbenchSchedulePending\(false\)/);
  assert.match(script, /confirmExecutePreplan\(\)[\s\S]*setWorkbenchSchedulePending\(false\)/);
  assert.match(optimization, /setWorkbenchSchedulePending\?\.\(true\)/);
});

test('preplan guide mirrors pending plan orders and reveals material details on hover', () => {
  const optimization = readHtml('aps-optimization.js');
  const guideMarkup = readBetween(
    optimization,
    '<article class="aps-upgrade-card" id="aps-order-sync-card">',
    '<article class="aps-upgrade-card" id="aps-resource-check-card">'
  );

  for (const heading of ['计划订单号', '订单类型', '交期', '数量', '订单状态']) {
    assert.match(guideMarkup, new RegExp(`<th>${heading}<\\/th>`), `missing preplan guide heading: ${heading}`);
  }
  assert.doesNotMatch(guideMarkup, /<th>订单号<\/th>|<th>来源<\/th>/, 'legacy order/source headings should be removed');
  assert.match(optimization, /const pendingPlanOrders = Array\.from\(\{ length: 30 \}/);
  assert.match(optimization, /\.filter\(\(order\) => order\.orderStatusDescription === '待确认'\)/);
  assert.match(optimization, /planOrderNo: `PLN202606\$\{padPreplanOrderNumber\(index \+ 1, 4\)\}`/);
  assert.match(optimization, /<span class="aps-order-status pending">待确认<\/span>/);
  assert.match(optimization, /class="aps-order-hover-detail"/);
  assert.match(optimization, /<b>物料编码：<\/b>\$\{order\.materialCode\}/);
  assert.match(optimization, /<b>物料说明：<\/b>\$\{order\.materialDescription\}/);
  assert.match(optimization, /\.aps-order-table tbody tr:hover \.aps-order-hover-detail[\s\S]*?display:\s*grid/);
  assert.match(optimization, /class="aps-order-no-cell" tabindex="0"/, 'material tooltip should also be keyboard accessible');
});

test('order management center defaults to plan orders and exposes all three modules', () => {
  assert.ok(existsSync(path.join(root, 'order-center.html')), 'order-center.html should exist');
  const html = readHtml('order-center.html');
  const sidebar = readBetween(html, '<aside class="order-center-sidebar">', '</aside>');

  for (const label of ['订单管理中心', '订单管理', '智能BOM', '库存情况', '返回排产操作']) {
    if (label !== '返回排产操作') {
      assert.match(html, new RegExp(label), `missing order center label: ${label}`);
    }
  }
  assert.doesNotMatch(sidebar, /返回排产操作/, 'return action should not remain in the sidebar');
  assert.doesNotMatch(html, /order-center-workspace-head/, 'order center workspace header should be removed');
  assert.doesNotMatch(html, /order-center-workspace-title|order-center-title|order-center-description/, 'unused workspace title elements should be removed');
  assert.match(html, /data-center-module="orders"/);
  assert.match(html, /data-center-module="bom"/);
  assert.match(html, /data-center-module="inventory"/);
  assert.match(html, /order-management\.html\?embed=1&tab=plan/, 'orders should default to plan orders');
  assert.match(html, /smart-bom\.html\?embed=1&tab=global/, 'BOM should default to global BOM');
  assert.match(html, /inventory-board\.html\?embed=1/, 'inventory should load in embedded mode');
  assert.match(html, /const requestedModule = params\.get\('module'\) \|\| 'orders'/);
});

test('resource matching card opens an order-center styled resource management center', () => {
  assert.ok(existsSync(path.join(root, 'resource-center.html')), 'resource-center.html should exist');
  const optimization = readHtml('aps-optimization.js');
  const html = readHtml('resource-center.html');
  const resourceMarkup = readBetween(
    optimization,
    '<article class="aps-upgrade-card" id="aps-resource-check-card">',
    '<article class="aps-upgrade-card" id="aps-smart-schedule-card">'
  );
  const resourceCenterIndex = resourceMarkup.indexOf('id="aps-resource-center-btn"');
  const resourceMatchIndex = resourceMarkup.indexOf('id="aps-resource-match-btn"');
  const resourceListIndex = resourceMarkup.indexOf('id="aps-resource-list"');
  const resourceActionsIndex = resourceMarkup.indexOf('class="aps-card-bottom-actions"');
  const headers = readTableHeaders(html, 'resource-master-table');

  assert.ok(resourceMatchIndex > -1, 'resource match button should remain');
  assert.ok(resourceCenterIndex > -1, 'resource management center button should exist');
  assert.ok(resourceActionsIndex > resourceListIndex, 'resource management center actions should sit below the resource list');
  assert.ok(resourceCenterIndex > resourceActionsIndex, 'resource management center should sit inside the lower-left action row');
  assert.match(
    resourceMarkup,
    /<button class="btn sm primary" id="aps-resource-center-btn">资源管理中心<\/button>/,
    'resource management center should match the order center button style'
  );
  assert.match(optimization, /resourceCenterBtn\.addEventListener\('click',[\s\S]*window\.location\.href = 'resource-center\.html'/);

  for (const label of ['资源管理中心', '资源、设备与人力主数据统一工作区', '总装', '两器', '注塑', '钣金', '控制器', '设备管理', '人力资源', '品目表', '资源表', '制造BOM表', '配套分厂提前期', '生产订单表', '出勤模式表', '日历表', '输入关键词查询']) {
    assert.match(html, new RegExp(label), `missing resource center label: ${label}`);
  }
  assert.match(html, /\.resource-center-shell\s*{[\s\S]*?grid-template-columns:\s*196px minmax\(0, 1fr\)/, 'resource center shell should mirror order center layout width');
  assert.match(html, /\.resource-center-sidebar\s*{[\s\S]*?background:\s*#10192b/, 'resource center sidebar should mirror order center color');
  assert.match(html, /class="resource-center-nav"/);
  assert.match(html, /data-factory="assembly"/);
  assert.match(html, /data-factory="exchanger"/);
  assert.match(html, /data-factory="injection"/);
  assert.match(html, /data-factory="sheet"/);
  assert.match(html, /data-factory="controller"/);
  assert.match(html, /data-resource-area="equipment"/);
  assert.match(html, /data-resource-area="labor"/);
  assert.match(html, /id="resource-search"/);
  assert.match(html, /id="resource-master-table"/);
  assert.match(html, /class="resource-center-pager"/);
  for (const heading of ['序号', '资源编码', '资源名称', '所属分厂', '资源类型', '状态', '产能/班', '负责人']) {
    assert.ok(headers.includes(heading), `missing resource table heading: ${heading}`);
  }
});

test('smart scheduling card shows configured scheduling rules summary', () => {
  const optimization = readHtml('aps-optimization.js');
  const smartScheduleCard = readBetween(
    optimization,
    '<article class="aps-upgrade-card" id="aps-smart-schedule-card">',
    '</article>'
  );

  assert.match(smartScheduleCard, /已配置排产规则/, 'smart scheduling card should include configured rules summary');
  assert.match(smartScheduleCard, /id="aps-schedule-rule-summary"/, 'rules summary should have a stable container id');
  assert.match(smartScheduleCard, /id="aps-schedule-rule-toggle"[\s\S]*aria-expanded="false"[\s\S]*aria-controls="aps-schedule-rule-tags"/, 'rules summary should default to collapsed with an accessible toggle');
  assert.match(smartScheduleCard, /id="aps-schedule-rule-tags"[^>]*hidden/, 'rule tags should be hidden until expanded');
  assert.match(optimization, /const configuredScheduleRules = \[/, 'rules should be data driven');
  assert.match(optimization, /const enabledScheduleRuleCount = configuredScheduleRules\.filter\(\(rule\) => rule\.enabled\)\.length/);
  assert.match(optimization, /const disabledScheduleRuleCount = configuredScheduleRules\.length - enabledScheduleRuleCount/);
  assert.match(optimization, /已启用 \$\{enabledScheduleRuleCount\} 条/);
  assert.match(optimization, /已禁用 \$\{disabledScheduleRuleCount\} 条/);
  assert.match(optimization, /class="aps-schedule-rule-chip \$\{rule\.enabled \? 'enabled' : 'disabled'\}"/);
  assert.match(optimization, /function setScheduleRuleExpanded\(expanded\)/);
  assert.match(optimization, /aps-schedule-rule-toggle[\s\S]*addEventListener\('click',[\s\S]*setScheduleRuleExpanded/);
  assert.match(optimization, /\.aps-schedule-rule-summary\.is-open \.aps-schedule-rule-tags/);
  assert.match(optimization, /\.aps-schedule-rule-summary\.is-open \.aps-schedule-rule-arrow[\s\S]*transform:\s*rotate\(90deg\)/);

  for (const label of [
    '小批验证/试制白班约束',
    '首次批量机型自动拆单',
    '物料齐套性验证',
    '模具/工装可用性校验',
    '工艺走线可行性检查',
    '质量状态合格性校验',
    '返包方案同步排产',
    '物料生产运输检验周期',
    '指定顺序强制优先'
  ]) {
    assert.match(optimization, new RegExp(label), `missing configured scheduling rule: ${label}`);
  }
});

test('one-click scheduling modal uses a platform-styled four-step flow', () => {
  const optimization = readHtml('aps-optimization.js');
  const runSmartScheduleBlock = readBetween(
    optimization,
    'function runSmartSchedule() {',
    'const allPreplanOrdersBtn = document.getElementById'
  );

  assert.match(optimization, /\.aps-sync-flow-card\.aps-schedule-flow-card\s*{[\s\S]*?width:\s*min\(640px, calc\(100vw - 32px\)\)/, 'one-click scheduling modal should use the platform flow-card width');
  assert.match(optimization, /\.aps-sync-flow-card\.aps-schedule-flow-card\s*{[\s\S]*?background:\s*linear-gradient\(180deg, rgba\(15, 23, 42/, 'one-click scheduling modal should use the platform dark card background');
  assert.match(optimization, /\.aps-schedule-flow-card \.aps-sync-flow-top\s*{[\s\S]*?radial-gradient\(circle at top right, rgba\(56, 189, 248/, 'one-click scheduling header should mirror the order sync title area');
  assert.match(optimization, /\.aps-schedule-flow-list \.aps-sync-flow-step\s*{[\s\S]*?grid-template-columns:\s*28px 1fr auto/, 'one-click scheduling steps should use the platform step layout');
  assert.doesNotMatch(optimization, /background:\s*#fbfff9|#35c52f|aps-sync-flow-list\.aps-schedule-flow-list::before/, 'one-click scheduling modal should not use the previous white/green timeline style');
  assert.match(runSmartScheduleBlock, /steps:\s*\[/, 'one-click scheduling should pass its own four-step flow');
  assert.match(runSmartScheduleBlock, /variant:\s*'schedule'/, 'one-click scheduling should enable the scheduling flow variant');
  assert.match(optimization, /const steps = systemExecutionFlowState\.steps\.length \? systemExecutionFlowState\.steps : SYSTEM_EXECUTION_FLOW_STEPS/);
  assert.match(optimization, /card\.classList\.toggle\('aps-schedule-flow-card', isScheduleFlow\)/);
  assert.match(optimization, /list\.classList\.toggle\('aps-schedule-flow-list', isScheduleFlow\)/);

  const labels = ['订单导入', '可排产判断', '预排排序', '均衡排产'];
  const metas = ['导入 96 条生产订单', '判断完成：90/96 可排产', '排序完成：90 条订单', '排产完成：90/90 条订单已排产'];
  for (const label of labels) {
    assert.match(runSmartScheduleBlock, new RegExp(label), `missing scheduling flow step: ${label}`);
  }
  for (const meta of metas) {
    assert.match(runSmartScheduleBlock, new RegExp(meta), `missing scheduling flow copy: ${meta}`);
  }

  const scheduleStepsBlock = runSmartScheduleBlock.match(/steps:\s*\[([\s\S]*?)\]\s*,\s*variant:/)?.[1] || '';
  const stepCount = (scheduleStepsBlock.match(/title:\s*'/g) || []).length;
  assert.equal(stepCount, 4, 'one-click scheduling flow should have exactly 4 steps');
});

test('resource management center provides 20 mock rows per form and mold management queries', () => {
  const html = readHtml('resource-center.html');
  const data = evalResourceCenterScript();

  for (const factoryLabel of Object.values(data.factoryLabels)) {
    for (const tableLabel of Object.values(data.tableLabels)) {
      const rows = data.resourceRows.filter((row) => row[3] === factoryLabel && row[4] === tableLabel);
      assert.equal(rows.length, 20, `${factoryLabel} / ${tableLabel} should provide 20 mock rows`);
    }
  }

  assert.match(html, /data-factory="mold"/, 'mold management should be a first-level menu after controller');
  assert.match(html, /data-factory-nav="mold"[\s\S]*>模具管理<\/button>/);
  assert.match(html, /data-mold-query="info"[\s\S]*>模具信息查询<\/button>/);
  assert.match(html, /data-mold-query="transfer"[\s\S]*>模具调拨查询<\/button>/);
  assert.match(html, /id="mold-info-panel"/);
  assert.match(html, /id="mold-transfer-panel"/);

  for (const label of ['你所在的位置', '工装编号', '模具组', '物料', '模具类型', '零件名称', '查询', '重置']) {
    assert.match(html, new RegExp(label), `missing mold info query label: ${label}`);
  }
  for (const label of ['你所在的位置', '数量（预计使用数量）', '工装编号', '物料', '查询', '重置']) {
    assert.match(html, new RegExp(label), `missing mold transfer query label: ${label}`);
  }
  for (const label of ['模具组信息', '查询条件: 位置: 芜湖格力', '共有 4696 套模具组，合计 5156 副模具', '模具信息明细']) {
    assert.match(html, new RegExp(label), `missing mold info reference copy: ${label}`);
  }

  assert.deepEqual(readTableHeaders(html, 'mold-group-table'), ['模具组', '模具工装编号', '位置', '模具数量']);
  assert.deepEqual(readTableHeaders(html, 'mold-detail-table'), ['序号', '工装编号', '一级位置说明', '二级位置说明', '工序名称', '物料', '零件名称', '模具类型', '模具寿命', '模具预计修复时间', '模具重量', '模具组']);
  assert.deepEqual(readTableHeaders(html, 'mold-transfer-table'), ['序号', '调拨单号', '当前位置', '目标位置', '预计使用数量', '工装编号', '物料', '调拨状态', '预计到达', '负责人']);
  assert.equal(data.moldInfoRows.length, 20, 'mold info query should provide 20 mock rows');
  assert.equal(data.moldTransferRows.length, 20, 'mold transfer query should provide 20 mock rows');
});

test('legacy module pages support embedded mode and requested initial tabs', () => {
  const orderHtml = readHtml('order-management.html');
  const bomHtml = readHtml('smart-bom.html');
  const inventoryHtml = readHtml('inventory-board.html');
  const embedModeScript = readHtml('embed-mode.js');

  for (const [name, html] of [
    ['order management', orderHtml],
    ['smart BOM', bomHtml],
    ['inventory', inventoryHtml]
  ]) {
    assert.match(html, /<script src="embed-mode\.js"><\/script>/, `${name} should load shared embed mode`);
    assert.match(html, /html\.is-embedded \.aps-header-layout\s*{\s*display:\s*none/, `${name} should hide the global header when embedded`);
    assert.match(html, /module-return-link/, `${name} should identify its standalone return link`);
    assert.doesNotMatch(html, /html\.is-embedded \.module-return-link\s*{\s*display:\s*none/, `${name} should keep the return action visible when embedded`);
  }
  assert.match(orderHtml, /class="orders-header"[\s\S]*href="collab\.html" target="_top" class="btn sm module-return-link">返回排产操作<\/a>/);
  assert.match(bomHtml, /class="module-header"[\s\S]*href="collab\.html" target="_top" class="btn sm module-return-link">返回排产操作<\/a>/);
  assert.match(inventoryHtml, /class="card-hd"[\s\S]*href="collab\.html" target="_top" class="btn sm module-return-link">返回排产操作<\/a>/);
  assert.match(embedModeScript, /get\('embed'\) === '1'/, 'embed mode should read the URL flag');
  assert.match(embedModeScript, /classList\.add\('is-embedded'\)/, 'embed mode should apply the root class');

  assert.match(
    orderHtml,
    /switchOrderTab\(\['plan', 'insert', 'production'\]\.includes\(initialTab\) \? initialTab : 'plan'\)/,
    'order management should validate and activate the requested initial tab'
  );
  assert.match(bomHtml, /new URLSearchParams\(window\.location\.search\)\.get\('tab'\)/);
  assert.match(
    bomHtml,
    /switchTab\(\['global', 'split'\]\.includes\(initialTab\) \? initialTab : 'global'\)/,
    'smart BOM should validate and activate the requested initial tab'
  );
});

test('embedded order center modules do not create duplicate AI assistants', () => {
  const commonScript = readHtml('common.js');

  assert.match(
    commonScript,
    /if \(!document\.documentElement\.classList\.contains\('is-embedded'\)\) \{\s*initAIAssistant\(\);\s*\}/,
    'AI assistant should initialize only in the top-level page'
  );
});

test('smart BOM page has two tabs and linked tree/detail panels', () => {
  assert.ok(existsSync(path.join(root, 'smart-bom.html')), 'smart-bom.html should exist');

  const html = readHtml('smart-bom.html');
  for (const label of ['全局BOM', 'BOM拆解', '成品码（根节点）', '节点详情']) {
    assert.match(html, new RegExp(label), `missing ${label}`);
  }

  assert.match(html, /bom-root-list/, 'missing root tree list');
  assert.match(html, /bom-detail-tree/, 'missing detail tree');
  assert.match(html, /data-bom-tab="global"/, 'missing global tab wiring');
  assert.match(html, /data-bom-tab="split"/, 'missing split tab wiring');
});

test('smart BOM root list has no root toggle icon and tree data reaches six levels', () => {
  const html = readHtml('smart-bom.html');
  assert.doesNotMatch(html, /root-toggle/, 'root list should not render root toggle icons');
  assert.match(html, /max="6"/, 'BOM level control should cap at six levels');

  const [script] = readInlineScripts('smart-bom.html');
  const catalog = require('node:vm').runInNewContext(`${script}\nbomCatalog;`, {
    document: { addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } },
    Set,
    console
  });

  const globalDepth = maxDepth(catalog.global.roots);
  const splitDepth = maxDepth(catalog.split.roots);
  assert.ok(globalDepth >= 6 || splitDepth >= 6, `expected at least one BOM tree to reach six levels, got ${Math.max(globalDepth, splitDepth)}`);
  assert.ok(Math.max(globalDepth, splitDepth) <= 6, 'BOM tree data should not exceed six levels');
});

test('smart BOM lists many product roots and uses fixed scroll windows', () => {
  const html = readHtml('smart-bom.html');
  assert.match(html, /\.bom-panel\s*{[\s\S]*?height:\s*var\(--bom-panel-height\)/, 'BOM panels should have fixed height');
  assert.match(html, /\.tree-scroll\s*{[\s\S]*?height:\s*var\(--tree-window-height\)/, 'tree-scroll should be a fixed-height window');
  assert.match(readCssRuleBody(html, '.tree-scroll'), /border\s*:\s*1px\s+solid\s+#1b2f48/, 'tree-scroll should use the requested border color');
  assert.match(readCssRuleBody(html, '.tree-scroll'), /background\s*:\s*rgb\(13\s+21\s+37\s*\/\s*96%\)/, 'tree-scroll should use the requested background');
  assert.match(html, /\.tree-scroll:hover\s*{[\s\S]*?transform:\s*translateY\(-1px\)/, 'tree-scroll should have a hover micro interaction');
  assert.doesNotMatch(readCssRuleBody(html, '.tree-scroll:hover'), /border-color\s*:|box-shadow\s*:/, 'detail tree hover should not draw an outline');
  assert.doesNotMatch(readCssRuleBody(html, '.tree-scroll:hover .tree-node:hover'), /border-color\s*:|box-shadow\s*:/, 'detail tree node hover should not draw an outline');
  assert.match(readCssRuleBody(html, '.root-row'), /border\s*:\s*1px\s+solid\s+#2f3d55/, 'product code root rows should keep a complete 1px outline');
  assert.doesNotMatch(readCssRuleBody(html, '.root-row'), /border-left\s*:/, 'product code root rows should not use a separate left accent border');

  const [script] = readInlineScripts('smart-bom.html');
  const catalog = require('node:vm').runInNewContext(`${script}\nbomCatalog;`, {
    document: { addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } },
    Set,
    console
  });

  assert.ok(catalog.global.roots.length >= 18, `global BOM root list should have at least 18 rows, got ${catalog.global.roots.length}`);
  assert.ok(catalog.split.roots.length >= 18, `split BOM root list should have at least 18 rows, got ${catalog.split.roots.length}`);
});

test('order management page has three tabs and double confirmation for order actions', () => {
  assert.ok(existsSync(path.join(root, 'order-management.html')), 'order-management.html should exist');

  const html = readHtml('order-management.html');
  for (const label of ['计划订单', '插单订单', '生产订单', '开单', '插单开单']) {
    assert.match(html, new RegExp(label), `missing ${label}`);
  }

  assert.match(html, /confirmOrderAction\('plan-open'\)/, 'plan open action should use confirmation');
  assert.match(html, /confirmOrderAction\('insert-open'\)/, 'insert order action should use confirmation');
  assert.match(html, /确认执行开单\?/, 'plan open confirmation should use the requested title copy');
  assert.match(html, /开始日期:\$\{startDate\}/, 'plan open confirmation should include selected start date');
  assert.match(html, /结束日期:\$\{endDate\}/, 'plan open confirmation should include selected end date');
  assert.match(html, /确认后将提交开单请求并生成新的开单记录。/, 'plan open confirmation should explain the submitted request');
  assert.match(html, /确认插单开单？/, 'insert open confirmation should use the requested title copy');
  assert.match(html, /你已选择\$\{selectedRows\.length\}条插单，计划订单号：\$\{planNumbers\.join\('、'\)\}/, 'insert open confirmation should include selected count and plan numbers');
  assert.match(html, /onclick="openInsertOrderDialog\(\)"/, 'insert add button should open the insert order dialog');
  assert.match(html, /id="insert-order-mask"/, 'insert order dialog should exist');

  for (const label of [
    '插单前缀\\(必填\\)',
    '公司',
    '来源订单号',
    '物料编码',
    '物料说明',
    '订货数量',
    '订单状态',
    '订单状态描述',
    '计划需求日期',
    '计划起始日期',
    '报关日期',
    '交货期\\/完成日期',
    '批次',
    '行号',
    '序号',
    '提交'
  ]) {
    assert.match(html, new RegExp(label), `missing insert order dialog field: ${label}`);
  }

  assert.match(
    html,
    /<select id="insert-form-prefix"[^>]*required>[\s\S]*?<option value="">请选择<\/option>[\s\S]*?<option value="出口订单">出口订单<\/option>[\s\S]*?<option value="内销订单">内销订单<\/option>[\s\S]*?<\/select>/,
    'insert order prefix should use the requested select options'
  );

  assert.match(html, /onclick="openReturnOrderDialog\(\)"/, 'return package order button should open the return order dialog');
  assert.match(html, /id="return-order-mask"/, 'return order dialog should exist');

  for (const label of [
    '工艺流程\\(必选\\)',
    '返包订单系列号\\(必填\\)',
    '分厂编码',
    '分厂名称',
    '计划订单',
    '订单来源',
    '订单代码\\(总装\\)',
    '物料编码',
    '订单数量',
    '出口订单报关日期',
    '交货期',
    '成品码',
    '订单状态',
    '是否关闭订单',
    '批次',
    '行号',
    '序号',
    '类型',
    '是否加急订单',
    '提交'
  ]) {
    assert.match(html, new RegExp(label), `missing return order dialog field: ${label}`);
  }

  for (const id of ['return-form-plant', 'return-form-plant-name', 'return-form-customs-date', 'return-form-delivery-date']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*readonly`), `${id} should be automatically filled and read only`);
  }
  for (const id of ['return-form-batch', 'return-form-line-no', 'return-form-seq']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing split return order field: ${id}`);
  }
  assert.doesNotMatch(html, /id="return-form-batch-line-seq"/, 'combined batch/line/sequence field should be removed');
  assert.match(html, /onchange="updateReturnOrderAutofill\(\)"/, 'return order selectors should refresh linked fields');
  assert.doesNotMatch(html, /清空开单/, 'production orders should not show the clear opened orders action');
  assert.doesNotMatch(html, /clearOpenedOrders/, 'unused clear opened orders handler should be removed');
});

test('order management filter bars use the requested grouped layouts', () => {
  const html = readHtml('order-management.html');
  const planFilters = readBetween(html, 'id="plan-filter-layout"', '<div class="table-shell">');
  const productionFilters = readBetween(html, 'id="production-filter-stack"', '<div class="table-shell">');
  const productionPrimary = readBetween(
    productionFilters,
    'id="production-filter-primary"',
    'id="production-filter-secondary"'
  );
  const productionSecondary = productionFilters.slice(productionFilters.indexOf('id="production-filter-secondary"'));

  assert.ok(planFilters, 'plan order filters should use a dedicated two-column layout');
  assert.match(planFilters, /id="plan-filter-dates"[\s\S]*id="plan-start-date"[\s\S]*id="plan-end-date"[\s\S]*confirmOrderAction\('plan-open'\)/);
  assert.match(planFilters, /id="plan-filter-query"[\s\S]*id="plan-status"[\s\S]*id="plan-search"/);
  assert.ok(
    planFilters.indexOf('id="plan-filter-dates"') < planFilters.indexOf('id="plan-filter-query"'),
    'date/open bar should be placed before the status/search bar'
  );
  assert.match(readCssRuleBody(html, '.order-filter-layout'), /grid-template-columns\s*:\s*[^;]*\s+[^;]*/);

  assert.ok(productionFilters, 'production filters should use a two-row stack');
  assert.ok(productionPrimary, 'production primary filter row should exist');
  assert.ok(productionSecondary, 'production secondary filter row should exist');
  for (const id of ['prod-plant', 'prod-closed', 'prod-type', 'prod-urgent']) {
    assert.doesNotMatch(productionPrimary, new RegExp(`id="${id}"`), `${id} should not remain in the primary row`);
    assert.match(productionSecondary, new RegExp(`id="${id}"`), `${id} should be placed in the secondary row`);
  }
});

test('return package order selection auto-fills plant and delivery details', () => {
  const [script] = readInlineScripts('order-management.html');
  const elements = {
    'return-form-process': { value: 'CBJW12' },
    'return-form-series': { value: 'FB202606-B' },
    'return-form-plant': { value: '' },
    'return-form-plant-name': { value: '' },
    'return-form-customs-date': { value: '' },
    'return-form-delivery-date': { value: '' }
  };
  const result = require('node:vm').runInNewContext(
    `${script}\nupdateReturnOrderAutofill(); ({
      plant: document.getElementById('return-form-plant').value,
      plantName: document.getElementById('return-form-plant-name').value,
      customsDate: document.getElementById('return-form-customs-date').value,
      deliveryDate: document.getElementById('return-form-delivery-date').value
    });`,
    {
      document: {
        addEventListener() {},
        querySelectorAll() { return []; },
        getElementById(id) { return elements[id] || null; }
      },
      Set,
      console
    }
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(result)),
    {
      plant: '1688',
      plantName: '总装一厂',
      customsDate: '2026-06-20T09:00',
      deliveryDate: '2026-06-24T17:30'
    }
  );
});

test('order management tables use the requested headers and paginate 30 rows by tens', () => {
  const html = readHtml('order-management.html');
  const expectedHeaders = {
    'plan-order-table': [
      '序号', '公司', '计划订单号', '订单类别', '来源订单号', '物料编码', '物料说明', '订货数量',
      '订单状态', '订单状态描述', '计划需求日期', '计划起始日期', '报关日期', '交货期/完成日期', '销售批次', '行号'
    ],
    'insert-order-table': [
      '序号', 'ID', '公司', '计划订单号', '订单类别', '来源订单号', '物料编码', '物料说明',
      '订货数量', '订单状态', '订单状态描述', '是否开单', '是否插单', '计划需求日期',
      '计划起始日期', '报关日期', '交货期/完成日期', '销售批次', '行号'
    ],
    'production-order-table': [
      '序号', '配套订单', '开单时间', '分厂编码', '分厂名称', '计划订单', '订单来源', '订单代码（总装）',
      '物料编码', '订单数量', '报关日期', '交货期', '工艺流程', '成品码', '订单状态', '是否关闭',
      '类型', '是否加急订单', '批次', '行号'
    ]
  };

  Object.entries(expectedHeaders).forEach(([tableId, headers]) => {
    assert.deepEqual(readTableHeaders(html, tableId), headers, `${tableId} headers should match the requested order`);
  });

  const [script] = readInlineScripts('order-management.html');
  const result = require('node:vm').runInNewContext(
    `${script}\n({ ORDER_PAGE_SIZE, planOrderData, insertOrderData, productionOrderData });`,
    {
      document: {
        addEventListener() {},
        querySelectorAll() { return []; },
        getElementById() { return null; }
      },
      Set,
      console
    }
  );

  assert.equal(result.ORDER_PAGE_SIZE, 10, 'each order page should contain ten records');
  assert.equal(result.planOrderData.length, 30, 'plan orders should contain 30 records');
  assert.equal(result.insertOrderData.length, 30, 'insert orders should contain 30 records');
  assert.equal(result.productionOrderData.length, 30, 'production orders should contain 30 records');

  for (const type of ['plan', 'insert', 'production']) {
    assert.match(html, new RegExp(`id="${type}-order-tbody"`), `missing ${type} table body`);
    assert.match(html, new RegExp(`id="${type}-page-label"[^>]*>1/3<`), `${type} pagination should start at 1/3`);
    assert.match(html, new RegExp(`changeOrderPage\\('${type}', -1\\)`), `${type} previous page control should be wired`);
    assert.match(html, new RegExp(`changeOrderPage\\('${type}', 1\\)`), `${type} next page control should be wired`);
  }
});

test('inventory board is rebuilt as a stock list page with the requested columns', () => {
  const html = readHtml('inventory-board.html');
  const requiredHeaders = [
    '仓库',
    '物料',
    '现有库存',
    '现有寄存库存',
    '客户所拥有的现有库存',
    '冻结库存',
    '计划时冻结库存',
    '在购库存',
    '公司所拥有的在购库存',
    '在购寄存库存',
    '客户所拥有的在购库存',
    '在途库存',
    '在途寄存库存',
    '客户所拥有的在途库存',
    '分配库存',
    '公司所拥有的分配库位的库存',
    '分配库位的寄存库存',
    '客户所拥有的分配库位的库存',
    '客户所拥有的冻结库存',
    '用于计划的客户所拥有的冻结库存',
    '承诺库存',
    '分配库位的库存',
    '处理中的承诺库存',
    '公司所拥有的隔离库存',
    '寄存隔离库存',
    '客户所拥有的隔离库存',
    '上次库存事务处理日期',
    '历史库存余量日期',
    '作废日期',
    '累计发料',
    '历史库存余量'
  ];

  assert.match(html, /库存列表/, 'inventory page should use list title copy');
  assert.match(html, /inventory-list-table/, 'inventory page should render a stock list table');
  assert.match(html, /\.inventory-table-shell\s*{[\s\S]*?overflow:\s*auto/, 'inventory table should scroll when columns overflow');
  assert.match(html, /\.inventory-list-table th:last-child,\s*\.inventory-list-table td:last-child\s*{[\s\S]*?position:\s*sticky[\s\S]*?right:\s*0/, 'history balance column should stay frozen on the right');
  assert.match(html, /仓库 \/ 物料（模糊）/, 'inventory page should include the fuzzy warehouse/material search');

  for (const header of requiredHeaders) {
    assert.match(html, new RegExp(`<th[^>]*>\\s*${header}\\s*</th>`), `missing inventory table header: ${header}`);
  }
});
