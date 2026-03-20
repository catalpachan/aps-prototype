function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let toastTimer = null;
let aiAssistantLastFocus = null;
let headerDateTimer = null;
let commonInitialized = false;
let clickA11yObserver = null;
let formPromptLastFocus = null;
let confirmDialogLastFocus = null;

function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.setAttribute('aria-atomic', 'true');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    toastTimer = null;
  }, 2000);
}

function updateHeaderDateText() {
  const headerDate = document.getElementById('header-date');
  if (headerDate) {
    headerDate.textContent = formatDateTime(new Date());
  }
}

function showFormPrompt(options = {}) {
  const {
    title = '请输入内容',
    label = '输入',
    defaultValue = '',
    placeholder = '',
    inputType = 'text',
    min,
    max,
    step,
    confirmText = '确定',
    cancelText = '取消',
    validator
  } = options;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'form-prompt-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'form-prompt-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'form-prompt-title');

    const inputId = `form-prompt-input-${Date.now()}`;
    dialog.innerHTML = `
      <h3 id="form-prompt-title">${escapeHTML(title)}</h3>
      <label for="${inputId}">${escapeHTML(label)}</label>
      <input id="${inputId}" class="form-prompt-input" type="${escapeHTML(inputType)}" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(String(defaultValue))}" />
      <div class="form-prompt-error" aria-live="polite"></div>
      <div class="form-prompt-actions">
        <button type="button" class="btn" data-action="cancel">${escapeHTML(cancelText)}</button>
        <button type="button" class="btn primary" data-action="confirm">${escapeHTML(confirmText)}</button>
      </div>
    `;

    const input = dialog.querySelector('.form-prompt-input');
    if (input) {
      if (min !== undefined) input.setAttribute('min', String(min));
      if (max !== undefined) input.setAttribute('max', String(max));
      if (step !== undefined) input.setAttribute('step', String(step));
    }

    const errorEl = dialog.querySelector('.form-prompt-error');
    const finish = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      if (formPromptLastFocus) {
        formPromptLastFocus.focus();
        formPromptLastFocus = null;
      }
      resolve(value);
    };

    const onConfirm = () => {
      if (!input) {
        finish(null);
        return;
      }
      const value = input.value.trim();
      let error = '';
      if (typeof validator === 'function') {
        error = validator(value) || '';
      } else if (!value) {
        error = '请输入有效内容';
      }
      if (error) {
        if (errorEl) errorEl.textContent = error;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      finish(value);
    };

    const onKeyDown = (evt) => {
      if (!backdrop.isConnected) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(null);
      } else if (evt.key === 'Enter' && evt.target === input) {
        evt.preventDefault();
        onConfirm();
      }
    };

    backdrop.addEventListener('click', (evt) => {
      if (evt.target === backdrop) {
        finish(null);
      }
    });

    dialog.addEventListener('click', (evt) => {
      const target = evt.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === 'cancel') {
        finish(null);
      } else if (target.dataset.action === 'confirm') {
        onConfirm();
      }
    });

    formPromptLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKeyDown);

    if (input) {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 10);
    }
  });
}

function showConfirmDialog(options = {}) {
  const config = typeof options === 'string' ? { message: options } : (options || {});
  const {
    title = '请确认操作',
    message = '是否继续执行该操作？',
    confirmText = '确定',
    cancelText = '取消',
    confirmType = 'primary'
  } = config;

  const confirmBtnClass = confirmType === 'danger' ? 'btn err txt-white' : 'btn primary';

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.innerHTML = `
      <h3 id="confirm-dialog-title">${escapeHTML(String(title))}</h3>
      <div class="confirm-dialog-message">${escapeHTML(String(message)).replace(/\n/g, '<br>')}</div>
      <div class="confirm-dialog-actions">
        <button type="button" class="btn" data-action="cancel">${escapeHTML(String(cancelText))}</button>
        <button type="button" class="${confirmBtnClass}" data-action="confirm">${escapeHTML(String(confirmText))}</button>
      </div>
    `;

    const finish = (value) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      if (confirmDialogLastFocus) {
        confirmDialogLastFocus.focus();
        confirmDialogLastFocus = null;
      }
      resolve(value);
    };

    const onKeyDown = (evt) => {
      if (!backdrop.isConnected) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        finish(false);
      }
      if (evt.key === 'Enter') {
        evt.preventDefault();
        finish(true);
      }
    };

    backdrop.addEventListener('click', (evt) => {
      if (evt.target === backdrop) finish(false);
    });

    dialog.addEventListener('click', (evt) => {
      const target = evt.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.action === 'cancel') finish(false);
      if (target.dataset.action === 'confirm') finish(true);
    });

    confirmDialogLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKeyDown);

    const confirmButton = dialog.querySelector('[data-action="confirm"]');
    if (confirmButton instanceof HTMLElement) {
      setTimeout(() => confirmButton.focus(), 10);
    }
  });
}

