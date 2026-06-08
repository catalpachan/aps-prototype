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

function maxDepth(nodes, depth = 1) {
  return nodes.reduce((max, node) => {
    const childDepth = Array.isArray(node.children) && node.children.length
      ? maxDepth(node.children, depth + 1)
      : depth;
    return Math.max(max, childDepth);
  }, depth);
}

test('collab workbench exposes smart BOM and order management before inventory board', () => {
  const html = readHtml('collab.html');
  const bomIndex = html.indexOf('smart-bom.html');
  const orderIndex = html.indexOf('order-management.html');
  const inventoryIndex = html.indexOf('inventory-board.html');

  assert.ok(bomIndex > -1, 'missing Smart BOM entry');
  assert.ok(orderIndex > -1, 'missing order management entry');
  assert.ok(inventoryIndex > -1, 'missing inventory entry');
  assert.ok(bomIndex < inventoryIndex, 'Smart BOM should be to the left of inventory board');
  assert.ok(orderIndex < inventoryIndex, 'Order management should be to the left of inventory board');
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
