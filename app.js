// --- State Management ---
const state = {
    orders: [],
    scheduleData: [],
    devices: [
        { id: 'line_A1', name: '内机总装A', type: 'internal', status: 'free' },
        { id: 'line_A2', name: '内机总装B', type: 'internal', status: 'free' },
        { id: 'line_B1', name: '外机总装A', type: 'external', status: 'free' },
        { id: 'line_B2', name: '外机总装B', type: 'external', status: 'free' },
    ],
    agents: [
        { id: 'order_agent', name: '订单分析Agent', desc: '优先级排序' },
        { id: 'resource_agent', name: '资源分配Agent', desc: '设备匹配' },
        { id: 'material_agent', name: '物料协同Agent', desc: '库存检查' },
        { id: 'diagnosis_agent', name: '诊断Agent', desc: '瓶颈分析' }
    ],
    exceptions: [],
    resourceLimits: [],
    shellLimits: [],
    materialAlerts: [
        { item: 'ABS原料', qty: 120, critical: 50, status: 'low' },
        { item: '电机MTR-01', qty: 30, critical: 80, status: 'critical' },
        { item: '电路板PCB', qty: 200, critical: 100, status: 'ok' },
        { item: '冷凝器', qty: 5, critical: 20, status: 'critical' }
    ],
    dataSources: [
        { id: 'erp', name: 'ERP系统', type: 'SAP', status: 'connected', lastSync: '2025-12-17 10:30', tables: 15, records: 15230 },
        { id: 'mes', name: 'MES系统', type: '数据库', status: 'connected', lastSync: '2025-12-17 09:45', tables: 8, records: 8450 },
        { id: 'wms', name: 'WMS系统', type: 'WebService', status: 'connected', lastSync: '2025-12-17 11:20', tables: 6, records: 6780 },
        { id: 'qms', name: '质量系统', type: '文件接口', status: 'connected', lastSync: '2025-12-16 16:15', tables: 3, records: 3210 },
        { id: 'scm', name: '供应链系统', type: 'API', status: 'disconnected', lastSync: '2025-12-15 14:00', tables: 5, records: 4500 },
        { id: 'crm', name: 'CRM系统', type: 'API', status: 'syncing', lastSync: '2025-12-17 13:00', tables: 4, records: 2800 }
    ],
    dataTables: [
        { name: '制造 BOM 表', source: 'ERP系统', records: 1523, lastSync: '2025-12-17 10:30', fields: 25, status: 'active' },
        { name: '品目表', source: 'ERP系统', records: 845, lastSync: '2025-12-17 10:28', fields: 18, status: 'active' },
        { name: '订单表', source: 'ERP系统', records: 5230, lastSync: '2025-12-17 10:25', fields: 32, status: 'active' },
        { name: '生产日历表', source: 'MES系统', records: 365, lastSync: '2025-12-17 09:45', fields: 12, status: 'active' },
        { name: '资源表', source: 'MES系统', records: 48, lastSync: '2025-12-17 09:40', fields: 15, status: 'active' },
        { name: '销售急售表', source: 'CRM系统', records: 156, lastSync: '2025-12-17 13:00', fields: 8, status: 'syncing' },
        { name: '物料配套表', source: 'WMS系统', records: 2345, lastSync: '2025-12-17 11:20', fields: 20, status: 'active' },
        { name: '配套结果表', source: 'WMS系统', records: 1234, lastSync: '2025-12-17 11:18', fields: 16, status: 'active' }
    ],
    dragItems: [
        { id: 'ORD-1001', name: 'ORD-1001 - 内机挂机 (50件)', resource: '内机总装A' },
        { id: 'ORD-1002', name: 'ORD-1002 - 外机压缩机 (30件)', resource: '外机总装A' },
        { id: 'ORD-1003', name: 'ORD-1003 - 冷凝器 (100件)', resource: '钣金线' }
    ]
};

// --- View Router ---
function switchView(viewId, navEl) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    
    // 更新导航栏激活状态
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navEl && !navEl.classList.contains('nav-with-dropdown')) {
        navEl.classList.add('active');
    }
    
    // 如果是基础数据页面，默认显示用户管理
    if (viewId === 'basicdata') {
        switchBasicData('users');
    }

    if (viewId === 'scheduler') renderScheduler();
    if (viewId === 'dashboard') { 
        updateDashboardKPIs(); 
        renderScheduleTable(); 
        renderMaterialAlerts(); 
        updateInfoGrid(); 
    }
    if (viewId === 'integration') { 
        renderDataSources(); 
        renderIntegrationTables(); 
    }
    if (viewId === 'config') renderLimits();
    if (viewId === 'ai') {
        setupAIControls();
        // 初始化拖动功能
        initDragAndDrop();
    }
}