function ensureSkipLink() {
  if (document.querySelector('.skip-link')) return;
  const main = document.getElementById('app') || document.querySelector('main');
  if (!main) return;
  if (!main.id) {
    main.id = 'main-content';
  }
  const skipLink = document.createElement('a');
  skipLink.className = 'skip-link';
  skipLink.href = `#${main.id}`;
  skipLink.textContent = '跳转到主要内容';
  document.body.insertAdjacentElement('afterbegin', skipLink);
}

function hasAssociatedLabel(control) {
  if (!(control instanceof HTMLElement)) return false;
  if (control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) return true;
  if (control.closest('label')) return true;
  const id = control.getAttribute('id');
  if (!id) return false;
  return !!document.querySelector(`label[for="${id}"]`);
}

function buildControlLabel(control) {
  if (!(control instanceof HTMLElement)) return '';
  const prev = control.previousElementSibling;
  if (prev && prev.tagName === 'LABEL') {
    return prev.textContent.trim();
  }
  const parentLabel = control.parentElement?.querySelector(':scope > label');
  if (parentLabel) {
    return parentLabel.textContent.trim();
  }
  const placeholder = control.getAttribute('placeholder');
  if (placeholder) return placeholder.trim();
  const name = control.getAttribute('name');
  if (name) return name.trim();
  const id = control.getAttribute('id');
  if (id) return id.trim();
  return control.tagName === 'SELECT' ? '选择项' : '输入项';
}

function ensureFormControlLabels(root = document) {
  if (!(root instanceof Document) && !(root instanceof HTMLElement)) return;
  const controls = [];
  if (root instanceof HTMLElement && root.matches('input, select, textarea')) {
    controls.push(root);
  }
  root.querySelectorAll('input, select, textarea').forEach((el) => controls.push(el));
  controls.forEach((control) => {
    const type = control.getAttribute('type');
    if (type === 'hidden' || control.getAttribute('aria-hidden') === 'true') return;
    if (hasAssociatedLabel(control)) return;
    const inferred = buildControlLabel(control);
    if (inferred) {
      control.setAttribute('aria-label', inferred);
    }
  });
}

function padNumber(num, length) {
  return String(num).padStart(length, '0');
}

function formatClockTime() {
  const now = new Date();
  return `${padNumber(now.getHours(), 2)}:${padNumber(now.getMinutes(), 2)}`;
}

function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const state = {
  ganttTasks: [],
  decisionTasks: [],
  orders: [],
  bomTree: [],
  inventory: [],
  inserts: [],
  equipment: [],
  molds: [],
  skills: [],
  calendar: [],
  outsource: [],
  hardRules: [],
  softScores: [],
  leadTimes: [],
  alerts: [],
  flowData: [],
  attribution: [],
  performance: [],
  locks: [],
  resourceRecords: null,
  settingsUsers: [],
  settingsAuditLogs: [],
  confirmModalResolve: null,
  formModalResolve: null,
  formModalReject: null,
  editingResourceType: null,
  editingResourceId: null,
  resourcePagination: {
    device: { page: 1, pageSize: 10, total: 0 },
    mold: { page: 1, pageSize: 10, total: 0 },
    personnel: { page: 1, pageSize: 10, total: 0 },
    calendar: { page: 1, pageSize: 10, total: 0 },
    outsource: { page: 1, pageSize: 10, total: 0 }
  }
};

function buildInitialGanttTasks() {
  const products = ["KFR-26GW", "KFR-35GW", "KFR-50GW", "KFR-72GW", "KFR-120LW"];
  const tasks = [];
  let seq = 1;

  const processByLine = (line) => {
    if (line <= 4) return "总装";
    if (line <= 9) return "注塑成型";
    if (line <= 14) return "钣金加工";
    return "两器焊接";
  };

  for (let line = 0; line < 20; line++) {
    const taskCount = (line % 3) + 1;
    const baseStarts = [line % 5, 8 + (line % 6), 16 + (line % 5)];
    let prevEnd = -1;

    for (let j = 0; j < taskCount; j++) {
      let duration = j === 2 ? 2 : (2 + ((line + j) % 3));
      let start = baseStarts[j];
      start = Math.max(start, prevEnd + 1);
      if (start + duration > 24) {
        start = Math.max(0, 24 - duration);
      }
      if (start <= prevEnd) {
        start = prevEnd + 1;
        if (start + duration > 24) {
          duration = Math.max(1, 24 - start);
        }
      }

      const idStr = String(seq).padStart(4, "0");
      const taskNo = `TASK-${idStr}`;
      const orderNo = `ORD-20260301-${String(100 + seq).slice(-3)}`;

      tasks.push({
        id: `T${seq}`,
        taskNo,
        orderNo,
        productName: products[(line + j) % products.length],
        qty: 80 + ((line * 17 + j * 23) % 260),
        process: processByLine(line),
        status: "预排订单",
        line,
        start,
        duration,
        name: `WO-${7000 + seq}`,
        cls: "a"
      });

      prevEnd = start + duration;
      seq += 1;
    }
  }

  const rankedTasks = tasks
    .map((task, idx) => ({
      idx,
      seed: ((task.line + 1) * 97) + (Math.round(task.start * 10) * 13) + (Math.round(task.duration * 10) * 17) + idx * 19
    }))
    .sort((a, b) => a.seed - b.seed);
  const emergencyCount = Math.min(5, Math.max(3, 3 + (tasks.length % 3)));
  const lockedCount = Math.max(4, Math.round(tasks.length * 0.1));

  rankedTasks.forEach(({ idx }, orderIdx) => {
    const task = tasks[idx];
    if (!task) return;
    if (orderIdx < emergencyCount) {
      task.cls = "c";
      task.status = "紧急插单";
      return;
    }
    if (orderIdx < emergencyCount + lockedCount) {
      task.cls = "b";
      task.status = "锁定订单";
      return;
    }
    task.cls = "a";
    task.status = "预排订单";
  });

  return tasks;
}

