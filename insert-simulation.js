// 插单模拟页的确定性演示数据与交互。

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
  },
  {
    id: 'order-2',
    rowIndex: 1,
    company: '1688',
    plannedOrderCode: 'CNX000002',
    orderCategory: '内销',
    sourceOrderCode: 'G003测试',
    materialCode: 'CA444W12201',
    materialDescription: '变频冷暖柜机',
    orderQty: 32
  },
  {
    id: 'order-3',
    rowIndex: 2,
    company: '合肥格力',
    plannedOrderCode: 'CNX000003',
    orderCategory: '出口',
    sourceOrderCode: 'G003测试',
    materialCode: 'CA444W12202',
    materialDescription: '云佳系列空调',
    orderQty: 28
  },
  {
    id: 'order-4',
    rowIndex: 3,
    company: '芜湖格力',
    plannedOrderCode: 'CNX000004',
    orderCategory: '内销',
    sourceOrderCode: 'G003测试',
    materialCode: 'CA444W12203',
    materialDescription: '新风空调套装',
    orderQty: 26
  },
  {
    id: 'order-5',
    rowIndex: 4,
    company: '1688',
    plannedOrderCode: 'CNX000005',
    orderCategory: '出口',
    sourceOrderCode: 'G003测试',
    materialCode: 'CA444W12204',
    materialDescription: '静音变频空调',
    orderQty: 24
  }
];

const simulationResultTemplates = [
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
  },
  {
    sequence: 2,
    plantCode: '200',
    materialCode: '20000106009002',
    workCenter: 'ZS302/29558F',
    scheduledCapacity: 120,
    insertCapacity: 28,
    remainingCapacity: 1652,
    utilization: '1.6%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.14
  },
  {
    sequence: 3,
    plantCode: '201',
    materialCode: '20000106009003',
    workCenter: 'ZS401/29561F',
    scheduledCapacity: 260,
    insertCapacity: 24,
    remainingCapacity: 1516,
    utilization: '1.3%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.13
  },
  {
    sequence: 4,
    plantCode: '201',
    materialCode: '20000106009004',
    workCenter: 'ZS402/29562F',
    scheduledCapacity: 340,
    insertCapacity: 22,
    remainingCapacity: 1438,
    utilization: '1.2%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.12
  },
  {
    sequence: 5,
    plantCode: '202',
    materialCode: '20000106009005',
    workCenter: 'ZS501/29565F',
    scheduledCapacity: 420,
    insertCapacity: 18,
    remainingCapacity: 1362,
    utilization: '1.0%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.11
  },
  {
    sequence: 6,
    plantCode: '202',
    materialCode: '20000106009006',
    workCenter: 'ZS502/29566F',
    scheduledCapacity: 520,
    insertCapacity: 16,
    remainingCapacity: 1264,
    utilization: '0.9%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.10
  },
  {
    sequence: 7,
    plantCode: '203',
    materialCode: '20000106009007',
    workCenter: 'ZS601/29569F',
    scheduledCapacity: 640,
    insertCapacity: 14,
    remainingCapacity: 1146,
    utilization: '0.8%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.09
  },
  {
    sequence: 8,
    plantCode: '203',
    materialCode: '20000106009008',
    workCenter: 'ZS602/29570F',
    scheduledCapacity: 760,
    insertCapacity: 12,
    remainingCapacity: 1028,
    utilization: '0.7%',
    status: '正常',
    capacityLimit: 1800,
    allocationRate: 0.16
  }
];

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSelectionState(selectedIds, totalCount = insertOrders.length) {
  const selectedCount = selectedIds && typeof selectedIds.size === 'number' ? selectedIds.size : 0;
  const normalizedTotalCount = Number.isFinite(totalCount) ? Math.max(0, totalCount) : insertOrders.length;
  const isAllSelected = normalizedTotalCount > 0 && selectedCount === normalizedTotalCount;
  return {
    selectedCount,
    totalCount: normalizedTotalCount,
    isAllSelected,
    isIndeterminate: selectedCount > 0 && !isAllSelected
  };
}

function calculateSimulationResults(orders, selectedIds, templates = simulationResultTemplates) {
  const selectedOrderIds = selectedIds && typeof selectedIds.has === 'function'
    ? selectedIds
    : new Set(selectedIds || []);
  const selectedTotalQty = orders
    .filter((order) => selectedOrderIds.has(order.id))
    .reduce((total, order) => total + Number(order.orderQty || 0), 0);

  return templates.map((template) => {
    const insertCapacity = Math.round(selectedTotalQty * template.allocationRate);
    const remainingCapacity = Math.max(
      0,
      template.capacityLimit - template.scheduledCapacity - insertCapacity
    );
    const utilizationPercent = template.capacityLimit > 0
      ? Math.round(insertCapacity / template.capacityLimit * 1000) / 10
      : 0;

    return {
      ...template,
      insertCapacity,
      remainingCapacity,
      utilization: `${utilizationPercent}%`,
      status: utilizationPercent <= 80 ? '正常' : '需关注'
    };
  });
}

function setDynamicText(element, value) {
  const text = String(value ?? '');
  element.textContent = text;
  element.setAttribute('title', text);
}

