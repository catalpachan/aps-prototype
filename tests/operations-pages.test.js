const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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
  const resourceCenterIndex = optimization.indexOf('id="aps-resource-center-btn"');
  const resourceMatchIndex = optimization.indexOf('id="aps-resource-match-btn"');
  const headers = readTableHeaders(html, 'resource-master-table');

  assert.ok(resourceMatchIndex > -1, 'resource match button should remain');
  assert.ok(resourceCenterIndex > -1, 'resource management center button should exist');
  assert.ok(resourceCenterIndex < resourceMatchIndex, 'resource management center should sit to the left of resource matching');
  assert.match(optimization, /resourceCenterBtn\?\.addEventListener\('click',[\s\S]*window\.location\.href = 'resource-center\.html'/);

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