function buildInitialDecisionTasks() {
  const plants = [
    { name: "东区总装", jobs: [{ s: 1, d: 4, n: "内机组装" }, { s: 8, d: 5, n: "整机联调" }] },
    { name: "西区总装", jobs: [{ s: 3, d: 4, n: "外机总装" }, { s: 13, d: 4, n: "包装入库" }] },
    { name: "注塑分厂", jobs: [{ s: 0, d: 6, n: "面板注塑" }, { s: 11, d: 5, n: "外壳注塑" }] },
    { name: "两器分厂", jobs: [{ s: 5, d: 4, n: "冷凝器焊接" }, { s: 14, d: 4, n: "蒸发器组装" }] },
    { name: "控制器分厂", jobs: [{ s: 2, d: 5, n: "控制板装配" }, { s: 15, d: 3, n: "程序烧录" }] }
  ];
  const tasks = [];
  let seq = 1;
  plants.forEach((plant, line) => {
    plant.jobs.forEach((job, jobIdx) => {
      tasks.push({
        id: `DG${seq}`,
        line,
        start: job.s,
        duration: job.d,
        name: job.n,
        cls: `p${(line + jobIdx) % 5 + 1}`
      });
      seq += 1;
    });
  });
  return tasks;
}

function buildResourceRecords(count = 100) {
  const deviceStatus = ["运行", "预警", "检修", "待机"];
  const moldStatus = ["在用", "待检", "保养", "封存"];
  const skills = ["注塑", "焊接", "总装", "冷媒加注", "钣金"];
  const levels = ["L1", "L2", "L3", "L4"];
  const calendarStatus = ["已对齐", "待对齐"];
  const outsourceStatus = ["可用", "备选", "紧张"];
  const factories = ["总装厂", "注塑厂", "两器厂", "控制器厂", "钣金厂"];

  return {
    devices: Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      return {
        code: `EQ-${padNumber(idx, 4)}`,
        name: `${factories[i % factories.length]}设备-${padNumber(idx, 3)}`,
        model: `MDL-${320 + (i % 12) * 10}`,
        status: deviceStatus[i % deviceStatus.length],
        capacity: `${80 + (i % 9) * 10}套/时`
      };
    }),
    molds: Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      return {
        code: `M-${padNumber(1000 + idx, 4)}`,
        cavity: `1模${2 + (i % 6)}穴`,
        machine: `IM-${1600 + (i % 8) * 100}`,
        life: `${45 + (i * 3) % 55}%`,
        location: `${factories[i % factories.length]}-库位${padNumber((i % 20) + 1, 2)}`,
        status: moldStatus[i % moldStatus.length]
      };
    }),
    personnels: Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      const month = padNumber((i % 12) + 1, 2);
      const day = padNumber((i % 28) + 1, 2);
      return {
        empId: `P${padNumber(1000 + idx, 5)}`,
        name: `员工${padNumber(idx, 3)}`,
        skill: skills[i % skills.length],
        level: levels[i % levels.length],
        certExpiry: `${2026 + (i % 3)}-${month}-${day}`
      };
    }),
    calendars: Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      return {
        factory: factories[i % factories.length],
        shift: i % 2 === 0 ? "三班制" : "两班制",
        maintenance: `周${["一", "二", "三", "四", "五", "六", "日"][i % 7]} ${padNumber(i % 24, 2)}:00-${padNumber((i % 24) + 2, 2)}:00`,
        overtime: i % 3 === 0 ? "旺季加班" : "按需加班",
        status: calendarStatus[idx % calendarStatus.length]
      };
    }),
    outsources: Array.from({ length: count }, (_, i) => {
      const idx = i + 1;
      return {
        vendor: `外协厂商-${padNumber(idx, 3)}`,
        capacity: `${120 + (i % 8) * 20}套/日`,
        quality: ["A+", "A", "B+", "B"][i % 4],
        leadTime: `T+${2 + (i % 4)}`,
        status: outsourceStatus[i % outsourceStatus.length]
      };
    })
  };
}

function buildOrders() {
  const tags = ["", "旺季", "战略", "", "旺季", "", "", "战略", "", "旺季"];
  const statuses = ["valid", "valid", "frozen", "valid", "valid", "valid", "frozen", "valid", "valid", "valid"];
  return Array.from({ length: 10 }, (_, i) => {
    const seq = 18 + i;
    return {
      no: `SO-20260227-${String(seq).padStart(3, "0")}`,
      source: i % 3 === 0 ? "CRM" : "EDI",
      delivery: `2026-03-${String(5 + (i % 10)).padStart(2, "0")}`,
      qty: 200 + ((i * 137) % 800),
      tag: tags[i],
      status: statuses[i]
    };
  });
}