function createCell(documentRef, value, className) {
  const cell = documentRef.createElement('td');
  if (className) cell.className = className;
  setDynamicText(cell, value);
  return cell;
}

function replaceElementChildren(element, children) {
  if (typeof element.replaceChildren === 'function') {
    element.replaceChildren(...children);
    return;
  }
  element.textContent = '';
  children.forEach((child) => element.appendChild(child));
}

function createStatusElement(documentRef, runButton) {
  let statusElement = documentRef.getElementById('simulation-status');
  if (statusElement) return statusElement;

  statusElement = documentRef.createElement('p');
  statusElement.id = 'simulation-status';
  statusElement.setAttribute('aria-live', 'polite');
  statusElement.className = 'simulation-status-message';
  const host = runButton.parentNode || documentRef.body || documentRef.documentElement;
  if (host && typeof host.appendChild === 'function') host.appendChild(statusElement);
  return statusElement;
}

function initializeInsertSimulation() {
  const orderTbody = document.getElementById('insert-order-tbody');
  const resultTbody = document.getElementById('simulation-result-tbody');
  const selectAll = document.getElementById('insert-order-select-all');
  const selectedCountElement = document.getElementById('insert-order-selected-count');
  const runButton = document.getElementById('simulation-run-btn');

  if (!orderTbody || !resultTbody || !selectAll || !selectedCountElement || !runButton) return;

  const selectedOrderIds = new Set(insertOrders.slice(0, 3).map((order) => order.id));
  const orderCheckboxes = new Map();
  const statusElement = createStatusElement(document, runButton);

  function renderSelectionState() {
    const state = getSelectionState(selectedOrderIds, insertOrders.length);
    selectAll.checked = state.isAllSelected;
    selectAll.indeterminate = state.isIndeterminate;
    selectAll.setAttribute('aria-checked', state.isAllSelected ? 'true' : state.isIndeterminate ? 'mixed' : 'false');
    selectAll.setAttribute('aria-label', '全选插单订单');
    selectedCountElement.textContent = `已选 ${state.selectedCount} 条`;

    insertOrders.forEach((order) => {
      const checkbox = orderCheckboxes.get(order.id);
      if (!checkbox) return;
      const isChecked = selectedOrderIds.has(order.id);
      checkbox.checked = isChecked;
      checkbox.indeterminate = false;
      checkbox.setAttribute('aria-checked', String(isChecked));
      checkbox.setAttribute('aria-label', `选择插单订单 ${order.id}`);
      checkbox.parentNode.parentNode.classList.toggle('selected', isChecked);
    });
  }

  function renderOrders() {
    const rows = insertOrders.map((order) => {
      const row = document.createElement('tr');
      row.setAttribute('data-order-id', order.id);

      const selectionCell = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedOrderIds.has(order.id);
      checkbox.setAttribute('aria-label', `选择插单订单 ${order.id}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedOrderIds.add(order.id);
        else selectedOrderIds.delete(order.id);
        renderSelectionState();
      });
      selectionCell.appendChild(checkbox);
      row.appendChild(selectionCell);
      orderCheckboxes.set(order.id, checkbox);

      [
        order.rowIndex + 1,
        order.rowIndex,
        order.company,
        order.plannedOrderCode,
        order.orderCategory,
        order.sourceOrderCode,
        order.materialCode,
        order.materialDescription,
        order.orderQty
      ].forEach((value) => row.appendChild(createCell(document, value)));
      return row;
    });

    replaceElementChildren(orderTbody, rows);
    renderSelectionState();
  }

  function renderResults(results) {
    const rows = results.map((result) => {
      const row = document.createElement('tr');
      [
        result.sequence,
        result.plantCode,
        result.materialCode,
        result.workCenter,
        result.scheduledCapacity,
        result.insertCapacity,
        result.remainingCapacity,
        result.utilization,
        result.status
      ].forEach((value, index) => {
        const className = index === 8
          ? result.status === '正常' ? 'simulation-status-normal' : 'simulation-status-attention'
          : '';
        row.appendChild(createCell(document, value, className));
      });
      return row;
    });
    replaceElementChildren(resultTbody, rows);
  }

  selectAll.addEventListener('change', () => {
    if (selectAll.checked) insertOrders.forEach((order) => selectedOrderIds.add(order.id));
    else selectedOrderIds.clear();
    renderSelectionState();
  });

  runButton.addEventListener('click', () => {
    if (selectedOrderIds.size === 0) {
      statusElement.textContent = '请先选择插单订单';
      return;
    }

    runButton.disabled = true;
    runButton.setAttribute('aria-busy', 'true');
    try {
      renderResults(calculateSimulationResults(insertOrders, selectedOrderIds, simulationResultTemplates));
      statusElement.textContent = '模拟完成，结果已更新';
    } finally {
      runButton.disabled = false;
      runButton.setAttribute('aria-busy', 'false');
    }
  });

  renderOrders();
  renderResults(simulationResultTemplates);
}

window.InsertSimulation = {
  insertOrders,
  simulationResultTemplates,
  getSelectionState,
  calculateSimulationResults,
  escapeHTML,
  initializeInsertSimulation
};

document.addEventListener('DOMContentLoaded', initializeInsertSimulation);
