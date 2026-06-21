// ui.js — UI: модалки, тосты, тема, онбординг, настройки, статистика
// Загружается первым (нет зависимостей от app.js)
'use strict';

// ── Минимальный CSS для шапки (без скрытия элементов) ──
(function() {
    const s = document.createElement('style');
    s.id = '_topbar_css';
    s.textContent =
        '#top-stats-bar [data-card]{transition:opacity .15s,transform .15s;cursor:pointer}' +
        '#top-stats-bar [data-card]:active{opacity:.75;transform:scale(.95)}';
    (document.head || document.documentElement).appendChild(s);
})();

// ── Скрыть чекбокс "скрывать выученное" — он больше не нужен ──
function patchHeaderDOM() {
    const hll = document.getElementById('pg-hide-learned-container');
    if (hll) hll.style.display = 'none';
}

// Запускаем максимально рано
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchHeaderDOM, { once: true });
} else {
    patchHeaderDOM();
}

window.showModal = function(id) {
    const m = document.getElementById(id); if(!m) return;
    m.classList.remove('hidden'); m.classList.add('flex');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
};
window.hideModal = function(id) {
    const m = document.getElementById(id); if(!m) return;
    m.classList.add('opacity-0');
    setTimeout(() => { m.classList.add('hidden'); m.classList.remove('flex'); }, 300);
};

// Карта по географическому объекту: метка на координатах из geoDict ([lng, lat]).
// Функция отсутствовала — клик по гео в задании №4 не открывал карту (ReferenceError).
window.openMapModal = function(geo) {
    const coords = (typeof geoDict !== 'undefined') ? geoDict[geo] : null;
    if (!coords || coords.length !== 2) return;
    if (typeof haptic === 'function') haptic('light');
    const [lng, lat] = coords;
    const title = document.getElementById('map-modal-title');
    if (title) title.textContent = geo;
    const iframe = document.getElementById('yandex-map-iframe');
    if (iframe) {
        // Yandex Maps widget: центр + красная метка ровно на точке.
        iframe.src = `https://yandex.ru/map-widget/v1/?ll=${lng}%2C${lat}&z=7&l=map&pt=${lng},${lat},pm2rdm`;
    }
    window.showModal('map-modal');
};

// ═══ КОМПОЗЕР ДЗ (учитель): набор подзаданий с разными метриками ═══
// _hwComposer = { target:{type:'class'|'student', id, name}, items:[{task,period,metric,goal}], deadline }
window._hwComposer = null;

const HWC_TASKS = [
    { v: 'task4', t: '📍 №4 География' },
    { v: 'task3', t: '🔗 №3 Процессы' },
    { v: 'task5', t: '👤 №5 Личности' },
    { v: 'task7', t: '🎨 №7 Культура' }
];
const HWC_PERIODS = [
    { v: 'all', t: 'Вся история' }, { v: 'early', t: 'До XVIII в.' },
    { v: '18th', t: 'XVIII век' }, { v: '19th', t: 'XIX век' }, { v: '20th', t: 'XX век' },
    { v: 'custom', t: '📅 Свои годы' }
];
const HWC_METRICS = [
    { v: 'lines', t: 'Строки (решить)' },
    { v: 'points', t: 'Баллы ЕГЭ (набрать)' },
    { v: 'learned', t: 'Выученные факты' }
];

window.promptAssignHw = function(studentId, name) {
    window.openHwComposer({ type: 'student', id: studentId, name: name || 'Ученик' });
};
window.promptAssignHwClass = function() {
    const students = (window._cachedStudents || []);
    if (!students.length) return showToast('⚠️', 'Сначала загрузите класс', 'bg-rose-500', 'border-rose-700');
    window.openHwComposer({ type: 'class', count: students.length });
};

window.openHwComposer = function(target) {
    window._hwComposer = { target, items: [], deadline: null };
    let overlay = document.getElementById('hw-composer-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'hw-composer-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center';
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }
    _renderHwComposer();
};

function _hwcAvail() {
    const task = document.getElementById('hwc-task')?.value || 'task4';
    const period = document.getElementById('hwc-period')?.value || 'all';
    const metric = document.getElementById('hwc-metric')?.value || 'lines';
    const hint = document.getElementById('hwc-avail');
    const yearRow = document.getElementById('hwc-year-row');
    if (yearRow) yearRow.style.display = period === 'custom' ? 'grid' : 'none';
    if (!hint) return;
    if (metric === 'learned' && window.learnedCountInPeriod) {
        const ys = period === 'custom' ? parseInt(document.getElementById('hwc-year-start')?.value) || 0 : undefined;
        const ye = period === 'custom' ? parseInt(document.getElementById('hwc-year-end')?.value) || 3000 : undefined;
        const { total } = window.learnedCountInPeriod(task, period, ys, ye);
        hint.textContent = `Доступно фактов в периоде: ${total}`;
        hint.style.display = '';
    } else if (period === 'custom') {
        const cfg = window.TASK_CONFIG && window.TASK_CONFIG[task];
        if (cfg && cfg.data) {
            const ys = parseInt(document.getElementById('hwc-year-start')?.value) || 0;
            const ye = parseInt(document.getElementById('hwc-year-end')?.value) || 3000;
            const count = cfg.data().filter(d => { const y = getYearFromFact(d); return y >= ys && y <= ye; }).length;
            hint.textContent = `Фактов в диапазоне ${ys}–${ye}: ${count}`;
            hint.style.display = '';
        } else { hint.style.display = 'none'; }
    } else { hint.style.display = 'none'; }
}
window._hwcAvail = _hwcAvail;

window._hwcAddItem = function() {
    const c = window._hwComposer; if (!c) return;
    const task = document.getElementById('hwc-task').value;
    const period = document.getElementById('hwc-period').value;
    const metric = document.getElementById('hwc-metric').value;
    let goal = parseInt(document.getElementById('hwc-goal').value);
    if (isNaN(goal) || goal <= 0) return showToast('⚠️', 'Укажите цель (> 0)', 'bg-rose-500', 'border-rose-700');
    const item = { task, period, metric, goal };
    if (period === 'custom') {
        item.yearStart = parseInt(document.getElementById('hwc-year-start')?.value) || 0;
        item.yearEnd = parseInt(document.getElementById('hwc-year-end')?.value) || 3000;
        if (item.yearStart > item.yearEnd) return showToast('⚠️', 'Начальный год > конечного', 'bg-rose-500', 'border-rose-700');
    }
    if (metric === 'learned' && window.learnedCountInPeriod) {
        const { total } = window.learnedCountInPeriod(task, period, item.yearStart, item.yearEnd);
        if (goal > total) goal = total;
        item.goal = goal;
    }
    c.items.push(item);
    _renderHwComposer();
};
window._hwcRemoveItem = function(i) { if (window._hwComposer) { window._hwComposer.items.splice(i, 1); _renderHwComposer(); } };
window._hwcSetDeadline = function(days) {
    const c = window._hwComposer; if (!c) return;
    if (days === null) c.deadline = null;
    else { const d = new Date(); d.setDate(d.getDate() + days); c.deadline = d.toISOString().split('T')[0]; }
    _renderHwComposer();
};
window._hwcSetDeadlineDate = function(val) { if (window._hwComposer) window._hwComposer.deadline = val || null; };

window._hwcSubmit = function() {
    const c = window._hwComposer; if (!c) return;
    if (!c.items.length) return showToast('⚠️', 'Добавьте хотя бы один этап', 'bg-rose-500', 'border-rose-700');
    const overlay = document.getElementById('hw-composer-overlay');
    if (overlay) overlay.remove();
    if (c.target.type === 'class') {
        if (window._assignBundleToClassDb) window._assignBundleToClassDb(c.items, c.deadline, null);
    } else {
        if (window._assignBundleToStudentDb) window._assignBundleToStudentDb(c.target.id, c.items, c.deadline, null);
    }
    window._hwComposer = null;
};