function buildBomTree() {
  return [
    {
      id: "ROOT-1",
      title: "KFR-35GW 整机订单",
      code: "SO-20260227-001",
      qty: 500,
      batch: 1,
      children: [
        {
          id: "CHILD-1",
          title: "内机组件",
          code: "WO-20260227-001-A",
          qty: 500,
          batch: 1,
          children: [
            { id: "LEAF-1", title: "蒸发器", code: "PN-1001", qty: 500, batch: 2, isLeaf: true },
            { id: "LEAF-2", title: "面板", code: "PN-1002", qty: 500, batch: 1, isLeaf: true }
          ]
        },
        {
          id: "CHILD-2",
          title: "外机组件",
          code: "WO-20260227-001-B",
          qty: 500,
          batch: 2,
          children: [
            { id: "LEAF-3", title: "压缩机", code: "PN-2001", qty: 500, batch: 3, isLeaf: true },
            { id: "LEAF-4", title: "冷凝器", code: "PN-2002", qty: 500, batch: 2, isLeaf: true }
          ]
        }
      ]
    }
  ];
}

function buildInventory() {
  return [
    { name: "压缩机", stock: 320, required: 500, status: "shortage" },
    { name: "铜管", stock: 850, required: 600, status: "ok" },
    { name: "面板", stock: 480, required: 500, status: "warning" },
    { name: "电路板", stock: 120, required: 500, status: "shortage" }
  ];
}

function buildInserts() {
  return [
    { code: "RUSH-001", shortage: "压缩机", delay: "2h", capacity: "占用15%" },
    { code: "RUSH-002", shortage: "电路板", delay: "4h", capacity: "占用8%" },
    { code: "RUSH-003", shortage: "-", delay: "-", capacity: "占用5%" }
  ];
}

function buildHardRules() {
  return [
    { code: "HR-001", level: "强制", name: "设备产能上限", desc: "单台设备每日最大产能不得超过设计上限的120%" },
    { code: "HR-002", level: "强制", name: "工序先后顺序", desc: "必须遵守BOM定义的工序先后顺序，不可逆向作业" },
    { code: "HR-003", level: "强制", name: "物料齐套检查", desc: "开工前必须完成物料齐套检查，缺料不允许开工" },
    { code: "HR-004", level: "强制", name: "质检停线规则", desc: "关键工位质检不合格率超过5%自动触发停线" }
  ];
}

function buildSoftScores() {
  return [
    { name: "准时交付率", weight: 35, score: 92.5 },
    { name: "产能利用率", weight: 25, score: 88.3 },
    { name: "换产成本", weight: 20, score: 85.0 },
    { name: "库存周转", weight: 20, score: 90.2 }
  ];
}

function buildLeadTimes() {
  return [
    { process: "注塑", normal: 2, peak: 1.5 },
    { process: "钣金", normal: 1.5, peak: 1.2 },
    { process: "焊接", normal: 1, peak: 0.8 },
    { process: "总装", normal: 1, peak: 0.8 }
  ];
}

function buildAlerts() {
  return [
    { level: 1, title: "东区总装 ZZW05 设备故障停机", time: "2分钟前" },
    { level: 2, title: "注塑分厂物料短缺预警", time: "15分钟前" },
    { level: 2, title: "西区总装配件等待超时", time: "32分钟前" },
    { level: 3, title: "两器分厂班次调整通知", time: "1小时前" }
  ];
}

function buildFlowData() {
  return [
    { name: "注塑成型", value: 85, planned: 1200, actual: 1020 },
    { name: "钣金加工", value: 70, planned: 800, actual: 560 },
    { name: "两器焊接", value: 92, planned: 600, actual: 552 },
    { name: "总装装配", value: 89, planned: 1000, actual: 890 }
  ];
}

function buildAttribution() {
  return [
    { name: "OEE偏低归因", value: -2.3, desc: "主要原因是设备换产时间过长，建议优化换产流程", type: "warn" },
    { name: "准时交付提升", value: 3.5, desc: "得益于插单优化算法，旺季订单交付率显著提升", type: "ok" },
    { name: "产能利用优化", value: 5.2, desc: "跨厂协同排程减少等待时间，整体效率提升", type: "ok" }
  ];
}

function buildPerformance() {
  return [
    { name: "OEE", target: 90, actual: 88.7 },
    { name: "准时交付", target: 95, actual: 94.2 },
    { name: "产能利用", target: 85, actual: 91.3 },
    { name: "质量合格率", target: 99, actual: 98.6 }
  ];
}

function buildLocks() {
  return [
    { line: "ZZW03", user: "张三", time: "08:15" },
    { line: "ZZW07", user: "李四", time: "08:22" },
    { line: "ZZW12", user: "王五", time: "08:30" }
  ];
}

