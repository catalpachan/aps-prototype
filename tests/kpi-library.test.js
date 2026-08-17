const assert = require('node:assert/strict');
const test = require('node:test');

const {
  KPI_LIBRARY_STORAGE_KEY,
  KPI_METRICS,
  DEFAULT_KPI_IDS,
  loadKpiLibraryConfig,
  saveKpiLibraryConfig
} = require('../kpi-library.js');

const EXPECTED_DEFAULT_IDS = [
  'production-total',
  'line-utilization',
  'theoretical-capacity',
  'actual-capacity',
  'production-utilization'
];

const EXPECTED_CATALOG = [
  ['production-total', '产能统计'],
  ['line-utilization', '产线利用率'],
  ['theoretical-capacity', '理论产能'],
  ['actual-capacity', '实际产能'],
  ['production-utilization', '产能利用率'],
  ['daily-achievement', '日产能达成率'],
  ['monthly-capacity-trend', '月产能趋势'],
  ['annual-capacity-growth', '年产能增长率'],
  ['equipment-status', '设备实时状态'],
  ['mtbf', 'MTBF'],
  ['mttr', 'MTTR'],
  ['teep', '季度 TEEP'],
  ['attendance-rate', '人员出勤率'],
  ['hourly-output-per-person', '小时人均产出'],
  ['monthly-output-per-person', '月人均产值'],
  ['daily-mix-count', '日混种品种'],
  ['changeover-time', '产品切换分钟'],
  ['oee', 'OEE'],
  ['minute-oee', '分钟 OEE'],
  ['hour-oee', '小时 OEE'],
  ['day-oee', '日 OEE'],
  ['quality-rate', '一次合格率'],
  ['schedule-adherence', '排程执行率'],
  ['utilization-gap', '产能利用差额'],
  ['labor-efficiency', '人员效率'],
  ['sequence-change-count', '排序变更次数'],
  ['sequence-violation-rate', '排序违约率'],
  ['due-date-risk-rate', '交期风险率'],
  ['plan-completion-rate', '计划完成率'],
  ['plan-on-time-rate', '计划准时率'],
  ['bottleneck-load', '瓶颈资源负荷'],
  ['bottleneck-wait-time', '瓶颈等待时长'],
  ['bottleneck-order-count', '瓶颈积压订单'],
  ['bottleneck-capacity-gap', '瓶颈能力缺口'],
  ['inventory-turnover', '库存周转率'],
  ['inventory-days', '库存可用天数'],
  ['shortage-count', '缺料预警数'],
  ['overstock-rate', '库存呆滞率'],
  ['safety-stock-hit-rate', '安全库存达标率'],
  ['order-on-time-rate', '订单准时交付率']
];

const EXPECTED_CATEGORY_COUNTS = {
  产能类: 8,
  设备类: 4,
  人员类: 3,
  柔性类: 2,
  效率类: 8,
  排序质量类: 3,
  计划类: 2,
  瓶颈类: 4,
  库存类: 5,
  订单类: 1
};

function createStorage(initialValue = null, { failWrites = false } = {}) {
  let value = initialValue;

  return {
    getItem(key) {
      assert.equal(key, KPI_LIBRARY_STORAGE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, KPI_LIBRARY_STORAGE_KEY);
      if (failWrites) throw new Error('storage write failed');
      value = nextValue;
    },
    read() {
      return value;
    }
  };
}

function withMockedLocalStorage(storage, callback) {
  const hadLocalStorage = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = storage;

  try {
    return callback();
  } finally {
    if (hadLocalStorage) {
      globalThis.localStorage = previousLocalStorage;
    } else {
      delete globalThis.localStorage;
    }
  }
}

test('catalog contains exactly 40 uniquely identified metrics with all required fields', () => {
  assert.equal(KPI_METRICS.length, 40);

  const ids = KPI_METRICS.map((metric) => metric.id);
  assert.equal(new Set(ids).size, KPI_METRICS.length);

  for (const metric of KPI_METRICS) {
    for (const field of ['id', 'category', 'name', 'description', 'unit', 'value', 'trend', 'note']) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(metric, field),
        `metric ${metric.id || '<unknown>'} is missing ${field}`
      );
      assert.notEqual(metric[field], '', `metric ${metric.id} has an empty ${field}`);
      assert.notEqual(metric[field], null, `metric ${metric.id} has a null ${field}`);
      assert.notEqual(metric[field], undefined, `metric ${metric.id} has an undefined ${field}`);
    }
  }
});

test('catalog category counts match the approved specification', () => {
  const categoryCounts = KPI_METRICS.reduce((counts, metric) => {
    counts[metric.category] = (counts[metric.category] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    categoryCounts,
    EXPECTED_CATEGORY_COUNTS
  );
});

test('catalog IDs and names match the approved order', () => {
  assert.deepEqual(
    KPI_METRICS.map((metric) => [metric.id, metric.name]),
    EXPECTED_CATALOG
  );
});

test('default selection contains exactly the five approved stable IDs', () => {
  assert.deepEqual(DEFAULT_KPI_IDS, EXPECTED_DEFAULT_IDS);
});

test('KPI configuration uses the approved storage key', () => {
  assert.equal(KPI_LIBRARY_STORAGE_KEY, 'aps.kpi.library.config.v1');
});

test('loading from empty storage returns the default selection', () => {
  const storage = createStorage();

  assert.deepEqual(loadKpiLibraryConfig(storage), {
    selectedIds: EXPECTED_DEFAULT_IDS
  });
});

test('loading malformed JSON returns the default selection', () => {
  const storage = createStorage('{not valid JSON');

  assert.deepEqual(loadKpiLibraryConfig(storage), {
    selectedIds: EXPECTED_DEFAULT_IDS
  });
});

test('loading a valid configuration filters unknown metric IDs', () => {
  const storage = createStorage(JSON.stringify({
    selectedIds: ['line-utilization', 'unknown-metric', 'actual-capacity']
  }));

  assert.deepEqual(loadKpiLibraryConfig(storage), {
    selectedIds: ['line-utilization', 'actual-capacity']
  });
});

test('invalid configuration payloads fall back to defaults while an empty selection remains valid', () => {
  for (const payload of [
    'null',
    JSON.stringify({}),
    JSON.stringify({ selectedIds: 'line-utilization' }),
    JSON.stringify({ selectedIds: null })
  ]) {
    assert.deepEqual(loadKpiLibraryConfig(createStorage(payload)), {
      selectedIds: EXPECTED_DEFAULT_IDS
    });
  }

  assert.deepEqual(loadKpiLibraryConfig(createStorage(JSON.stringify({ selectedIds: [] }))), {
    selectedIds: []
  });
});

test('saving a configuration writes selected IDs and an updated timestamp as JSON', () => {
  const storage = createStorage();

  saveKpiLibraryConfig({ selectedIds: ['production-total', 'unknown-metric'] }, storage);

  const saved = JSON.parse(storage.read());
  assert.deepEqual(saved.selectedIds, ['production-total']);
  assert.equal(typeof saved.updatedAt, 'string');
  assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
});

test('no-argument load and save calls use globalThis.localStorage', () => {
  const storage = createStorage();

  withMockedLocalStorage(storage, () => {
    saveKpiLibraryConfig({ selectedIds: ['line-utilization'] });
    assert.deepEqual(loadKpiLibraryConfig(), { selectedIds: ['line-utilization'] });
  });
});

test('storage write failures are surfaced to the caller', () => {
  const storage = createStorage(null, { failWrites: true });

  assert.throws(
    () => saveKpiLibraryConfig({ selectedIds: ['line-utilization'] }, storage),
    /storage write failed/
  );
});