function _renderHwComposer() {
    const c = window._hwComposer;
    const overlay = document.getElementById('hw-composer-overlay');
    if (!c || !overlay) return;
    const targetName = c.target.type === 'class'
        ? `Весь класс — ${c.target.count} ${c.target.count === 1 ? 'ученик' : 'учеников'}`
        : c.target.name;
    const metricUnit = { lines: 'строк', points: 'баллов', learned: 'фактов' };
    const taskShort = { task3: '🔗№3', task4: '📍№4', task5: '👤№5', task7: '🎨№7' };
    const periodShort = Object.fromEntries(HWC_PERIODS.map(p => [p.v, p.t]));

    const itemsHtml = c.items.length ? c.items.map((it, i) => `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:8px 10px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:800;color:#111" class="dark:text-gray-100">Этап ${i + 1}: ${taskShort[it.task] || it.task}</div>
            <div style="font-size:10px;color:#6b7280">${it.goal} ${metricUnit[it.metric]} · ${it.period === 'custom' ? (it.yearStart || '?') + '–' + (it.yearEnd || '?') + ' гг.' : (periodShort[it.period] || it.period)}</div>
          </div>
          <button onclick="window._hwcRemoveItem(${i})" style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:2px 6px">🗑</button>
        </div>`).join('')
        : '<div style="font-size:12px;color:#9ca3af;text-align:center;padding:10px 0">Этапов пока нет — добавьте ниже</div>';

    const sel = (id, opts, onchange) => `<select id="${id}" ${onchange ? `onchange="${onchange}"` : ''} style="width:100%;padding:9px;border:1px solid rgba(128,128,128,0.3);border-radius:10px;font-size:12px;font-weight:700;background:#fff;color:#111">${opts.map(o => `<option value="${o.v}">${o.t}</option>`).join('')}</select>`;

    const dl = c.deadline;
    const dlBtn = (label, days) => {
        const active = (days === null && !dl) || (days !== null && dl === (() => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; })());
        return `<button onclick="window._hwcSetDeadline(${days})" style="flex:1;padding:8px;border-radius:9px;font-size:11px;font-weight:800;cursor:pointer;border:1px solid ${active ? '#7c3aed' : 'rgba(128,128,128,0.3)'};background:${active ? '#f5f3ff' : '#fff'};color:${active ? '#6d28d9' : '#6b7280'}">${label}</button>`;
    };

    overlay.innerHTML = `
    <div style="background:#f7f7f8;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;border-radius:24px 24px 0 0;padding:18px 16px 28px;box-shadow:0 -8px 40px rgba(0,0,0,0.25)" class="dark:bg-[#141414]">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-size:16px;font-weight:900;color:#111" class="dark:text-white">📝 Новое ДЗ</div>
        <button onclick="document.getElementById('hw-composer-overlay').remove()" style="font-size:22px;color:#aaa;background:none;border:none;cursor:pointer;padding:2px 8px">✕</button>
      </div>
      <div style="font-size:12px;color:#6b7280;font-weight:700;margin-bottom:12px">${targetName}</div>

      <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:6px">Этапы (решаются по очереди)</div>
      ${itemsHtml}

      <div style="background:var(--card,#fff);border:1px solid rgba(128,128,128,0.18);border-radius:14px;padding:12px;margin:10px 0" class="dark:bg-[#1e1e1e]">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          ${sel('hwc-task', HWC_TASKS, 'window._hwcAvail()')}
          ${sel('hwc-period', HWC_PERIODS, 'window._hwcAvail()')}
        </div>
        <div id="hwc-year-row" style="display:none;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;margin-bottom:8px">
          <input id="hwc-year-start" type="number" min="862" max="2026" value="862" placeholder="от" oninput="window._hwcAvail()" style="width:100%;padding:8px;border:1px solid rgba(128,128,128,0.3);border-radius:10px;font-size:13px;font-weight:800;text-align:center">
          <span style="font-size:12px;color:#9ca3af;font-weight:800">—</span>
          <input id="hwc-year-end" type="number" min="862" max="2026" value="2026" placeholder="до" oninput="window._hwcAvail()" style="width:100%;padding:8px;border:1px solid rgba(128,128,128,0.3);border-radius:10px;font-size:13px;font-weight:800;text-align:center">
        </div>
        <div style="display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center">
          ${sel('hwc-metric', HWC_METRICS, 'window._hwcAvail()')}
          <input id="hwc-goal" type="number" min="1" placeholder="N" style="width:100%;padding:9px;border:1px solid rgba(128,128,128,0.3);border-radius:10px;font-size:13px;font-weight:800;text-align:center">
        </div>
        <div id="hwc-avail" style="display:none;font-size:10px;color:#2563eb;font-weight:700;margin-top:6px"></div>
        <button onclick="window._hwcAddItem()" style="margin-top:10px;width:100%;background:rgba(59,130,246,0.12);color:#2563eb;border:1px dashed #3b82f6;border-radius:10px;padding:10px;font-size:12px;font-weight:900;cursor:pointer">＋ Добавить этап</button>
      </div>

      <div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin:8px 0 6px">Срок сдачи</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        ${dlBtn('3 дня', 3)} ${dlBtn('Неделя', 7)} ${dlBtn('2 нед.', 14)} ${dlBtn('Без срока', null)}
      </div>
      <input type="date" value="${dl || ''}" onchange="window._hwcSetDeadlineDate(this.value)" style="width:100%;padding:9px;border:1px solid rgba(128,128,128,0.3);border-radius:10px;font-size:12px;margin-bottom:14px">

      <button onclick="window._hwcSubmit()" style="width:100%;background:#10b981;color:#fff;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:900;cursor:pointer">
        ✅ Выдать ДЗ${c.items.length ? ` (${c.items.length} этап.)` : ''}
      </button>
    </div>`;
    _hwcAvail();
}

function checkOnboarding() {
    if (!localStorage.getItem('ege_onboarding_done')) {
        $('onboarding-overlay').classList.remove('hidden');
        $('onboarding-overlay').classList.add('flex');
    }
}
window.nextOnbStep = function(step) {
    haptic('light');
    for (let i = 1; i <= 6; i++) {
        const s = $('onb-step-' + i); if (s) s.classList.toggle('hidden', i !== step);
        const d = $('onb-dot-' + i); if (d) { 
            d.classList.toggle('bg-blue-500', i === step); 
            d.classList.toggle('bg-gray-300', i !== step && i > step); 
            d.classList.toggle('bg-blue-200', i < step);
            d.classList.toggle('dark:bg-gray-600', i !== step);
        }
    }
};
window.finishOnboarding = function() {
    haptic('medium');
    // Save name/class from onboarding slide 6 if provided
    const onbName = $('onb-name-input') ? $('onb-name-input').value.trim() : '';
    const onbClass = $('onb-class-input') ? $('onb-class-input').value.trim() : '';
    if (onbName) localStorage.setItem('student_manual_name', onbName);
    if (onbClass) localStorage.setItem('student_class_code', onbClass);
    localStorage.setItem('ege_onboarding_done', '1');
    $('onboarding-overlay').classList.add('hidden');
    $('onboarding-overlay').classList.remove('flex');
    if (onbName || onbClass) {
        if (window.syncProgressToCloud) window.syncProgressToCloud();
        showToast('✅', 'Профиль сохранён! Удачи на ЕГЭ!', 'bg-emerald-500', 'border-emerald-700');
    }
    if (onbClass && window.pullClassAssignments) window.pullClassAssignments(onbClass);
};

// === PULL-TO-REFRESH ===
document.addEventListener('app:ready', function initPullToRefresh() {
    let startY = 0, pulling = false;
    const lobby = document.getElementById('lobby-area');
    if (!lobby) return;
    lobby.addEventListener('touchstart', function(e) {
        if (window.scrollY === 0 && !document.body.classList.contains('in-game')) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });
    lobby.addEventListener('touchmove', function(e) {
        if (!pulling) return;
        const diff = e.touches[0].clientY - startY;
        if (diff > 80) {
            pulling = false;
            if (typeof haptic === 'function') haptic('medium');
            if (window.loadProgressFromCloud) window.loadProgressFromCloud();
            if (typeof updateProgressBars === 'function') updateProgressBars();
            if (typeof updateGlobalUI === 'function') updateGlobalUI();
            showToast('🔄', 'Обновлено!', 'bg-blue-500', 'border-blue-700');
        }
    }, { passive: true });
    lobby.addEventListener('touchend', function() { pulling = false; }, { passive: true });
}, { once: true });

document.addEventListener('app:ready', function() {
    patchHeaderDOM();
    if (typeof updateGlobalUI === 'function') updateGlobalUI();
    // data.js уже загружен — можно корректно посчитать дела
    if (typeof window.refreshDetectiveCaseOptions === 'function') window.refreshDetectiveCaseOptions();
}, { once: true });

// Обновляет лейблы опций в #pg-filter-case, добавляя счётчик «N дел».
// Категории с числом дел < MIN_CASES_TO_SHOW скрываются, остальные получают пометку «· N дел».
// Чтобы вернуть одиночные категории — изменить MIN_CASES_TO_SHOW на 1.
window.refreshDetectiveCaseOptions = function() {
    const MIN_CASES_TO_SHOW = 2;
    const select = $('pg-filter-case');
    if (!select || typeof detectiveCases === 'undefined') return;
    Array.from(select.options).forEach(opt => {
        // Сохраняем исходный текст один раз
        if (!opt.dataset.baseLabel) opt.dataset.baseLabel = opt.textContent.replace(/\s·\s.*$/, '').trim();
        const key = opt.value;
        const arr = detectiveCases[key];
        const count = Array.isArray(arr) ? arr.length : 0;
        if (count < MIN_CASES_TO_SHOW) {
            opt.hidden = true;
            opt.disabled = true;
            opt.textContent = opt.dataset.baseLabel + (count === 0 ? ' · пусто' : ' · 1 дело');
        } else {
            opt.hidden = false;
            opt.disabled = false;
            opt.textContent = opt.dataset.baseLabel + ` · ${count} дел`;
        }
    });
    // Если текущий выбранный пункт оказался скрыт — переключимся на первый видимый
    if (select.selectedOptions[0] && select.selectedOptions[0].hidden) {
        const firstVisible = Array.from(select.options).find(o => !o.hidden);
        if (firstVisible) {
            select.value = firstVisible.value;
            // Синхронизируем системный #filter-case, чтобы игра стартовала с валидной категорией
            const sysSelect = $('filter-case');
            if (sysSelect) sysSelect.value = firstVisible.value;
        }
    }
};