function buildSettingsUsers(count = 50) {
  const seed = [
    { id: "U001", account: "admin", name: "系统管理员", role: "管理员", email: "admin@gree.com.cn", status: "启用", lastLogin: "2026-02-28 09:15" },
    { id: "U002", account: "planner_wang", name: "王计划", role: "计划员", email: "wang.plan@gree.com.cn", status: "启用", lastLogin: "2026-02-28 08:47" },
    { id: "U003", account: "workshop_li", name: "李车间", role: "车间主管", email: "li.ws@gree.com.cn", status: "禁用", lastLogin: "2026-02-27 18:03" }
  ];
  if (count <= seed.length) return seed.slice(0, count);

  const roles = ["计划员", "车间主管", "计划员", "管理员"];
  const statusCycle = ["启用", "启用", "启用", "禁用", "启用"];
  const users = [...seed];
  for (let i = seed.length + 1; i <= count; i += 1) {
    const seq = padNumber(i, 3);
    const day = padNumber(26 + (i % 3), 2);
    const hour = padNumber(8 + (i % 10), 2);
    const minute = padNumber((i * 7) % 60, 2);
    users.push({
      id: `U${seq}`,
      account: `user_${seq}`,
      name: `用户${seq}`,
      role: roles[(i - 1) % roles.length],
      email: `user_${seq}@gree.com.cn`,
      status: statusCycle[(i - 1) % statusCycle.length],
      lastLogin: `2026-02-${day} ${hour}:${minute}`
    });
  }
  return users;
}

function buildSettingsAuditLogs(count = 50) {
  const modules = ["账号", "排程", "规则", "资源"];
  const users = ["admin", "planner_wang", "workshop_li", "planner_zhou", "ops_chen"];
  const accountActions = ["新增账号", "重置密码", "禁用账号", "启用账号"];
  const scheduleActions = ["执行 Forward-ASAP", "调整工序顺序", "发布日排程", "锁定瓶颈资源"];
  const ruleActions = ["修改旺季参数组", "发布排程策略", "调整插单阈值", "更新交期惩罚系数"];
  const resourceActions = ["编辑设备", "更新模具", "同步人员资质", "更新外协厂商评分"];
  const secondStep = 173;
  const baseSeconds = 9 * 3600 + 30 * 60;

  function buildChangeDetail(module, actionIndex, i, seq) {
    if (module === "账号") {
      if (actionIndex === 0) {
        return { beforeValue: "账号列表: 42人", afterValue: "账号列表: 43人" };
      }
      if (actionIndex === 1) {
        return { beforeValue: `user_${seq} 密码版本:v2`, afterValue: `user_${seq} 密码版本:v3` };
      }
      if (actionIndex === 2) {
        return { beforeValue: `user_${seq} 状态:启用`, afterValue: `user_${seq} 状态:禁用` };
      }
      return { beforeValue: `user_${seq} 状态:禁用`, afterValue: `user_${seq} 状态:启用` };
    }

    if (module === "排程") {
      const beforeStart = 8 + (i % 3);
      const afterStart = beforeStart - 1;
      if (actionIndex === 0) {
        return {
          beforeValue: "模式: Backward-JIT, 达成率: 92.8%",
          afterValue: "模式: Forward-ASAP, 达成率: 94.1%"
        };
      }
      if (actionIndex === 1) {
        return {
          beforeValue: `WO-${7000 + i} 开始:${padNumber(beforeStart, 2)}:00`,
          afterValue: `WO-${7000 + i} 开始:${padNumber(afterStart, 2)}:00`
        };
      }
      if (actionIndex === 2) {
        return {
          beforeValue: "计划状态: 草稿",
          afterValue: "计划状态: 已发布"
        };
      }
      return {
        beforeValue: "瓶颈资源锁定: 2条",
        afterValue: "瓶颈资源锁定: 3条"
      };
    }

    if (module === "规则") {
      if (actionIndex === 0) {
        return { beforeValue: "交期权重: 68%", afterValue: "交期权重: 72%" };
      }
      if (actionIndex === 1) {
        return { beforeValue: "策略版本: V3.5", afterValue: "策略版本: V3.6" };
      }
      if (actionIndex === 2) {
        return { beforeValue: "插单阈值: 12%", afterValue: "插单阈值: 10%" };
      }
      return { beforeValue: "换产惩罚系数: 1.20", afterValue: "换产惩罚系数: 1.05" };
    }

    if (actionIndex === 0) {
      return { beforeValue: "设备状态: 待维护", afterValue: "设备状态: 正常" };
    }
    if (actionIndex === 1) {
      return { beforeValue: "模具寿命: 81%", afterValue: "模具寿命: 95%" };
    }
    if (actionIndex === 2) {
      return { beforeValue: "人员资质: 48人", afterValue: "人员资质: 52人" };
    }
    return { beforeValue: "外协评分: 83", afterValue: "外协评分: 87" };
  }

  return Array.from({ length: count }, (_, i) => {
    const module = modules[i % modules.length];
    const actionIndex = Math.floor(i / modules.length) % 4;
    const seq = padNumber((i % 47) + 4, 3);
    let action = "";
    if (module === "账号") action = `${accountActions[actionIndex]} user_${seq}`;
    if (module === "排程") action = scheduleActions[actionIndex];
    if (module === "规则") action = ruleActions[actionIndex];
    if (module === "资源") {
      if (actionIndex === 0) action = `${resourceActions[actionIndex]} EQ-${padNumber((i % 120) + 1, 4)}`;
      if (actionIndex === 1) action = `${resourceActions[actionIndex]} M-${padNumber(1000 + (i % 120), 4)}`;
      if (actionIndex === 2) action = `${resourceActions[actionIndex]} P${padNumber(1000 + (i % 120), 5)}`;
      if (actionIndex === 3) action = resourceActions[actionIndex];
    }
    const timeSeconds = baseSeconds - i * secondStep;
    const hour = Math.floor(timeSeconds / 3600);
    const minute = Math.floor((timeSeconds % 3600) / 60);
    const second = timeSeconds % 60;
    const changeDetail = buildChangeDetail(module, actionIndex, i, seq);
    return {
      time: `2026-02-28 ${padNumber(hour, 2)}:${padNumber(minute, 2)}:${padNumber(second, 2)}`,
      user: users[i % users.length],
      module,
      action,
      beforeValue: changeDetail.beforeValue,
      afterValue: i % 9 === 0 ? `${changeDetail.beforeValue}（未生效）` : changeDetail.afterValue,
      result: i % 9 === 0 ? "失败" : "成功"
    };
  });
}