// --- 基础数据管理切换 ---
function switchBasicData(dataType, sidebarEl) {
    // 更新侧边栏激活状态
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    if (sidebarEl) sidebarEl.classList.add('active');
    
    // 显示对应的数据管理部分
    document.querySelectorAll('.data-management-section').forEach(el => {
        el.classList.remove('active');
        el.classList.remove('fade-in');
    });
    
    const targetSection = document.getElementById('data-' + dataType);
    if (targetSection) {
        targetSection.classList.add('active');
        setTimeout(() => targetSection.classList.add('fade-in'), 10);
    }
}

// --- 基础数据管理函数 ---
function addNewUser() {
    showToast("打开新增用户表单");
    addMessage('打开用户管理 - 新增用户', 'system');
}

function editUser(userId) {
    showToast(`编辑用户: ${userId}`);
    addMessage(`编辑用户 ${userId}`, 'system');
}

async function deleteUser(userId) {
    const confirmed = typeof showConfirmDialog === 'function'
        ? await showConfirmDialog({
            title: '确认删除用户',
            message: `确定要删除用户 ${userId} 吗？`,
            confirmText: '确认删除',
            cancelText: '取消',
            confirmType: 'danger'
        })
        : false;
    if (confirmed) {
        showToast(`用户 ${userId} 已删除`);
        addMessage(`删除用户 ${userId}`, 'system');
    }
}

function addNewWorkshop() {
    showToast("打开新增车间表单");
    addMessage('打开车间管理 - 新增车间', 'system');
}

function editWorkshop(workshopId) {
    showToast(`编辑车间: ${workshopId}`);
    addMessage(`编辑车间 ${workshopId}`, 'system');
}

function viewWorkshopDetail(workshopId) {
    showToast(`查看车间详情: ${workshopId}`);
    addMessage(`查看车间 ${workshopId} 详情`, 'system');
}

function addNewResource() {
    showToast("打开新增资源表单");
    addMessage('打开资源管理 - 新增资源', 'system');
}

function editResource(resourceId) {
    showToast(`编辑资源: ${resourceId}`);
    addMessage(`编辑资源 ${resourceId}`, 'system');
}

function viewResourceDetail(resourceId) {
    showToast(`查看资源详情: ${resourceId}`);
    addMessage(`查看资源 ${resourceId} 详情`, 'system');
}

function addNewRule() {
    showToast("打开新增规则表单");
    addMessage('打开规则管理 - 新增规则', 'system');
}

function editRule(ruleId) {
    showToast(`编辑规则: ${ruleId}`);
    addMessage(`编辑规则 ${ruleId}`, 'system');
}

function toggleRuleStatus(ruleId) {
    showToast(`切换规则 ${ruleId} 状态`);
    addMessage(`切换规则 ${ruleId} 状态`, 'system');
}

// --- Dashboard Specific Functions ---
function updateInfoGrid() {
    // Update Material Alerts
    const alertsContainer = document.getElementById('material-alerts');
    const alertCount = document.getElementById('alert-count');
    const criticalItems = state.materialAlerts.filter(a => a.status === 'critical');
    
    alertCount.innerText = criticalItems.length;
    alertsContainer.innerHTML = criticalItems.length 
        ? criticalItems.map(a => `<div class="alert-item">${a.item}: 库存 ${a.qty} (临界 ${a.critical})</div>`).join('')
        : '<div style="color:var(--ok); font-size:11px; padding:4px;">暂无短缺预警</div>';

    // Update Stats
    document.getElementById('stat-new').innerText = Math.floor(Math.random() * 20 + 5);
    document.getElementById('stat-urgent').innerText = Math.floor(Math.random() * 5 + 1);
    document.getElementById('stat-done').innerText = Math.floor(Math.random() * 50 + 30);

    // Update Optimization Tips (Dynamic)
    const tips = [
        { text: "建议启用外机B线分流", type: "info" },
        { text: "内机总装A等待时间过长", type: "warn" },
        { text: "优化后预计节省 15% 等待时间", type: "ok" }
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const tipsContainer = document.getElementById('optimization-tips');
    tipsContainer.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); line-height: 1.4;">
        <div style="margin-bottom:4px;">• <span style="color: var(--${tip.type === 'ok' ? 'ok' : tip.type === 'warn' ? 'warn' : 'info'})">${tip.type === 'ok' ? '优化' : tip.type === 'warn' ? '警告' : '建议'}</span>: ${tip.text}</div>
    </div>`;
}

function renderMaterialAlerts() {
    updateInfoGrid(); 
}

function renderScheduleTable() {
    const tbody = document.getElementById('schedule-tbody');
    const emptyMsg = document.getElementById('no-schedule-msg');
    
    if (state.scheduleData.length === 0) {
        // Generate initial data
        for(let i = 0; i < 8; i++) {
            const now = new Date();
            const startDate = new Date(now.getTime() + i * 60 * 60 * 1000);
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
            
            const row = {
                resource: i % 4 === 0 ? '内机总装A' : i % 4 === 1 ? '外机总装A' : i % 4 === 2 ? '钣金线' : '注塑机',
                order: `ORD-${1001 + i}`,
                product: i % 3 === 0 ? 'KFR-35GW' : i % 3 === 1 ? 'KFR-50GW' : 'KFR-72GW',
                material: i % 3 === 0 ? '内机挂机' : i % 3 === 1 ? '外机压缩机' : '冷凝器',
                qty: Math.floor(Math.random() * 50 + 10),
                shell: i % 4 === 0 ? 'ABS' : i % 4 === 1 ? '金属' : i % 4 === 2 ? '定制' : '塑料',
                pipe: i % 3 === 0 ? '6.35' : i % 3 === 1 ? '9.52' : '12.7',
                start: startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                end: endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                status: i < 2 ? 'Running' : i < 5 ? 'Wait' : 'Done'
            };
            state.scheduleData.push(row);
        }
    }
    
    emptyMsg.style.display = 'none';
    tbody.innerHTML = state.scheduleData.map((row, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><span class="tag internal">${row.resource}</span></td>
            <td>${row.order}</td>
            <td>${row.product}</td>
            <td>${row.material}</td>
            <td>${row.qty}</td>
            <td>${row.shell}</td>
            <td>${row.pipe}</td>
            <td>${row.start}</td>
            <td>${row.end}</td>
            <td><span class="status-badge ${row.status === 'Running' ? 'status-run' : row.status === 'Done' ? 'status-done' : 'status-wait'}">${row.status}</span></td>
        </tr>
    `).join('');
    
    setTimeout(() => {
        const progress = document.getElementById('prod-progress');
        if(progress) progress.style.width = (Math.random() * 40 + 50) + '%';
    }, 100);
}