window.openGlobalSettings = function() {
    $('pre-game-title').innerText = 'Глобальные настройки';
    window.refreshDetectiveCaseOptions();
    
    $('pg-period-container').classList.remove('hidden');
    $('pg-rows-container').classList.remove('hidden');
    $('pg-case-container').classList.add('hidden'); 
    if ($('pg-hide-learned-container')) $('pg-hide-learned-container').classList.add('hidden');
    
    if (window.state.currentMode === 'detective') {
        $('pg-period-container').classList.add('hidden');
        $('pg-rows-container').classList.add('hidden');
        if ($('pg-hide-learned-container')) $('pg-hide-learned-container').classList.add('hidden');
        $('pg-case-container').classList.remove('hidden');
    }
    if (window.state.currentMode === 'redpencil') {
        $('pg-rows-container').classList.add('hidden');
    }
    
    if ($('filter-period')) $('pg-filter-period').value = $('filter-period').value || 'all';
    if ($('filter-case')) $('pg-filter-case').value = $('filter-case').value || 'rtw';
    if ($('filter-rows')) window.setPgRows($('filter-rows').value || '4');
    
    if ($('pg-filter-period').value === 'custom') {
        if (!$('pg-custom-year-start').value || $('pg-custom-year-start').value === '0') $('pg-custom-year-start').value = '862';
        if (!$('pg-custom-year-end').value || $('pg-custom-year-end').value === '0') $('pg-custom-year-end').value = '2026';
    }
    checkCustomPeriod(); 
    showModal('pre-game-modal'); 
    setTimeout(() => $('pg-sheet').classList.remove('translate-y-full'), 10);
};

window.closePreGameModal = function() { hideModal('pre-game-modal'); $('pg-sheet').classList.add('translate-y-full'); };
window.checkCustomPeriod = function() { $('pg-custom-period-container').classList.toggle('hidden', $('pg-filter-period').value !== 'custom'); };
window.setPgRows = function(rows) { $$('.pg-row-btn').forEach(btn => btn.className = "pg-row-btn bg-white border-gray-200 text-gray-600 dark:bg-[#2c2c2c] dark:border-[#3f3f46] dark:text-gray-400 border-2 rounded-xl py-3 font-black text-sm transition-colors"); const active = $(`btn-row-${rows}`); if (active) active.className = "pg-row-btn bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-2 rounded-xl py-3 font-black text-sm transition-colors"; $('filter-rows').value = rows; };

window.applyGlobalSettings = function() {
    haptic('medium'); 
    $('filter-period').value = $('pg-filter-period').value; 
    $('custom-year-start').value = $('pg-custom-year-start').value; 
    $('custom-year-end').value = $('pg-custom-year-end').value;
    $('filter-case').value = $('pg-filter-case').value;
    
    saveProgress();
    closePreGameModal();
    
    if (document.body.classList.contains('in-game')) {
        window.handleSettingsChange();
    } else {
        showToast('⚙️', 'Настройки сохранены', 'bg-blue-500', 'border-blue-700');
    }
};

function toggleTheme() { localStorage.setItem('ege_theme', document.documentElement.classList.toggle('dark') ? 'dark' : 'light'); }

/* ──────────────────────────────────────────────────────────
   SKIN SYSTEM — 7 лобби-тем
   ────────────────────────────────────────────────────────── */
const SKINS = ['aurora','classic','constructivism','vaporwave','sakura','terminal','midnight','scholar'];

window.applySkin = function(skin) {
    if (!SKINS.includes(skin)) skin = 'aurora';
    // Remove all previous skin classes
    SKINS.forEach(s => document.body.classList.remove('skin-' + s));
    // Aurora is the default (no extra class needed)
    if (skin !== 'aurora') document.body.classList.add('skin-' + skin);
    localStorage.setItem('ege_skin', skin);
    updateSkinPicker(skin);
};

function updateSkinPicker(activeSkin) {
    const picker = document.getElementById('skin-picker');
    if (!picker) return;
    picker.querySelectorAll('.skin-btn').forEach(btn => {
        const s = btn.dataset.skin;
        const isActive = s === activeSkin || (activeSkin === 'aurora' && s === 'aurora');
        // Style the button border to show active state
        btn.style.borderColor = isActive ? '#60a5fa' : 'transparent';
        btn.style.background  = isActive ? 'rgba(59,130,246,.12)' : '';
        btn.style.borderRadius = '12px';
    });
}

// Apply skin on page load — тема по умолчанию: необрутализм (constructivism)
const DEFAULT_SKIN = 'constructivism';
(function() {
    const saved = localStorage.getItem('ege_skin') || DEFAULT_SKIN;
    SKINS.forEach(s => document.body.classList.remove('skin-' + s));
    if (saved !== 'aurora') document.body.classList.add('skin-' + saved);
})();

// Delegate click on skin-picker
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.skin-btn[data-skin]');
    if (btn) {
        if (typeof haptic === 'function') haptic('light');
        window.applySkin(btn.dataset.skin);
    }
});


window.toggleFocusMode = function() {
    window.state.focusMode = !window.state.focusMode; 
    const header = $('main-header'), bottomNav = $('bottom-nav'), body = document.body;
    
    if (window.state.focusMode) { 
        body.classList.add('zen-mode-active'); 
        header.classList.add('hidden'); 
        bottomNav.classList.add('hide-nav'); 
        if (!body.classList.contains('in-game')) body.classList.add('in-game'); 
        showToast('🧘', 'Режим Дзен активирован', 'bg-teal-500', 'border-teal-700'); 
    } else { 
        body.classList.remove('zen-mode-active'); 
        header.classList.remove('hidden'); 
        if (!$('lobby-area').classList.contains('hidden')) { 
            bottomNav.classList.remove('hide-nav'); 
            body.classList.remove('in-game'); 
        }
        showToast('🧘', 'Дзен отключен', 'bg-gray-500', 'border-gray-700'); 
    }
    window.updateZenButton();
};

function toggleHideLearned() { window.state.hideLearned = $('toggle-hide-learned').checked; saveProgress(); handleSettingsChange(); }

window.startHwFromBanner = function() {
    // Баннер теперь открывает вкладку ДЗ со списком заданий
    if (window.openHwTab) return window.openHwTab();
    haptic('light');
    const s = window.state.stats;
    const tasks = [
        { key: 'task3', cnt: s.hwTask3||0 },
        { key: 'task4', cnt: s.hwTask4||0 },
        { key: 'task5', cnt: s.hwTask5||0 },
        { key: 'task7', cnt: s.hwTask7||0 },
    ];
    const best = tasks.reduce((a,b) => b.cnt > a.cnt ? b : a, tasks[0]);
    quickStartGame(best.cnt > 0 ? best.key : 'task4', 'normal');
};