function syncUserDropdownA11y() {
  const dropdown = document.getElementById('user-dropdown');
  if (!dropdown) return;
  const toggle = dropdown.querySelector('.user-dropdown-toggle');
  const menu = dropdown.querySelector('.user-dropdown-menu');
  if (toggle) {
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-haspopup', 'menu');
    if (menu) {
      if (!menu.id) {
        menu.id = 'user-dropdown-menu';
      }
      toggle.setAttribute('aria-controls', menu.id);
    }
    toggle.setAttribute('aria-expanded', dropdown.classList.contains('open') ? 'true' : 'false');
  }
}

function isNativeInteractive(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'BUTTON'
    || tag === 'A'
    || tag === 'INPUT'
    || tag === 'SELECT'
    || tag === 'TEXTAREA'
    || tag === 'SUMMARY';
}

function makeOnclickElementKeyboardAccessible(el) {
  if (!(el instanceof HTMLElement) || isNativeInteractive(el)) return;
  if (!el.hasAttribute('role')) {
    el.setAttribute('role', 'button');
  }
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '0');
  }
  if (el.dataset.keyActivated === 'true') return;
  el.dataset.keyActivated = 'true';
  el.addEventListener('keydown', (evt) => {
    if (evt.key !== 'Enter' && evt.key !== ' ') return;
    evt.preventDefault();
    el.click();
  });
}

function enhanceClickAccessibility(root = document) {
  const targets = root.querySelectorAll('[onclick], .user-dropdown-toggle');
  targets.forEach((el) => makeOnclickElementKeyboardAccessible(el));
  syncUserDropdownA11y();
  ensureFormControlLabels(root);
}

function ensureClickAccessibilityObserver() {
  if (clickA11yObserver || !document.body) return;
  clickA11yObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('[onclick], .user-dropdown-toggle')) {
          makeOnclickElementKeyboardAccessible(node);
        }
        enhanceClickAccessibility(node);
        ensureFormControlLabels(node);
      });
    });
  });
  clickA11yObserver.observe(document.body, { childList: true, subtree: true });
}

// 用户下拉菜单切换
function toggleUserDropdown(forceOpen) {
  const dropdown = document.getElementById('user-dropdown');
  if (!dropdown) return;
  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !dropdown.classList.contains('open');
  dropdown.classList.toggle('open', shouldOpen);
  syncUserDropdownA11y();
}

// 点击外部关闭用户下拉菜单
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    toggleUserDropdown(false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    toggleUserDropdown(false);
  }
});

function init(options = {}) {
  const force = options.force === true;
  if (commonInitialized && !force) {
    updateHeaderDateText();
    enhanceClickAccessibility(document);
    ensureClickAccessibilityObserver();
    return;
  }
  commonInitialized = true;
  state.ganttTasks = buildInitialGanttTasks();
  state.decisionTasks = buildInitialDecisionTasks();
  state.orders = buildOrders();
  state.bomTree = buildBomTree();
  state.inventory = buildInventory();
  state.inserts = buildInserts();
  state.hardRules = buildHardRules();
  state.softScores = buildSoftScores();
  state.leadTimes = buildLeadTimes();
  state.alerts = buildAlerts();
  state.flowData = buildFlowData();
  state.attribution = buildAttribution();
  state.performance = buildPerformance();
  state.locks = buildLocks();
  state.resourceRecords = buildResourceRecords();
  state.settingsUsers = buildSettingsUsers();
  state.settingsAuditLogs = buildSettingsAuditLogs();

  updateHeaderDateText();
  if (headerDateTimer) {
    clearInterval(headerDateTimer);
    headerDateTimer = null;
  }
  if (document.getElementById('header-date')) {
    headerDateTimer = setInterval(updateHeaderDateText, 1000);
  }
  ensureSkipLink();
  enhanceClickAccessibility(document);
  ensureFormControlLabels(document);
  ensureClickAccessibilityObserver();
}