function refreshScheduleTable() {
    if (state.scheduleData.length < 5) {
        const now = new Date();
        const startStr = now.toTimeString().slice(0,5);
        now.setMinutes(now.getMinutes() + 30);
        const endStr = now.toTimeString().slice(0,5);
        
        state.scheduleData.push({
            resource: Math.random() > 0.5 ? '内机总装A' : '外机总装A',
            order: `ORD-${Math.floor(Math.random()*9000)+1000}`,
            product: 'KFR-35GW',
            material: '内机挂机',
            qty: Math.floor(Math.random() * 50 + 10),
            shell: 'ABS',
            pipe: '6.35',
            start: startStr,
            end: endStr,
            status: 'Wait'
        });
    } else {
        state.scheduleData.forEach(d => {
            if (d.status === 'Wait') d.status = 'Running';
            else if (d.status === 'Running') d.status = 'Done';
            else d.status = 'Wait';
        });
    }
    renderScheduleTable();
    showToast("排产表数据已更新");
}

function generateOptimizedSchedule() {
    addMessage('触发：优化排产生成', 'system');
    setTimeout(() => {
        state.scheduleData = [];
        for(let i=0; i<8; i++) {
            refreshScheduleTable();
        }
        showToast("优化排产完成");
        const dash = document.getElementById('view-dashboard');
        if (!dash.classList.contains('active')) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            dash.classList.add('active');
            document.querySelectorAll('.nav-item')[0].classList.add('active');
        }
    }, 1000);
}

function exportScheduleTable() {
    showToast("排产表数据已导出为Excel文件");
}

// --- Data Integration Functions ---
function renderDataSources() {
    const container = document.getElementById('data-source-list');
    container.innerHTML = state.dataSources.map(source => `
        <div class="data-source-card">
            <div class="data-source-header">
                <div class="data-source-name">
                    <span>${source.name}</span>
                    <span class="tag db">${source.type}</span>
                </div>
                <div class="data-source-status">
                    <div class="status-indicator ${source.status}"></div>
                    <span>${source.status === 'connected' ? '已连接' : source.status === 'disconnected' ? '断开' : '同步中'}</span>
                </div>
            </div>
            <div class="data-source-info">
                <div class="data-source-info-item">
                    <div class="data-source-info-label">最后同步</div>
                    <div class="data-source-info-value">${source.lastSync}</div>
                </div>
                <div class="data-source-info-item">
                    <div class="data-source-info-label">数据表</div>
                    <div class="data-source-info-value">${source.tables} 个</div>
                </div>
                <div class="data-source-info-item">
                    <div class="data-source-info-label">总记录</div>
                    <div class="data-source-info-value">${source.records.toLocaleString()}</div>
                </div>
                <div class="data-source-info-item">
                    <div class="data-source-info-label">同步状态</div>
                    <div class="data-source-info-value">
                        <span style="color: ${source.status === 'connected' ? 'var(--ok)' : source.status === 'disconnected' ? 'var(--error)' : 'var(--warn)'}">
                            ${source.status === 'connected' ? '正常' : source.status === 'disconnected' ? '异常' : '同步中'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="data-source-actions">
                <button class="btn sm ${source.status === 'connected' ? 'success' : 'primary'}" onclick="syncDataSource('${source.id}')">
                    ${source.status === 'connected' ? '重新同步' : '连接'}
                </button>
                <button class="btn sm" onclick="showDataSourceDetails('${source.id}')">详情</button>
                <button class="btn sm" onclick="testDataSource('${source.id}')">测试</button>
            </div>
        </div>
    `).join('');
}