window.showHwTasksSequential = function() {
    haptic('light');
    const s = window.state.stats;
    const tasks = [];
    if ((s.hwTask3||0) > 0) tasks.push({ key: 'task3', emoji: '🔗', name: 'Задание №3 — Процессы', cnt: s.hwTask3 });
    if ((s.hwTask4||0) > 0) tasks.push({ key: 'task4', emoji: '📍', name: 'Задание №4 — География', cnt: s.hwTask4 });
    if ((s.hwTask5||0) > 0) tasks.push({ key: 'task5', emoji: '👤', name: 'Задание №5 — Личности', cnt: s.hwTask5 });
    if ((s.hwTask7||0) > 0) tasks.push({ key: 'task7', emoji: '🎨', name: 'Задание №7 — Культура', cnt: s.hwTask7 });
    if (!tasks.length) return;

    const total = tasks.reduce((a, t) => a + t.cnt, 0);
    const dlRaw = localStorage.getItem('teacher_hw_deadline');
    const dlStr = dlRaw ? ' · срок: ' + new Date(dlRaw + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric',month:'long'}) : '';

    const overlayId = 'hw-seq-overlay';
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;padding:0';
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }

    let idx = 0;
    function renderStep() {
        const t = tasks[idx];
        const isLast = idx === tasks.length - 1;
        overlay.innerHTML = `
        <div style="background:#fff;width:100%;max-width:480px;border-radius:24px 24px 0 0;padding:20px 20px 28px;box-shadow:0 -8px 40px rgba(0,0,0,0.2)" class="dark:bg-[#1e1e1e]">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#9ca3af">Домашнее задание</div>
              <div style="font-size:13px;font-weight:900;color:#111;margin-top:2px" class="dark:text-white">${t.emoji} ${t.name}</div>
            </div>
            <button onclick="document.getElementById('${overlayId}').remove()" style="font-size:20px;color:#aaa;background:none;border:none;cursor:pointer;padding:4px 8px">✕</button>
          </div>

          <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:14px;padding:14px 16px;margin-bottom:14px">
            <div style="font-size:28px;font-weight:900;color:#ef4444;line-height:1">${t.cnt} <span style="font-size:14px;font-weight:600;color:#9ca3af">строк</span></div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px">Задание ${idx+1} из ${tasks.length} · всего ${total} строк${dlStr}</div>
            <div style="display:flex;gap:4px;margin-top:10px">
              ${tasks.map((tt, i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i < idx ? '#10b981' : i === idx ? '#ef4444' : 'rgba(0,0,0,0.1)'}"></div>`).join('')}
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <button onclick="(function(){document.getElementById('${overlayId}').remove();quickStartGame('${t.key}','normal');})()"
              style="width:100%;background:#ef4444;color:#fff;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:900;cursor:pointer;letter-spacing:.02em">
              ▶ Начать ${t.emoji} ${t.name}
            </button>
            ${!isLast ? `<button onclick="(function(){window._hwSeqIdx=(window._hwSeqIdx||0)+1;document.getElementById('${overlayId}')._nextStep&&document.getElementById('${overlayId}')._nextStep();})()"
              style="width:100%;background:rgba(0,0,0,0.05);color:#374151;border:none;border-radius:14px;padding:12px;font-size:13px;font-weight:700;cursor:pointer" class="dark:bg-white/10 dark:text-gray-300">
              Следующее задание →
            </button>` : ''}
          </div>
        </div>`;
        overlay._nextStep = () => { idx = Math.min(idx + 1, tasks.length - 1); renderStep(); };
    }
    renderStep();
};

// ── Вкладка «ДЗ» ученика: набор подзаданий (этапов) с автопереходом ──
const HW_TASK_META = {
    task3: { emoji: '🔗', name: 'Задание №3 — Процессы' },
    task4: { emoji: '📍', name: 'Задание №4 — География' },
    task5: { emoji: '👤', name: 'Задание №5 — Личности' },
    task7: { emoji: '🎨', name: 'Задание №7 — Культура' }
};
const HW_PERIOD_LABEL = { all: 'Вся история', early: 'До XVIII в.', '18th': 'XVIII век', '19th': 'XIX век', '20th': 'XX век', custom: 'Свои годы' };
const HW_METRIC_META = {
    lines:   { unit: 'строк',  verb: 'Решить',  mode: 'normal', color: '#3b82f6' },
    points:  { unit: 'баллов', verb: 'Набрать', mode: 'normal', color: '#8b5cf6' },
    // Выучивание идёт В САМОМ ЗАДАНИИ (строки 3/4/5/7): ученик «заходит решать», факты периода
    // учитываются общей системой приложения (isFactLearned). Уже выученные — автозачёт. Прогресс — живой счёт.
    learned: { unit: 'фактов', verb: 'Выучить', mode: 'normal', color: '#10b981' }
};

// Плашка прогресса режима выучивания (learned-ДЗ): показывается на игровом экране над заданием.
window.hwLearnBannerHtml = function() {
    const ah = window.state.activeHw;
    if (!ah) return '';
    const a = (window.state.stats.assignments || []).find(x => x.id === ah.id);
    if (!a) return '';
    const it = (a.items || [])[ah.itemIndex];
    if (!it || it.metric !== 'learned') return '';
    const done = window.hwItemProgress(it), goal = it.goal || 0;
    const pct = goal ? Math.round(done / goal * 100) : 0;
    return `<div style="width:100%;padding:8px 12px;margin-bottom:8px;background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.35);border-radius:12px">
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:#059669;margin-bottom:5px">
        <span>📚 Выучивание · ДЗ</span><span>Выучено ${done} / ${goal}</span></div>
      <div style="height:7px;background:rgba(16,185,129,0.18);border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:#10b981;border-radius:6px;transition:width .3s"></div></div>
    </div>`;
};

// Показать/скрыть и обновить плашку выучивания на игровом экране (#hw-learn-bar).
window.updateHwLearnBar = function() {
    const el = document.getElementById('hw-learn-bar');
    if (!el) return;
    const html = window.hwLearnBannerHtml();
    if (html) { el.innerHTML = html; el.classList.remove('hidden'); }
    else { el.innerHTML = ''; el.classList.add('hidden'); }
};

function _hwFmtDate(dl) {
    if (!dl) return 'без срока';
    return new Date(dl + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function _hwAssignmentActive(a) {
    return a.status === 'active' && (a.items || []).some(it => !window.hwItemDone(it));
}
function _hwAssignmentRemainingItems(a) {
    return (a.items || []).filter(it => !window.hwItemDone(it)).length;
}

window.countActiveAssignments = function() {
    const arr = window.state.stats.assignments || [];
    return arr.filter(_hwAssignmentActive).length;
};

// Обновить красный бейдж с числом активных ДЗ на кнопке нижнего меню
window.updateHwNavBadge = function() {
    const badge = document.getElementById('hw-nav-badge');
    if (!badge) return;
    const n = window.countActiveAssignments();
    if (n > 0) { badge.textContent = n > 9 ? '9+' : String(n); badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
};

function _hwItemRow(it, idx, kind) {
    const m = HW_TASK_META[it.task] || { emoji: '📝', name: it.task };
    const mm = HW_METRIC_META[it.metric] || HW_METRIC_META.lines;
    const prog = window.hwItemProgress(it), goal = it.goal || 0;
    const pct = goal ? Math.min(100, Math.round(prog / goal * 100)) : 0;
    const done = window.hwItemDone(it);
    const periodLabel = it.period === 'custom' ? (it.yearStart || '?') + '–' + (it.yearEnd || '?') + ' гг.' : (HW_PERIOD_LABEL[it.period] || '');
    const tick = done ? '✅' : '▢';
    return `
      <div style="display:flex;gap:8px;align-items:center;padding:6px 0">
        <span style="font-size:14px;width:18px;flex-shrink:0">${tick}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" class="dark:text-gray-100">${m.emoji} ${m.name}</div>
          <div style="font-size:10px;color:#9ca3af;margin:1px 0 3px">${mm.verb} ${goal} ${mm.unit} · ${periodLabel}</div>
          <div style="width:100%;height:5px;background:rgba(128,128,128,0.15);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${done ? '#10b981' : mm.color};border-radius:3px;transition:width .3s"></div>
          </div>
        </div>
        <span style="font-size:11px;font-weight:900;color:${done ? '#10b981' : '#6b7280'};flex-shrink:0;min-width:42px;text-align:right">${prog}/${goal}</span>
      </div>`;
}

window.openHwTab = function() {
    haptic('light');
    if (window.refreshHwState) window.refreshHwState();
    const arr = (window.state.stats.assignments || []).slice();
    const now = Date.now();
    const isOverdue = a => a.deadline && new Date(a.deadline + 'T23:59:59').getTime() < now;

    const active  = arr.filter(a => _hwAssignmentActive(a) && !isOverdue(a))
        .sort((a, b) => (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity));
    const overdue = arr.filter(a => _hwAssignmentActive(a) && isOverdue(a))
        .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
    const done    = arr.filter(a => a.status === 'done')
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 30);

    const card = (a, kind) => {
        const items = a.items || [];
        let headBadge, btn = '';
        if (kind === 'done') {
            headBadge = a.onTime
                ? '<span style="background:#10b981;color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:999px">✅ Сдано вовремя</span>'
                : '<span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:999px">⌛ Сдано с опозданием</span>';
        } else {
            const od = kind === 'overdue';
            headBadge = od
                ? '<span style="background:#ef4444;color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:999px">🔴 Просрочено</span>'
                : `<span style="background:rgba(16,185,129,0.15);color:#059669;font-size:10px;font-weight:900;padding:3px 8px;border-radius:999px">🟢 Срок: ${_hwFmtDate(a.deadline)}</span>`;
            const restN = _hwAssignmentRemainingItems(a);
            const started = items.some(it => !window.hwItemDone(it) && (it.progress || 0) > 0) || items.some(it => window.hwItemDone(it));
            const label = od ? 'Доделать' : (started ? 'Продолжить' : 'Начать');
            btn = `<button onclick="window.startAssignment&&window.startAssignment('${a.id}')"
                style="margin-top:10px;width:100%;background:${od ? '#ef4444' : '#3b82f6'};color:#fff;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:900;cursor:pointer">
                ▶ ${label} · ${restN} ${restN === 1 ? 'этап' : 'этапа+'} </button>`;
        }
        const title = a.title || (items.length > 1 ? `Домашнее задание · ${items.length} этапов` : 'Домашнее задание');
        return `
        <div style="background:var(--card,#fff);border:1px solid rgba(128,128,128,0.18);border-radius:16px;padding:14px;margin-bottom:10px" class="dark:bg-[#1e1e1e]">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
            <div style="font-size:13px;font-weight:900;color:#111" class="dark:text-white">${title}</div>
            ${headBadge}
          </div>
          ${kind === 'done' ? `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px">Выполнено ${a.completedAt ? new Date(a.completedAt).toLocaleDateString('ru-RU') : ''} · срок: ${_hwFmtDate(a.deadline)}</div>` : ''}
          <div>${items.map((it, i) => _hwItemRow(it, i, kind)).join('')}</div>
          ${btn}
        </div>`;
    };

    const section = (title, items, kind) => items.length
        ? `<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:6px 2px 8px">${title}</div>${items.map(a => card(a, kind)).join('')}</div>`
        : '';

    const empty = (!active.length && !overdue.length && !done.length)
        ? `<div style="text-align:center;padding:40px 16px;color:#9ca3af">
             <div style="font-size:42px;margin-bottom:8px">🎉</div>
             <div style="font-size:14px;font-weight:800;color:#374151" class="dark:text-gray-300">Домашних заданий нет</div>
             <div style="font-size:12px;margin-top:4px">Учитель пока ничего не задал</div>
           </div>` : '';

    const streak = window.state.stats.achievementsData?.hwStreakMax || 0;
    const onTime = window.state.stats.achievementsData?.hwOnTime || 0;
    const statsLine = (onTime || streak)
        ? `<div style="display:flex;gap:8px;margin-bottom:12px">
             <div style="flex:1;background:rgba(16,185,129,0.1);border-radius:12px;padding:10px;text-align:center">
               <div style="font-size:20px;font-weight:900;color:#059669">${onTime}</div>
               <div style="font-size:10px;color:#6b7280;font-weight:700">сдано вовремя</div></div>
             <div style="flex:1;background:rgba(245,158,11,0.1);border-radius:12px;padding:10px;text-align:center">
               <div style="font-size:20px;font-weight:900;color:#d97706">🔥 ${streak}</div>
               <div style="font-size:10px;color:#6b7280;font-weight:700">лучшая серия вовремя</div></div>
           </div>` : '';

    const overlayId = 'hw-tab-overlay';
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center';
        overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
    <div style="background:#f7f7f8;width:100%;max-width:480px;max-height:88vh;overflow-y:auto;border-radius:24px 24px 0 0;padding:18px 16px calc(28px + env(safe-area-inset-bottom, 0px));box-shadow:0 -8px 40px rgba(0,0,0,0.25)" class="dark:bg-[#141414]">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:16px;font-weight:900;color:#111" class="dark:text-white">📚 Домашние задания</div>
        <button onclick="document.getElementById('${overlayId}').remove()" style="font-size:22px;color:#aaa;background:none;border:none;cursor:pointer;padding:2px 8px">✕</button>
      </div>
      ${statsLine}
      ${section('🔴 Просроченные — доделать', overdue, 'overdue')}
      ${section('🟢 Активные', active, 'active')}
      ${section('Выполненные', done, 'done')}
      ${empty}
    </div>`;
};

// Начать ДЗ: запускаем поток с первого невыполненного этапа.
window.startAssignment = function(id) {
    const a = (window.state.stats.assignments || []).find(x => x.id === id);
    const ov = document.getElementById('hw-tab-overlay');
    if (ov) ov.remove();
    if (!a) return;
    const idx = (a.items || []).findIndex(it => !window.hwItemDone(it));
    if (idx === -1) return showToast('✅', 'Это ДЗ уже выполнено', 'bg-emerald-500', 'border-emerald-700');
    window.startHwItem(id, idx);
};

// Запустить конкретный этап ДЗ (настраивает задание/период/режим и фокус прогресса).
window.startHwItem = function(id, idx) {
    const a = (window.state.stats.assignments || []).find(x => x.id === id);
    if (!a) return;
    const it = (a.items || [])[idx];
    if (!it) return;
    window.state.activeHw = { id, itemIndex: idx };
    const mm = HW_METRIC_META[it.metric] || HW_METRIC_META.lines;
    if ($('filter-period')) $('filter-period').value = it.period || 'all';
    if (it.period === 'custom') {
        if ($('custom-year-start')) $('custom-year-start').value = it.yearStart || 862;
        if ($('custom-year-end')) $('custom-year-end').value = it.yearEnd || 2026;
    }
    const total = (a.items || []).length;
    const m = HW_TASK_META[it.task] || { emoji: '📝', name: it.task };
    showToast('📚', `Этап ${idx + 1} из ${total}: ${mm.verb.toLowerCase()} ${it.goal} ${mm.unit}`, 'bg-indigo-500', 'border-indigo-700');
    quickStartGame(it.task || 'task4', mm.mode);
};

// Вызывается после засчитанного прогресса. Если активный этап выполнен — автопереход к следующему,
// либо завершение ДЗ. Возвращает true, если поток ДЗ перехватил управление.
window.maybeAdvanceHw = function() {
    const ah = window.state.activeHw;
    if (!ah) return false;
    if (window.refreshHwState) window.refreshHwState();
    const a = (window.state.stats.assignments || []).find(x => x.id === ah.id);
    if (!a) { window.state.activeHw = null; return false; }
    const curItem = (a.items || [])[ah.itemIndex];
    if (curItem && !window.hwItemDone(curItem)) return false; // этап ещё не завершён — продолжаем его

    // следующий невыполненный этап
    const nextIdx = (a.items || []).findIndex(it => !window.hwItemDone(it));
    if (nextIdx !== -1) {
        haptic('success');
        setTimeout(() => window.startHwItem(a.id, nextIdx), 700);
        return true;
    }
    // все этапы выполнены → ДЗ завершено (статус выставит refreshHwState/completeAssignment)
    window.state.activeHw = null;
    haptic('success');
    setTimeout(() => {
        if (window.backToLobby) window.backToLobby();
        showToast('🎉', 'Домашнее задание выполнено!', 'bg-emerald-500', 'border-emerald-700');
        setTimeout(() => window.openHwTab && window.openHwTab(), 900);
    }, 600);
    return true;
};

// ── Всплывающий вызов на дуэль (сверху, не мешает решать) ──
let _challengeHideTimer = null;
let _challengeAudioCtx = null;
let _lastChallengeShownId = null;
const _dismissedChallenges = new Set();

// Короткий ненавязчивый «дзынь» (Web Audio, без ассетов). Можно заглушить: localStorage duel_challenge_muted=1
function _playChallengeChime() {
    try {
        if (localStorage.getItem('duel_challenge_muted') === '1') return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        _challengeAudioCtx = _challengeAudioCtx || new Ctx();
        if (_challengeAudioCtx.state === 'suspended') _challengeAudioCtx.resume();
        const ctx = _challengeAudioCtx, t = ctx.currentTime;
        [[880, 0], [1318.5, 0.10]].forEach(([f, dt]) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t + dt);
            g.gain.exponentialRampToValueAtTime(0.11, t + dt + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
            o.connect(g); g.connect(ctx.destination);
            o.start(t + dt); o.stop(t + dt + 0.2);
        });
    } catch (e) {}
}

window.showDuelChallenge = function(ch) {
    if (!ch || !ch.matchId) return;
    if (_dismissedChallenges.has(ch.matchId)) return;
    if (window.state.duel && (window.state.duel.active || window.state.duel.searching)) return;
    const name = String(ch.name || 'Игрок').replace(/[<>&]/g, '');
    const isNew = ch.matchId !== _lastChallengeShownId;   // привлекаем внимание только для нового вызова
    _lastChallengeShownId = ch.matchId;
    if (!document.getElementById('_duel_chal_css')) {
        const st = document.createElement('style');
        st.id = '_duel_chal_css';
        st.textContent = '@keyframes duelChalPulse{0%,100%{box-shadow:0 10px 30px rgba(79,70,229,.45)}50%{box-shadow:0 12px 44px rgba(124,58,237,.9)}}';
        document.head.appendChild(st);
    }
    let el = document.getElementById('duel-challenge-banner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'duel-challenge-banner';
        el.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 8px);transform:translateX(-50%) translateY(-140%);z-index:9500;display:flex;align-items:center;gap:10px;max-width:94vw;padding:9px 12px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 10px 30px rgba(79,70,229,.45);font-size:12px;font-weight:800;transition:transform .35s cubic-bezier(.2,.9,.3,1.2);pointer-events:auto';
        document.body.appendChild(el);
    }
    el.dataset.matchId = ch.matchId;
    el.innerHTML = `
        <span style="font-size:16px;flex-shrink:0">🗡️</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${name}</b> вызывает на дуэль!</span>
        <button onclick="window.acceptDuelChallenge&&window.acceptDuelChallenge('${ch.matchId}')" style="flex-shrink:0;background:#fff;color:#4f46e5;border:none;border-radius:9px;padding:6px 12px;font-size:12px;font-weight:900;cursor:pointer">Принять</button>
        <button onclick="window.dismissDuelChallenge&&window.dismissDuelChallenge('${ch.matchId}')" style="flex-shrink:0;background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:9px;width:26px;height:26px;font-size:13px;font-weight:900;cursor:pointer;line-height:1">✕</button>`;
    requestAnimationFrame(() => { el.style.transform = 'translateX(-50%) translateY(0)'; });
    if (isNew) {
        el.style.animation = 'duelChalPulse 1.1s ease-in-out 3';
        if (typeof haptic === 'function') haptic('warning');
        _playChallengeChime();
    }
    clearTimeout(_challengeHideTimer);
    _challengeHideTimer = setTimeout(() => window.hideDuelChallenge(), 26000);
};
window.hideDuelChallenge = function() {
    clearTimeout(_challengeHideTimer);
    const el = document.getElementById('duel-challenge-banner');
    if (!el) return;
    el.style.transform = 'translateX(-50%) translateY(-140%)';
    setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 350);
};
window.dismissDuelChallenge = function(matchId) {
    if (matchId) { _dismissedChallenges.add(matchId); setTimeout(() => _dismissedChallenges.delete(matchId), 40000); }
    window.hideDuelChallenge();
};

window.openEGEModal = function() {
    haptic('light');
    const r = estimateEGEScore(window.state.stats);
    const score = r.score;
    const color = score >= 85 ? '#0F6E56' : score >= 70 ? '#185FA5' : score >= 55 ? '#BA7517' : '#A32D2D';
    const grade = score >= 85 ? 'Отлично' : score >= 70 ? 'Хорошо' : score >= 55 ? 'Средне' : 'Слабо';

    const rows = [
        { label:'База', val:'+20', pct:29, color:'#888' },
        { label:'Задание №4 (факты)', val:'+'+Math.round(r.s4), pct:Math.round((r.s4/20)*100), color:'#185FA5' },
        { label:'Задание №3 (процессы)', val:'+'+Math.round(r.s3), pct:Math.round((r.s3/17)*100), color:'#1D9E75' },
        { label:'Задание №5 (даты)', val:'+'+Math.round(r.s5), pct:Math.round((r.s5/16)*100), color:'#8b5cf6' },
        { label:'Задание №7 (культура)', val:'+'+Math.round(r.s7), pct:Math.round((r.s7/12)*100), color:'#d97706' },
        { label:'Штраф за эпохи', val:'−'+r.pen, pct:Math.round((r.pen/25)*100), color:'#E24B4A', neg:true },
        { label:'Точность'+(r.accuracy?` (${r.accuracy}%)`:''), val:(r.accAdj>=0?'+':'')+r.accAdj, pct:Math.round((Math.abs(r.accAdj)/15)*100), color: r.accAdj >= 0 ? '#1D9E75' : '#E24B4A', neg: r.accAdj < 0 },
    ];

    const rowsHtml = rows.map(row => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:11px;color:#888;min-width:160px;flex-shrink:0">${row.label}</span>
        <div style="flex:1;height:5px;background:rgba(128,128,128,0.15);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${row.pct}%;background:${row.color};border-radius:3px;transition:width .3s"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${row.neg?'#E24B4A':row.color};min-width:36px;text-align:right">${row.val}</span>
      </div>`).join('');

    const potentialRow = r.ceiling < 100 && r.weakEra ? `
      <div style="background:rgba(234,179,8,0.12);border:0.5px solid rgba(234,179,8,0.4);border-radius:8px;padding:10px 14px;font-size:12px;color:#92400e;margin-top:12px">
        ⚠ Слабое место: <b>${r.weakEra}</b>. Потолок = ${r.ceiling}. Прокачай эту эпоху — выйдешь на ${Math.min(100, r.score + (100 - r.ceiling))}+.
      </div>` : '';

    const ceilRow = r.ceiling < 100 ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;opacity:.7">
        <span style="font-size:11px;color:#888;min-width:160px;flex-shrink:0">Потолок (слаб. эпоха)</span>
        <div style="flex:1;height:5px;background:rgba(128,128,128,0.15);border-radius:3px;overflow:hidden"><div style="height:100%;width:${r.ceiling}%;background:#888;border-radius:3px"></div></div>
        <span style="font-size:12px;font-weight:700;color:#888;min-width:36px;text-align:right">≤${r.ceiling}</span></div>` : '';

    const factsRow = `<div style="margin:12px 0 8px;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;font-weight:700">Выучено фактов</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${(function(){
          const mx4 = typeof bigData !== 'undefined' ? bigData.length : 500;
          const mx5 = typeof task5Data !== 'undefined' ? task5Data.length : 250;
          const mx3 = typeof task3Data !== 'undefined' ? task3Data.length : 150;
          const mx7 = typeof window.task7Data !== 'undefined' ? window.task7Data.length : 180;
          return [['📍 №4',r.d4,mx4,'#185FA5'],['👤 №5',r.d5,mx5,'#8b5cf6'],['🔗 №3',r.d3,mx3,'#1D9E75'],['🎨 №7',r.d7,mx7,'#d97706']].map(([lbl,cnt,mx,clr])=>`
          <div style="background:rgba(128,128,128,0.07);border-radius:8px;padding:8px 10px">
            <div style="font-size:11px;color:#888;margin-bottom:4px">${lbl}</div>
            <div style="font-size:16px;font-weight:700;color:${clr}">${cnt}<span style="font-size:10px;font-weight:400;color:#aaa"> / ${mx}</span></div>
            <div style="margin-top:4px;height:3px;background:rgba(128,128,128,0.15);border-radius:2px"><div style="height:100%;width:${Math.min(100,Math.round(cnt/mx*100))}%;background:${clr};border-radius:2px"></div></div>
          </div>`).join('');
        })()}
      </div>`;

    const overlayId = 'ege-score-overlay';
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;padding:0';
        overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="background:var(--tw-bg-opacity,1);background-color:#fff;width:100%;max-width:480px;border-radius:24px 24px 0 0;padding:24px 20px 32px;max-height:90vh;overflow-y:auto" class="dark:bg-[#1e1e1e]">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#888">Прогноз ЕГЭ по истории</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:2px">
            <span style="font-size:48px;font-weight:500;color:${color};line-height:1">${score}</span>
            <span style="font-size:13px;color:${color};font-weight:700">${grade}</span>
          </div>
        </div>
        <button onclick="document.getElementById('${overlayId}').remove()" style="font-size:20px;color:#aaa;background:none;border:none;cursor:pointer;padding:4px 8px">✕</button>
      </div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:#888;margin-bottom:8px">Из чего складывается</div>
      ${rowsHtml}${ceilRow}${potentialRow}${factsRow}
      <div style="margin-top:16px;font-size:10px;color:#aaa;text-align:center">Факты — основной сигнал (65 оч.), точность — до ±15 оч., база — 20. Не учитывает задания 18–24.</div>
    </div>`;
};

