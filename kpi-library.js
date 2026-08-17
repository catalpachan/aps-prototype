(function exposeKpiLibrary(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    Object.assign(root, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createKpiLibrary() {
  const KPI_LIBRARY_STORAGE_KEY = 'aps.kpi.library.config.v1';

  const KPI_METRICS = Object.freeze([
    {
      id: 'production-total',
      category: '产能类',
      name: '产能统计',
      description: '产能明细表（含日期选择）',
      unit: '件',
      value: '12,860',
      trend: 'up',
      note: '较上期 +6.2%'
    },
    {
      id: 'line-utilization',
      category: '产能类',
      name: '产线利用率',
      description: '各产线利用率排行',
      unit: '%',
      value: '86.4',
      trend: 'up',
      note: '产能利用率保持在目标带内'
    },
    {
      id: 'theoretical-capacity',
      category: '产能类',
      name: '理论产能',
      description: '理论计算的最大产能',
      unit: '件',
      value: '14,880',
      trend: 'stable',
      note: '按当前班次能力计算'
    },
    {
      id: 'actual-capacity',
      category: '产能类',
      name: '实际产能',
      description: '实际完成的产量',
      unit: '件',
      value: '12,860',
      trend: 'up',
      note: '已完成报工汇总'
    },
    {
      id: 'production-utilization',
      category: '产能类',
      name: '产能利用率',
      description: '实际产能 / 理论产能',
      unit: '%',
      value: '86.4',
      trend: 'up',
      note: '与产线利用率联动'
    },
    {
      id: 'daily-achievement',
      category: '产能类',
      name: '日产能达成率',
      description: '日计划完成率',
      unit: '%',
      value: '92.0',
      trend: 'up',
      note: '今日计划完成情况'
    },
    {
      id: 'monthly-capacity-trend',
      category: '产能类',
      name: '月产能趋势',
      description: '月度产能变化趋势',
      unit: '件',
      value: '12,860',
      trend: 'up',
      note: '最近 6 个月趋势'
    },
    {
      id: 'annual-capacity-growth',
      category: '产能类',
      name: '年产能增长率',
      description: '年度产能同比增长',
      unit: '%',
      value: '8.7',
      trend: 'up',
      note: '同比去年同期'
    },
    {
      id: 'equipment-status',
      category: '设备类',
      name: '设备实时状态',
      description: '设备当前运行状态',
      unit: '台',
      value: '48',
      trend: 'stable',
      note: '在线设备数量'
    },
    {
      id: 'mtbf',
      category: '设备类',
      name: 'MTBF',
      description: '平均故障间隔时间',
      unit: '小时',
      value: '168',
      trend: 'up',
      note: '越高越稳定'
    },
    {
      id: 'mttr',
      category: '设备类',
      name: 'MTTR',
      description: '平均修复时间',
      unit: '小时',
      value: '2.4',
      trend: 'down',
      note: '越低越好'
    },
    {
      id: 'teep',
      category: '设备类',
      name: '季度 TEEP',
      description: 'Total Effective Equipment Performance',
      unit: '%',
      value: '78.6',
      trend: 'up',
      note: '季度设备综合绩效'
    },
    {
      id: 'attendance-rate',
      category: '人员类',
      name: '人员出勤率',
      description: '实际出勤人数 / 应出勤人数',
      unit: '%',
      value: '96.5',
      trend: 'stable',
      note: '当班人员统计'
    },
    {
      id: 'hourly-output-per-person',
      category: '人员类',
      name: '小时人均产出',
      description: '每小时每人产出数量',
      unit: '件/人',
      value: '18.6',
      trend: 'up',
      note: '人效趋势'
    },
    {
      id: 'monthly-output-per-person',
      category: '人员类',
      name: '月人均产值',
      description: '月度人均产值',
      unit: '元',
      value: '86,400',
      trend: 'up',
      note: '人均产值统计'
    },
    {
      id: 'daily-mix-count',
      category: '柔性类',
      name: '日混种品种',
      description: '当日切换品种数',
      unit: '种',
      value: '12',
      trend: 'stable',
      note: '统计日内切换'
    },
    {
      id: 'changeover-time',
      category: '柔性类',
      name: '产品切换分钟',
      description: 'PCT=首件合格-末位合格',
      unit: '分钟',
      value: '36',
      trend: 'down',
      note: '越低越好'
    },
    {
      id: 'oee',
      category: '效率类',
      name: 'OEE',
      description: '当前设备综合效率',
      unit: '%',
      value: '82.3',
      trend: 'up',
      note: '可用率 × 性能 × 质量'
    },
    {
      id: 'minute-oee',
      category: '效率类',
      name: '分钟 OEE',
      description: '当前分钟设备综合效率',
      unit: '%',
      value: '84.1',
      trend: 'up',
      note: '分钟级快照'
    },
    {
      id: 'hour-oee',
      category: '效率类',
      name: '小时 OEE',
      description: '当前小时设备综合效率',
      unit: '%',
      value: '83.6',
      trend: 'stable',
      note: '小时级快照'
    },
    {
      id: 'day-oee',
      category: '效率类',
      name: '日 OEE',
      description: '当日设备综合效率',
      unit: '%',
      value: '81.9',
      trend: 'up',
      note: '日班次汇总'
    },
    {
      id: 'quality-rate',
      category: '效率类',
      name: '一次合格率',
      description: '首次检验合格数量占比',
      unit: '%',
      value: '98.1',
      trend: 'up',
      note: '质量效率'
    },
    {
      id: 'schedule-adherence',
      category: '效率类',
      name: '排程执行率',
      description: '实际执行工单 / 计划工单',
      unit: '%',
      value: '94.7',
      trend: 'up',
      note: '计划执行效率'
    },
    {
      id: 'utilization-gap',
      category: '效率类',
      name: '产能利用差额',
      description: '理论产能与实际产能差值',
      unit: '件',
      value: '2,020',
      trend: 'down',
      note: '差额越低越好'
    },
    {
      id: 'labor-efficiency',
      category: '效率类',
      name: '人员效率',
      description: '实际产出 / 工时',
      unit: '件/小时',
      value: '21.8',
      trend: 'up',
      note: '工时效率'
    },
    {
      id: 'sequence-change-count',
      category: '排序质量类',
      name: '排序变更次数',
      description: '排程发布后的调整次数',
      unit: '次',
      value: '6',
      trend: 'down',
      note: '次数越低越稳定'
    },
    {
      id: 'sequence-violation-rate',
      category: '排序质量类',
      name: '排序违约率',
      description: '未按推荐顺序执行的比例',
      unit: '%',
      value: '3.2',
      trend: 'down',
      note: '订单排序质量'
    },
    {
      id: 'due-date-risk-rate',
      category: '排序质量类',
      name: '交期风险率',
      description: '存在交期风险的订单比例',
      unit: '%',
      value: '4.8',
      trend: 'down',
      note: '风险预警'
    },
    {
      id: 'plan-completion-rate',
      category: '计划类',
      name: '计划完成率',
      description: '计划工单已完成比例',
      unit: '%',
      value: '92.0',
      trend: 'up',
      note: '日计划达成'
    },
    {
      id: 'plan-on-time-rate',
      category: '计划类',
      name: '计划准时率',
      description: '按计划时间完成的比例',
      unit: '%',
      value: '94.2',
      trend: 'up',
      note: '准时交付'
    },
    {
      id: 'bottleneck-load',
      category: '瓶颈类',
      name: '瓶颈资源负荷',
      description: '瓶颈工作中心负荷率',
      unit: '%',
      value: '97.6',
      trend: 'down',
      note: '超过 95% 触发关注'
    },
    {
      id: 'bottleneck-wait-time',
      category: '瓶颈类',
      name: '瓶颈等待时长',
      description: '瓶颈工序平均等待时长',
      unit: '小时',
      value: '5.8',
      trend: 'down',
      note: '物料与设备等待'
    },
    {
      id: 'bottleneck-order-count',
      category: '瓶颈类',
      name: '瓶颈积压订单',
      description: '瓶颈资源前待处理订单数',
      unit: '单',
      value: '14',
      trend: 'down',
      note: '积压订单'
    },
    {
      id: 'bottleneck-capacity-gap',
      category: '瓶颈类',
      name: '瓶颈能力缺口',
      description: '瓶颈资源缺少的产能',
      unit: '件',
      value: '420',
      trend: 'down',
      note: '未来 24 小时预测'
    },
    {
      id: 'inventory-turnover',
      category: '库存类',
      name: '库存周转率',
      description: '库存周转次数',
      unit: '次/月',
      value: '5.6',
      trend: 'up',
      note: '库存效率'
    },
    {
      id: 'inventory-days',
      category: '库存类',
      name: '库存可用天数',
      description: '按当前消耗速度可用天数',
      unit: '天',
      value: '7.4',
      trend: 'stable',
      note: '安全库存窗口'
    },
    {
      id: 'shortage-count',
      category: '库存类',
      name: '缺料预警数',
      description: '当前存在短缺风险的物料数',
      unit: '项',
      value: '3',
      trend: 'down',
      note: '已同步至待办'
    },
    {
      id: 'overstock-rate',
      category: '库存类',
      name: '库存呆滞率',
      description: '超过周转阈值的库存比例',
      unit: '%',
      value: '6.8',
      trend: 'down',
      note: '呆滞库存占比'
    },
    {
      id: 'safety-stock-hit-rate',
      category: '库存类',
      name: '安全库存达标率',
      description: '达到安全库存的物料比例',
      unit: '%',
      value: '91.5',
      trend: 'up',
      note: 'WMS 库存快照'
    },
    {
      id: 'order-on-time-rate',
      category: '订单类',
      name: '订单准时交付率',
      description: '按承诺日期交付的订单比例',
      unit: '%',
      value: '94.2',
      trend: 'up',
      note: '核心交付 KPI'
    }
  ].map(function freezeMetric(metric) {
    return Object.freeze(metric);
  }));

  const DEFAULT_KPI_IDS = Object.freeze([
    'production-total',
    'line-utilization',
    'theoretical-capacity',
    'actual-capacity',
    'production-utilization'
  ]);
  const KNOWN_KPI_IDS = new Set(KPI_METRICS.map(function getMetricId(metric) {
    return metric.id;
  }));

  function getDefaultKpiLibraryConfig() {
    return { selectedIds: DEFAULT_KPI_IDS.slice() };
  }

  function getGlobalLocalStorage() {
    try {
      return typeof globalThis === 'undefined' ? undefined : globalThis.localStorage;
    } catch (error) {
      return undefined;
    }
  }

  function normalizeSelectedIds(selectedIds) {
    if (!Array.isArray(selectedIds)) return null;

    const seen = new Set();
    return selectedIds.filter(function keepKnownUniqueId(id) {
      if (typeof id !== 'string' || !KNOWN_KPI_IDS.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function loadKpiLibraryConfig(storage = getGlobalLocalStorage()) {
    const resolvedStorage = storage;
    if (!resolvedStorage || typeof resolvedStorage.getItem !== 'function') {
      return getDefaultKpiLibraryConfig();
    }

    let rawValue;
    try {
      rawValue = resolvedStorage.getItem(KPI_LIBRARY_STORAGE_KEY);
    } catch (error) {
      return getDefaultKpiLibraryConfig();
    }

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return getDefaultKpiLibraryConfig();
    }

    let payload;
    try {
      payload = JSON.parse(rawValue);
    } catch (error) {
      return getDefaultKpiLibraryConfig();
    }

    const selectedIds = normalizeSelectedIds(
      payload && typeof payload === 'object' ? payload.selectedIds : null
    );
    return selectedIds === null ? getDefaultKpiLibraryConfig() : { selectedIds };
  }

  function saveKpiLibraryConfig(config, storage = getGlobalLocalStorage()) {
    const resolvedStorage = storage;
    if (!resolvedStorage || typeof resolvedStorage.setItem !== 'function') {
      throw new Error('localStorage is unavailable');
    }

    const selectedIds = normalizeSelectedIds(
      config && typeof config === 'object' ? config.selectedIds : null
    );
    const payload = {
      selectedIds: selectedIds === null ? DEFAULT_KPI_IDS.slice() : selectedIds,
      updatedAt: new Date().toISOString()
    };
    resolvedStorage.setItem(KPI_LIBRARY_STORAGE_KEY, JSON.stringify(payload));
    return { selectedIds: payload.selectedIds.slice(), updatedAt: payload.updatedAt };
  }

  return {
    KPI_LIBRARY_STORAGE_KEY,
    KPI_METRICS,
    DEFAULT_KPI_IDS,
    getDefaultKpiLibraryConfig,
    loadKpiLibraryConfig,
    saveKpiLibraryConfig
  };
});
