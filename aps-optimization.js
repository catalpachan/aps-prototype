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

      .aps-header-layout {
        display: grid;
        grid-template-columns: minmax(280px, 1fr) auto minmax(280px, 1fr);
        align-items: center;
        gap: 16px;
      }

      .aps-header-layout .brand-block {
        min-width: 0;
        justify-self: start;
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
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .aps-console-title-main::after {
        content: "v3.6";
        display: inline-flex;
        align-items: center;
        height: 20px;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.18);
        border: 1px solid rgba(96, 165, 250, 0.4);
        color: #93c5fd;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.2px;
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

      .aps-header-layout .aps-main-nav {
        grid-column: 2;
        flex: 0 1 auto;
        justify-self: center;
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

      .aps-header-layout .aps-header-meta {
        grid-column: 3;
        justify-self: end;
      }

      .aps-header-meta .aps-site-switch {
        margin-left: 0;
        margin-right: 4px;
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
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .aps-upgrade-card h4 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--txt);
        line-height: 1.3;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .aps-order-table-wrap {
        max-height: 520px;
        overflow: auto;
        border: 1px solid #263346;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.44);
      }

      .aps-order-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        min-width: 100%;
      }

      .aps-order-table th,
      .aps-order-table td {
        border-bottom: 1px solid #263346;
        padding: 6px;
        text-align: left;
      }

      .aps-order-table th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #172033;
      }

      .aps-order-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .aps-order-pager {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        margin-left: auto;
      }

      .aps-order-page-btn {
        min-width: 66px;
        border: 1px solid #334155;
        border-radius: 6px;
        background: #1e293b;
        color: #cbd5e1;
        font-size: 11px;
        padding: 5px 10px;
        cursor: pointer;
        transition: all var(--dur-fast);
      }

      .aps-order-page-btn:hover:not(:disabled) {
        border-color: #2563eb;
        background: #2563eb;
        color: #fff;
      }

      .aps-order-page-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .aps-order-page-info {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 700;
        min-width: 52px;
        text-align: center;
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

      .aps-sync-flow-card {
        width: min(560px, calc(100vw - 32px));
        border-radius: 18px;
        overflow: hidden;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.94));
        border: 1px solid rgba(59, 130, 246, 0.22);
        box-shadow: 0 28px 80px rgba(2, 6, 23, 0.5);
      }

      .aps-sync-flow-top {
        padding: 18px 20px 14px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.75);
        background:
          radial-gradient(circle at top right, rgba(56, 189, 248, 0.2), transparent 42%),
          linear-gradient(135deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.96));
      }

      .aps-sync-flow-top h3 {
        margin: 0;
        font-size: 18px;
        color: #e2e8f0;
        letter-spacing: 0.2px;
      }

      .aps-sync-flow-top p {
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 1.6;
        color: #94a3b8;
      }

      .aps-sync-flow-progress {
        margin-top: 14px;
        height: 8px;
        border-radius: 999px;
        background: rgba(30, 41, 59, 0.95);
        overflow: hidden;
      }

      .aps-sync-flow-progress > span {
        display: block;
        height: 100%;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2563eb, #38bdf8, #7dd3fc);
        transition: width 320ms ease;
      }

      .aps-sync-flow-list {
        padding: 16px 20px 4px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .aps-sync-flow-step {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(51, 65, 85, 0.82);
        background: rgba(15, 23, 42, 0.88);
        transition: transform 220ms ease, border-color 220ms ease, background 220ms ease, box-shadow 220ms ease;
      }

      .aps-sync-flow-step.waiting .aps-sync-flow-index {
        color: #64748b;
        border-color: rgba(71, 85, 105, 0.8);
      }

      .aps-sync-flow-step.active {
        border-color: rgba(56, 189, 248, 0.5);
        background: linear-gradient(135deg, rgba(8, 47, 73, 0.8), rgba(15, 23, 42, 0.94));
        box-shadow: 0 12px 28px rgba(8, 47, 73, 0.18);
        transform: translateY(-1px);
      }

      .aps-sync-flow-step.done {
        border-color: rgba(34, 197, 94, 0.35);
        background: linear-gradient(135deg, rgba(5, 46, 22, 0.68), rgba(15, 23, 42, 0.94));
      }

      .aps-sync-flow-index {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        border: 1px solid rgba(125, 211, 252, 0.35);
        color: #7dd3fc;
        font-size: 12px;
        font-weight: 700;
      }

      .aps-sync-flow-step.done .aps-sync-flow-index {
        color: #bbf7d0;
        border-color: rgba(34, 197, 94, 0.35);
      }

      .aps-sync-flow-name {
        font-size: 14px;
        font-weight: 700;
        color: #e2e8f0;
      }

      .aps-sync-flow-meta {
        margin-top: 4px;
        font-size: 11px;
        color: #94a3b8;
      }

      .aps-sync-flow-status {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(71, 85, 105, 0.85);
        color: #94a3b8;
        background: rgba(15, 23, 42, 0.92);
      }

      .aps-sync-flow-step.active .aps-sync-flow-status {
        color: #e0f2fe;
        border-color: rgba(56, 189, 248, 0.4);
        background: rgba(8, 47, 73, 0.7);
      }

      .aps-sync-flow-step.done .aps-sync-flow-status {
        color: #bbf7d0;
        border-color: rgba(34, 197, 94, 0.35);
        background: rgba(5, 46, 22, 0.7);
      }

      .aps-sync-flow-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 14px 20px 18px;
      }

      .aps-sync-flow-note {
        font-size: 12px;
        line-height: 1.6;
        color: #94a3b8;
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
        grid-template-columns: repeat(2, minmax(0, 1fr));
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

      .aps-sim-card .card-bd {
        display: grid;
        gap: 16px;
      }

      .aps-sim-title-stack {
        display: grid;
        gap: 4px;
      }

      .aps-sim-subtitle {
        color: #64748b;
        font-size: 12px;
        line-height: 1.4;
      }

      .aps-sim-card .aps-slider-panel {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .aps-sim-card .aps-slider-row {
        display: grid;
        gap: 14px;
        min-width: 0;
        padding: 16px;
        border: 1px solid rgba(51, 65, 85, 0.96);
        border-radius: 16px;
        background:
          radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 42%),
          linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(13, 20, 36, 0.96) 100%);
        box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.08);
      }

      .aps-sim-row-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .aps-sim-row-title {
        color: #e2e8f0;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.3;
        letter-spacing: 0.02em;
      }

      .aps-sim-row-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid rgba(71, 85, 105, 0.9);
        background: rgba(15, 23, 42, 0.84);
        color: #94a3b8;
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .aps-sim-row-badge.is-active {
        border-color: rgba(96, 165, 250, 0.55);
        background: rgba(30, 64, 175, 0.24);
        color: #dbeafe;
      }

      .aps-sim-multi {
        position: relative;
      }

      .aps-sim-select-shell {
        position: relative;
      }

      .aps-sim-selectbox {
        min-height: 44px;
        padding: 7px 12px;
        border: 1px solid rgba(51, 65, 85, 0.92);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.74);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        cursor: pointer;
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      }

      .aps-sim-select-shell.is-open .aps-sim-selectbox {
        border-color: rgba(96, 165, 250, 0.62);
        box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.16);
        background: rgba(15, 23, 42, 0.92);
      }

      .aps-sim-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-width: 0;
        flex: 1;
      }

      .aps-sim-placeholder {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        color: #64748b;
        font-size: 12px;
      }

      .aps-sim-chip {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        max-width: 100%;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(30, 41, 59, 0.92);
        color: #dbeafe;
        font-size: 12px;
        line-height: 1.2;
      }

      .aps-sim-chip.is-muted {
        color: #94a3b8;
        background: rgba(30, 41, 59, 0.7);
      }

      .aps-sim-select-caret {
        color: #94a3b8;
        font-size: 11px;
        flex-shrink: 0;
        padding: 7px 8px;
        border-radius: 999px;
        background: rgba(30, 41, 59, 0.82);
        line-height: 1;
      }

      .aps-sim-note {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.55;
        min-height: 34px;
      }

      .aps-sim-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 12;
        display: none;
        gap: 6px;
        padding: 8px;
        border: 1px solid rgba(51, 65, 85, 0.92);
        border-radius: 14px;
        background: rgba(9, 15, 28, 0.98);
        box-shadow: 0 18px 32px rgba(2, 6, 23, 0.48);
        max-height: 228px;
        overflow: auto;
      }

      .aps-sim-select-shell.is-open .aps-sim-menu {
        display: grid;
      }

      .aps-sim-option {
        width: 100%;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid transparent;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.78);
        color: #e2e8f0;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
      }

      .aps-sim-option:hover {
        border-color: rgba(59, 130, 246, 0.32);
        background: rgba(17, 24, 39, 0.96);
      }

      .aps-sim-option.is-selected {
        border-color: rgba(96, 165, 250, 0.55);
        background: linear-gradient(180deg, rgba(23, 37, 84, 0.86) 0%, rgba(30, 41, 59, 0.92) 100%);
      }

      .aps-sim-option-content {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .aps-sim-option-label {
        font-size: 12px;
        font-weight: 600;
        color: #f8fafc;
      }

      .aps-sim-option small {
        display: block;
        color: #94a3b8;
        font-size: 11px;
        line-height: 1.5;
      }

      .aps-sim-option-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-top: 2px;
        border-radius: 999px;
        border: 1px solid rgba(71, 85, 105, 0.96);
        color: transparent;
        flex-shrink: 0;
      }

      .aps-sim-option.is-selected .aps-sim-option-check {
        border-color: rgba(96, 165, 250, 0.62);
        background: rgba(37, 99, 235, 0.24);
        color: #dbeafe;
      }

      .aps-sim-bars {
        grid-column: 1 / -1;
        position: relative;
        display: grid;
        gap: 14px;
        padding: 16px;
        border: 1px solid rgba(51, 65, 85, 0.96);
        border-radius: 18px;
        background:
          radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 36%),
          linear-gradient(180deg, rgba(8, 15, 29, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
        box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.08);
      }

      .aps-sim-result-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.72);
      }

      .aps-sim-result-meta {
        display: grid;
        gap: 6px;
        min-width: 0;
      }

      .aps-sim-result-title {
        color: #f8fafc;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .aps-sim-result-note {
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.55;
      }

      .aps-sim-progress-shell {
        display: none;
        gap: 8px;
        align-content: start;
      }

      .aps-sim-progress-shell.is-visible {
        display: grid;
      }

      .aps-sim-progress-track {
        height: 10px;
        border-radius: 999px;
        background: #1e293b;
        overflow: hidden;
      }

      .aps-sim-progress-fill {
        height: 100%;
        width: 0;
        border-radius: 999px;
        background: linear-gradient(90deg, #38bdf8, #22c55e);
        transition: width 0.2s ease;
      }

      .aps-sim-progress-text {
        font-size: 12px;
        color: #cbd5e1;
      }

      .aps-sim-report {
        min-height: 190px;
        border: 1px dashed rgba(96, 165, 250, 0.35);
        border-radius: 14px;
        padding: 16px;
        background:
          linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(15, 23, 42, 0.74) 100%);
        color: #dbeafe;
        font-size: 12px;
        line-height: 1.7;
      }

      .aps-sim-report.empty {
        color: #64748b;
      }

      .aps-sim-report-title {
        font-size: 13px;
        font-weight: 700;
        color: #f8fafc;
        margin-bottom: 6px;
      }

      .aps-sim-report-meta {
        font-size: 11px;
        color: #94a3b8;
        margin-bottom: 8px;
      }

      .aps-sim-report p {
        margin: 0 0 8px;
      }

      .aps-sim-report p:last-child {
        margin-bottom: 0;
      }

      @media (max-width: 1280px) {
        .aps-sim-card .aps-slider-panel {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 980px) {
        .aps-sim-card .aps-slider-panel {
          grid-template-columns: 1fr;
        }

        .aps-sim-result-head {
          flex-direction: column;
          align-items: stretch;
        }
      }

      #aps-settings-upgrade {
        display: grid;
        gap: 14px;
      }

      .aps-setting-block {
        border: 1px solid #334155;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(15, 26, 45, 0.98), rgba(15, 23, 42, 0.9));
        padding: 14px;
        margin-top: 0;
        overflow: hidden;
      }

      .aps-setting-title {
        font-size: 14px;
        font-weight: 700;
        color: #dbeafe;
        margin-bottom: 6px;
      }

      .aps-setting-subtitle {
        font-size: 11px;
        line-height: 1.55;
        color: #94a3b8;
        margin-bottom: 12px;
      }

      .aps-switch-row,
      .aps-slider-config,
      .aps-scene-row,
      .aps-feedback-box {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .aps-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border: 1px solid #334155;
        border-radius: 10px;
        background: rgba(17, 27, 45, 0.9);
        padding: 10px 12px;
        font-size: 12px;
      }

      .aps-toggle span {
        color: #e2e8f0;
        font-weight: 600;
      }

      .aps-setting-block .aps-slider-row {
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr) 52px;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(51, 65, 85, 0.92);
        border-radius: 10px;
        background: rgba(17, 27, 45, 0.9);
        padding: 10px 12px;
        font-size: 12px;
      }

      .aps-setting-block .aps-slider-row span:first-child {
        color: #cbd5e1;
        font-weight: 600;
      }

      .aps-setting-block .aps-slider-row span:last-child {
        color: #7dd3fc;
        font-weight: 700;
        text-align: right;
      }

      .aps-setting-block .aps-slider-row input[type="range"] {
        width: 100%;
      }

      .aps-setting-chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .aps-setting-chip {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(51, 65, 85, 0.92);
        background: rgba(17, 27, 45, 0.82);
        color: #cbd5e1;
        font-size: 11px;
      }

      .aps-setting-chip b {
        color: #7dd3fc;
        margin-left: 4px;
      }

      .aps-scene-options {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .aps-scene-btn {
        border: 1px solid #334155;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.86);
        color: #dbeafe;
        font-size: 12px;
        font-weight: 700;
        padding: 12px 10px;
        cursor: pointer;
      }

      .aps-scene-btn.active {
        border-color: #2563eb;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
      }

      .aps-feedback-content {
        border: 1px dashed #334155;
        border-radius: 10px;
        padding: 12px;
        background: rgba(15, 23, 42, 0.8);
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
        .aps-header-layout {
          display: flex;
        }

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

        .aps-header-meta .aps-site-switch {
          width: auto;
        }

        .aps-site-switch .role-select {
          width: 100%;
        }

        .aps-header-meta .aps-site-switch .role-select {
          width: 132px;
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
    const headerEl = document.querySelector('header');
    const headerDate = document.getElementById('header-date');
    if (!header || !brandBlock || !nav || !meta) return;

    if (!brandBlock.querySelector('.aps-console-title')) {
      const titleBlock = document.createElement('div');
      titleBlock.className = 'aps-console-title';
      titleBlock.innerHTML = `
        <div class="aps-console-title-main">格力高级计划排程系统</div>
        <div class="aps-console-title-sub">跨厂协同排程控制台</div>
      `;
      brandBlock.appendChild(titleBlock);
    }

    headerEl?.classList.add('aps-header-layout');

    let siteSwitch = document.querySelector('.aps-site-switch');
    if (!siteSwitch) {
      siteSwitch = document.createElement('div');
      siteSwitch.className = 'aps-site-switch';
      siteSwitch.innerHTML = '<span class="aps-site-switch-label">制造基地</span>';
    }
    if (hqSelect && hqSelect.parentElement !== siteSwitch) {
      siteSwitch.appendChild(hqSelect);
    }

    const topTabs = [
      { href: 'decision.html', label: '决策分析' },
      { href: 'collab.html', label: '排产操作' },
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

    if (siteSwitch.parentElement !== meta) meta.prepend(siteSwitch);
    if (dateChip.parentElement !== meta) meta.appendChild(dateChip);
    if (notifyBtn.parentElement !== meta) meta.appendChild(notifyBtn);
    if (userDropdown && userDropdown.parentElement !== meta) meta.appendChild(userDropdown);

    if (siteSwitch.nextSibling !== dateChip) {
      meta.insertBefore(dateChip, siteSwitch.nextSibling);
    }
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
        <div class="aps-order-table-wrap">
          <table class="aps-order-table">
            <thead>
              <tr><th>订单号</th><th>来源</th><th>交期</th><th>数量</th><th>状态</th></tr>
            </thead>
            <tbody id="aps-order-tbody"></tbody>
          </table>
        </div>
        <div class="aps-order-footer">
          <button class="btn sm" id="aps-all-preplan-orders-btn">所有预排订单</button>
          <div class="aps-order-pager">
            <button class="aps-order-page-btn" id="aps-order-prev-page">上一页</button>
            <span class="aps-order-page-info" id="aps-order-page-info">1 / 1</span>
            <button class="aps-order-page-btn" id="aps-order-next-page">下一页</button>
          </div>
        </div>
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
    const wipCard = leftCol.querySelector('.wip-orders-card');
    const preplanCard = document.getElementById('aps-order-sync-card');
    if (wipCard && preplanCard && wipCard !== preplanCard.previousElementSibling) {
      leftCol.insertBefore(wipCard, preplanCard);
    }

    const ORDER_PAGE_SIZE = 8;
    let currentOrderPage = 1;
    const orderSources = ['ERP', 'EDI', 'CRM', 'APS'];
    const orders = Array.from({ length: 36 }, (_, idx) => {
      const seq = 18 + idx;
      const source = orderSources[idx % orderSources.length];
      const deliveryDay = 10 + (idx % 9);
      const qty = 180 + ((idx * 37) % 420);
      let status = 'ready';
      if (idx === 2 || idx === 11 || idx === 24) status = 'rush';
      if (idx === 15 || idx === 29) status = 'cancelled';
      return {
        no: `SO-20260309-${String(seq).padStart(3, '0')}`,
        source,
        delivery: `2026-03-${String(deliveryDay).padStart(2, '0')}`,
        qty,
        status
      };
    });

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
      const pageInfo = document.getElementById('aps-order-page-info');
      const prevBtn = document.getElementById('aps-order-prev-page');
      const nextBtn = document.getElementById('aps-order-next-page');
      if (!tbody) return;
      const sortWeight = { rush: 0, ready: 1, cancelled: 2 };
      orders.sort((a, b) => sortWeight[a.status] - sortWeight[b.status]);
      const visibleOrders = orders.filter((order) => order.status !== 'cancelled');
      const totalPages = Math.max(1, Math.ceil(visibleOrders.length / ORDER_PAGE_SIZE));
      currentOrderPage = Math.min(Math.max(currentOrderPage, 1), totalPages);
      const start = (currentOrderPage - 1) * ORDER_PAGE_SIZE;
      const currentRows = visibleOrders.slice(start, start + ORDER_PAGE_SIZE);
      tbody.innerHTML = currentRows
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
      if (pageInfo) pageInfo.textContent = `${currentOrderPage} / ${totalPages}`;
      if (prevBtn) prevBtn.disabled = currentOrderPage <= 1;
      if (nextBtn) nextBtn.disabled = currentOrderPage >= totalPages;
    }

    function changeOrderPage(offset) {
      const visibleCount = orders.filter((order) => order.status !== 'cancelled').length;
      const totalPages = Math.max(1, Math.ceil(visibleCount / ORDER_PAGE_SIZE));
      const nextPage = currentOrderPage + offset;
      if (nextPage < 1 || nextPage > totalPages) return;
      currentOrderPage = nextPage;
      renderOrderTable();
    }

    const ORDER_SYNC_FLOW_STEPS = [
      { title: '基础数据导入', desc: '读取 ERP / CRM 订单主数据与交期基线。' },
      { title: '排产记录复原', desc: '恢复最近一次排产快照与执行留痕。' },
      { title: '数据初始化', desc: '建立本轮同步的工厂、产线与任务索引。' },
      { title: '一模多物订单处理', desc: '识别需拆分的组合订单与共模约束关系。' },
      { title: '品目指定机台', desc: '按物料属性绑定默认机台与工艺路径。' },
      { title: '数据导入完成', desc: '导入结果已写入可视化交互工作台。' }
    ];
    const orderSyncFlowState = {
      running: false,
      currentStep: -1,
      timers: []
    };
    const SYSTEM_EXECUTION_FLOW_STEPS = [
      { title: '品目指定机台', desc: '依据品目工艺特性与既定映射关系锁定默认机台。' },
      { title: '批次订单合并', desc: '按交期、工艺和能效批次执行订单聚合。' },
      { title: '计划排产', desc: '计算产线负荷、交付优先级与可执行排产序列。' },
      { title: '一模多物不排产订单开始时间赋值', desc: '为未直接排产的共模订单回填起始时间与衔接窗口。' },
      { title: '车间计划标识', desc: '写入车间级计划状态、批次标记与协同识别码。' },
      { title: '排产记录更新到工作台', desc: '将结果同步到可视化交互工作台与排产记录区。' }
    ];
    const systemExecutionFlowState = {
      running: false,
      currentStep: -1,
      timers: [],
      title: '系统执行流程',
      readyText: '准备执行排产流程...',
      doneText: '系统执行完成，工作台已同步更新。'
    };

    function clearOrderSyncFlowTimers() {
      orderSyncFlowState.timers.forEach((timer) => clearTimeout(timer));
      orderSyncFlowState.timers = [];
    }

    function clearSystemExecutionFlowTimers() {
      systemExecutionFlowState.timers.forEach((timer) => clearTimeout(timer));
      systemExecutionFlowState.timers = [];
    }

    function ensureOrderSyncFlowModal() {
      if (document.getElementById('aps-order-sync-mask')) return;
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.id = 'aps-order-sync-mask';
      mask.innerHTML = `
        <div class="modal-card aps-sync-flow-card" role="dialog" aria-modal="true" aria-labelledby="aps-order-sync-title">
          <div class="aps-sync-flow-top">
            <h3 id="aps-order-sync-title">订单同步更新</h3>
            <p>系统将按导入顺序恢复基础数据、排产快照与机台映射，完成后自动更新待排订单目录。</p>
            <div class="aps-sync-flow-progress"><span id="aps-order-sync-progress"></span></div>
          </div>
          <div class="aps-sync-flow-list" id="aps-order-sync-steps"></div>
          <div class="aps-sync-flow-foot">
            <div class="aps-sync-flow-note" id="aps-order-sync-note">准备启动数据导入流程...</div>
            <button type="button" class="btn primary" id="aps-order-sync-close" disabled>处理中</button>
          </div>
        </div>
      `;
      document.body.appendChild(mask);

      document.getElementById('aps-order-sync-close')?.addEventListener('click', () => {
        if (orderSyncFlowState.running) return;
        mask.classList.remove('show');
      });
      mask.addEventListener('click', (evt) => {
        if (evt.target === mask && !orderSyncFlowState.running) {
          mask.classList.remove('show');
        }
      });
      document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && mask.classList.contains('show') && !orderSyncFlowState.running) {
          mask.classList.remove('show');
        }
      });
    }

    function renderOrderSyncFlow() {
      const list = document.getElementById('aps-order-sync-steps');
      const note = document.getElementById('aps-order-sync-note');
      const progress = document.getElementById('aps-order-sync-progress');
      const closeBtn = document.getElementById('aps-order-sync-close');
      if (!list || !note || !progress || !closeBtn) return;

      const doneCount = orderSyncFlowState.currentStep >= ORDER_SYNC_FLOW_STEPS.length
        ? ORDER_SYNC_FLOW_STEPS.length
        : Math.max(0, orderSyncFlowState.currentStep);
      const activeIndex = orderSyncFlowState.running ? orderSyncFlowState.currentStep : -1;
      const progressValue = Math.round((doneCount / ORDER_SYNC_FLOW_STEPS.length) * 100);

      list.innerHTML = ORDER_SYNC_FLOW_STEPS.map((step, idx) => {
        const isDone = idx < doneCount;
        const isActive = idx === activeIndex && orderSyncFlowState.running;
        const status = isDone ? '已完成' : isActive ? '导入中' : '等待中';
        const klass = isDone ? 'done' : isActive ? 'active' : 'waiting';
        const indexLabel = isDone ? '✓' : String(idx + 1).padStart(2, '0');
        return `
          <div class="aps-sync-flow-step ${klass}">
            <span class="aps-sync-flow-index">${indexLabel}</span>
            <div>
              <div class="aps-sync-flow-name">${step.title}</div>
              <div class="aps-sync-flow-meta">${step.desc}</div>
            </div>
            <span class="aps-sync-flow-status">${status}</span>
          </div>
        `;
      }).join('');

      if (orderSyncFlowState.running && ORDER_SYNC_FLOW_STEPS[activeIndex]) {
        note.textContent = `正在执行：${ORDER_SYNC_FLOW_STEPS[activeIndex].title}`;
      } else if (!orderSyncFlowState.running && doneCount === ORDER_SYNC_FLOW_STEPS.length) {
        note.textContent = '订单同步更新已完成，待排订单目录与预排向导已刷新。';
      } else {
        note.textContent = '准备启动数据导入流程...';
      }

      progress.style.width = `${progressValue}%`;
      closeBtn.disabled = orderSyncFlowState.running;
      closeBtn.textContent = orderSyncFlowState.running ? '处理中' : '关闭';
    }

    function ensureSystemExecutionFlowModal() {
      if (document.getElementById('aps-system-flow-mask')) return;
      const mask = document.createElement('div');
      mask.className = 'modal-mask';
      mask.id = 'aps-system-flow-mask';
      mask.innerHTML = `
        <div class="modal-card aps-sync-flow-card" role="dialog" aria-modal="true" aria-labelledby="aps-system-flow-title">
          <div class="aps-sync-flow-top">
            <h3 id="aps-system-flow-title">系统执行流程</h3>
            <p id="aps-system-flow-desc">系统将依次完成机台指定、批次合并、计划排产与工作台回写。</p>
            <div class="aps-sync-flow-progress"><span id="aps-system-flow-progress"></span></div>
          </div>
          <div class="aps-sync-flow-list" id="aps-system-flow-steps"></div>
          <div class="aps-sync-flow-foot">
            <div class="aps-sync-flow-note" id="aps-system-flow-note">准备执行排产流程...</div>
            <button type="button" class="btn primary" id="aps-system-flow-close" disabled>处理中</button>
          </div>
        </div>
      `;
      document.body.appendChild(mask);

      document.getElementById('aps-system-flow-close')?.addEventListener('click', () => {
        if (systemExecutionFlowState.running) return;
        mask.classList.remove('show');
      });
      mask.addEventListener('click', (evt) => {
        if (evt.target === mask && !systemExecutionFlowState.running) {
          mask.classList.remove('show');
        }
      });
      document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && mask.classList.contains('show') && !systemExecutionFlowState.running) {
          mask.classList.remove('show');
        }
      });
    }

    function renderSystemExecutionFlow() {
      const title = document.getElementById('aps-system-flow-title');
      const desc = document.getElementById('aps-system-flow-desc');
      const list = document.getElementById('aps-system-flow-steps');
      const note = document.getElementById('aps-system-flow-note');
      const progress = document.getElementById('aps-system-flow-progress');
      const closeBtn = document.getElementById('aps-system-flow-close');
      if (!title || !desc || !list || !note || !progress || !closeBtn) return;

      const doneCount = systemExecutionFlowState.currentStep >= SYSTEM_EXECUTION_FLOW_STEPS.length
        ? SYSTEM_EXECUTION_FLOW_STEPS.length
        : Math.max(0, systemExecutionFlowState.currentStep);
      const activeIndex = systemExecutionFlowState.running ? systemExecutionFlowState.currentStep : -1;
      const progressValue = Math.round((doneCount / SYSTEM_EXECUTION_FLOW_STEPS.length) * 100);

      title.textContent = systemExecutionFlowState.title;
      desc.textContent = '系统将依次完成机台指定、批次合并、计划排产与工作台回写。';
      list.innerHTML = SYSTEM_EXECUTION_FLOW_STEPS.map((step, idx) => {
        const isDone = idx < doneCount;
        const isActive = idx === activeIndex && systemExecutionFlowState.running;
        const status = isDone ? '已完成' : isActive ? '执行中' : '等待中';
        const klass = isDone ? 'done' : isActive ? 'active' : 'waiting';
        const indexLabel = isDone ? '✓' : String(idx + 1).padStart(2, '0');
        return `
          <div class="aps-sync-flow-step ${klass}">
            <span class="aps-sync-flow-index">${indexLabel}</span>
            <div>
              <div class="aps-sync-flow-name">${step.title}</div>
              <div class="aps-sync-flow-meta">${step.desc}</div>
            </div>
            <span class="aps-sync-flow-status">${status}</span>
          </div>
        `;
      }).join('');

      if (systemExecutionFlowState.running && SYSTEM_EXECUTION_FLOW_STEPS[activeIndex]) {
        note.textContent = `正在执行：${SYSTEM_EXECUTION_FLOW_STEPS[activeIndex].title}`;
      } else if (!systemExecutionFlowState.running && doneCount === SYSTEM_EXECUTION_FLOW_STEPS.length) {
        note.textContent = systemExecutionFlowState.doneText;
      } else {
        note.textContent = systemExecutionFlowState.readyText;
      }

      progress.style.width = `${progressValue}%`;
      closeBtn.disabled = systemExecutionFlowState.running;
      closeBtn.textContent = systemExecutionFlowState.running ? '处理中' : '关闭';
    }

    function runSystemExecutionFlow(options = {}) {
      if (systemExecutionFlowState.running) {
        document.getElementById('aps-system-flow-mask')?.classList.add('show');
        toast('系统执行中，请稍候。');
        return;
      }

      ensureSystemExecutionFlowModal();
      const mask = document.getElementById('aps-system-flow-mask');
      if (!mask) return;

      clearSystemExecutionFlowTimers();
      systemExecutionFlowState.running = true;
      systemExecutionFlowState.currentStep = 0;
      systemExecutionFlowState.title = options.title || '系统执行流程';
      systemExecutionFlowState.readyText = options.readyText || '准备执行排产流程...';
      systemExecutionFlowState.doneText = options.doneText || '系统执行完成，工作台已同步更新。';
      renderSystemExecutionFlow();
      mask.classList.add('show');

      SYSTEM_EXECUTION_FLOW_STEPS.forEach((_, idx) => {
        const timer = setTimeout(() => {
          systemExecutionFlowState.currentStep = idx;
          renderSystemExecutionFlow();
        }, idx * 650);
        systemExecutionFlowState.timers.push(timer);
      });

      const finishTimer = setTimeout(() => {
        systemExecutionFlowState.currentStep = SYSTEM_EXECUTION_FLOW_STEPS.length;
        systemExecutionFlowState.running = false;
        if (typeof options.onComplete === 'function') {
          options.onComplete();
        }
        renderSystemExecutionFlow();
      }, SYSTEM_EXECUTION_FLOW_STEPS.length * 650 + 300);
      systemExecutionFlowState.timers.push(finishTimer);
    }

    function finalizeOrderSyncOrders() {
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
      if (orders.length > 48) orders.pop();
      currentOrderPage = 1;
      renderOrderTable();
    }

    function syncOrders() {
      if (orderSyncFlowState.running) {
        document.getElementById('aps-order-sync-mask')?.classList.add('show');
        toast('订单同步更新进行中，请稍候。');
        return;
      }

      ensureOrderSyncFlowModal();
      const mask = document.getElementById('aps-order-sync-mask');
      if (!mask) return;

      clearOrderSyncFlowTimers();
      orderSyncFlowState.running = true;
      orderSyncFlowState.currentStep = 0;
      renderOrderSyncFlow();
      mask.classList.add('show');

      ORDER_SYNC_FLOW_STEPS.forEach((_, idx) => {
        const timer = setTimeout(() => {
          orderSyncFlowState.currentStep = idx;
          renderOrderSyncFlow();
        }, idx * 700);
        orderSyncFlowState.timers.push(timer);
      });

      const finishTimer = setTimeout(() => {
        orderSyncFlowState.currentStep = ORDER_SYNC_FLOW_STEPS.length;
        orderSyncFlowState.running = false;
        finalizeOrderSyncOrders();
        renderOrderSyncFlow();
        toast('订单同步完成：已置顶加急插单，并隐藏撤销订单。');
      }, ORDER_SYNC_FLOW_STEPS.length * 700 + 300);
      orderSyncFlowState.timers.push(finishTimer);
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

    function executeSmartSchedule() {
      const plan = getSchedulePlan(selectedScheduleMode);
      applyScheduleMode(plan.mode);
      const nowText = typeof formatClockTime === 'function'
        ? formatClockTime()
        : new Date().toLocaleTimeString('zh-CN', { hour12: false });
      updateScheduleSelectionHint(`${nowText} 已执行${plan.title}，可视化交互工作台已跟随更新。`);
      toast(`一键排产完成：${plan.title}已同步到可视化交互工作台。`);
    }

    function runSmartSchedule() {
      runSystemExecutionFlow({
        title: '系统执行流程',
        readyText: '准备执行一键排产流程...',
        doneText: '一键排产流程执行完成，排产记录已更新到工作台。',
        onComplete: executeSmartSchedule
      });
    }

    const allPreplanOrdersBtn = document.getElementById('aps-all-preplan-orders-btn');
    const orderPrevPageBtn = document.getElementById('aps-order-prev-page');
    const orderNextPageBtn = document.getElementById('aps-order-next-page');
    const orderSyncBtn = document.getElementById('aps-order-sync-btn');
    const preplanBtn = document.getElementById('aps-preplan-start-btn');
    const resourceBtn = document.getElementById('aps-resource-match-btn');
    const smartBtn = document.getElementById('aps-smart-schedule-btn');

    allPreplanOrdersBtn?.addEventListener('click', () => {
      window.location.href = 'preplan-orders.html';
    });
    orderPrevPageBtn?.addEventListener('click', () => changeOrderPage(-1));
    orderNextPageBtn?.addEventListener('click', () => changeOrderPage(1));
    orderSyncBtn?.addEventListener('click', syncOrders);
    preplanBtn?.addEventListener('click', runPreplanWizard);
    resourceBtn?.addEventListener('click', runResourceMatch);
    smartBtn?.addEventListener('click', runSmartSchedule);

    const originalRunSelfHealing = window.runSelfHealing;
    function executeSelfHealing() {
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
    }

    window.runSelfHealing = function () {
      runSystemExecutionFlow({
        title: '系统执行流程',
        readyText: '准备执行重排与自愈流程...',
        doneText: '执行重排流程完成，最新排产记录已更新到工作台。',
        onComplete: executeSelfHealing
      });
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

    const module = document.createElement('section');
    module.id = 'aps-decision-upgrade';
    module.className = 'aps-decision-grid';
    module.innerHTML = `
      <article class="card aps-sim-card">
        <div class="card-hd">
          <span>全链路进度与预警大屏</span>
          <button class="btn sm" id="aps-feedback-btn">生成反哺建议</button>
        </div>
        <div class="card-bd">
          <div class="aps-stage-flow" id="aps-stage-flow"></div>
          <div class="aps-diagnosis-card" id="aps-stage-diagnosis">点击延误节点查看归因诊断卡片。</div>
        </div>
      </article>

      <article class="card aps-sim-card">
        <div class="card-hd">
          <div class="aps-sim-title-stack">
            <span>AI推演工作台</span>
            <div class="aps-sim-subtitle">先组合异常来源，再生成一段可执行的排程调整建议。</div>
          </div>
        </div>
        <div class="card-bd">
          <div class="aps-slider-panel">
            <div class="aps-slider-row">
              <div class="aps-sim-row-head">
                <div class="aps-sim-row-title">物料异常</div>
                <div class="aps-sim-row-badge" id="aps-sim-shortage-badge">待选择</div>
              </div>
              <div class="aps-sim-note">聚焦供应商、配送、检验与现场到料问题，快速组合会影响上线节奏的物料异常。</div>
              <div id="aps-sim-shortage" class="aps-sim-multi"></div>
            </div>
            <div class="aps-slider-row">
              <div class="aps-sim-row-head">
                <div class="aps-sim-row-title">设备/模具异常</div>
                <div class="aps-sim-row-badge" id="aps-sim-breakdown-badge">待选择</div>
              </div>
              <div class="aps-sim-note">覆盖设备维修、模具备件与机型适配限制，集中评估产能缺口和切线压力。</div>
              <div id="aps-sim-breakdown" class="aps-sim-multi"></div>
            </div>
            <div class="aps-slider-row">
              <div class="aps-sim-row-head">
                <div class="aps-sim-row-title">插单/跳单异常</div>
                <div class="aps-sim-row-badge" id="aps-sim-rush-badge">待选择</div>
              </div>
              <div class="aps-sim-note">覆盖客户紧急插单与齐套、供货导致的跳单场景，联动评估交期承诺与局部重排压力。</div>
              <div id="aps-sim-rush" class="aps-sim-multi"></div>
            </div>
            <div class="aps-sim-bars" id="aps-sim-bars">
              <div class="aps-sim-result-head">
                <div class="aps-sim-result-meta">
                  <div class="aps-sim-result-title">AI推演结果舱</div>
                  <div class="aps-sim-result-note" id="aps-sim-selection-hint">请至少选择一个突发事件后生成推演建议。</div>
                </div>
                <button class="btn sm" id="aps-sim-generate-btn">生成AI推演</button>
              </div>
              <div class="aps-sim-progress-shell" id="aps-sim-progress-shell">
                <div class="aps-sim-progress-track">
                  <div class="aps-sim-progress-fill" id="aps-sim-progress-fill"></div>
                </div>
                <div class="aps-sim-progress-text" id="aps-sim-progress-text">正在初始化推演上下文...</div>
              </div>
              <div class="aps-sim-report empty" id="aps-sim-report">推演结果会在这里生成。先从上方三个类别中勾选本次排程需要考虑的突发事件。</div>
            </div>
          </div>
        </div>
      </article>
    `;

    const topModule = view.querySelector('.decision-kpi-module');
    if (topModule) {
      topModule.insertAdjacentElement('afterend', module);
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
    const SIM_SCENARIO_GROUPS = {
      shortage: {
        id: 'aps-sim-shortage',
        emptyText: '请选择物料异常',
        options: [
          { id: 'shortage-supplier-lack', label: '供应商缺料', hint: '上游供应商缺料，影响关键物料到厂节奏。', impact: 32, advice: '优先锁定高优订单物料配额，并同步供应商补料窗口。'},
          { id: 'shortage-delivery', label: '配送问题', hint: '厂内外配送异常，造成上线物料未按时到位。', impact: 26, advice: '调整配送优先级，先保障即将上线批次的物料直送。'},
          { id: 'shortage-detection', label: '检测问题', hint: '来料或过程检测卡滞，影响物料放行。', impact: 24, advice: '将待检批次前置复检，同时给齐套订单预留替代上线窗口。'},
          { id: 'shortage-quality-fail', label: '检验不合格', hint: '检验判退导致可用库存低于预期。', impact: 29, advice: '立即拆分不合格批次，并将可用合格料优先分配给锁定工单。'},
          { id: 'shortage-no-delivery', label: '物资库未配送到现场', hint: '库位有料但未完成现场配送。', impact: 21, advice: '先补齐现场待料工位，再延后低优订单释放。'},
          { id: 'shortage-under-delivery', label: '送货不足', hint: '实际送达数量少于排程需求。', impact: 27, advice: '按欠料缺口重排批次，优先释放可完成整单的订单。'}
        ]
      },
      breakdown: {
        id: 'aps-sim-breakdown',
        emptyText: '请选择设备/模具异常',
        options: [
          { id: 'breakdown-repair', label: '设备维修', hint: '设备故障停机，当前机台需要抢修。', impact: 34, advice: '高优订单切换至备机运行，故障机台仅保留锁定工单待恢复。'},
          { id: 'breakdown-mould-parts', label: '模具备件问题', hint: '模具或备件缺失，造成换型与生产受阻。', impact: 28, advice: '减少换型频次，把同机型工单合并到连续时段执行。'},
          { id: 'breakdown-model-mismatch', label: '机型不通用', hint: '现有设备与订单机型不兼容，无法直接承接。', impact: 23, advice: '优先分配可通用设备承接高优订单，其他订单后移至适配产线。'}
        ]
      },
      rush: {
        id: 'aps-sim-rush',
        emptyText: '请选择插单/跳单异常',
        options: [
          { id: 'rush-customer-urgent', label: '客户紧急插单', hint: '客户临时插入高优先订单，需要抢占排程窗口。', impact: 31, advice: '紧急插单单独建批，冻结最近两小时已锁定顺序避免连锁扰动。'},
          { id: 'rush-skip-incomplete', label: '不齐套造成跳单', hint: '订单不齐套，导致现场被迫跳单切换。', impact: 26, advice: '把不齐套订单移至待齐套池，优先释放齐套率更高的订单。'},
          { id: 'rush-late-supply', label: '供货不及时跳单', hint: '供货节奏跟不上，现场需要临时跳过原计划订单。', impact: 28, advice: '重排受影响时段的上线顺序，并为延迟供货订单预留补位窗口。'}
        ]
      }
    };
    const SIM_PROGRESS_TEXT = [
      '正在读取当前排程快照...',
      '正在比对事件组合对产能与交期的影响...',
      '正在生成调整建议与优先级排序...',
      '正在汇总 AI 推演结论...'
    ];
    let simProgressTimer = null;

    function closeScenarioSelects(exceptShell = null) {
      module.querySelectorAll('.aps-sim-select-shell.is-open').forEach((shell) => {
        if (exceptShell && shell === exceptShell) return;
        shell.classList.remove('is-open');
        const trigger = shell.querySelector('.aps-sim-selectbox');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    }

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

    function renderScenarioControls() {
      Object.entries(SIM_SCENARIO_GROUPS).forEach(([groupKey, group]) => {
        const host = document.getElementById(group.id);
        if (!host) return;
        host.innerHTML = `
          <div class="aps-sim-select-shell">
            <button type="button" class="aps-sim-selectbox" aria-haspopup="listbox" aria-expanded="false">
              <span class="aps-sim-summary" id="${group.id}-summary"></span>
              <span class="aps-sim-select-caret">多选</span>
            </button>
            <div class="aps-sim-menu" role="listbox" aria-multiselectable="true">
              ${group.options
                .map(
                  (option) => `
                    <button type="button" class="aps-sim-option" data-sim-group="${groupKey}" data-sim-value="${option.id}" role="option" aria-selected="false">
                      <span class="aps-sim-option-content">
                        <span class="aps-sim-option-label">${option.label}</span>
                        <small>${option.hint}</small>
                      </span>
                      <span class="aps-sim-option-check">✓</span>
                    </button>
                  `
                )
                .join('')}
            </div>
          </div>
        `;
        const shell = host.querySelector('.aps-sim-select-shell');
        const trigger = host.querySelector('.aps-sim-selectbox');
        trigger?.addEventListener('click', (event) => {
          event.stopPropagation();
          const willOpen = !shell.classList.contains('is-open');
          closeScenarioSelects(willOpen ? shell : null);
          shell.classList.toggle('is-open', willOpen);
          trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
        host.querySelectorAll(`button[data-sim-group="${groupKey}"]`).forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            const nextSelected = !button.classList.contains('is-selected');
            button.classList.toggle('is-selected', nextSelected);
            button.setAttribute('aria-selected', nextSelected ? 'true' : 'false');
            updateScenarioSummary(groupKey);
            markScenarioDirty();
          });
        });
        updateScenarioSummary(groupKey);
      });
    }

    function getScenarioGroupSelection(groupKey) {
      const group = SIM_SCENARIO_GROUPS[groupKey];
      if (!group) return [];
      const selected = Array.from(
        document.querySelectorAll(`#${group.id} .aps-sim-option.is-selected[data-sim-group="${groupKey}"]`)
      ).map((button) => button.dataset.simValue);
      return group.options.filter((option) => selected.includes(option.id));
    }

    function updateScenarioSummary(groupKey) {
      const group = SIM_SCENARIO_GROUPS[groupKey];
      if (!group) return;
      const summary = document.getElementById(`${group.id}-summary`);
      const badge = document.getElementById(`${group.id}-badge`);
      if (!summary) return;
      const selected = getScenarioGroupSelection(groupKey);
      if (!selected.length) {
        summary.innerHTML = `<span class="aps-sim-placeholder">${group.emptyText}</span>`;
        if (badge) {
          badge.textContent = '待选择';
          badge.classList.remove('is-active');
        }
        return;
      }
      if (badge) {
        badge.textContent = selected.length === 1 ? selected[0].label : `已选 ${selected.length} 项`;
        badge.classList.add('is-active');
      }
      const chips = selected
        .slice(0, 2)
        .map((item) => `<span class="aps-sim-chip">${item.label}</span>`);
      if (selected.length > 2) {
        chips.push(`<span class="aps-sim-chip is-muted">+${selected.length - 2}</span>`);
      }
      summary.innerHTML = chips.join('');
    }

    function getScenarioSnapshot() {
      const shortage = getScenarioGroupSelection('shortage');
      const breakdown = getScenarioGroupSelection('breakdown');
      const rush = getScenarioGroupSelection('rush');
      const all = [...shortage, ...breakdown, ...rush];
      return { shortage, breakdown, rush, all };
    }

    function getScenarioScore(items) {
      return items.reduce((total, item) => total + item.impact, 0);
    }

    function clearSimulationProgress() {
      if (simProgressTimer) {
        window.clearInterval(simProgressTimer);
        simProgressTimer = null;
      }
      const shell = document.getElementById('aps-sim-progress-shell');
      const fill = document.getElementById('aps-sim-progress-fill');
      const text = document.getElementById('aps-sim-progress-text');
      if (shell) shell.classList.remove('is-visible');
      if (fill) fill.style.width = '0%';
      if (text) text.textContent = '正在初始化推演上下文...';
    }

    function markScenarioDirty() {
      clearSimulationProgress();
      const snapshot = getScenarioSnapshot();
      const hint = document.getElementById('aps-sim-selection-hint');
      const report = document.getElementById('aps-sim-report');
      if (hint) {
        hint.textContent = snapshot.all.length
          ? `已选择 ${snapshot.all.length} 个突发事件，点击生成 AI 推演。`
          : '请至少选择一个突发事件后生成推演建议。';
      }
      if (report) {
        report.classList.add('empty');
        report.textContent = snapshot.all.length
          ? '事件组合已更新，点击“生成AI推演”输出新的排程建议。'
          : '推演结果会在这里生成。先从上方三个类别中勾选本次排程需要考虑的突发事件。';
      }
      const button = document.getElementById('aps-sim-generate-btn');
      if (button) button.disabled = false;
    }

    function buildSimulationAdvice(snapshot) {
      const shortageScore = getScenarioScore(snapshot.shortage);
      const breakdownScore = getScenarioScore(snapshot.breakdown);
      const rushScore = getScenarioScore(snapshot.rush);
      const totalScore = shortageScore + breakdownScore + rushScore;
      const riskLevel = totalScore >= 78 ? '高' : totalScore >= 42 ? '中' : '低';
      const sortedGroups = [
        { label: '物料异常', score: shortageScore, items: snapshot.shortage },
        { label: '设备/模具异常', score: breakdownScore, items: snapshot.breakdown },
        { label: '插单/跳单异常', score: rushScore, items: snapshot.rush }
      ].sort((a, b) => b.score - a.score);
      const primary = sortedGroups[0];
      const primaryNames = primary.items.map((item) => item.label).join('、') || '当前事件';
      const actions = snapshot.all.slice(0, 3).map((item) => item.advice);
      const leadHours = Math.min(10, Math.max(3, Math.round(totalScore / 9)));

      return `
        <div class="aps-sim-report-title">AI 推演结论：本次排程风险等级 ${riskLevel}</div>
        <div class="aps-sim-report-meta">生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}</div>
        <p>综合当前勾选的突发事件，系统判断 <strong>${primary.label}</strong> 是本轮排程最需要优先处置的变量，其中 ${primaryNames} 会直接压缩未来 ${leadHours} 小时的可用排程窗口。</p>
        <p>建议先锁定已承诺交期且齐套率高的订单，把受影响机台上的普通订单后移一个批次，再将跨线可切换订单分摊到备用产线，避免所有风险同时堆到白班窗口。</p>
        <p>执行动作建议：${actions.join('；')}。</p>
        <p>如果今天必须保交付，优先维持高优订单与合同订单的上线节奏，同时把低优订单释放节拍下调 10% 到 15%，给插单和故障恢复留出缓冲。</p>
      `;
    }

    function generateSimulationAdvice() {
      const snapshot = getScenarioSnapshot();
      const button = document.getElementById('aps-sim-generate-btn');
      const shell = document.getElementById('aps-sim-progress-shell');
      const fill = document.getElementById('aps-sim-progress-fill');
      const text = document.getElementById('aps-sim-progress-text');
      const report = document.getElementById('aps-sim-report');

      if (!button || !shell || !fill || !text || !report) return;
      if (!snapshot.all.length) {
        toast('请先选择至少一个突发事件。');
        return;
      }

      clearSimulationProgress();
      button.disabled = true;
      report.classList.add('empty');
      report.textContent = 'AI 正在结合当前事件组合生成排程建议，请稍候...';
      shell.classList.add('is-visible');

      let progress = 0;
      simProgressTimer = window.setInterval(() => {
        progress = Math.min(100, progress + 12 + Math.round(Math.random() * 10));
        fill.style.width = `${progress}%`;
        text.textContent = SIM_PROGRESS_TEXT[Math.min(SIM_PROGRESS_TEXT.length - 1, Math.floor(progress / 28))];

        if (progress >= 100) {
          window.clearInterval(simProgressTimer);
          simProgressTimer = null;
          report.classList.remove('empty');
          report.innerHTML = buildSimulationAdvice(snapshot);
          text.textContent = 'AI 推演已完成，建议已生成。';
          button.disabled = false;
        }
      }, 320);
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
    renderScenarioControls();
    document.addEventListener('click', (event) => {
      if (!module.contains(event.target)) {
        closeScenarioSelects();
      }
    });
    document.getElementById('aps-sim-generate-btn')?.addEventListener('click', generateSimulationAdvice);
    renderStages(1);
    const initialDiag = document.getElementById('aps-stage-diagnosis');
    if (initialDiag) {
      initialDiag.innerHTML = renderStageDiagnosis(stages[1]);
    }
    markScenarioDirty();
  }

  function enhanceSettingsPage() {
    const upgradeHost = document.getElementById('aps-settings-upgrade-host');
    if (!upgradeHost || document.getElementById('aps-settings-upgrade')) return;

    const block = document.createElement('div');
    block.id = 'aps-settings-upgrade';
    block.innerHTML = `
      <div class="aps-setting-block">
        <div class="aps-setting-title">约束规则与参数滑动配置</div>
        <div class="aps-setting-subtitle">把基础排程策略拆成开关与权重，方便计划员按总部基线做局部微调。</div>
        <div class="aps-switch-row">
          <div class="aps-toggle"><span>硬约束实时校验</span><input type="checkbox" id="aps-hard-check" checked /></div>
          <div class="aps-toggle"><span>软约束评分引擎</span><input type="checkbox" id="aps-soft-check" checked /></div>
          <div class="aps-toggle"><span>跨厂协同优先级加权</span><input type="checkbox" id="aps-cross-check" checked /></div>
        </div>
        <div class="aps-slider-config">
          <div class="aps-slider-row"><span>交期权重</span><input type="range" min="0" max="100" value="68" id="aps-weight-delivery" /><span id="aps-weight-delivery-v">68%</span></div>
          <div class="aps-slider-row"><span>成本权重</span><input type="range" min="0" max="100" value="22" id="aps-weight-cost" /><span id="aps-weight-cost-v">22%</span></div>
          <div class="aps-slider-row"><span>库存权重</span><input type="range" min="0" max="100" value="10" id="aps-weight-stock" /><span id="aps-weight-stock-v">10%</span></div>
        </div>
        <div class="aps-setting-chip-row">
          <div class="aps-setting-chip">当前策略包<b>总部默认</b></div>
          <div class="aps-setting-chip">回写状态<b>自动同步</b></div>
        </div>
      </div>

      <div class="aps-setting-block">
        <div class="aps-setting-title">一键场景换挡机制</div>
        <div class="aps-setting-subtitle">把常规、旺季和极端缺料三套策略包直接固化为快捷入口，减少手工调参次数。</div>
        <div class="aps-scene-options" id="aps-scene-options">
          <button type="button" class="aps-scene-btn active" data-scene="常规平稳">常规平稳</button>
          <button type="button" class="aps-scene-btn" data-scene="旺季抢产">旺季抢产</button>
          <button type="button" class="aps-scene-btn" data-scene="极端缺料">极端缺料</button>
        </div>
      </div>

      <div class="aps-setting-block">
        <div class="aps-setting-title">跨厂时间尺图形化对齐</div>
        <div class="aps-setting-subtitle">以总装厂作息为主时间尺，对分厂班次盲区和偏移窗口做统一覆盖修正。</div>
        <div class="aps-feedback-box">
          <button class="btn sm" id="aps-align-btn">以总装厂作息为准强制覆盖</button>
          <div class="aps-feedback-content" id="aps-align-result">等待执行时间尺对齐...</div>
        </div>
      </div>

    `;

    upgradeHost.appendChild(block);

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