function updateGlobalUI() {
    const now = Date.now();
    let totalL = 0, freshL = 0;
    Object.values(window.state.stats.factStreaks || {}).forEach(d => {
        if (window.isFactLearned(d)) { totalL++; if (d.nextReview > now) freshL++; }
    });

    const EGE_DATE = new Date('2026-06-01T07:00:00Z');
    const daysLeft = Math.max(0, Math.ceil((EGE_DATE - now) / 86400000));

    let totalCorrect = 0, totalAttempts = 0;
    const es = window.state.stats.eraStats || {};
    ['task3','task4','task5','task7'].forEach(tk => {
        ['early','18th','19th','20th'].forEach(era => {
            const e = (es[tk] || {})[era] || {};
            totalCorrect += e.correct || 0;
            totalAttempts += e.total || 0;
        });
    });
    const accuracy = totalAttempts >= 10 ? Math.round(totalCorrect / totalAttempts * 100) : null;

    const egePoints = window.state.stats.egePoints || 0;
    const egeResult = estimateEGEScore(window.state.stats);
    const sc = egeResult.score;

    const hwTotal = window.state.stats.hwFlashcardsToSolve || 0;
    const hwMode = hwTotal > 0 ? {
        total: hwTotal,
        t3: window.state.stats.hwTask3 || 0,
        t4: window.state.stats.hwTask4 || 0,
        t5: window.state.stats.hwTask5 || 0,
        t7: window.state.stats.hwTask7 || 0,
    } : null;
    renderTopBar({ daysLeft, sc, egePoints, totalL, totalSolved: window.state.stats.totalSolvedEver || 0, hwMode });

    const egeEl = $('stat-ege');
    if (egeEl) {
        egeEl.textContent = sc;
        egeEl.className = 'text-[14px] sm:text-[16px] font-black text-[#fbbf24] leading-none group-hover:scale-110 transition-transform';
    }
    const egeRing = $('ege-ring');
    if (egeRing) {
        const circumference = 97.4;
        const pct = Math.min(sc / 100, 1);
        egeRing.style.strokeDashoffset = circumference * (1 - pct);
        egeRing.style.stroke = '#fbbf24';
    }
    if ($('stat-days')) updateText($('stat-days'), daysLeft);

    updateText($('stat-streak'), window.state.stats.streak);
    updateText($('stat-solved'), window.state.stats.egePoints || 0);
    if ($('zen-stat-solved')) updateText($('zen-stat-solved'), window.state.stats.egePoints || 0);
    updateText($('stat-learned'), totalL);
    updateText($('modal-stat-solved'), window.state.stats.totalSolvedEver);
    updateText($('modal-stat-mistakes'), window.state.mistakesPool.length);

    const sbt = window.state.stats.solvedByTask || {};
    if ($('modal-stat-task3')) $('modal-stat-task3').textContent = sbt.task3 || 0;
    if ($('modal-stat-task4')) updateText($('modal-stat-task4'), sbt.task4 || 0);
    if ($('modal-stat-task5')) updateText($('modal-stat-task5'), sbt.task5 || 0);
    if ($('modal-stat-task7')) updateText($('modal-stat-task7'), sbt.task7 || 0);

    if (window.state.isHomeworkMode && window.state.hwTargetIndices && window.state.hwTargetIndices.length > 0 && $('hw-remaining'))
        updateText($('hw-remaining'), window.state.hwCurrentPool.length);

    if (window.state.stats.hwFlashcardsToSolve > 0) {
        if ($('lobby-hw-banner')) $('lobby-hw-banner').classList.remove('hidden');
        const activeN = window.countActiveAssignments ? window.countActiveAssignments() : 0;
        if ($('lobby-hw-remaining')) updateText($('lobby-hw-remaining'), activeN || window.state.stats.hwFlashcardsToSolve);
        const dlRawL = localStorage.getItem('teacher_hw_deadline');
        if ($('lobby-hw-deadline')) $('lobby-hw-deadline').textContent = dlRawL
            ? ('до ' + new Date(dlRawL + 'T00:00:00').toLocaleDateString('ru-RU', {day:'numeric',month:'long'})) : '';
    } else {
        if ($('lobby-hw-banner')) $('lobby-hw-banner').classList.add('hidden');
    }
    if (window.updateHwNavBadge) window.updateHwNavBadge();

    let h = totalL === 0 ? 100 : Math.round((freshL / totalL) * 100);
    if ($('stat-memory')) {
        const mem = $('stat-memory');
        mem.classList.remove('text-emerald-400','text-rose-400','text-yellow-400');
        if (h < 50) mem.classList.add('text-rose-400');
        else if (h < 80) mem.classList.add('text-yellow-400');
        else mem.classList.add('text-emerald-400');
        updateText(mem, h + '%');
    }
}