function renderIntegrationTables() {
    const tbody = document.getElementById('integration-tbody');
    tbody.innerHTML = state.dataTables.map(table => `
        <tr>
            <td><strong>${table.name}</strong></td>
            <td>${table.source}</td>
            <td>${table.records.toLocaleString()}</td>
            <td>${table.lastSync}</td>
            <td>${table.fields}</td>
            <td>
                <span class="tag ${table.status === 'active' ? 'success' : table.status === 'syncing' ? 'priority' : 'alert'}">
                    ${table.status === 'active' ? '正常' : table.status === 'syncing' ? '同步中' : '异常'}
                </span>
            </td>
            <td>
                <button class="btn sm" onclick="previewTable('${table.name}')">预览</button>
                <button class="btn sm primary" onclick="syncTable('${table.name}')">同步</button>
            </td>
        </tr>
    `).join('');
}

function syncDataSource(sourceId) {
    const source = state.dataSources.find(s => s.id === sourceId);
    if (!source) return;
    
    source.status = 'syncing';
    showToast(`开始同步 ${source.name}...`);
    
    setTimeout(() => {
        source.status = 'connected';
        source.lastSync = new Date().toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit'});
        source.records = Math.floor(source.records * (1 + Math.random() * 0.1));
        
        renderDataSources();
        showToast(`${source.name} 同步完成`);
    }, 1500);
}

function syncAllDataSources() {
    showToast("开始同步所有数据源...");
    state.dataSources.forEach(source => {
        if (source.status !== 'disconnected') {
            source.status = 'syncing';
        }
    });
    
    renderDataSources();
    
    setTimeout(() => {
        state.dataSources.forEach(source => {
            if (source.status !== 'disconnected') {
                source.status = 'connected';
                source.lastSync = new Date().toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit'});
                source.records = Math.floor(source.records * (1 + Math.random() * 0.05));
            }
        });
        
        renderDataSources();
        showToast("所有数据源同步完成");
    }, 3000);
}

function refreshDataTables() {
    showToast("数据表已刷新");
    renderIntegrationTables();
}

function showMappingConfig() {
    addMessage('数据映射配置功能正在开发中...', 'ai');
}

function previewTable(tableName) {
    addMessage(`正在预览 ${tableName} 的数据...`, 'system');
    showToast(`已打开 ${tableName} 数据预览`);
}

function syncTable(tableName) {
    addMessage(`正在同步 ${tableName}...`, 'system');
    showToast(`${tableName} 同步开始`);
    
    setTimeout(() => {
        showToast(`${tableName} 同步完成`);
    }, 1000);
}

// --- AI Production Functions ---
function setupAIControls() {
    // Set default schedule time to tomorrow 8 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    
    const dateTimeInput = document.getElementById('schedule-time');
    const formattedDateTime = tomorrow.toISOString().slice(0, 16);
    dateTimeInput.value = formattedDateTime;
}

