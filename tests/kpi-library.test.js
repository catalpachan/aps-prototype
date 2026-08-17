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
  ['production-total', '产能统计', '产能明细表（含日期选择）', '件', '12,860', 'up', '较上期 +6.2%'],
  ['line-utilization', '产线利用率', '各产线利用率排行', '%', '86.4', 'up', '产能利用率保持在目标带内'],
  ['theoretical-capacity', '理论产能', '理论计算的最大产能', '件', '14,880', 'stable', '按当前班次能力计算'],
  ['actual-capacity', '实际产能', '实际完成的产量', '件', '12,860', 'up', '已完成报工汇总'],
  ['production-utilization', '产能利用率', '实际产能 / 理论产能', '%', '86.4', 'up', '与产线利用率联动'],
  ['daily-achievement', '日产能达成率', '日计划完成率', '%', '92.0', 'up', '今日计划完成情况'],
  ['monthly-capacity-trend', '月产能趋势', '月度产能变化趋势', '件', '12,860', 'up', '最近 6 个月趋势'],
  ['annual-capacity-growth', '年产能增长率', '年度产能同比增长', '%', '8.7', 'up', '同比去年同期'],
  ['equipment-status', '设备实时状态', '设备当前运行状态', '台', '48', 'stable', '在线设备数量'],
  ['mtbf', 'MTBF', '平均故障间隔时间', '小时', '168', 'up', '越高越稳定'],
  ['mttr', 'MTTR', '平均修复时间', '小时', '2.4', 'down', '越低越好'],
  ['teep', '季度 TEEP', 'Total Effective Equipment Performance', '%', '78.6', 'up', '季度设备综合绩效'],
  ['attendance-rate', '人员出勤率', '实际出勤人数 / 应出勤人数', '%', '96.5', 'stable', '当班人员统计'],
  ['hourly-output-per-person', '小时人均产出', '每小时每人产出数量', '件/人', '18.6', 'up', '人效趋势'],
  ['monthly-output-per-person', '月人均产值', '月度人均产值', '元', '86,400', 'up', '人均产值统计'],
  ['daily-mix-count', '日混种品种', '当日切换品种数', '种', '12', 'stable', '统计日内切换'],
  ['changeover-time', '产品切换分钟', 'PCT=首件合格-末位合格', '分钟', '36', 'down', '越低越好'],
  ['oee', 'OEE', '当前设备综合效率', '%', '82.3', 'up', '可用率 × 性能 × 质量'],
  ['minute-oee', '分钟 OEE', '当前分钟设备综合效率', '%', '84.1', 'up', '分钟级快照'],
  ['hour-oee', '小时 OEE', '当前小时设备综合效率', '%', '83.6', 'stable', '小时级快照'],
  ['day-oee', '日 OEE', '当日设备综合效率', '%', '81.9', 'up', '日班次汇总'],
  ['quality-rate', '一次合格率', '首次检验合格数量占比', '%', '98.1', 'up', '质量效率'],
  ['schedule-adherence', '排程执行率', '实际执行工单 / 计划工单', '%', '94.7', 'up', '计划执行效率'],
  ['utilization-gap', '产能利用差额', '理论产能与实际产能差值', '件', '2,020', 'down', '差额越低越好'],
  ['labor-efficiency', '人员效率', '实际产出 / 工时', '件/小时', '21.8', 'up', '工时效率'],
  ['sequence-change-count', '排序变更次数', '排程发布后的调整次数', '次', '6', 'down', '次数越低越稳定'],
  ['sequence-violation-rate', '排序违约率', '未按推荐顺序执行的比例', '%', '3.2', 'down', '订单排序质量'],
  ['due-date-risk-rate', '交期风险率', '存在交期风险的订单比例', '%', '4.8', 'down', '风险预警'],
  ['plan-completion-rate', '计划完成率', '计划工单已完成比例', '%', '92.0', 'up', '日计划达成'],
  ['plan-on-time-rate', '计划准时率', '按计划时间完成的比例', '%', '94.2', 'up', '准时交付'],
  ['bottleneck-load', '瓶颈资源负荷', '瓶颈工作中心负荷率', '%', '97.6', 'down', '超过 95% 触发关注'],
  ['bottleneck-wait-time', '瓶颈等待时长', '瓶颈工序平均等待时长', '小时', '5.8', 'down', '物料与设备等待'],
  ['bottleneck-order-count', '瓶颈积压订单', '瓶颈资源前待处理订单数', '单', '14', 'down', '积压订单'],
  ['bottleneck-capacity-gap', '瓶颈能力缺口', '瓶颈资源缺少的产能', '件', '420', 'down', '未来 24 小时预测'],
  ['inventory-turnover', '库存周转率', '库存周转次数', '次/月', '5.6', 'up', '库存效率'],
  ['inventory-days', '库存可用天数', '按当前消耗速度可用天数', '天', '7.4', 'stable', '安全库存窗口'],
  ['shortage-count', '缺料预警数', '当前存在短缺风险的物料数', '项', '3', 'down', '已同步至待办'],
  ['overstock-rate', '库存呆滞率', '超过周转阈值的库存比例', '%', '6.8', 'down', '呆滞库存占比'],
  ['safety-stock-hit-rate', '安全库存达标率', '达到安全库存的物料比例', '%', '91.5', 'up', 'WMS 库存快照'],
  ['order-on-time-rate', '订单准时交付率', '按承诺日期交付的订单比例', '%', '94.2', 'up', '核心交付 KPI']
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

test('catalog IDs and metadata match the approved order', () => {
  assert.deepEqual(
    KPI_METRICS.map((metric) => [
      metric.id,
      metric.name,
      metric.description,
      metric.unit,
      metric.value,
      metric.trend,
      metric.note
    ]),
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