let _headerCenterBackup = null;
function renderTopBar({ daysLeft, sc, egePoints, totalL, totalSolved, hwMode }) {
    const center = document.getElementById('header-center');
    if (!center) return;

    if (_headerCenterBackup) {
        center.innerHTML = _headerCenterBackup;
        _headerCenterBackup = null;
    }
}

let toastTimeout = null;
function showToast(emoji, text, bg, border) { const t = $('joke-toast'), c = $('toast-content'); c.innerHTML = `<span>${emoji}</span><span>${text}</span>`; c.className = `${bg} ${border} text-slate-50 font-bold text-xs sm:text-sm px-4 py-2 rounded-l-lg shadow-lg flex items-center gap-2 border-y-2 border-l-2`; t.classList.remove('translate-x-full'); if (toastTimeout) clearTimeout(toastTimeout); toastTimeout = setTimeout(() => t.classList.add('translate-x-full'), 2000); }

function endGame() {
    clearInterval(window.state.timerInterval); $('modal-score').innerText = window.state.stats.streak;
    if (window.state.currentMode === 'speedrun') { if (window.state.stats.streak > (window.state.stats.bestSpeedrunScore || 0)) { window.state.stats.bestSpeedrunScore = window.state.stats.streak; checkAchievements(); } }
    saveLocal(); 
    syncNow();   
    showModal('game-over-modal'); $('board-overlay').classList.remove('hidden');
}