// AI Assistant Functions
function initAIAssistant() {
  if (document.getElementById('ai-assistant-backdrop')) {
    return;
  }

  // Create AI Assistant Button
  const btn = document.createElement('button');
  btn.id = 'ai-assistant-trigger';
  btn.className = 'ai-assistant-btn';
  btn.title = 'AI助手';
  btn.setAttribute('aria-label', 'AI排程助手');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-controls', 'ai-assistant-modal');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<img class="ai-assistant-icon" src="AI助手.svg" alt="AI排程助手图标" width="44" height="44" />';
  btn.onclick = toggleAIAssistant;
  document.body.appendChild(btn);

  // Create AI Assistant Backdrop + Modal
  const backdrop = document.createElement('div');
  backdrop.className = 'ai-assistant-backdrop';
  backdrop.id = 'ai-assistant-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.onclick = (e) => {
    if (e.target === backdrop) {
      toggleAIAssistant(false);
    }
  };

  const modal = document.createElement('div');
  modal.className = 'ai-assistant-modal';
  modal.id = 'ai-assistant-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'ai-assistant-title-text');
  modal.innerHTML = `
    <div class="ai-assistant-header">
      <div class="ai-assistant-title">
        <span>🤖</span>
        <span id="ai-assistant-title-text">AI排程助手</span>
      </div>
      <button type="button" class="ai-assistant-close" aria-label="关闭AI助手" onclick="toggleAIAssistant()">×</button>
    </div>
    <div class="ai-assistant-body" id="ai-chat-body"></div>
    <div class="ai-assistant-footer">
      <div class="ai-input-row">
        <input type="text" class="ai-assistant-input" id="ai-chat-input" placeholder="请输入您的问题..." onkeydown="handleAIInputKeydown(event)">
        <button type="button" class="ai-assistant-send" aria-label="发送消息" onclick="sendAIMessage()">➤</button>
      </div>
    </div>
  `;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.addEventListener('keydown', handleAIAssistantKeydown);

  // Add welcome message
  setTimeout(() => {
    addAIMessage('ai', '您好！我是格力APS智能助手，可以帮您分析排产情况、提供优化建议或执行排程操作。有什么可以帮您的吗？');
  }, 500);
}

function toggleAIAssistant(forceOpen) {
  const backdrop = document.getElementById('ai-assistant-backdrop');
  if (!backdrop) return;

  const shouldOpen = typeof forceOpen === 'boolean'
    ? forceOpen
    : !backdrop.classList.contains('open');

  backdrop.classList.toggle('open', shouldOpen);
  backdrop.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
  document.body.classList.toggle('ai-modal-open', shouldOpen);
  const triggerBtn = document.getElementById('ai-assistant-trigger');
  if (triggerBtn) {
    triggerBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  }

  if (shouldOpen) {
    aiAssistantLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTimeout(() => {
      const input = document.getElementById('ai-chat-input');
      if (input) input.focus();
    }, 30);
  } else if (aiAssistantLastFocus) {
    aiAssistantLastFocus.focus();
    aiAssistantLastFocus = null;
  }
}

