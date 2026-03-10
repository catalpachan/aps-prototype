(function () {
  const FEEDBACK_STORAGE_KEY = 'aps.feedback.suggestion.v1';
  const SETTINGS_BASELINE_KEY = 'aps.settings.baseline.v1';
  let echartsLoaderPromise = null;
  let notifyDataCache = null;
  const notifyFilters = {
    date: '',
    category: 'all'
  };

  function normalizeBaselineWeights(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const parse = (v, fallback) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(100, Math.max(0, Math.round(n)));
    };
    const delivery = parse(raw.delivery, 68);
    const cost = parse(raw.cost, 22);
    let stock = parse(raw.stock, 10);
    const total = delivery + cost + stock;
    if (total !== 100) {
      stock = Math.max(0, 100 - delivery - cost);
    }
    return { delivery, cost, stock };
  }

  function loadBaselineWeights() {
    try {
      const raw = localStorage.getItem(SETTINGS_BASELINE_KEY);
      if (!raw) return null;
      return normalizeBaselineWeights(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function saveBaselineWeights(weights) {
    const normalized = normalizeBaselineWeights(weights);
    if (!normalized) return null;
    localStorage.setItem(SETTINGS_BASELINE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function applyBaselineWeightsToInputs(weights) {
    const normalized = normalizeBaselineWeights(weights);
    if (!normalized) return false;
    const mapping = [
      ['aps-weight-delivery', normalized.delivery],
      ['aps-weight-cost', normalized.cost],
      ['aps-weight-stock', normalized.stock]
    ];
    let applied = false;
    mapping.forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = String(value);
      const mirror = document.getElementById(`${id}-v`);
      if (mirror) mirror.textContent = `${value}%`;
      applied = true;
    });
    return applied;
  }

  function loadEChartsLibrary() {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('window is unavailable'));
    }
    if (window.echarts) {
      return Promise.resolve(window.echarts);
    }
    if (echartsLoaderPromise) {
      return echartsLoaderPromise;
    }

    echartsLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-aps-echarts="true"]');
      if (existingScript) {
        if (window.echarts) {
          resolve(window.echarts);
          return;
        }
        existingScript.addEventListener('load', () => resolve(window.echarts), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('echarts script load failed')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
      script.async = true;
      script.dataset.apsEcharts = 'true';
      script.onload = () => {
        if (window.echarts) {
          resolve(window.echarts);
        } else {
          reject(new Error('echarts is unavailable after load'));
        }
      };
      script.onerror = () => {
        reject(new Error('failed to load echarts'));
      };
      document.head.appendChild(script);
    });

    return echartsLoaderPromise;
  }

  function getSharedState() {
    if (typeof state !== 'undefined') return state;
    return null;
  }

  function injectOptimizationStyles() {
    if (document.getElementById('aps-optimization-style')) return;
    const style = document.createElement('style');
    style.id = 'aps-optimization-style';
    style.textContent = `
      .brand-block {
        min-width: 360px;
      }

      .aps-console-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .aps-console-title-main {
        font-size: 16px;
        font-weight: 800;
        color: #e2e8f0;
        letter-spacing: 0.3px;
      }

      .aps-console-title-sub {
        font-size: 11px;
        color: #93c5fd;
      }

      .aps-site-switch {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: 8px;
        background: rgba(15, 23, 42, 0.86);
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 4px 6px;
      }

      .aps-site-switch-label {
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-site-switch .role-select {
        margin-left: 0;
        width: 132px;
        height: 28px;
        border-color: #475569;
      }

      .aps-main-nav {
        gap: 10px;
        flex: 1;
        justify-content: center;
        min-width: 0;
      }

      .aps-main-nav .nav-item {
        font-size: 14px;
        font-weight: 700;
        padding: 11px 20px 10px;
        border-radius: 10px;
        border: 1px solid #334155;
        background: rgba(15, 23, 42, 0.5);
        color: #cbd5e1;
        position: relative;
      }

      .aps-main-nav .nav-item.active {
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        border-color: #2563eb;
        color: #fff;
      }

      .aps-header-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }

      .aps-clock-chip {
        display: inline-flex;
        align-items: center;
        padding: 5px 8px;
        height: 34px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #111b2d;
        color: #9fb1cb;
        font-size: 11px;
      }

      .aps-notify-btn {
        position: relative;
        width: 34px;
        height: 34px;
        border-radius: 9px;
        border: 1px solid #334155;
        background: #111b2d;
        color: #dbeafe;
        font-size: 15px;
        cursor: pointer;
      }

      .aps-header-meta .user-dropdown {
        height: 34px;
      }

      .aps-header-meta .user-dropdown-toggle {
        height: 34px;
        padding: 0 8px;
      }

      .aps-notify-btn:hover {
        border-color: #60a5fa;
        background: #172445;
      }

      .aps-notify-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 999px;
        border: 1px solid #7f1d1d;
        background: #dc2626;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .aps-notify-drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: min(420px, 92vw);
        height: 100vh;
        background: linear-gradient(180deg, #0a1222 0%, #0f172a 100%);
        border-left: 1px solid #334155;
        transform: translateX(100%);
        transition: transform 220ms ease;
        z-index: 260;
        display: flex;
        flex-direction: column;
        box-shadow: -18px 0 40px rgba(2, 6, 23, 0.45);
      }

      .aps-notify-drawer.open {
        transform: translateX(0);
      }

      .aps-notify-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid #334155;
        font-weight: 700;
        font-size: 14px;
      }

      .aps-notify-head-actions {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .aps-notify-close {
        border: 1px solid #334155;
        background: #111b2d;
        color: #dbeafe;
        border-radius: 8px;
        padding: 4px 8px;
        cursor: pointer;
      }

      .aps-notify-clear {
        border: 1px solid #7f1d1d;
        background: rgba(127, 29, 29, 0.3);
        color: #fecaca;
        border-radius: 8px;
        padding: 4px 8px;
        cursor: pointer;
      }

      .aps-notify-filters {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid #1e293b;
      }

      .aps-notify-filter {
        width: 100%;
        height: 32px;
        border-radius: 8px;
        border: 1px solid #334155;
        background: #0f1a2d;
        color: #dbeafe;
        font-size: 12px;
        padding: 0 8px;
      }

      .aps-notify-section {
        padding: 12px 16px;
        border-bottom: 1px solid #1e293b;
      }

      .aps-notify-section-title {
        font-size: 12px;
        color: #94a3b8;
        margin-bottom: 8px;
      }

      .aps-notify-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .aps-notify-item {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 8px 10px;
        background: #0f1a2d;
      }

      .aps-notify-item-title {
        font-size: 12px;
        color: #e2e8f0;
        line-height: 1.5;
      }

      .aps-notify-item-meta {
        margin-top: 4px;
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-notify-item.urgent {
        border-left: 3px solid #ef4444;
      }

      .aps-notify-item.warn {
        border-left: 3px solid #f59e0b;
      }

      .aps-notify-empty {
        border: 1px dashed #334155;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        color: #94a3b8;
      }

      .aps-notify-mask {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.55);
        z-index: 250;
        display: none;
      }

      .aps-notify-mask.open {
        display: block;
      }

      .aps-upgrade-card {
        border: 1px solid #334155;
        border-radius: 10px;
        background: linear-gradient(160deg, #0f1a2d 0%, #0f172a 100%);
        padding: 12px;
        margin-bottom: 0;
      }

      .aps-upgrade-card h4 {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
        color: var(--txt);
        line-height: 1.3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .aps-order-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .aps-order-table th,
      .aps-order-table td {
        border-bottom: 1px solid #263346;
        padding: 6px;
        text-align: left;
      }

      .aps-order-summary {
        margin-top: 6px;
        font-size: 14px;
        line-height: 1.6;
      }

      .aps-order-status {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid #334155;
      }

      .aps-order-status.rush {
        background: #dc2626;
        border-color: #7f1d1d;
        color: #fff;
        font-weight: 700;
      }

      .aps-order-status.cancelled {
        background: #3f3f46;
        color: #cbd5e1;
        text-decoration: line-through;
      }

      .aps-order-status.ready {
        background: #064e3b;
        border-color: #065f46;
        color: #a7f3d0;
      }

      .aps-preplan-result,
      .aps-resource-list,
      .aps-schedule-options {
        margin-top: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .aps-resource-list > .muted {
        font-size: 14px;
        line-height: 1.6;
      }

      .aps-resource-item,
      .aps-schedule-option {
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 8px 10px;
        background: #111b2d;
        font-size: 12px;
        line-height: 1.5;
      }

      .aps-resource-item.warn {
        border-left: 3px solid #f59e0b;
      }

      .aps-schedule-option.best {
        border-color: #22c55e;
        background: linear-gradient(135deg, rgba(6, 78, 59, 0.28), rgba(17, 27, 45, 0.95));
      }

      .aps-schedule-option-title {
        font-weight: 700;
        color: #dbeafe;
        margin-bottom: 4px;
      }

      .aps-schedule-tablist {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .aps-schedule-tab {
        border: 1px solid #334155;
        border-radius: 8px;
        background: #111b2d;
        color: #cbd5e1;
        padding: 8px;
        text-align: left;
        cursor: pointer;
        transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
      }

      .aps-schedule-tab:hover {
        transform: translateY(-1px);
        border-color: #3b82f6;
      }

      .aps-schedule-tab.active {
        border-color: #2563eb;
        background: linear-gradient(135deg, rgba(30, 58, 138, 0.24), rgba(17, 27, 45, 0.94));
      }

      .aps-schedule-tab-name {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: #dbeafe;
      }

      .aps-schedule-tab-meta {
        display: block;
        margin-top: 3px;
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-schedule-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 8px 0 6px;
      }

      .aps-schedule-metric {
        border: 1px solid #2f3d55;
        border-radius: 6px;
        background: #0f172a;
        padding: 6px;
      }

      .aps-schedule-metric b {
        display: block;
        color: #e2e8f0;
        font-size: 13px;
      }

      .aps-schedule-hint {
        margin-top: 2px;
        font-size: 14px;
        line-height: 1.6;
      }

      .aps-kpi-band {
        margin-bottom: 14px;
      }

      .aps-kpi-mini-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .aps-kpi-mini {
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0f1a2d;
        padding: 8px 10px;
      }

      .aps-kpi-mini .label {
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-kpi-mini .value {
        margin-top: 4px;
        font-size: 18px;
        font-weight: 800;
        color: #e2e8f0;
      }

      .aps-kpi-trend-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .aps-kpi-trend-card {
        border: 1px solid #334155;
        border-radius: 10px;
        background: #0f172a;
        padding: 10px;
      }

      .aps-kpi-trend-card-hd {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .aps-kpi-trend-card-hd b {
        font-size: 13px;
        color: #e2e8f0;
      }

      .aps-kpi-trend-delta {
        font-size: 12px;
        font-weight: 700;
      }

      .aps-kpi-trend-delta.up { color: #22c55e; }
      .aps-kpi-trend-delta.down { color: #f59e0b; }

      .aps-kpi-trend-spark {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        align-items: end;
        height: 96px;
      }

      .aps-kpi-trend-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .aps-kpi-trend-col i {
        width: 100%;
        border-radius: 6px 6px 2px 2px;
        background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
        border: 1px solid rgba(147, 197, 253, 0.35);
      }

      .aps-kpi-trend-col span {
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-kpi-trend-col em {
        font-style: normal;
        font-size: 11px;
        color: #e2e8f0;
      }

      .gantt-task.violation-flash {
        animation: apsViolationFlash 0.45s ease 3;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5), 0 0 24px rgba(239, 68, 68, 0.55);
      }

      @keyframes apsViolationFlash {
        0% { filter: brightness(1); }
        50% { filter: brightness(1.55); }
        100% { filter: brightness(1); }
      }

      .aps-decision-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.9fr) minmax(320px, 0.95fr);
        gap: 14px;
        margin-bottom: 16px;
        align-items: start;
      }

      .aps-stage-flow {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        overflow: visible;
      }

      .aps-stage-node {
        min-width: 0;
        width: 100%;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #0f1a2d;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
        text-align: left;
        color: #e2e8f0;
      }

      .aps-stage-node-title {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
      }

      .aps-stage-meta {
        margin-top: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        color: #cbd5e1;
      }

      .aps-stage-status {
        border: 1px solid #334155;
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.5;
      }

      .aps-stage-status.normal {
        color: #bbf7d0;
        border-color: #065f46;
        background: rgba(6, 95, 70, 0.28);
      }

      .aps-stage-status.delay {
        color: #fde68a;
        border-color: #b45309;
        background: rgba(180, 83, 9, 0.22);
      }

      .aps-stage-status.risk {
        color: #fecaca;
        border-color: #991b1b;
        background: rgba(153, 27, 27, 0.22);
      }

      .aps-stage-progress {
        margin-top: 6px;
      }

      .aps-stage-progress-track {
        height: 7px;
        border-radius: 999px;
        background: #22324a;
        overflow: hidden;
      }

      .aps-stage-progress-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #38bdf8, #2563eb);
      }

      .aps-stage-progress-fill.warn {
        background: linear-gradient(90deg, #f59e0b, #d97706);
      }

      .aps-stage-progress-fill.risk {
        background: linear-gradient(90deg, #ef4444, #dc2626);
      }

      .aps-stage-progress-value {
        margin-top: 4px;
        font-size: 11px;
        color: #cbd5e1;
      }

      .aps-stage-node.delay {
        border-color: #f59e0b;
        animation: apsDelayPulse 1.6s ease infinite;
      }

      .aps-stage-node.active {
        border-color: #60a5fa;
        background: #172445;
      }

      @keyframes apsDelayPulse {
        0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35); }
        70% { box-shadow: 0 0 0 9px rgba(245, 158, 11, 0); }
        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
      }

      .aps-diagnosis-card {
        margin-top: 10px;
        border: 1px solid #334155;
        border-radius: 10px;
        background: linear-gradient(160deg, #0f1a2d 0%, #0f172a 100%);
        padding: 12px;
        font-size: 12px;
        color: #e2e8f0;
        display: grid;
        gap: 10px;
      }

      .aps-diagnosis-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .aps-diagnosis-title {
        font-size: 13px;
        font-weight: 700;
        color: #f8fafc;
      }

      .aps-diagnosis-updated {
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-diagnosis-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .aps-diagnosis-item {
        border: 1px dashed #334155;
        border-radius: 8px;
        background: #111b2d;
        padding: 8px 10px;
      }

      .aps-diagnosis-item-label {
        font-size: 11px;
        color: #93c5fd;
        margin-bottom: 4px;
      }

      .aps-diagnosis-item-value {
        line-height: 1.55;
        color: #e2e8f0;
      }

      .aps-slider-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .aps-slider-row {
        display: grid;
        grid-template-columns: 80px 1fr 56px;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .aps-sim-bars {
        height: 242px;
        border: 1px solid #334155;
        border-radius: 10px;
        background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
        padding: 6px;
        position: relative;
      }

      .aps-sim-fallback {
        display: grid;
        gap: 8px;
        padding: 6px;
      }

      .aps-sim-bar {
        display: grid;
        grid-template-columns: 84px 1fr 60px;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .aps-sim-track {
        height: 8px;
        border-radius: 999px;
        background: #1e293b;
        overflow: hidden;
      }

      .aps-sim-fill {
        height: 100%;
        background: linear-gradient(90deg, #38bdf8, #2563eb);
      }

      .aps-setting-block {
        border: 1px solid #334155;
        border-radius: 10px;
        background: #0f1a2d;
        padding: 12px;
        margin-top: 10px;
      }

      .aps-setting-title {
        font-size: 13px;
        font-weight: 700;
        color: #dbeafe;
        margin-bottom: 10px;
      }

      .aps-switch-row,
      .aps-slider-config,
      .aps-scene-row,
      .aps-feedback-box {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .aps-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border: 1px solid #334155;
        border-radius: 8px;
        background: #111b2d;
        padding: 8px 10px;
        font-size: 12px;
      }

      .aps-scene-options {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .aps-scene-btn {
        border: 1px solid #334155;
        border-radius: 10px;
        background: #0f172a;
        color: #dbeafe;
        font-size: 12px;
        font-weight: 700;
        padding: 10px 8px;
        cursor: pointer;
      }

      .aps-scene-btn.active {
        border-color: #2563eb;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
      }

      .aps-feedback-content {
        border: 1px dashed #334155;
        border-radius: 8px;
        padding: 10px;
        background: #0f172a;
        font-size: 12px;
        line-height: 1.6;
      }

      @media (max-width: 1180px) {
        .aps-decision-grid {
          grid-template-columns: 1fr;
        }

        .aps-stage-flow {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .aps-kpi-mini-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 960px) {
        .brand-block {
          min-width: 0;
          flex-wrap: wrap;
        }

        .aps-main-nav {
          justify-content: flex-start;
        }

        .aps-main-nav .nav-item {
          font-size: 13px;
          padding: 9px 12px;
        }

        .aps-header-meta {
          width: auto;
          margin-left: auto;
        }

        .aps-site-switch {
          width: 100%;
        }

        .aps-site-switch .role-select {
          width: 100%;
        }

        .aps-scene-options {
          grid-template-columns: 1fr;
        }

        .aps-stage-flow {
          grid-template-columns: 1fr;
        }

        .aps-kpi-mini-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setupOptimizedHeader() {
    const header = document.querySelector('header');
    const brandBlock = document.querySelector('.brand-block');
    const nav = document.getElementById('nav');
    const meta = document.getElementById('header-meta');
    const hqSelect = document.getElementById('hq-select');
    const userDropdown = document.getElementById('user-dropdown');
    const headerDate = document.getElementById('header-date');
    if (!header || !brandBlock || !nav || !meta) return;

    if (!brandBlock.querySelector('.aps-console-title')) {
      const titleBlock = document.createElement('div');
      titleBlock.className = 'aps-console-title';
      titleBlock.innerHTML = `
        <div class="aps-console-title-main">高级计划排程系统</div>
        <div class="aps-console-title-sub">跨厂协同排程控制台</div>
      `;
      brandBlock.appendChild(titleBlock);
    }

    let siteSwitch = brandBlock.querySelector('.aps-site-switch');
    if (!siteSwitch) {
      siteSwitch = document.createElement('div');
      siteSwitch.className = 'aps-site-switch';
      siteSwitch.innerHTML = '<span class="aps-site-switch-label">制造基地</span>';
      brandBlock.appendChild(siteSwitch);
    }
    if (hqSelect && hqSelect.parentElement !== siteSwitch) {
      siteSwitch.appendChild(hqSelect);
    }

    const topTabs = [
      { href: 'collab.html', label: '排产操作' },
      { href: 'decision.html', label: '决策分析' },
      { href: 'settings.html', label: '系统设置' }
    ];
    const current = location.pathname.split('/').pop() || 'decision.html';
    nav.classList.add('aps-main-nav');
    const existingTabs = Array.from(nav.querySelectorAll('a.nav-item'));
    const navMatchesPreset = existingTabs.length === topTabs.length
      && topTabs.every((tab, idx) => {
        const link = existingTabs[idx];
        if (!link) return false;
        return link.getAttribute('href') === tab.href
          && link.textContent.trim() === tab.label;
      });

    if (!navMatchesPreset) {
      nav.innerHTML = topTabs
        .map((tab) => {
          const active = current === tab.href ? ' active' : '';
          return `<a href="${tab.href}" class="nav-item${active}">${tab.label}</a>`;
        })
        .join('');
    } else {
      existingTabs.forEach((link) => {
        const href = link.getAttribute('href') || '';
        link.classList.toggle('active', href === current);
      });
    }

    if (meta.dataset.optimizedHeader === 'true') return;
    meta.dataset.optimizedHeader = 'true';
    meta.classList.add('aps-header-meta');

    const dateChip = headerDate || document.createElement('span');
    if (!dateChip.id) dateChip.id = 'header-date';
    dateChip.classList.add('aps-clock-chip');

    let notifyBtn = document.getElementById('aps-notify-btn');
    if (!notifyBtn) {
      notifyBtn = document.createElement('button');
      notifyBtn.type = 'button';
      notifyBtn.className = 'aps-notify-btn';
      notifyBtn.id = 'aps-notify-btn';
      notifyBtn.setAttribute('aria-label', '打开消息通知');
      notifyBtn.innerHTML = '🔔<span class="aps-notify-badge" id="aps-notify-badge">0</span>';
    }

    Array.from(meta.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes('|')) {
        node.remove();
      }
    });

    if (dateChip.parentElement !== meta) meta.prepend(dateChip);
    if (notifyBtn.parentElement !== meta) meta.appendChild(notifyBtn);
    if (userDropdown && userDropdown.parentElement !== meta) meta.appendChild(userDropdown);

    if (dateChip.nextSibling !== notifyBtn) {
      meta.insertBefore(notifyBtn, dateChip.nextSibling);
    }
    if (userDropdown && userDropdown.previousSibling !== notifyBtn) {
      meta.appendChild(userDropdown);
    }

    ensureNotificationDrawer();
    renderNotificationDrawer();

    if (notifyBtn.dataset.bound !== 'true') {
      notifyBtn.addEventListener('click', () => toggleNotificationDrawer(true));
      notifyBtn.dataset.bound = 'true';
    }
  }

  function parseRelativeTimeToTimestamp(text, nowTs, idxOffset) {
    if (!text) return nowTs - idxOffset * 3 * 60 * 1000;
    const content = String(text).trim();
    if (content.includes('刚刚')) return nowTs - (idxOffset + 1) * 30 * 1000;

    const minMatch = content.match(/(\d+)\s*分钟前/);
    if (minMatch) return nowTs - Number(minMatch[1]) * 60 * 1000;

    const hourMatch = content.match(/(\d+)\s*小时前/);
    if (hourMatch) return nowTs - Number(hourMatch[1]) * 60 * 60 * 1000;

    const parsed = Date.parse(content);
    if (Number.isFinite(parsed)) return parsed;

    return nowTs - idxOffset * 3 * 60 * 1000;
  }

  function toDateKey(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getNotificationItems() {
    if (notifyDataCache) return notifyDataCache;

    const nowTs = Date.now();
    const sharedState = getSharedState();
    const alertsRaw = Array.isArray(sharedState?.alerts)
      ? sharedState.alerts.slice(0, 4).map((item) => ({
          level: item.level,
          title: item.title,
          time: item.time,
          type: item.level <= 1 ? 'urgent' : 'warn'
        }))
      : [];

    const approvalsRaw = [
      { type: 'warn', title: '审批待办: 战略订单 SO-20260309-018 插单申请', time: '刚刚' },
      { type: 'warn', title: '审批待办: 旺季参数包热切换待确认', time: '6分钟前' }
    ];

    if (!alertsRaw.length) {
      alertsRaw.push(
        { type: 'urgent', title: '异常预警: 东区总装 ZZW05 停机', time: '2分钟前' },
        { type: 'warn', title: '物料预警: 压缩机安全库存低于阈值', time: '11分钟前' }
      );
    }

    const alerts = alertsRaw.map((item, idx) => ({
      ...item,
      category: 'alert',
      createdAt: parseRelativeTimeToTimestamp(item.time, nowTs, idx),
      dateKey: toDateKey(parseRelativeTimeToTimestamp(item.time, nowTs, idx))
    }));

    const approvals = approvalsRaw.map((item, idx) => ({
      ...item,
      category: 'approval',
      createdAt: parseRelativeTimeToTimestamp(item.time, nowTs, idx + alerts.length),
      dateKey: toDateKey(parseRelativeTimeToTimestamp(item.time, nowTs, idx + alerts.length))
    }));

    notifyDataCache = { alerts, approvals };
    return notifyDataCache;
  }

  function getFilteredNotifications(allItems) {
    const byDate = (item) => !notifyFilters.date || item.dateKey === notifyFilters.date;
    const byCategory = (item) => {
      if (notifyFilters.category === 'all') return true;
      return item.category === notifyFilters.category;
    };
    const predicate = (item) => byDate(item) && byCategory(item);
    return {
      alerts: allItems.alerts.filter(predicate),
      approvals: allItems.approvals.filter(predicate)
    };
  }

  function ensureNotificationDrawer() {
    if (document.getElementById('aps-notify-drawer')) return;

    const mask = document.createElement('div');
    mask.className = 'aps-notify-mask';
    mask.id = 'aps-notify-mask';
    mask.addEventListener('click', () => toggleNotificationDrawer(false));

    const drawer = document.createElement('aside');
    drawer.className = 'aps-notify-drawer';
    drawer.id = 'aps-notify-drawer';
    drawer.innerHTML = `
      <div class="aps-notify-head">
        <span>异常告警与审批待办</span>
        <div class="aps-notify-head-actions">
          <button type="button" class="aps-notify-clear" id="aps-notify-clear">清空所有消息</button>
          <button type="button" class="aps-notify-close" id="aps-notify-close">关闭</button>
        </div>
      </div>
      <div class="aps-notify-filters">
        <input type="date" class="aps-notify-filter" id="aps-notify-date-filter" aria-label="按日期筛选消息" />
        <select class="aps-notify-filter" id="aps-notify-type-filter" aria-label="按通知类型筛选">
          <option value="all">全部类型</option>
          <option value="alert">异常告警</option>
          <option value="approval">审批待办</option>
        </select>
      </div>
      <div class="aps-notify-section">
        <div class="aps-notify-section-title">异常告警</div>
        <div class="aps-notify-list" id="aps-alert-list"></div>
      </div>
      <div class="aps-notify-section">
        <div class="aps-notify-section-title">审批待办</div>
        <div class="aps-notify-list" id="aps-approval-list"></div>
      </div>
    `;

    document.body.appendChild(mask);
    document.body.appendChild(drawer);
    document.getElementById('aps-notify-close')?.addEventListener('click', () => toggleNotificationDrawer(false));
    document.getElementById('aps-notify-date-filter')?.addEventListener('change', (evt) => {
      notifyFilters.date = evt.target.value || '';
      renderNotificationDrawer();
    });
    document.getElementById('aps-notify-type-filter')?.addEventListener('change', (evt) => {
      notifyFilters.category = evt.target.value || 'all';
      renderNotificationDrawer();
    });
    document.getElementById('aps-notify-clear')?.addEventListener('click', () => {
      notifyDataCache = { alerts: [], approvals: [] };
      const sharedState = getSharedState();
      if (sharedState && Array.isArray(sharedState.alerts)) {
        sharedState.alerts = [];
      }
      renderNotificationDrawer();
      toast('消息通知已清空。');
    });

    document.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') toggleNotificationDrawer(false);
    });
  }

  function renderNotificationDrawer() {
    const alertList = document.getElementById('aps-alert-list');
    const approvalList = document.getElementById('aps-approval-list');
    const badge = document.getElementById('aps-notify-badge');
    if (!alertList || !approvalList || !badge) return;

    const allItems = getNotificationItems();
    const items = getFilteredNotifications(allItems);
    const dateFilter = document.getElementById('aps-notify-date-filter');
    const typeFilter = document.getElementById('aps-notify-type-filter');
    if (dateFilter) dateFilter.value = notifyFilters.date;
    if (typeFilter) typeFilter.value = notifyFilters.category;

    alertList.innerHTML = items.alerts.length
      ? items.alerts
      .map(
        (item) => `
          <div class="aps-notify-item ${item.type}">
            <div class="aps-notify-item-title">${item.title}</div>
            <div class="aps-notify-item-meta">${item.time}</div>
          </div>
        `
      )
      .join('')
      : '<div class="aps-notify-empty">当前筛选条件下无异常告警。</div>';

    approvalList.innerHTML = items.approvals.length
      ? items.approvals
      .map(
        (item) => `
          <div class="aps-notify-item ${item.type}">
            <div class="aps-notify-item-title">${item.title}</div>
            <div class="aps-notify-item-meta">${item.time}</div>
          </div>
        `
      )
      .join('')
      : '<div class="aps-notify-empty">当前筛选条件下无审批待办。</div>';

    const unreadCount = allItems.alerts.length + allItems.approvals.length;
    badge.textContent = String(unreadCount);
  }

  function toggleNotificationDrawer(open) {
    const drawer = document.getElementById('aps-notify-drawer');
    const mask = document.getElementById('aps-notify-mask');
    if (!drawer || !mask) return;
    drawer.classList.toggle('open', open);
    mask.classList.toggle('open', open);
  }

  function enhanceCollabPage() {
    const leftCol = document.querySelector('.collab-left');
    if (!leftCol || document.getElementById('aps-order-sync-card')) return;

    const upgradeHtml = `
      <article class="aps-upgrade-card" id="aps-order-sync-card">
        <h4>
          <span>待排订单目录与预排向导</span>
          <div class="row">
            <button class="btn sm" id="aps-order-sync-btn">订单同步更新</button>
            <button class="btn sm primary" id="aps-preplan-start-btn">启动预排</button>
          </div>
        </h4>
        <table class="aps-order-table">
          <thead>
            <tr><th>订单号</th><th>来源</th><th>交期</th><th>数量</th><th>状态</th></tr>
          </thead>
          <tbody id="aps-order-tbody"></tbody>
        </table>
        <div class="muted aps-order-summary" id="aps-order-summary"></div>
        <div class="aps-preplan-result" id="aps-preplan-result"></div>
      </article>

      <article class="aps-upgrade-card" id="aps-resource-check-card">
        <h4>
          <span>全要素资源匹配预检</span>
          <button class="btn sm warn" id="aps-resource-match-btn">执行资源匹配</button>
        </h4>
        <div class="aps-resource-list" id="aps-resource-list">
          <div class="muted">等待执行资源匹配预检...</div>
        </div>
      </article>

      <article class="aps-upgrade-card" id="aps-smart-schedule-card">
        <h4>
          <span>一键智能排产与多方案决策</span>
          <button class="btn sm ok txt-white" id="aps-smart-schedule-btn">一键排产</button>
        </h4>
        <div class="aps-schedule-options" id="aps-schedule-options">
          <div class="muted">方案加载中...</div>
        </div>
      </article>

    `;
    leftCol.insertAdjacentHTML('afterbegin', upgradeHtml);

    const orders = [
      { no: 'SO-20260309-018', source: 'ERP', delivery: '2026-03-10', qty: 560, status: 'ready' },
      { no: 'SO-20260309-019', source: 'EDI', delivery: '2026-03-11', qty: 420, status: 'ready' },
      { no: 'SO-20260309-020', source: 'ERP', delivery: '2026-03-12', qty: 300, status: 'ready' },
      { no: 'SO-20260309-021', source: 'CRM', delivery: '2026-03-12', qty: 260, status: 'ready' }
    ];

    const sharedState = getSharedState();
    const schedulePlans = [
      {
        mode: 'delivery',
        tabLabel: '交期优先',
        tabMeta: '推荐',
        title: '交期优先方案（推荐）',
        onTime: '96.2%',
        utilization: '88.4%',
        cost: '1.06',
        description: '优先保障高优订单交付时点，适合交期风险偏高场景。'
      },
      {
        mode: 'cost',
        tabLabel: '成本最优',
        tabMeta: '低换线成本',
        title: '成本最优方案',
        onTime: '92.8%',
        utilization: '86.9%',
        cost: '0.87',
        description: '优先减少换线频次与跨厂调拨，适合成本控制阶段。'
      },
      {
        mode: 'balanced',
        tabLabel: '均衡稳定',
        tabMeta: '稳态产能',
        title: '均衡稳定方案',
        onTime: '94.6%',
        utilization: '89.3%',
        cost: '0.95',
        description: '交付、利用率与成本折中，适合常态化稳态排产。'
      }
    ];
    let selectedScheduleMode = schedulePlans[0].mode;

    function ensureTaskTags() {
      if (!Array.isArray(sharedState?.ganttTasks)) return;
      sharedState.ganttTasks.forEach((task, idx) => {
        if (!task.chainId) task.chainId = `CHAIN-${idx % 8}`;
        if (!task.batchCode) task.batchCode = `B${(idx % 5) + 1}`;
      });
    }

    function renderOrderTable() {
      const tbody = document.getElementById('aps-order-tbody');
      const summary = document.getElementById('aps-order-summary');
      if (!tbody) return;
      const sortWeight = { rush: 0, ready: 1, cancelled: 2 };
      orders.sort((a, b) => sortWeight[a.status] - sortWeight[b.status]);
      const visibleOrders = orders.filter((order) => order.status !== 'cancelled');
      const cancelledCount = orders.length - visibleOrders.length;
      tbody.innerHTML = visibleOrders
        .map((order) => {
          const labels = {
            ready: '可排',
            rush: '加急插单',
            cancelled: '已撤销'
          };
          return `
            <tr>
              <td>${order.status === 'cancelled' ? `<s>${order.no}</s>` : order.no}</td>
              <td>${order.source}</td>
              <td>${order.delivery}</td>
              <td>${order.qty}</td>
              <td><span class="aps-order-status ${order.status}">${labels[order.status]}</span></td>
            </tr>
          `;
        })
        .join('');
      if (summary) {
        summary.textContent = `当前可排订单 ${visibleOrders.length} 条，已自动隐藏撤销订单 ${cancelledCount} 条。`;
      }
    }

    function syncOrders() {
      const today = new Date().toISOString().slice(0, 10);
      const rushOrder = {
        no: `SO-${today.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        source: 'CRM',
        delivery: today,
        qty: 180 + Math.floor(Math.random() * 220),
        status: 'rush'
      };
      orders.unshift(rushOrder);
      const cancellable = orders.find((item) => item.status === 'ready');
      if (cancellable) cancellable.status = 'cancelled';
      if (orders.length > 7) orders.pop();
      renderOrderTable();
      toast('订单同步完成：已置顶加急插单，并隐藏撤销订单。');
    }

    async function runPreplanWizard() {
      const preplanResult = document.getElementById('aps-preplan-result');
      const shouldModify = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog({
            title: '预排规则确认',
            message: '是否修改订单清洗与拆解规则？\n点击“确定”进入规则调整；点击“取消”沿用预设规则。',
            confirmText: '进入调整',
            cancelText: '沿用预设'
          })
        : false;
      if (shouldModify) {
        if (preplanResult) {
          preplanResult.innerHTML = '<div class="aps-resource-item">已进入规则调整：可修改订单清洗与拆解参数（演示版）。</div>';
        }
        toast('已打开订单清洗与拆解规则面板。');
        return;
      }
      if (preplanResult) {
        preplanResult.innerHTML = '<div class="aps-resource-item">预排处理中：剔除无效数据并拆解跨厂子任务...</div>';
      }
      setTimeout(() => {
        if (preplanResult) {
          preplanResult.innerHTML = `
            <div class="aps-resource-item">拆解完成：整机需求已拆分为 <b>注塑</b>、<b>钣金</b>、<b>两器焊接</b> 子任务，并生成能效批次码。</div>
            <div class="aps-resource-item">本次预排覆盖 <b>${orders.filter((o) => o.status !== 'cancelled').length}</b> 个有效订单。</div>
          `;
        }
        toast('启动预排完成：已应用预设清洗拆解规则。');
      }, 1200);
    }

    async function runResourceMatch() {
      const list = document.getElementById('aps-resource-list');
      if (!list) return;
      const inventory = Array.isArray(sharedState?.inventory) ? sharedState.inventory : [];
      const mapped = inventory.length
        ? inventory.map((item) => ({
            name: item.name,
            shortage: Math.max(item.required - item.stock, 0),
            warn: item.required > item.stock,
            replacement: item.required > item.stock ? `${item.name} 替代料方案` : '无需替代'
          }))
        : [
            { name: '压缩机', shortage: 120, warn: true, replacement: '启用战略安全库存批次 S-03' },
            { name: '电路板', shortage: 80, warn: true, replacement: '切换备用供应商（洛阳）' },
            { name: '冷凝器', shortage: 0, warn: false, replacement: '无需替代' }
          ];
      const warnCount = mapped.filter((item) => item.warn).length;

      list.innerHTML = mapped
        .map((item) => `
          <div class="aps-resource-item ${item.warn ? 'warn' : ''}">
            <div><b>${item.warn ? '🟡' : '🟢'} ${item.name}</b> ${item.warn ? '缺料/故障预警' : '状态正常'}</div>
            <div class="muted">缺口: ${item.shortage} · 推荐: ${item.replacement}</div>
          </div>
        `)
        .join('');
      toast('资源匹配完成：已完成设备状态与物料水位碰撞测算。');

      const shouldAdopt = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog({
            title: '资源匹配建议确认',
            message: warnCount
              ? `本次资源匹配识别出 ${warnCount} 项预警，是否采纳系统推荐的替代料与调拨方案？`
              : '本次资源匹配未发现异常，是否采纳系统建议并锁定当前资源配置？',
            confirmText: '采纳建议',
            cancelText: '暂不采纳'
          })
        : false;

      if (shouldAdopt) {
        list.insertAdjacentHTML(
          'afterbegin',
          `<div class="aps-resource-item">
            <div><b>已采纳系统建议</b></div>
            <div class="muted">${warnCount ? '替代料与跨基地调拨方案已加入执行队列。' : '当前资源配置已锁定为推荐基线。'}</div>
          </div>`
        );
        toast('已采纳资源匹配建议。');
        return;
      }

      list.insertAdjacentHTML(
        'afterbegin',
        `<div class="aps-resource-item">
          <div><b>待人工确认</b></div>
          <div class="muted">系统已保留本次资源匹配结果，暂未采纳推荐方案。</div>
        </div>`
      );
      toast('已保留资源匹配结果，等待人工决策。');
    }

    function applyScheduleMode(mode) {
      if (!Array.isArray(sharedState?.ganttTasks)) return;
      ensureTaskTags();
      sharedState.ganttTasks.forEach((task, idx) => {
        if (mode === 'delivery') {
          task.start = Math.max(0, task.start - (idx % 2));
        } else if (mode === 'cost') {
          task.start = Math.min(22, Math.floor(task.start / 2) * 2);
        } else {
          task.start = Math.min(22, Math.max(0, task.start + ((idx % 3) - 1)));
        }
      });
      if (typeof renderGanttWorkbench === 'function') renderGanttWorkbench();
    }

    function getSchedulePlan(mode) {
      return schedulePlans.find((plan) => plan.mode === mode) || schedulePlans[0];
    }

    function updateScheduleSelectionHint(customHint) {
      const target = document.getElementById('aps-schedule-options');
      if (!target) return;
      const plan = getSchedulePlan(selectedScheduleMode);

      target.querySelectorAll('.aps-schedule-tab').forEach((tab) => {
        const active = tab.dataset.mode === selectedScheduleMode;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      const detail = target.querySelector('#aps-schedule-detail');
      if (detail) {
        detail.classList.toggle('best', plan.mode === 'delivery');
        detail.innerHTML = `
          <div class="aps-schedule-option-title">${plan.title}</div>
          <div class="aps-schedule-metrics">
            <div class="aps-schedule-metric"><span class="muted">准时交付率</span><b>${plan.onTime}</b></div>
            <div class="aps-schedule-metric"><span class="muted">产能利用率</span><b>${plan.utilization}</b></div>
            <div class="aps-schedule-metric"><span class="muted">成本指数</span><b>${plan.cost}</b></div>
          </div>
          <div class="muted">${plan.description}</div>
        `;
      }

      const hint = target.querySelector('#aps-schedule-hint');
      if (hint) {
        hint.textContent = customHint || '已选择方案，点击“一键排产”后可视化交互工作台将跟随执行。';
      }
    }

    function renderSmartScheduleOptions() {
      const target = document.getElementById('aps-schedule-options');
      if (!target) return;

      target.innerHTML = `
        <div class="aps-schedule-tablist" role="tablist" aria-label="智能排产方案选项卡">
          ${schedulePlans
            .map(
              (plan) => `
                <button type="button" class="aps-schedule-tab" data-mode="${plan.mode}" role="tab" aria-selected="false">
                  <span class="aps-schedule-tab-name">${plan.tabLabel}</span>
                  <span class="aps-schedule-tab-meta">${plan.tabMeta}</span>
                </button>
              `
            )
            .join('')}
        </div>
        <div class="aps-schedule-option" id="aps-schedule-detail"></div>
        <div class="muted aps-schedule-hint" id="aps-schedule-hint"></div>
      `;

      target.querySelectorAll('.aps-schedule-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          selectedScheduleMode = tab.dataset.mode || schedulePlans[0].mode;
          updateScheduleSelectionHint();
        });
      });

      updateScheduleSelectionHint();
    }

    function runSmartSchedule() {
      const plan = getSchedulePlan(selectedScheduleMode);
      applyScheduleMode(plan.mode);
      const nowText = typeof formatClockTime === 'function'
        ? formatClockTime()
        : new Date().toLocaleTimeString('zh-CN', { hour12: false });
      updateScheduleSelectionHint(`${nowText} 已执行${plan.title}，可视化交互工作台已跟随更新。`);
      toast(`一键排产完成：${plan.title}已同步到可视化交互工作台。`);
    }

    const orderSyncBtn = document.getElementById('aps-order-sync-btn');
    const preplanBtn = document.getElementById('aps-preplan-start-btn');
    const resourceBtn = document.getElementById('aps-resource-match-btn');
    const smartBtn = document.getElementById('aps-smart-schedule-btn');

    orderSyncBtn?.addEventListener('click', syncOrders);
    preplanBtn?.addEventListener('click', runPreplanWizard);
    resourceBtn?.addEventListener('click', runResourceMatch);
    smartBtn?.addEventListener('click', runSmartSchedule);

    const originalRunSelfHealing = window.runSelfHealing;
    window.runSelfHealing = function () {
      const isMajor = Math.random() > 0.45;
      if (!isMajor) {
        const healResult = document.getElementById('heal-result');
        if (healResult) {
          healResult.textContent = '轻微物料延迟已自动微调，无需人工干预。';
        }
        toast('系统已完成后台无声微调。');
        return;
      }
      if (typeof originalRunSelfHealing === 'function') {
        originalRunSelfHealing();
      }
      setTimeout(() => {
        const healResult = document.getElementById('heal-result');
        if (healResult) {
          healResult.textContent = '重大异常：已生成红色重排建议单，执行后时间轴已重组。';
        }
      }, 1200);
    };

    const healTitle = Array.from(document.querySelectorAll('.collab-left .card-hd span')).find((el) => el.textContent.includes('自主自愈重排'));
    if (healTitle) {
      healTitle.textContent = '执行重排与自主自愈机制';
    }
    const healBtn = Array.from(document.querySelectorAll('.collab-left .card-hd button')).find((el) => el.textContent.includes('触发自愈'));
    if (healBtn) {
      healBtn.textContent = '执行重排';
    }

    ensureTaskTags();
    renderOrderTable();
    renderSmartScheduleOptions();
  }

  function enhanceDecisionPage() {
    const view = document.getElementById('view-decision');
    if (!view || document.getElementById('aps-decision-upgrade')) return;

    const kpiDashboard = view.querySelector('.kpi-dashboard');
    if (kpiDashboard && !document.getElementById('aps-kpi-band')) {
      const kpiBand = document.createElement('article');
      kpiBand.className = 'card aps-kpi-band';
      kpiBand.id = 'aps-kpi-band';
      kpiBand.innerHTML = `
        <div class="card-hd">
          <span>全局关键绩效指标仪表带</span>
          <div class="row">
            <button class="btn sm" id="aps-kpi-trend-btn">查看走势明细</button>
            <button class="btn sm primary" id="aps-kpi-feedback-btn">生成反哺建议</button>
          </div>
        </div>
        <div class="card-bd">
          <div class="aps-kpi-mini-grid">
            <div class="aps-kpi-mini"><div class="label">准时交付率</div><div class="value">94.2%</div></div>
            <div class="aps-kpi-mini"><div class="label">平均换产时长</div><div class="value">36min</div></div>
            <div class="aps-kpi-mini"><div class="label">库存风险点</div><div class="value">3</div></div>
            <div class="aps-kpi-mini"><div class="label">综合健康评分</div><div class="value">89</div></div>
          </div>
          <div class="muted" id="aps-kpi-band-status" style="margin-top:8px;">点击“生成反哺建议”可将参数建议回写到系统设置。</div>
        </div>
      `;
      kpiDashboard.insertAdjacentElement('afterend', kpiBand);
    }

    const module = document.createElement('section');
    module.id = 'aps-decision-upgrade';
    module.className = 'aps-decision-grid';
    module.innerHTML = `
      <article class="card">
        <div class="card-hd">
          <span>全链路进度与预警大屏</span>
          <button class="btn sm" id="aps-feedback-btn">生成反哺建议</button>
        </div>
        <div class="card-bd">
          <div class="aps-stage-flow" id="aps-stage-flow"></div>
          <div class="aps-diagnosis-card" id="aps-stage-diagnosis">点击延误节点查看归因诊断卡片。</div>
        </div>
      </article>

      <article class="card">
        <div class="card-hd">
          <span>滑动推演工作台</span>
          <button class="btn sm" id="aps-sim-apply-btn">刷新对比图</button>
        </div>
        <div class="card-bd aps-slider-panel">
          <div class="aps-slider-row">
            <span>缺料冲击</span>
            <input type="range" min="0" max="100" value="35" id="aps-sim-shortage" />
            <span id="aps-sim-shortage-v">35%</span>
          </div>
          <div class="aps-slider-row">
            <span>设备故障</span>
            <input type="range" min="0" max="100" value="22" id="aps-sim-breakdown" />
            <span id="aps-sim-breakdown-v">22%</span>
          </div>
          <div class="aps-slider-row">
            <span>插单压力</span>
            <input type="range" min="0" max="100" value="48" id="aps-sim-rush" />
            <span id="aps-sim-rush-v">48%</span>
          </div>
          <div class="aps-sim-bars" id="aps-sim-bars"></div>
        </div>
      </article>
    `;

    const aiWorkbench = view.querySelector('.ai-workbench');
    if (aiWorkbench) {
      aiWorkbench.insertAdjacentElement('beforebegin', module);
    } else {
      view.insertAdjacentElement('afterbegin', module);
    }

    const stages = [
      {
        name: '配套件开工',
        progress: 96,
        status: '正常',
        rootCause: '库存齐套，开工条件满足。',
        impact: '当前节拍平稳，对总装交付无负面影响。',
        suggestion: '保持当前排产节奏，继续监控两小时内库存波动。'
      },
      {
        name: '注塑分厂',
        progress: 82,
        status: '延误',
        delay: true,
        rootCause: '模具换型延迟 18 分钟。',
        impact: '预计影响下游两器焊接窗口 12 分钟。',
        suggestion: '切换备用模具并优先保障批次 B1 连续生产。'
      },
      {
        name: '钣金加工',
        progress: 88,
        status: '正常',
        rootCause: '产线负载均衡，设备稼动率稳定。',
        impact: '预计可提前 6 分钟交付到总装缓冲区。',
        suggestion: '维持当前班次配置，无需额外干预。'
      },
      {
        name: '两器焊接',
        progress: 79,
        status: '延误',
        delay: true,
        rootCause: '铜管来料偏晚，造成焊接工位等待。',
        impact: '总装下线窗口压缩约 14 分钟。',
        suggestion: '调高该链路优先级，并提前触发跨厂备料。'
      },
      {
        name: '总装下线',
        progress: 73,
        status: '风险',
        rootCause: '上游工序波动叠加，缓冲区库存下降。',
        impact: '晚班交付存在 24 分钟超时风险。',
        suggestion: '执行局部重排，将高优订单切换至西区总装。'
      }
    ];
    let simChart = null;
    let simResizeBound = false;

    function renderStageDiagnosis(stage) {
      const statusClass = stage.status === '正常' ? 'normal' : stage.status === '延误' ? 'delay' : 'risk';
      return `
        <div class="aps-diagnosis-head">
          <div class="aps-diagnosis-title">${stage.name} 诊断卡片</div>
          <span class="aps-stage-status ${statusClass}">${stage.status}</span>
        </div>
        <div class="aps-diagnosis-updated">更新时间：${new Date().toLocaleTimeString('zh-CN', { hour12: false })}</div>
        <div class="aps-diagnosis-grid">
          <div class="aps-diagnosis-item">
            <div class="aps-diagnosis-item-label">根因定位</div>
            <div class="aps-diagnosis-item-value">${stage.rootCause}</div>
          </div>
          <div class="aps-diagnosis-item">
            <div class="aps-diagnosis-item-label">影响评估</div>
            <div class="aps-diagnosis-item-value">${stage.impact}</div>
          </div>
          <div class="aps-diagnosis-item">
            <div class="aps-diagnosis-item-label">建议动作</div>
            <div class="aps-diagnosis-item-value">${stage.suggestion}</div>
          </div>
        </div>
      `;
    }

    function renderStages(activeIndex) {
      const flow = document.getElementById('aps-stage-flow');
      if (!flow) return;
      flow.innerHTML = stages
        .map((stage, idx) => {
          const statusClass = stage.status === '正常' ? 'normal' : stage.status === '延误' ? 'delay' : 'risk';
          const progressClass = stage.progress >= 85 ? '' : stage.progress >= 75 ? 'warn' : 'risk';
          return `
            <button type="button" class="aps-stage-node ${stage.delay ? 'delay' : ''} ${idx === activeIndex ? 'active' : ''}" data-stage-idx="${idx}">
              <div class="aps-stage-node-title">${stage.name}</div>
              <div class="aps-stage-meta">
                <span>进度监测</span>
                <span class="aps-stage-status ${statusClass}">${stage.status}</span>
              </div>
              <div class="aps-stage-progress">
                <div class="aps-stage-progress-track">
                  <div class="aps-stage-progress-fill ${progressClass}" style="width:${Math.max(6, Math.min(100, stage.progress))}%"></div>
                </div>
                <div class="aps-stage-progress-value">${stage.progress}%</div>
              </div>
            </button>
          `;
        })
        .join('');

      flow.querySelectorAll('[data-stage-idx]').forEach((button) => {
        button.addEventListener('click', () => {
          const idx = Number(button.dataset.stageIdx);
          renderStages(idx);
          const diag = document.getElementById('aps-stage-diagnosis');
          if (diag) {
            const stage = stages[idx];
            diag.innerHTML = renderStageDiagnosis(stage);
          }
        });
      });
    }

    function simulateBars() {
      const shortage = Number(document.getElementById('aps-sim-shortage')?.value || 0);
      const breakdown = Number(document.getElementById('aps-sim-breakdown')?.value || 0);
      const rush = Number(document.getElementById('aps-sim-rush')?.value || 0);
      const container = document.getElementById('aps-sim-bars');
      if (!container) return;

      const onTime = Math.max(70, 98 - shortage * 0.12 - breakdown * 0.15 - rush * 0.08);
      const oee = Math.max(65, 93 - shortage * 0.08 - breakdown * 0.2 - rush * 0.07);
      const cost = Math.min(138, 88 + shortage * 0.16 + breakdown * 0.1 + rush * 0.14);

      const metrics = [
        { label: '准时交付率', value: onTime, suffix: '%' },
        { label: '产能利用率', value: oee, suffix: '%' },
        { label: '成本指数', value: cost, suffix: '' }
      ];

      const renderFallback = (note = '') => {
        container.innerHTML = `
          <div class="aps-sim-fallback">
            ${note ? `<div class="muted" style="font-size:11px;">${note}</div>` : ''}
            ${metrics
              .map(
                (item) => `
                  <div class="aps-sim-bar">
                    <span>${item.label}</span>
                    <span class="aps-sim-track"><span class="aps-sim-fill" style="width:${Math.min(100, item.value)}%"></span></span>
                    <span>${item.value.toFixed(1)}${item.suffix}</span>
                  </div>
                `
              )
              .join('')}
          </div>
        `;
      };

      loadEChartsLibrary()
        .then((echarts) => {
          if (!simChart) {
            simChart = echarts.init(container);
          }
          const values = metrics.map((item) => Number(item.value.toFixed(1)));
          const maxValue = Math.max(100, ...values);
          const axisMax = Math.ceil((maxValue + 5) / 10) * 10;
          simChart.setOption(
            {
              animationDuration: 420,
              backgroundColor: 'transparent',
              grid: { left: 90, right: 24, top: 28, bottom: 30 },
              tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: '#0b1220',
                borderColor: '#334155',
                textStyle: { color: '#e2e8f0' },
                formatter: (params) => {
                  const row = params?.[0];
                  if (!row) return '';
                  const suffix = metrics[row.dataIndex]?.suffix || '';
                  return `${row.name}<br/><b>${row.value}${suffix}</b>`;
                }
              },
              xAxis: {
                type: 'value',
                min: 0,
                max: axisMax,
                axisLabel: { color: '#94a3b8', fontSize: 11 },
                splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.18)' } },
                axisLine: { lineStyle: { color: '#334155' } }
              },
              yAxis: {
                type: 'category',
                data: metrics.map((item) => item.label),
                axisTick: { show: false },
                axisLabel: { color: '#f1f5f9', fontSize: 12, fontWeight: 600 },
                axisLine: { lineStyle: { color: '#334155' } }
              },
              series: [
                {
                  type: 'bar',
                  data: values,
                  barWidth: 14,
                  label: {
                    show: true,
                    position: 'right',
                    color: '#e2e8f0',
                    fontSize: 12,
                    formatter: ({ value, dataIndex }) => `${value}${metrics[dataIndex]?.suffix || ''}`
                  },
                  itemStyle: {
                    borderRadius: [0, 8, 8, 0],
                    color: (params) => {
                      if (params.dataIndex === 0) return '#22c55e';
                      if (params.dataIndex === 1) return '#38bdf8';
                      return '#f59e0b';
                    }
                  }
                }
              ]
            },
            true
          );

          if (!simResizeBound) {
            window.addEventListener('resize', () => {
              if (simChart) simChart.resize();
            });
            simResizeBound = true;
          }
        })
        .catch(() => {
          renderFallback('ECharts 加载失败，已切换简化视图。');
        });
    }

    function bindSlider(inputId, valueId) {
      const input = document.getElementById(inputId);
      const value = document.getElementById(valueId);
      if (!input || !value) return;
      const onUpdate = () => {
        value.textContent = `${input.value}%`;
        simulateBars();
      };
      input.addEventListener('input', onUpdate);
      onUpdate();
    }

    function ensureKpiTrendModal() {
      if (document.getElementById('aps-kpi-trend-mask')) return;
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.id = 'aps-kpi-trend-mask';
      mask.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="aps-kpi-trend-title">
          <div class="modal-hd">
            <span id="aps-kpi-trend-title">KPI走势明细（最近4个时段）</span>
            <button type="button" class="btn sm" id="aps-kpi-trend-close">关闭</button>
          </div>
          <div class="modal-bd single-col">
            <div class="aps-kpi-trend-grid" id="aps-kpi-trend-content"></div>
          </div>
          <div class="modal-ft">
            <button type="button" class="btn" id="aps-kpi-trend-ok">知道了</button>
          </div>
        </div>
      `;
      document.body.appendChild(mask);

      document.getElementById('aps-kpi-trend-close')?.addEventListener('click', () => {
        mask.classList.remove('show');
      });
      document.getElementById('aps-kpi-trend-ok')?.addEventListener('click', () => {
        mask.classList.remove('show');
      });
      mask.addEventListener('click', (evt) => {
        if (evt.target === mask) mask.classList.remove('show');
      });
      document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && mask.classList.contains('show')) {
          mask.classList.remove('show');
        }
      });
    }

    function renderKpiTrendContent() {
      const container = document.getElementById('aps-kpi-trend-content');
      if (!container) return;
      const buckets = ['08:00', '10:00', '12:00', '14:00'];
      const series = [
        { label: '准时交付率', unit: '%', values: [92.1, 92.8, 93.5, 94.2] },
        { label: '平均换产时长', unit: 'min', values: [41, 39, 37, 36], inverse: true },
        { label: '库存风险点', unit: '', values: [5, 4, 4, 3], inverse: true },
        { label: '综合健康评分', unit: '', values: [84, 86, 87, 89] }
      ];

      container.innerHTML = series.map((item) => {
        const max = Math.max(...item.values);
        const min = Math.min(...item.values);
        const first = item.values[0];
        const last = item.values[item.values.length - 1];
        const delta = Number((last - first).toFixed(1));
        const trendUp = item.inverse ? delta <= 0 : delta >= 0;
        const deltaText = `${delta >= 0 ? '+' : ''}${delta}${item.unit}`;
        const deltaClass = trendUp ? 'up' : 'down';

        const bars = item.values.map((v, idx) => {
          const h = max === min ? 64 : Math.max(24, ((v - min) / (max - min)) * 64 + 24);
          return `
            <div class="aps-kpi-trend-col">
              <i style="height:${h}px;"></i>
              <span>${buckets[idx]}</span>
              <em>${v}${item.unit}</em>
            </div>
          `;
        }).join('');

        return `
          <div class="aps-kpi-trend-card">
            <div class="aps-kpi-trend-card-hd">
              <b>${item.label}</b>
              <span class="aps-kpi-trend-delta ${deltaClass}">${deltaText}</span>
            </div>
            <div class="aps-kpi-trend-spark">${bars}</div>
          </div>
        `;
      }).join('');
    }

    function openKpiTrendModal() {
      ensureKpiTrendModal();
      renderKpiTrendContent();
      document.getElementById('aps-kpi-trend-mask')?.classList.add('show');
    }

    async function generateFeedbackSuggestion() {
      const suggestion = {
        generatedAt: new Date().toLocaleString('zh-CN'),
        hardConstraintWeight: 72,
        softConstraintWeight: 28,
        recommendedScene: '旺季抢产',
        note: '建议上调交期优先权重，并同步降低换产惩罚系数，优先保障战略订单。',
        baselineWeights: { delivery: 72, cost: 18, stock: 10 },
        baselineAppliedAt: ''
      };
      const feedbackMessage = `建议基准权重：交期 ${suggestion.baselineWeights.delivery}% / 成本 ${suggestion.baselineWeights.cost}% / 库存 ${suggestion.baselineWeights.stock}%\n是否确认回写系统运行基准？`;
      const shouldApply = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog({
            title: '反哺建议确认',
            message: feedbackMessage,
            confirmText: '确认回写',
            cancelText: '稍后处理'
          })
        : false;
      if (shouldApply) {
        saveBaselineWeights(suggestion.baselineWeights);
        suggestion.baselineAppliedAt = new Date().toLocaleString('zh-CN');
        applyBaselineWeightsToInputs(suggestion.baselineWeights);
      }
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(suggestion));
      toast(shouldApply ? '反哺建议已确认并回写系统基准。' : '反哺建议已生成，等待确认回写。');
      const diag = document.getElementById('aps-stage-diagnosis');
      if (diag) {
        diag.innerHTML = `
          <div class="aps-diagnosis-head">
            <div class="aps-diagnosis-title">反哺建议已生成</div>
            <span class="aps-stage-status normal">已同步</span>
          </div>
          <div class="aps-diagnosis-updated">生成时间：${suggestion.generatedAt}</div>
          <div class="aps-diagnosis-grid">
            <div class="aps-diagnosis-item">
              <div class="aps-diagnosis-item-label">建议场景</div>
              <div class="aps-diagnosis-item-value">${suggestion.recommendedScene}</div>
            </div>
            <div class="aps-diagnosis-item">
              <div class="aps-diagnosis-item-label">建议说明</div>
              <div class="aps-diagnosis-item-value">${suggestion.note}</div>
            </div>
            <div class="aps-diagnosis-item">
              <div class="aps-diagnosis-item-label">回写状态</div>
              <div class="aps-diagnosis-item-value">${shouldApply ? `已确认回写（${suggestion.baselineAppliedAt}）` : '待确认回写'}</div>
            </div>
          </div>
        `;
      }
      const status = document.getElementById('aps-kpi-band-status');
      if (status) {
        status.textContent = shouldApply
          ? `已于 ${suggestion.baselineAppliedAt} 回写系统基准，推荐场景：${suggestion.recommendedScene}。`
          : `已于 ${suggestion.generatedAt} 生成参数建议，等待回写确认。`;
      }
    }

    document.getElementById('aps-feedback-btn')?.addEventListener('click', generateFeedbackSuggestion);
    document.getElementById('aps-kpi-feedback-btn')?.addEventListener('click', generateFeedbackSuggestion);
    document.getElementById('aps-kpi-trend-btn')?.addEventListener('click', openKpiTrendModal);
    document.getElementById('aps-sim-apply-btn')?.addEventListener('click', () => {
      simulateBars();
      toast('推演结果已刷新并覆写对比图。');
    });

    bindSlider('aps-sim-shortage', 'aps-sim-shortage-v');
    bindSlider('aps-sim-breakdown', 'aps-sim-breakdown-v');
    bindSlider('aps-sim-rush', 'aps-sim-rush-v');
    renderStages(1);
    const initialDiag = document.getElementById('aps-stage-diagnosis');
    if (initialDiag) {
      initialDiag.innerHTML = renderStageDiagnosis(stages[1]);
    }
    simulateBars();
  }

  function enhanceSettingsPage() {
    const baseCardBody = document.querySelector('#settings-sub-base .card-bd');
    if (!baseCardBody || document.getElementById('aps-settings-upgrade')) return;

    const block = document.createElement('div');
    block.id = 'aps-settings-upgrade';
    block.innerHTML = `
      <div class="aps-setting-block">
        <div class="aps-setting-title">约束规则与参数滑动配置</div>
        <div class="aps-switch-row">
          <div class="aps-toggle"><span>硬约束实时校验</span><input type="checkbox" id="aps-hard-check" checked /></div>
          <div class="aps-toggle"><span>软约束评分引擎</span><input type="checkbox" id="aps-soft-check" checked /></div>
          <div class="aps-toggle"><span>跨厂协同优先级加权</span><input type="checkbox" id="aps-cross-check" checked /></div>
        </div>
        <div class="aps-slider-config" style="margin-top:8px;">
          <div class="aps-slider-row"><span>交期权重</span><input type="range" min="0" max="100" value="68" id="aps-weight-delivery" /><span id="aps-weight-delivery-v">68%</span></div>
          <div class="aps-slider-row"><span>成本权重</span><input type="range" min="0" max="100" value="22" id="aps-weight-cost" /><span id="aps-weight-cost-v">22%</span></div>
          <div class="aps-slider-row"><span>库存权重</span><input type="range" min="0" max="100" value="10" id="aps-weight-stock" /><span id="aps-weight-stock-v">10%</span></div>
        </div>
      </div>

      <div class="aps-setting-block">
        <div class="aps-setting-title">一键场景换挡机制</div>
        <div class="aps-scene-options" id="aps-scene-options">
          <button type="button" class="aps-scene-btn active" data-scene="常规平稳">常规平稳</button>
          <button type="button" class="aps-scene-btn" data-scene="旺季抢产">旺季抢产</button>
          <button type="button" class="aps-scene-btn" data-scene="极端缺料">极端缺料</button>
        </div>
      </div>

      <div class="aps-setting-block">
        <div class="aps-setting-title">跨厂时间尺图形化对齐</div>
        <div class="aps-feedback-box">
          <button class="btn sm" id="aps-align-btn">以总装厂作息为准强制覆盖</button>
          <div class="aps-feedback-content" id="aps-align-result">等待执行时间尺对齐...</div>
        </div>
      </div>

    `;

    baseCardBody.appendChild(block);

    function applyScene(sceneName) {
      const buttons = Array.from(document.querySelectorAll('#aps-scene-options .aps-scene-btn'));
      if (!buttons.length) return;
      let target = buttons.find((btn) => btn.dataset.scene === sceneName);
      if (!target) target = buttons[0];
      buttons.forEach((btn) => btn.classList.toggle('active', btn === target));
    }

    function bindWeight(inputId, valueId) {
      const input = document.getElementById(inputId);
      const value = document.getElementById(valueId);
      if (!input || !value) return;
      const update = () => {
        value.textContent = `${input.value}%`;
        saveBaselineWeights({
          delivery: document.getElementById('aps-weight-delivery')?.value,
          cost: document.getElementById('aps-weight-cost')?.value,
          stock: document.getElementById('aps-weight-stock')?.value
        });
      };
      input.addEventListener('input', update);
      update();
    }

    document.querySelectorAll('#aps-scene-options .aps-scene-btn').forEach((button) => {
      button.addEventListener('click', () => {
        applyScene(button.dataset.scene);
        toast(`场景参数包已切换：${button.dataset.scene}`);
      });
    });

    document.getElementById('aps-align-btn')?.addEventListener('click', () => {
      const result = document.getElementById('aps-align-result');
      if (result) {
        result.textContent = '对齐完成：已按总装厂作息覆盖各分厂班次盲区，检测到 3 处偏差并已修正。';
      }
      toast('跨厂时间尺对齐请求已执行。');
    });

    const baseline = loadBaselineWeights();
    if (baseline) {
      applyBaselineWeightsToInputs(baseline);
    }
    bindWeight('aps-weight-delivery', 'aps-weight-delivery-v');
    bindWeight('aps-weight-cost', 'aps-weight-cost-v');
    bindWeight('aps-weight-stock', 'aps-weight-stock-v');
    applyScene('常规平稳');
  }

  function runPageEnhancement() {
    injectOptimizationStyles();
    setupOptimizedHeader();

    const pageName = location.pathname.split('/').pop() || '';
    if (pageName === 'collab.html') {
      enhanceCollabPage();
    } else if (pageName === 'decision.html') {
      enhanceDecisionPage();
    } else if (pageName === 'settings.html') {
      enhanceSettingsPage();
    }
  }

  let hasEnhanced = false;
  const canEnhanceNow = () => !!document.getElementById('nav') && !!document.querySelector('header');
  const runOnce = () => {
    if (hasEnhanced || !canEnhanceNow()) return;
    hasEnhanced = true;
    runPageEnhancement();
  };

  // Script is loaded at the end of body on target pages, run immediately to avoid header reflow flicker.
  runOnce();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runOnce, { once: true });
  }
})();