function runOneClickScheduling() {
    // Get selected parameters
    const scheduleTime = document.getElementById('schedule-time').value;
    const scheduleDays = document.getElementById('schedule-days').value;
    const scheduleMode = document.getElementById('schedule-mode').value;
    const workshopSelect = document.getElementById('workshop-select');
    const selectedWorkshops = Array.from(workshopSelect.selectedOptions).map(opt => opt.value);
    
    addMessage('用户触发：一键预排 & 诊断', 'system');
    addMessage(`参数设置：执行时间=${scheduleTime}，周期=${scheduleDays}天，模式=${getScheduleModeName(scheduleMode)}，车间=${selectedWorkshops.join(', ')}`, 'system');
    
    const diagDots = [
        document.getElementById('diag-dot-resource'),
        document.getElementById('diag-dot-material'),
        document.getElementById('diag-dot-conflict'),
        document.getElementById('diag-dot-constraint')
    ];
    diagDots.forEach(d => { d.className = 'diagnosis-dot'; });
    const diagContent = document.getElementById('diag-content');
    diagContent.innerHTML = "正在分析资源负载与物料齐套性...";
    
    setTimeout(() => {
        // Simulate diagnosis results
        const resourceOk = Math.random() > 0.2;
        const materialOk = Math.random() > 0.3;
        const conflictOk = Math.random() > 0.4;
        const constraintOk = Math.random() > 0.1;
        
        diagDots[0].classList.add(resourceOk ? 'ok' : 'error');
        diagDots[1].classList.add(materialOk ? 'ok' : 'error');
        diagDots[2].classList.add(conflictOk ? 'ok' : 'warn');
        diagDots[3].classList.add(constraintOk ? 'ok' : 'error');
        
        const issues = [];
        if (!resourceOk) issues.push("资源负载不均衡");
        if (!materialOk) issues.push("物料短缺");
        if (!conflictOk) issues.push("排产冲突");
        if (!constraintOk) issues.push("约束条件不满足");
        
        const hasIssues = issues.length > 0;
        
        diagContent.innerHTML = `
            <div style="margin-bottom:6px;">诊断结果: <span style="color: var(--${hasIssues ? 'error' : 'ok'})">${hasIssues ? '存在风险' : '通过'}</span></div>
            <div>排产模式: ${getScheduleModeName(scheduleMode)}</div>
            <div>${hasIssues ? '问题: ' + issues.join(', ') : '所有检查项正常'}</div>
            <div>建议: ${hasIssues ? '请根据问题调整排产参数' : '可立即执行排产'}</div>
        `;
        
        // Generate budget based on parameters
        const totalHours = scheduleDays * 8 * (selectedWorkshops.length || 1) * (scheduleMode === 'efficiency' ? 1.2 : 1);
        const materialCost = totalHours * 250 * (materialOk ? 1 : 1.3);
        
        const endDate = new Date(scheduleTime);
        endDate.setDate(endDate.getDate() + parseInt(scheduleDays));
        
        const bottlenecks = selectedWorkshops.length > 2 ? "多车间协同" : selectedWorkshops[0] || "总装";
        
        const budgetContent = document.getElementById('budget-content');
        budgetContent.innerHTML = `
            <div class="budget-row"><span>预计总工时</span><span class="budget-val">${totalHours.toFixed(1)} h</span></div>
            <div class="budget-row"><span>预计材料成本</span><span class="budget-val">${materialCost.toFixed(0)} ¥</span></div>
            <div class="budget-row"><span>预计交付日期</span><span class="budget-val">${endDate.toISOString().slice(0, 10)}</span></div>
            <div class="budget-row"><span>产能瓶颈</span><span class="budget-val">${bottlenecks}</span></div>
        `;
        
        addMessage('GREE AI 排产诊断与预算生成完成。', 'ai');
        
        // Update schedule table with new schedule
        if (!hasIssues) {
            setTimeout(() => {
                // Add a new schedule to the table
                const startDate = new Date(scheduleTime);
                const endDate = new Date(startDate.getTime() + totalHours * 60 * 60 * 1000);
                
                state.scheduleData.push({
                    resource: selectedWorkshops.length > 0 ? selectedWorkshops.map(w => getWorkshopName(w)).join(', ') : '总装',
                    order: `AI-${Date.now().toString().slice(-6)}`,
                    product: '智能排产',
                    material: '综合物料',
                    qty: Math.floor(totalHours / 2),
                    shell: '自动匹配',
                    pipe: '智能配置',
                    start: startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    end: endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    status: 'Wait'
                });
                
                renderScheduleTable();
                showToast("GREE AI 排产计划已生成并添加到排产表");
            }, 500);
        }
    }, 2000);
}

// --- 排产调整功能 ---
function runScheduleAdjustment() {
    const adjustmentSection = document.getElementById('adjustment-section');
    adjustmentSection.style.display = 'block';
    addMessage('打开排产调整功能', 'system');
    showToast("排产调整功能已启用");
}

function initDragAndDrop() {
    const dragContainer = document.getElementById('drag-container');
    if (!dragContainer) return;
    
    // 初始化拖动项
    dragContainer.innerHTML = state.dragItems.map(item => `
        <div class="drag-item" draggable="true" data-id="${item.id}">
            <span>${item.name}</span>
            <span class="tag ${item.resource.includes('内机') ? 'internal' : 'external'}">${item.resource}</span>
        </div>
    `).join('');
    
    // 添加拖动事件
    const dragItems = dragContainer.querySelectorAll('.drag-item');
    let draggedItem = null;
    
    dragItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            setTimeout(() => {
                this.style.opacity = '0.4';
            }, 0);
        });
        
        item.addEventListener('dragend', function(e) {
            setTimeout(() => {
                this.style.opacity = '1';
                draggedItem = null;
            }, 0);
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
        });
        
        item.addEventListener('dragenter', function(e) {
            e.preventDefault();
            if (this !== draggedItem) {
                this.style.borderColor = 'var(--primary)';
            }
        });
        
        item.addEventListener('dragleave', function(e) {
            this.style.borderColor = 'var(--border)';
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            if (this !== draggedItem) {
                const allItems = [...dragContainer.querySelectorAll('.drag-item')];
                const draggedIndex = allItems.indexOf(draggedItem);
                const targetIndex = allItems.indexOf(this);
                
                if (draggedIndex < targetIndex) {
                    this.after(draggedItem);
                } else {
                    this.before(draggedItem);
                }
                
                this.style.borderColor = 'var(--border)';
                showToast("订单顺序已调整");
            }
        });
    });
}

function applyDragAdjustment() {
    const dragContainer = document.getElementById('drag-container');
    const items = [...dragContainer.querySelectorAll('.drag-item')];
    const newOrder = items.map(item => item.getAttribute('data-id'));
    
    addMessage(`应用排产调整，新顺序: ${newOrder.join(' → ')}`, 'system');
    showToast("排产调整已应用");
    
    // 模拟更新排产表
    setTimeout(() => {
        state.scheduleData.sort((a, b) => {
            const aIndex = newOrder.indexOf(a.order) + 1;
            const bIndex = newOrder.indexOf(b.order) + 1;
            return (aIndex || 99) - (bIndex || 99);
        });
        renderScheduleTable();
        showToast("排产表已更新");
    }, 500);
}