window.closeGameOverModal = function() { 
    if (window.state.isHomeworkMode) window.location.href = window.location.pathname; 
    else { hideModal('game-over-modal'); $('board-overlay').classList.add('hidden'); backToLobby(); } 
};

function shareTelegram() { const text = `🔥 Мой стрик в тренажере ЕГЭ по истории — ${window.state.stats.streak}! Попробуй побить: `; window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`); }

window.openStatsModal = function() {
    updateGlobalUI(); if (window.loadStudentLeaderboard) window.loadStudentLeaderboard();
    if ($('stats-era-container')) {
        const tasks = [
            { key: 'task3', label: '🔗 Задание №3', color: 'text-emerald-600 dark:text-emerald-400' },
            { key: 'task4', label: '📍 Задание №4', color: 'text-blue-600 dark:text-blue-400' },
            { key: 'task5', label: '👤 Задание №5', color: 'text-purple-600 dark:text-purple-400' },
            { key: 'task7', label: '🎨 Задание №7', color: 'text-amber-600 dark:text-amber-400' },
        ];
        let eH = '';
        tasks.forEach(({ key, label, color }) => {
            const taskEra = (window.state.stats.eraStats || {})[key] || {};
            const totalAttempts = Object.values(taskEra).reduce((s, e) => s + (e.total || 0), 0);
            if (!totalAttempts) return;
            eH += `<div class="mb-3"><div class="text-[10px] font-black ${color} uppercase tracking-widest mb-2 px-1">${label}</div>`;
            for (const [eKey, eName] of Object.entries(TASK_EPOCH_NAMES)) {
                const e = taskEra[eKey] || { correct: 0, total: 0 };
                if (!e.total) continue;
                const pc = Math.round((e.correct / e.total) * 100);
                const pcColor = pc > 80 ? 'text-emerald-500' : pc > 50 ? 'text-yellow-500' : 'text-rose-500';
                const barColor = pc > 80 ? '#10b981' : pc > 50 ? '#f59e0b' : '#f43f5e';
                eH += `<div class="flex items-center gap-3 bg-gray-50 dark:bg-[#181818] p-2.5 rounded-xl border border-gray-100 dark:border-[#2c2c2c] mb-1.5">
                    <span class="text-[10px] font-black text-gray-500 dark:text-gray-400 min-w-[90px]">${eName}</span>
                    <div class="flex-1 h-1.5 bg-gray-200 dark:bg-[#2c2c2c] rounded-full overflow-hidden">
                        <div style="width:${pc}%;background:${barColor}" class="h-full rounded-full"></div>
                    </div>
                    <span class="text-xs font-black ${pcColor} min-w-[42px] text-right">${pc}% <span class="text-gray-400 font-normal text-[10px]">(${e.correct}/${e.total})</span></span>
                </div>`;
            }
            eH += '</div>';
        });
        $('stats-era-container').innerHTML = eH || '<p class="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center py-4">Ещё нет данных</p>';
    }
    if ($('stats-daily-container')) { const dStat = window.state.stats.dailyStats || {}; const dts = Object.keys(dStat).sort((a,b) => new Date(b) - new Date(a)).slice(0, 7); if (dts.length > 0) { let dH = ''; dts.forEach(d => { const day = dStat[d]; const mins = Math.floor((day.timeSpent || 0) / 60); const t3 = day.solvedTask3 || 0; const t4 = day.solvedTask4 || 0; const t5 = day.solvedTask5 || 0; const t7 = day.solvedTask7 || 0; const total = day.solved || 0; const taskParts = []; if (t3) taskParts.push(`<span class="text-emerald-500">🔗${t3}</span>`); if (t4) taskParts.push(`<span class="text-blue-500">📍${t4}</span>`); if (t5) taskParts.push(`<span class="text-purple-500">👤${t5}</span>`); if (t7) taskParts.push(`<span class="text-amber-500">🎨${t7}</span>`); const taskStr = taskParts.length > 0 ? taskParts.join(' ') : `<span class="text-examBlue dark:text-blue-400">${total}</span>`; dH += `<div class="bg-gray-50 dark:bg-[#181818] p-3 rounded-xl border border-gray-100 dark:border-[#2c2c2c]"><div class="flex justify-between items-center"><span class="text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">${new Date(d).toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'})}</span><span class="font-bold text-yellow-600 dark:text-yellow-500 text-[11px]">⏱ ${mins} мин</span></div><div class="flex gap-3 mt-1.5 text-[11px] font-black">${taskStr}<span class="text-gray-400 ml-auto">Всего: ${total}</span></div></div>`; }); $('stats-daily-container').innerHTML = dH; } else $('stats-daily-container').innerHTML = '<p class="text-[11px] font-bold text-gray-500 text-center py-4 uppercase tracking-widest">Пока нет данных.</p>'; }
    showModal('stats-modal');
};

window.openMistakesListModal = function() {
    const cont = $('mistakes-list-container'); const pool = window.state.mistakesPool || [];
    if (pool.length === 0) cont.innerHTML = '<div class="text-center p-8 text-gray-500 font-bold text-sm uppercase tracking-widest bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2c2c2c]">Ошибок нет! Вы молодец 🎉</div>';
    else { 
        let ht = '<div class="flex flex-col gap-2">'; 
        pool.forEach((m, idx) => { 
            let mTitle = m.task === 'task7' ? '🎨 Задание 7' : (m.task === 'task5' ? '👤 Задание 5' : (m.task === 'task3' ? '🔗 Задание 3' : '📍 Задание 4'));
            let mContent = m.task === 'task7' ? `<span class="text-amber-600 dark:text-amber-400">${m.fact.culture}</span> ➡️ ${m.fact.trait}` : (m.task === 'task5' ? `<span class="text-blue-600 dark:text-blue-400">${m.fact.person}</span> ➡️ ${m.fact.event}` : (m.task === 'task3' ? `<span class="text-emerald-600 dark:text-emerald-400">${m.fact.process}</span> ➡️ ${m.fact.fact}` : `<span class="text-emerald-600 dark:text-emerald-400">${m.fact.geo}</span> | <span class="text-blue-600 dark:text-blue-400">${m.fact.year}</span><br>${m.fact.event}`));
            ht += `<div class="bg-white dark:bg-[#1e1e1e] p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm flex gap-3 text-sm"><div class="font-black text-rose-300 w-4 text-right shrink-0">${idx + 1}.</div><div class="flex flex-col"><span class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">${mTitle}</span><span class="font-medium text-gray-800 dark:text-gray-300 leading-tight">${mContent}</span></div></div>`; 
        }); 
        ht += '</div>'; 
        cont.innerHTML = ht; 
    }
    showModal('mistakes-list-modal');
};

window.openProfileModal = function() {
    $('profile-name-input').value = localStorage.getItem('student_manual_name') || '';
    $('profile-class-code').value = localStorage.getItem('student_class_code') || '';
    const gEmail = localStorage.getItem('google_email');
    if ($('profile-google-status')) {
        $('profile-google-status').textContent = gEmail ? '✅ ' + gEmail : 'Не привязан';
        $('profile-google-status').className = gEmail ? 'text-[11px] font-bold text-emerald-600 mt-1' : 'text-[11px] font-bold text-gray-400 mt-1';
    }
    // Refresh skin picker active state
    const currentSkin = localStorage.getItem('ege_skin') || DEFAULT_SKIN;
    updateSkinPicker(currentSkin);
    showModal('profile-modal');
};
window.saveProfileName = function() { const nm = $('profile-name-input').value.trim(), cd = $('profile-class-code').value.trim(); const prevCd = localStorage.getItem('student_class_code') || ''; if (nm) localStorage.setItem('student_manual_name', nm); if (cd !== undefined) localStorage.setItem('student_class_code', cd); showToast('✅', 'Профиль сохранен!', 'bg-emerald-500', 'border-emerald-700'); hideModal('profile-modal'); if (window.syncProgressToCloud) window.syncProgressToCloud(); if (cd && cd !== prevCd && window.pullClassAssignments) window.pullClassAssignments(cd); };

window.openAchievementsModal = function() {
    const gr = $('achievements-grid'); if (gr && typeof achievementsList !== 'undefined') { let ht = ''; achievementsList.forEach(a => { const isU = window.state.stats.achievements.includes(a.id); ht += `<div class="achievement-card bg-white dark:bg-[#1e1e1e] border ${isU ? 'border-yellow-400 shadow-[0_4px_15px_rgba(250,204,21,0.2)]' : 'border-gray-100 dark:border-[#2c2c2c]'} rounded-2xl p-4 flex flex-col items-center text-center relative ${isU ? '' : 'achievement-locked'}"><div class="text-4xl mb-3 drop-shadow-sm">${a.icon}</div><h4 class="font-black text-[10px] sm:text-xs text-gray-800 dark:text-gray-300 mb-1 leading-tight uppercase tracking-wide">${a.name}</h4><p class="text-[9px] font-bold text-gray-400 leading-tight mt-1">${a.desc}</p></div>`; }); gr.innerHTML = ht; }
    showModal('achievements-modal');
};

window.openTeacherModal = function() {
    let tc = localStorage.getItem('teacher_class_code'); if(!tc) { tc = Math.floor(1000 + Math.random() * 9000).toString(); localStorage.setItem('teacher_class_code', tc); } $('teacher-class-code-input').value = tc;
    switchTeacherTab('stats'); showModal('teacher-modal');
};

window.saveTeacherClassCode = function() { const cd = $('teacher-class-code-input').value.trim(); if(cd) localStorage.setItem('teacher_class_code', cd); if (window.loadClassProgress) window.loadClassProgress(); };
window.switchTeacherTab = function(tab) { ['stats', 'weekly'].forEach(t => { $(`teacher-tab-${t}`).classList.add('hidden'); $(`teacher-tab-${t}`).classList.remove('flex'); $(`tab-btn-${t}`).className = "py-3 text-[9px] sm:text-xs font-black border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors uppercase tracking-wide leading-none truncate"; }); $(`teacher-tab-${tab}`).classList.remove('hidden'); $(`teacher-tab-${tab}`).classList.add('flex'); $(`tab-btn-${tab}`).className = "py-3 text-[9px] sm:text-xs font-black border-b-2 border-examBlue text-examBlue dark:text-blue-400 transition-colors uppercase tracking-wide leading-none truncate"; if (window.loadClassProgress) window.loadClassProgress(); };

window.openGlobalTopModal = function() {
    showModal('global-top-modal');
    if (window.loadGlobalLeaderboard) window.loadGlobalLeaderboard();
};

window.copyTextReport = function() {
    const s = window.state.stats;
    let t = `🏛 Тренажер ЕГЭ: История\n\n`;
    t += `📊 Всего решено: ${s.totalSolvedEver || 0}\n`;
    t += `🔥 Текущий стрик: ${s.streak || 0}\n`;
    
    if (typeof estimateEGEScore === 'function') {
        const egeResult = estimateEGEScore(s);
        t += `🎓 Прогноз ЕГЭ: ${egeResult.score} баллов\n\n`;
    }

    t += `📈 Точность по эпохам:\n`;
    const tasks = ['task3', 'task4', 'task5', 'task7'];
    const eMap = { 'early': 'Древность', '18th': 'XVIII в.', '19th': 'XIX в.', '20th': 'XX в.' };
    const combinedEra = { 'early': {c:0,t:0}, '18th': {c:0,t:0}, '19th': {c:0,t:0}, '20th': {c:0,t:0} };
    
    tasks.forEach(tk => {
        if (!s.eraStats || !s.eraStats[tk]) return;
        Object.keys(eMap).forEach(eKey => {
            if (s.eraStats[tk][eKey]) {
                combinedEra[eKey].c += s.eraStats[tk][eKey].correct || 0;
                combinedEra[eKey].t += s.eraStats[tk][eKey].total || 0;
            }
        });
    });
    
    Object.keys(eMap).forEach(eKey => {
        const correct = combinedEra[eKey].c;
        const total = combinedEra[eKey].t;
        if (total === 0) return;
        const pct = Math.round((correct / total) * 100);
        t += `- ${eMap[eKey]}: ${pct}% (${correct} из ${total})\n`;
    });

    if (window.state.mistakesPool && window.state.mistakesPool.length > 0) { 
        t += `\n⚠️ Ошибки:\n`; 
        window.state.mistakesPool.forEach((m, i) => { 
            if (m.task === 'task7') t += `${i + 1}. ${m.fact.culture} ➡️ ${m.fact.trait}\n`;
            else if (m.task === 'task5') t += `${i + 1}. ${m.fact.event} ➡️ ${m.fact.person}\n`;
            else if (m.task === 'task3') t += `${i + 1}. ${m.fact.process} ➡️ ${m.fact.fact}\n`;
            else t += `${i + 1}. ${m.fact.geo} | ${m.fact.event} | ${m.fact.year}\n`; 
        }); 
    } else t += `\n🎉 Ошибок нет!\n`; 
    
    const copyFn = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('📋', 'Скопировано!', 'bg-emerald-500', 'border-emerald-700'); }; 
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => showToast('📋', 'Скопировано!', 'bg-emerald-500', 'border-emerald-700')).catch(copyFn); else copyFn();
};

window.handleLogoClick = function() {
    if (typeof haptic === 'function') haptic('light');
    showToast('🏛️', 'Тренажер ЕГЭ: История (ULTIMATE)', 'bg-blue-500', 'border-blue-700');
};