function handleAIAssistantKeydown(e) {
  const backdrop = document.getElementById('ai-assistant-backdrop');
  if (!backdrop || !backdrop.classList.contains('open')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    toggleAIAssistant(false);
    return;
  }

  if (e.key === 'Tab') {
    const focusables = backdrop.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function addAIMessage(sender, text) {
  const body = document.getElementById('ai-chat-body');
  if (!body) return;

  if (sender === 'ai') {
    body.querySelectorAll('.ai-preset-cards').forEach((el) => el.remove());
  }

  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const cardsHtml = sender === 'ai' ? `
      <div class="ai-preset-cards">
        <button class="ai-preset-card" onclick="sendAIQuickMessage('排程优化建议')">排程优化建议</button>
        <button class="ai-preset-card" onclick="sendAIQuickMessage('深度自主规划')">深度自主规划</button>
        <button class="ai-preset-card" onclick="sendAIQuickMessage('生成当日报告')">生成当日报告</button>
      </div>
  ` : '';
  const content = sender === 'user' ? escapeHTML(text).replace(/\n/g, '<br>') : text;

  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-message ${sender}`;
  messageDiv.innerHTML = `
    <div class="ai-message-avatar">${sender === 'ai' ? 'AI' : '我'}</div>
    <div class="ai-message-main">
      <div class="ai-message-content">${content}</div>
      <div class="ai-message-time">${time}</div>
      ${cardsHtml}
    </div>
  `;
  body.appendChild(messageDiv);
  body.scrollTop = body.scrollHeight;
}

function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  addAIMessage('user', text);
  input.value = '';
  queueAIResponse(text);
}

function sendAIQuickMessage(text) {
  addAIMessage('user', text);
  queueAIResponse(text);
}

function queueAIResponse(text) {
  const sendBtn = document.querySelector('.ai-assistant-send');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = '...';
  }

  setTimeout(() => {
    const response = generateAIResponse(text);
    addAIMessage('ai', response);
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = '➤';
    }
  }, 800);
}

function handleAIInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendAIMessage();
  }
}
const handleAIInputKeypress = handleAIInputKeydown;

function generateAIResponse(input) {
  const responses = {
    '分析当前排产瓶颈': '经过分析，当前排产存在以下瓶颈：<br>1. <b>东区总装</b>：设备利用率92%，存在2小时产能缺口<br>2. <b>注塑分厂</b>：模具M-1002寿命仅剩45%，建议更换<br>3. <b>压缩机</b>：库存缺口180件，影响5个订单交付<br><br>建议优先处理压缩机缺料问题。',
    '排程优化建议': '基于当前排程数据，AI给出以下优化建议：<br>1. 将SO-20260227-018订单调整至西区总装生产，可减少等待时间30分钟<br>2. 建议开启注塑分厂夜班模式，提升产能15%<br>3. 外协厂商-003可承接200套/日产能，建议启用',
    '深度自主规划': '已启动深度自主规划：<br><br>1. 自动识别瓶颈工序与缺料约束，完成优先级重算<br>2. 生成总装与配套厂联动排程路径，预估交付达成率提升至95.1%<br>3. 输出3套可执行方案（交期优先 / 成本优先 / 均衡优先）<br><br>建议先应用“均衡优先”方案进行试运行。',
    '优化建议': '基于当前排程数据，AI给出以下优化建议：<br>1. 将SO-20260227-018订单调整至西区总装生产，可减少等待时间30分钟<br>2. 建议开启注塑分厂夜班模式，提升产能15%<br>3. 外协厂商-003可承接200套/日产能，建议启用',
    '重排方案': '已为您生成3套重排方案：<br><br><b>方案A（平衡模式）</b>：均衡各产线负载，预计OEE提升3.2%<br><b>方案B（交期优先）</b>：优先保障战略订单，可能影响OEE 1.5%<br><b>方案C（成本优先）</b>：最小化换产次数，降低换产成本20%<br><br>请点击「应用方案」选择执行。',
    '生成当日报告': '正在生成当日排程报告...<br><br>📊 <b>生产日报（2026-02-28）</b><br>━━━━━━━━━━━━━━━━━━<br>• 计划完成率：76.7% (92/120)<br>• 在制订单：34个<br>• 异常报警：3条（已解决2条）<br>• OEE：88.4%<br>• 准时交付预测：94.2%<br><br>报告已生成，可导出PDF。'
  };

  // Check for keywords
  for (const key in responses) {
    if (input.includes(key) || key.includes(input)) {
      return responses[key];
    }
  }

  // Default responses
  const defaults = [
    '收到您的询问，正在分析排程数据...<br><br>根据当前系统状态，建议关注东区总装的产能瓶颈和注塑分厂的模具寿命预警。',
    '我理解您的问题。基于APS系统的实时数据，目前整体排程平稳运行，OEE保持在88%以上。<br><br>如需详细分析，请尝试点击快捷问题按钮。',
    '好的，已记录您的需求。AI助手会持续监控排程状态，如有异常会第一时间提醒您。<br><br>您还可以使用下方预设：排程优化建议、深度自主规划、生成当日报告。'
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// Scheduling Functions
function rescheduleOrders() {
  toast('正在执行智能重排...');
  setTimeout(() => {
    // Randomize task positions
    if (state.decisionTasks) {
      state.decisionTasks.forEach(task => {
        task.start = Math.floor(Math.random() * 20);
        task.duration = 2 + Math.floor(Math.random() * 4);
      });
    }
    // Refresh display
    if (typeof renderDecisionGanttLanes === 'function') {
      renderDecisionGanttLanes();
    }
    toast('重排完成！OEE预计提升 2.3%');
  }, 1000);
}

function adjustSchedule(taskId, newStart, newDuration) {
  const task = state.decisionTasks?.find(t => t.id === taskId);
  if (task) {
    task.start = newStart;
    task.duration = newDuration;
    toast(`任务 ${task.name} 已调整`);
    if (typeof renderDecisionGanttLanes === 'function') {
      renderDecisionGanttLanes();
    }
  }
}

function diagnoseSchedule() {
  const issues = [];
  
  // Check for overlapping tasks
  const plants = ['东区总装', '西区总装', '注塑分厂', '两器分厂', '控制器分厂'];
  plants.forEach((plant, lineIdx) => {
    const tasks = state.decisionTasks?.filter(t => t.line === lineIdx) || [];
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const t1 = tasks[i];
        const t2 = tasks[j];
        if (t1.start < t2.start + t2.duration && t2.start < t1.start + t1.duration) {
          issues.push(`${plant}: ${t1.name} 与 ${t2.name} 存在时间冲突`);
        }
      }
    }
  });

  // Check inventory shortages
  const shortages = state.inventory?.filter(i => i.stock < i.required) || [];
  shortages.forEach(s => {
    issues.push(`物料短缺: ${s.name} 缺口 ${s.required - s.stock}`);
  });

  if (issues.length === 0) {
    return { ok: true, message: '排程诊断完成：未发现异常，当前排程合理。' };
  }
  
  return { ok: false, issues };
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  initAIAssistant();
});