function autoOptimizeSchedule() {
    addMessage('GREE AI 正在自动优化排产顺序...', 'system');
    
    setTimeout(() => {
        const dragContainer = document.getElementById('drag-container');
        const items = [...dragContainer.querySelectorAll('.drag-item')];
        
        // 模拟AI优化：按资源类型和数量排序
        items.sort((a, b) => {
            const aText = a.textContent;
            const bText = b.textContent;
            
            // 按资源类型排序（内机优先）
            const aIsInternal = aText.includes('内机');
            const bIsInternal = bText.includes('内机');
            if (aIsInternal && !bIsInternal) return -1;
            if (!aIsInternal && bIsInternal) return 1;
            
            // 按数量排序（数量少的优先）
            const aMatch = aText.match(/\((\d+)/);
            const bMatch = bText.match(/\((\d+)/);
            const aQty = aMatch ? parseInt(aMatch[1]) : 0;
            const bQty = bMatch ? parseInt(bMatch[1]) : 0;
            
            return aQty - bQty;
        });
        
        // 更新DOM顺序
        dragContainer.innerHTML = '';
        items.forEach(item => dragContainer.appendChild(item));
        
        addMessage('GREE AI 自动优化完成', 'ai');
        showToast("自动优化完成");
    }, 1000);
}

function swapAdjacentOrders() {
    const dragContainer = document.getElementById('drag-container');
    const items = [...dragContainer.querySelectorAll('.drag-item')];
    
    if (items.length < 2) {
        showToast("至少需要两个订单才能交换");
        return;
    }
    
    // 随机交换两个相邻订单
    const index = Math.floor(Math.random() * (items.length - 1));
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    
    // 更新DOM
    dragContainer.innerHTML = '';
    items.forEach(item => dragContainer.appendChild(item));
    
    addMessage(`交换相邻订单: ${items[index].getAttribute('data-id')} ↔ ${items[index + 1].getAttribute('data-id')}`, 'system');
    showToast("相邻订单已交换");
}

function resetAdjustment() {
    initDragAndDrop();
    addMessage('重置排产调整', 'system');
    showToast("排产调整已重置");
}

function getScheduleModeName(mode) {
    const modes = {
        'quality': '符合质量控制要求',
        'delivery': '满足客户按时交货要求',
        'material': '符合有料排产要求',
        'efficiency': '生产效率最大排产模型'
    };
    return modes[mode] || mode;
}

function getWorkshopName(workshop) {
    const workshops = {
        'assembly': '总装',
        'heat-exchanger': '两器',
        'injection': '注塑',
        'sheet-metal': '钣金',
        'controller': '控制器',
        'all': '全部'
    };
    return workshops[workshop] || workshop;
}

// --- Scheduler Logic ---
function generateOrderBatch() {
    const types = ['internal', 'external'];
    const priorities = ['normal', 'normal', 'normal', 'high'];
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
        state.orders.push({
            id: `ORD-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*100)}`,
            type: types[Math.floor(Math.random() * types.length)],
            priority: priorities[Math.floor(Math.random() * priorities.length)],
            status: 'pending'
        });
    }
    showToast(`成功生成 ${count} 个新订单`);
    renderScheduler();
    updateDashboardKPIs();
}

function renderScheduler() {
    const orderContainer = document.getElementById('scheduler-orders');
    orderContainer.innerHTML = '';
    state.orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `order-item ${o.status === 'processing' ? 'matched' : ''}`;
        div.innerHTML = `
            <div class="order-header">
                <span style="font-weight:bold;">${o.id}</span>
                <span class="tag ${o.type === 'internal' ? 'internal' : 'external'}">${o.type === 'internal' ? '内机' : '外机'}</span>
            </div>
            <div class="order-body">
                <span class="tag priority">${o.priority === 'high' ? '紧急' : '常规'}</span>
                <span>状态: ${o.status === 'processing' ? '生产中' : '待排'}</span>
            </div>
        `;
        orderContainer.appendChild(div);
    });

    const deviceContainer = document.getElementById('scheduler-devices');
    deviceContainer.innerHTML = '';
    state.devices.forEach(d => {
        const div = document.createElement('div');
        div.className = `device-item ${d.status === 'free' ? 'free' : 'busy'}`;
        div.innerHTML = `<div>${d.name}</div><div>${d.type === 'both' ? '通用' : (d.type === 'internal' ? '内机' : '外机')}</div>`;
        deviceContainer.appendChild(div);
    });

    document.getElementById('scheduler-exceptions').innerHTML = 
        state.exceptions.length ? state.exceptions.map(e => `> ${e}`).join('\n') : '系统正常';

    const agentContainer = document.getElementById('agent-viz-container');
    if (agentContainer.innerHTML === '') {
        state.agents.forEach(a => {
            const div = document.createElement('div');
            div.className = 'agent-box';
            div.id = `agent-box-${a.id}`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong>${a.name}</strong>
                    <span style="font-size:11px; color:var(--primary);">ACTIVE</span>
                </div>
                <div class="agent-status" id="agent-status-${a.id}">等待任务...</div>
            `;
            agentContainer.appendChild(div);
        });
    }
}

// --- Config Functions ---
function addResourceLimit() {
    const name = document.getElementById('res-name').value;
    const limit = document.getElementById('res-limit').value;
    if (!name || !limit) return showToast("请填写完整");
    state.resourceLimits.push({ name, limit });
    document.getElementById('res-name').value = '';
    document.getElementById('res-limit').value = '';
    renderLimits();
    showToast("资源限制已添加");
}

function addShellLimit() {
    const type = document.getElementById('shell-type').value;
    const limit = document.getElementById('shell-limit').value;
    if (!limit) return showToast("请填写产能上限");
    state.shellLimits.push({ type, limit });
    document.getElementById('shell-limit').value = '';
    renderLimits();
    showToast("壳体限制已添加");
}

function removeLimit(type, index) {
    if (type === 'resource') state.resourceLimits.splice(index, 1);
    if (type === 'shell') state.shellLimits.splice(index, 1);
    renderLimits();
}

function renderLimits() {
    const resList = document.getElementById('resource-limit-list');
    const shellList = document.getElementById('shell-limit-list');
    
    resList.innerHTML = state.resourceLimits.length 
        ? state.resourceLimits.map((item, i) => `
            <div class="limit-item">
                <span>${item.name}: <b>${item.limit}</b></span>
                <button class="btn sm danger" onclick="removeLimit('resource', ${i})">删除</button>
            </div>`).join('') 
        : '<div style="text-align:center; color:#666; font-size:12px;">暂无限制</div>';

    shellList.innerHTML = state.shellLimits.length 
        ? state.shellLimits.map((item, i) => `
            <div class="limit-item">
                <span>${item.type}: <b>${item.limit}</b></span>
                <button class="btn sm danger" onclick="removeLimit('shell', ${i})">删除</button>
            </div>`).join('') 
        : '<div style="text-align:center; color:#666; font-size:12px;">暂无限制</div>';
}

function updateDashboardKPIs() {
    const wip = state.orders.filter(o => o.status === 'processing').length;
    const pending = state.orders.filter(o => o.status === 'pending').length;
    const done = state.orders.filter(o => o.status === 'done').length;
    document.getElementById('kpi-wip').innerText = wip + pending;
    document.getElementById('kpi-rate').innerText = `${done}/${done + pending}`;
    const oee = (85 + Math.random() * 5).toFixed(1);
    document.getElementById('kpi-oee').innerText = oee + '%';
}

// --- Chat Functions ---
function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    setTimeout(() => handleAICommand(text), 600);
}

function addMessage(text, type) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.innerText = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function handleAICommand(text) {
    if (text.includes('开始') || text.includes('排产') || text.includes('执行')) {
        addMessage('收到指令。正在启动一键排产流程...', 'system');
        setTimeout(() => {
            runOneClickScheduling();
        }, 500);
    } else if (text.includes('状态') || text.includes('查询')) {
        const pending = state.orders.filter(o => o.status === 'pending').length;
        addMessage(`当前待排产订单：${pending}。排产表数据：${state.scheduleData.length} 条。`, 'ai');
    } else if (text.includes('同步') || text.includes('数据')) {
        addMessage("正在同步数据源...", 'system');
        setTimeout(() => {
            syncAllDataSources();
            addMessage("数据同步完成。", 'ai');
        }, 1000);
    } else if (text.includes('调整') || text.includes('修改')) {
        addMessage("正在打开排产调整功能...", 'system');
        setTimeout(() => {
            runScheduleAdjustment();
            addMessage("排产调整功能已就绪，您可以拖动订单调整顺序。", 'ai');
        }, 500);
    } else {
        addMessage("GREE AI：请输入'开始排产'、'查询状态'、'同步数据'或'调整排产'，或使用右侧功能按钮。", 'ai');
    }
}

// --- Utilities ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// Initial Boot
window.onload = function() {
    // 检查登录状态
    const isLoggedIn = sessionStorage.getItem('mimo_logged_in');
    const user = sessionStorage.getItem('mimo_user');
    
    if (!isLoggedIn || !user) {
        // 未登录，跳转到登录页面
        window.location.href = 'login.html';
    } else {
        // 显示用户信息
        document.getElementById('user-info').innerHTML = `${user} | GREE APS | ${new Date().toLocaleDateString()}`;
        
        console.log("GREE AI-APS v3.4 System Booted.");
        // Generate initial mock data for dashboard
        renderScheduleTable();
        updateDashboardKPIs();
        renderMaterialAlerts();
        updateInfoGrid();
        setupAIControls();
        initDragAndDrop();
    }
};

// 退出登录
function logout() {
    sessionStorage.removeItem('mimo_logged_in');
    sessionStorage.removeItem('mimo_user');
    window.location.href = 'login.html';
}
// 新增的甘特图相关函数
function refreshGanttChart() {
    showToast('甘特图已刷新');
    renderGanttChart();
}

function exportGanttChart() {
    showToast('甘特图已导出为图片');
}

function renderGanttChart() {
    const ganttChart = document.getElementById('gantt-chart');
    if (!ganttChart) return;
    
    // 模拟甘特图数据
    const ganttData = [
        { id: 'ORD-1001', name: '内机挂机', start: 0, duration: 3, color: '#4299e1' },
        { id: 'ORD-1002', name: '外机压缩机', start: 2, duration: 4, color: '#ed8936' },
        { id: 'ORD-1003', name: '冷凝器', start: 5, duration: 2, color: '#48bb78' },
        { id: 'ORD-1004', name: '控制器', start: 1, duration: 3, color: '#9f7aea' },
        { id: 'ORD-1005', name: '钣金件', start: 6, duration: 2, color: '#f56565' },
    ];
    
    ganttChart.innerHTML = '';
    
    ganttData.forEach(item => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        
        row.innerHTML = `
            <div class="gantt-row-label">${item.name} (${item.id})</div>
            <div class="gantt-bar-container">
                <div class="gantt-bar" 
                     style="left: ${item.start * 12.5}%; width: ${item.duration * 12.5}%; background: ${item.color};">
                    ${item.duration}h
                </div>
            </div>
        `;
        
        ganttChart.appendChild(row);
    });
}

// 新增的产线负荷图相关函数
function refreshWorkloadChart() {
    showToast('产线负荷图已刷新');
    renderWorkloadChart();
}

function updateWorkloadChart() {
    const filterValue = document.getElementById('workload-filter').value;
    showToast(`产线负荷图已更新: ${filterValue}`);
    renderWorkloadChart();
}

function renderWorkloadChart() {
    const workloadChart = document.getElementById('workload-chart');
    if (!workloadChart) return;
    
    // 模拟产线负荷数据
    const workloadData = [
        { name: '内机总装A', percent: 85, color: '#4299e1' },
        { name: '内机总装B', percent: 65, color: '#63b3ed' },
        { name: '外机总装A', percent: 92, color: '#ed8936' },
        { name: '外机总装B', percent: 45, color: '#fbbf24' },
        { name: '钣金线', percent: 78, color: '#48bb78' },
        { name: '注塑机', percent: 95, color: '#9f7aea' },
        { name: '两器线', percent: 60, color: '#f687b3' },
        { name: '控制器线', percent: 35, color: '#4fd1c7' },
    ];
    
    workloadChart.innerHTML = '';
    
    workloadData.forEach(item => {
        const row = document.createElement('div');
        row.className = 'workload-row';
        
        row.innerHTML = `
            <div class="workload-label">${item.name}</div>
            <div class="workload-bar-container">
                <div class="workload-bar" style="width: ${item.percent}%; background: ${item.color};">
                    <div class="workload-percent">${item.percent}%</div>
                </div>
            </div>
        `;
        
        workloadChart.appendChild(row);
    });
}

// 修改runOneClickScheduling函数，添加产线负荷图更新
function runOneClickScheduling() {
    // 原有代码...
    
    // 在原有函数末尾添加
    renderWorkloadChart();
    
    // 更新诊断点
    const dots = ['diag-dot-resource', 'diag-dot-material', 'diag-dot-conflict', 'diag-dot-constraint'];
    dots.forEach(dotId => {
        const dot = document.getElementById(dotId);
        dot.style.backgroundColor = '#4CAF50';
        dot.classList.add('ok');
    });
    
    // 显示提示
    showToast('一键预排完成，生成排产计划');
}

// 修改Initial Boot部分，添加初始化
window.onload = function() {
    // 原有代码...
    
    // 在原有初始化代码末尾添加
    setTimeout(() => {
        if (document.getElementById('view-dashboard').classList.contains('active')) {
            renderGanttChart();
        }
    }, 100);
    
    // 初始化产线负荷图
    if (document.getElementById('workload-chart')) {
        renderWorkloadChart();
    }
};

// 修改switchView函数，添加甘特图初始化
function switchView(viewId, navEl) {
    // 原有代码...
    
    if (viewId === 'dashboard') { 
        updateDashboardKPIs(); 
        renderScheduleTable(); 
        renderMaterialAlerts(); 
        updateInfoGrid();
        // 初始化甘特图
        setTimeout(() => {
            renderGanttChart();
        }, 100);
    }
    
    if (viewId === 'ai') {
        setupAIControls();
        // 初始化拖动功能
        initDragAndDrop();
        // 初始化产线负荷图
        setTimeout(() => {
            renderWorkloadChart();
        }, 100);
    }
}
