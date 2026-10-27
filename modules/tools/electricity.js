import { readJSON, writeJSON } from '../../shared/storage.js';
import { escapeHTML } from '../../shared/dom.js';

export const id = 'electricity';
export const title = '电费管家';
export const status = 'available';

const STORAGE_KEY = 'mod-electricity-records-v1';
const MAX_BALANCE = 1e12;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const TEMPLATE = `
  <section class="mod-electricity-root" aria-label="电费管家">
    <div class="mod-electricity-summary">
      <div class="mod-electricity-summary-top">
        <div>
          <p class="mod-electricity-kicker">LOCAL_LEDGER // 本机电费账本</p>
          <h3 class="mod-electricity-summary-title">累计消耗</h3>
        </div>
        <span class="mod-electricity-local"><span class="mod-electricity-local-dot" aria-hidden="true"></span>仅保存在本机</span>
      </div>
      <div class="mod-electricity-summary-body">
        <div class="mod-electricity-summary-main">
          <p class="mod-electricity-total" id="mod-electricity-total">¥0.00</p>
          <p class="mod-electricity-range" id="mod-electricity-range">还没有记录</p>
        </div>
        <dl class="mod-electricity-stats">
          <div class="mod-electricity-stat">
            <dt class="mod-electricity-stat-label">当前余额</dt>
            <dd class="mod-electricity-stat-value" id="mod-electricity-current">—</dd>
          </div>
          <div class="mod-electricity-stat">
            <dt class="mod-electricity-stat-label">记录条数</dt>
            <dd class="mod-electricity-stat-value" id="mod-electricity-count">0</dd>
          </div>
          <div class="mod-electricity-stat">
            <dt class="mod-electricity-stat-label">存储模式</dt>
            <dd class="mod-electricity-stat-value mod-electricity-stat-value--online">LOCAL</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="mod-electricity-grid">
      <section class="mod-electricity-card" aria-labelledby="mod-electricity-entry-title">
        <div class="mod-electricity-card-head">
          <div>
            <p class="mod-electricity-kicker">NEW_ENTRY // 新记录</p>
            <h3 class="mod-electricity-card-title" id="mod-electricity-entry-title">记录余额</h3>
          </div>
          <span class="mod-electricity-pill" id="mod-electricity-today">今天</span>
        </div>

        <form class="mod-electricity-form" id="mod-electricity-entry-form" novalidate>
          <div class="mod-electricity-fields">
            <div class="mod-electricity-field">
              <label class="mod-electricity-label" for="mod-electricity-entry-date">日期</label>
              <input class="mod-electricity-input" id="mod-electricity-entry-date" name="date" type="date" required aria-describedby="mod-electricity-entry-date-error">
              <p class="mod-electricity-error" id="mod-electricity-entry-date-error" aria-live="polite"></p>
            </div>
            <div class="mod-electricity-field">
              <label class="mod-electricity-label" for="mod-electricity-entry-balance">电费余额 <span class="mod-electricity-unit">元</span></label>
              <div class="mod-electricity-input-shell">
                <span class="mod-electricity-currency" aria-hidden="true">¥</span>
                <input class="mod-electricity-input mod-electricity-input--balance" id="mod-electricity-entry-balance" name="balance" type="number" inputmode="decimal" step="0.01" placeholder="0.00" autocomplete="off" required aria-describedby="mod-electricity-entry-balance-error">
              </div>
              <p class="mod-electricity-error" id="mod-electricity-entry-balance-error" aria-live="polite"></p>
            </div>
          </div>

          <p class="mod-electricity-hint">消耗金额 = 上次余额 − 本次余额；负数表示余额增加。</p>
          <button class="mod-electricity-button mod-electricity-button--primary mod-electricity-save" type="submit">保存记录</button>
        </form>
      </section>

      <section class="mod-electricity-card mod-electricity-card--records" aria-labelledby="mod-electricity-records-title">
        <div class="mod-electricity-card-head">
          <div>
            <p class="mod-electricity-kicker">HISTORY // 历史记录</p>
            <h3 class="mod-electricity-card-title" id="mod-electricity-records-title">记录列表</h3>
          </div>
          <span class="mod-electricity-pill" id="mod-electricity-list-count">0 条</span>
        </div>

        <div class="mod-electricity-empty" id="mod-electricity-empty">
          <span class="mod-electricity-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M13.2 2.4 4.9 13.2h5.5l-.8 8.4 8.5-10.9h-5.5l.6-8.3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </span>
          <p class="mod-electricity-empty-title">还没有记录</p>
          <p class="mod-electricity-empty-copy">在上方录入第一笔余额，下一条记录保存后会自动算出本次消耗。</p>
        </div>

        <ol class="mod-electricity-record-list" id="mod-electricity-record-list" aria-label="电费余额记录" hidden></ol>
      </section>
    </div>

    <section class="mod-electricity-card mod-electricity-card--data" aria-labelledby="mod-electricity-data-title">
      <div class="mod-electricity-card-head">
        <div>
          <p class="mod-electricity-kicker">BACKUP // 数据管理</p>
          <h3 class="mod-electricity-card-title" id="mod-electricity-data-title">数据管理</h3>
        </div>
        <span class="mod-electricity-pill">JSON 备份</span>
      </div>

      <div class="mod-electricity-data-actions">
        <button class="mod-electricity-data-button mod-electricity-data-button--export" id="mod-electricity-export" type="button">
          <svg class="mod-electricity-data-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0 4.2-4.2M12 15l-4.2-4.2M4.5 19.5h15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导出数据
        </button>
        <button class="mod-electricity-data-button mod-electricity-data-button--import" id="mod-electricity-import" type="button">
          <svg class="mod-electricity-data-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 15V3m0 0 4.2 4.2M12 3 7.8 7.2M4.5 19.5h15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导入数据
        </button>
        <button class="mod-electricity-data-button mod-electricity-data-button--clear" id="mod-electricity-clear" type="button">
          <svg class="mod-electricity-data-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M9.5 7V4.8h5V7m-7.8 0 .9 12.2h8.8L17.3 7M10 10.8v5.4m4-5.4v5.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          清空数据
        </button>
      </div>

      <input class="mod-electricity-file" id="mod-electricity-file" type="file" accept=".json,application/json" hidden>

      <p class="mod-electricity-note">
        <svg class="mod-electricity-note-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.5 10V7.5a5.5 5.5 0 0 1 11 0V10M5 10h14v10H5V10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
        所有数据只保存在当前浏览器。更换设备或清理浏览器数据前，请先导出一份 JSON 备份。
      </p>
    </section>

    <dialog class="mod-electricity-dialog" id="mod-electricity-edit-dialog" aria-labelledby="mod-electricity-edit-title">
      <div class="mod-electricity-modal">
        <button class="mod-electricity-close" id="mod-electricity-edit-close" type="button" aria-label="关闭编辑窗口">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        </button>
        <p class="mod-electricity-kicker">EDIT_RECORD // 修改余额</p>
        <h2 class="mod-electricity-modal-title" id="mod-electricity-edit-title">编辑记录</h2>
        <form class="mod-electricity-form" id="mod-electricity-edit-form" novalidate>
          <div class="mod-electricity-fields">
            <div class="mod-electricity-field">
              <label class="mod-electricity-label" for="mod-electricity-edit-date">日期</label>
              <input class="mod-electricity-input" id="mod-electricity-edit-date" type="date" required aria-describedby="mod-electricity-edit-date-error">
              <p class="mod-electricity-error" id="mod-electricity-edit-date-error" aria-live="polite"></p>
            </div>
            <div class="mod-electricity-field">
              <label class="mod-electricity-label" for="mod-electricity-edit-balance">电费余额 <span class="mod-electricity-unit">元</span></label>
              <div class="mod-electricity-input-shell">
                <span class="mod-electricity-currency" aria-hidden="true">¥</span>
                <input class="mod-electricity-input mod-electricity-input--balance" id="mod-electricity-edit-balance" type="number" inputmode="decimal" step="0.01" autocomplete="off" required aria-describedby="mod-electricity-edit-balance-error">
              </div>
              <p class="mod-electricity-error" id="mod-electricity-edit-balance-error" aria-live="polite"></p>
            </div>
          </div>
          <div class="mod-electricity-modal-actions">
            <button class="mod-electricity-button mod-electricity-button--ghost" id="mod-electricity-edit-cancel" type="button">取消</button>
            <button class="mod-electricity-button mod-electricity-button--primary" type="submit">保存修改</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog class="mod-electricity-dialog" id="mod-electricity-import-dialog" aria-labelledby="mod-electricity-import-title">
      <div class="mod-electricity-modal">
        <button class="mod-electricity-close" id="mod-electricity-import-close" type="button" aria-label="关闭导入窗口">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        </button>
        <p class="mod-electricity-kicker">IMPORT_JSON // 读取备份</p>
        <h2 class="mod-electricity-modal-title" id="mod-electricity-import-title">导入数据</h2>
        <div class="mod-electricity-import-summary">
          <span class="mod-electricity-import-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.5h7l4 4v13H7v-17Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3.5v4h4M9.8 12h4.4m-4.4 3.5h4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </span>
          <span class="mod-electricity-import-copy">
            <strong id="mod-electricity-import-name">数据文件.json</strong>
            <span id="mod-electricity-import-count">0 条记录</span>
          </span>
        </div>
        <p class="mod-electricity-modal-copy">合并导入会保留现有记录；覆盖导入会删除当前全部记录，只保留文件中的数据。</p>
        <div class="mod-electricity-modal-actions mod-electricity-modal-actions--triple">
          <button class="mod-electricity-button mod-electricity-button--ghost" id="mod-electricity-import-cancel" type="button">取消</button>
          <button class="mod-electricity-button mod-electricity-button--secondary" id="mod-electricity-import-merge" type="button">合并导入</button>
          <button class="mod-electricity-button mod-electricity-button--danger-ghost" id="mod-electricity-import-replace" type="button">覆盖本地</button>
        </div>
      </div>
    </dialog>

    <dialog class="mod-electricity-dialog" id="mod-electricity-confirm-dialog" aria-labelledby="mod-electricity-confirm-title" aria-describedby="mod-electricity-confirm-message">
      <div class="mod-electricity-modal">
        <button class="mod-electricity-close" id="mod-electricity-confirm-close" type="button" aria-label="关闭确认窗口">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
        </button>
        <p class="mod-electricity-kicker mod-electricity-kicker--danger">CONFIRM_ACTION // 不可撤销</p>
        <h2 class="mod-electricity-modal-title" id="mod-electricity-confirm-title">确认操作</h2>
        <p class="mod-electricity-modal-copy" id="mod-electricity-confirm-message"></p>
        <div class="mod-electricity-modal-actions">
          <button class="mod-electricity-button mod-electricity-button--ghost" id="mod-electricity-confirm-cancel" type="button">取消</button>
          <button class="mod-electricity-button mod-electricity-button--danger" id="mod-electricity-confirm-ok" type="button">确认</button>
        </div>
      </div>
    </dialog>

    <div class="mod-electricity-toast" id="mod-electricity-toast" role="status" aria-live="polite" data-type="success">
      <span class="mod-electricity-toast-dot" aria-hidden="true"></span>
      <span id="mod-electricity-toast-message"></span>
    </div>
  </section>
`;

export function mount(container) {
  container.innerHTML = TEMPLATE;

  const $ = (selector) => container.querySelector(selector);
  const refs = {
    total: $('#mod-electricity-total'),
    range: $('#mod-electricity-range'),
    current: $('#mod-electricity-current'),
    count: $('#mod-electricity-count'),
    today: $('#mod-electricity-today'),
    entryForm: $('#mod-electricity-entry-form'),
    entryDate: $('#mod-electricity-entry-date'),
    entryBalance: $('#mod-electricity-entry-balance'),
    entryDateError: $('#mod-electricity-entry-date-error'),
    entryBalanceError: $('#mod-electricity-entry-balance-error'),
    empty: $('#mod-electricity-empty'),
    recordList: $('#mod-electricity-record-list'),
    listCount: $('#mod-electricity-list-count'),
    exportButton: $('#mod-electricity-export'),
    importButton: $('#mod-electricity-import'),
    clearButton: $('#mod-electricity-clear'),
    importInput: $('#mod-electricity-file'),
    editDialog: $('#mod-electricity-edit-dialog'),
    editForm: $('#mod-electricity-edit-form'),
    editDate: $('#mod-electricity-edit-date'),
    editBalance: $('#mod-electricity-edit-balance'),
    editDateError: $('#mod-electricity-edit-date-error'),
    editBalanceError: $('#mod-electricity-edit-balance-error'),
    editClose: $('#mod-electricity-edit-close'),
    editCancel: $('#mod-electricity-edit-cancel'),
    importDialog: $('#mod-electricity-import-dialog'),
    importName: $('#mod-electricity-import-name'),
    importCount: $('#mod-electricity-import-count'),
    importClose: $('#mod-electricity-import-close'),
    importCancel: $('#mod-electricity-import-cancel'),
    importMerge: $('#mod-electricity-import-merge'),
    importReplace: $('#mod-electricity-import-replace'),
    confirmDialog: $('#mod-electricity-confirm-dialog'),
    confirmTitle: $('#mod-electricity-confirm-title'),
    confirmMessage: $('#mod-electricity-confirm-message'),
    confirmClose: $('#mod-electricity-confirm-close'),
    confirmCancel: $('#mod-electricity-confirm-cancel'),
    confirmOk: $('#mod-electricity-confirm-ok'),
    toast: $('#mod-electricity-toast'),
    toastMessage: $('#mod-electricity-toast-message')
  };

  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set();

  let disposed = false;
  let records = [];
  let editingId = null;
  let pendingImport = null;
  let pendingConfirm = null;
  let toastTimer = 0;
  let loadWarning = '';

  init();

  function init() {
    loadRecords();
    setToday();
    bindEvents();
    renderAll();

    if (loadWarning) {
      later(() => showToast(loadWarning, 'error'), 400);
    }
  }

  function bindEvents() {
    refs.entryForm.addEventListener('submit', handleEntrySubmit, { signal });
    refs.entryDate.addEventListener('input', () => clearFieldError(refs.entryDate, refs.entryDateError), { signal });
    refs.entryBalance.addEventListener('input', () => clearFieldError(refs.entryBalance, refs.entryBalanceError), { signal });

    refs.recordList.addEventListener('click', handleRecordAction, { signal });
    refs.exportButton.addEventListener('click', exportRecords, { signal });
    refs.importButton.addEventListener('click', () => refs.importInput.click(), { signal });
    refs.importInput.addEventListener('change', handleFileSelection, { signal });
    refs.clearButton.addEventListener('click', requestClearAll, { signal });

    refs.editForm.addEventListener('submit', handleEditSubmit, { signal });
    refs.editDate.addEventListener('input', () => clearFieldError(refs.editDate, refs.editDateError), { signal });
    refs.editBalance.addEventListener('input', () => clearFieldError(refs.editBalance, refs.editBalanceError), { signal });
    refs.editClose.addEventListener('click', () => closeModal(refs.editDialog), { signal });
    refs.editCancel.addEventListener('click', () => closeModal(refs.editDialog), { signal });
    refs.editDialog.addEventListener('close', () => {
      editingId = null;
      clearFieldError(refs.editDate, refs.editDateError);
      clearFieldError(refs.editBalance, refs.editBalanceError);
    }, { signal });

    refs.importClose.addEventListener('click', () => closeModal(refs.importDialog), { signal });
    refs.importCancel.addEventListener('click', () => closeModal(refs.importDialog), { signal });
    refs.importMerge.addEventListener('click', () => finishImport('merge'), { signal });
    refs.importReplace.addEventListener('click', () => finishImport('replace'), { signal });
    refs.importDialog.addEventListener('close', () => {
      pendingImport = null;
    }, { signal });

    refs.confirmClose.addEventListener('click', () => closeModal(refs.confirmDialog), { signal });
    refs.confirmCancel.addEventListener('click', () => closeModal(refs.confirmDialog), { signal });
    refs.confirmOk.addEventListener('click', runConfirmAction, { signal });
    refs.confirmDialog.addEventListener('close', () => {
      pendingConfirm = null;
    }, { signal });

    [refs.editDialog, refs.importDialog, refs.confirmDialog].forEach((dialog) => {
      dialog.addEventListener(
        'click',
        (event) => {
          if (event.target === dialog) closeModal(dialog);
        },
        { signal }
      );
    });
  }

  function later(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function loadRecords() {
    const raw = readJSON(STORAGE_KEY, null);

    if (raw === null) {
      records = [];
      return;
    }

    if (!Array.isArray(raw)) {
      records = [];
      loadWarning = '本地记录格式异常，已从空记录开始（原数据未被覆盖）';
      return;
    }

    const normalized = normalizeRecords(raw, false);
    records = normalized.records;
    if (normalized.skipped > 0) {
      loadWarning = `有 ${normalized.skipped} 条本地记录格式异常，已跳过`;
    }
  }

  function persistRecords() {
    const saved = writeJSON(STORAGE_KEY, records);
    if (!saved) showToast('无法写入浏览器本地存储，本次修改可能不会保留', 'error');
    return saved;
  }

  function normalizeRecords(raw, strict) {
    if (!Array.isArray(raw)) {
      if (strict) throw new Error('记录数据必须是数组');
      return { records: [], skipped: 0 };
    }

    const normalized = [];
    const seenIds = new Set();
    let skipped = 0;

    raw.forEach((source, index) => {
      try {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
          throw new Error('记录格式无效');
        }

        const date = typeof source.date === 'string' ? source.date.trim() : '';
        if (!isDateKey(date)) throw new Error('日期无效');

        const balance =
          typeof source.balance === 'number'
            ? source.balance
            : typeof source.balance === 'string' && source.balance.trim() !== ''
              ? Number(source.balance)
              : Number.NaN;

        if (!Number.isFinite(balance) || Math.abs(balance) > MAX_BALANCE) {
          throw new Error('余额无效');
        }

        let recordId =
          typeof source.id === 'string' && source.id.trim() ? source.id.trim() : createRecordId();
        while (seenIds.has(recordId)) recordId = createRecordId();
        seenIds.add(recordId);

        const createdAtCandidate = Number(source.createdAt);
        const createdAt = Number.isFinite(createdAtCandidate)
          ? createdAtCandidate
          : Date.parse(date) + index;

        normalized.push({
          id: recordId,
          date,
          balance: Math.round(balance * 100) / 100,
          createdAt: Number.isFinite(createdAt) ? createdAt : Date.now() + index
        });
      } catch (error) {
        if (strict) {
          throw new Error(`第 ${index + 1} 条记录格式无效`);
        }
        skipped += 1;
      }
    });

    return { records: normalized, skipped };
  }

  function handleEntrySubmit(event) {
    event.preventDefault();

    const result = validateEntry(refs.entryDate.value, refs.entryBalance.value, null);
    setFormErrors(result.errors, 'entry');

    if (result.errors.date) {
      refs.entryDate.focus();
      return;
    }
    if (result.errors.balance) {
      refs.entryBalance.focus();
      return;
    }

    records.push({
      id: createRecordId(),
      date: result.date,
      balance: result.balance,
      createdAt: Date.now()
    });

    const saved = persistRecords();
    renderAll();
    refs.entryBalance.value = '';
    refs.entryDate.value = todayKey();
    clearFieldError(refs.entryDate, refs.entryDateError);
    clearFieldError(refs.entryBalance, refs.entryBalanceError);
    refs.entryBalance.focus({ preventScroll: true });
    showToast(saved ? '记录已保存' : '记录已添加，但本地存储写入失败', saved ? 'success' : 'error');
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    if (!editingId) return;

    const result = validateEntry(refs.editDate.value, refs.editBalance.value, editingId);
    setFormErrors(result.errors, 'edit');

    if (result.errors.date) {
      refs.editDate.focus();
      return;
    }
    if (result.errors.balance) {
      refs.editBalance.focus();
      return;
    }

    const target = records.find((record) => record.id === editingId);
    if (!target) {
      closeModal(refs.editDialog);
      showToast('要编辑的记录已不存在', 'error');
      return;
    }

    target.date = result.date;
    target.balance = result.balance;
    const saved = persistRecords();
    closeModal(refs.editDialog);
    renderAll();
    showToast(saved ? '记录已更新' : '记录已更新，但本地存储写入失败', saved ? 'success' : 'error');
  }

  function validateEntry(dateValue, balanceValue, excludeId) {
    const errors = {};
    const date = String(dateValue || '').trim();
    const rawBalance = String(balanceValue || '').trim();

    if (!isDateKey(date)) {
      errors.date = '请选择有效日期';
    } else if (records.some((record) => record.date === date && record.id !== excludeId)) {
      errors.date = '该日期已有记录，请编辑已有记录';
    }

    const balance = Number(rawBalance);
    if (rawBalance === '' || !Number.isFinite(balance)) {
      errors.balance = '请输入有效余额';
    } else if (Math.abs(balance) > MAX_BALANCE) {
      errors.balance = '余额超出可记录范围';
    }

    return {
      errors,
      date,
      balance: Number.isFinite(balance) ? Math.round(balance * 100) / 100 : Number.NaN
    };
  }

  function setFormErrors(errors, prefix) {
    if (prefix === 'entry') {
      setFieldError(refs.entryDate, refs.entryDateError, errors.date || '');
      setFieldError(refs.entryBalance, refs.entryBalanceError, errors.balance || '');
      return;
    }

    setFieldError(refs.editDate, refs.editDateError, errors.date || '');
    setFieldError(refs.editBalance, refs.editBalanceError, errors.balance || '');
  }

  function setFieldError(input, errorElement, message) {
    errorElement.textContent = message;
    const field = input.closest('.mod-electricity-field');
    if (message) {
      field?.classList.add('mod-electricity-field--error');
      input.setAttribute('aria-invalid', 'true');
    } else {
      field?.classList.remove('mod-electricity-field--error');
      input.removeAttribute('aria-invalid');
    }
  }

  function clearFieldError(input, errorElement) {
    setFieldError(input, errorElement, '');
  }

  function handleRecordAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const record = records.find((item) => item.id === button.dataset.id);
    if (!record) return;

    if (button.dataset.action === 'edit') {
      openEditDialog(record);
    } else if (button.dataset.action === 'delete') {
      requestDelete(record);
    }
  }

  function openEditDialog(record) {
    editingId = record.id;
    refs.editDate.value = record.date;
    refs.editBalance.value = String(record.balance);
    clearFieldError(refs.editDate, refs.editDateError);
    clearFieldError(refs.editBalance, refs.editBalanceError);
    openModal(refs.editDialog);
    later(() => refs.editDate.focus({ preventScroll: true }), 30);
  }

  function requestDelete(record) {
    openConfirmDialog({
      title: '删除这条记录？',
      message: `将删除 ${formatDate(record.date)}，余额 ${formatMoney(record.balance)}。此操作不可撤销。`,
      confirmLabel: '删除',
      onConfirm: () => {
        records = records.filter((item) => item.id !== record.id);
        const saved = persistRecords();
        renderAll();
        showToast(saved ? '记录已删除' : '记录已删除，但本地存储写入失败', saved ? 'success' : 'error');
      }
    });
  }

  function requestClearAll() {
    if (!records.length) {
      showToast('目前没有可清空的记录', 'info');
      return;
    }

    openConfirmDialog({
      title: '清空全部记录？',
      message: `将清空本机保存的 ${records.length} 条记录，此操作不可撤销。建议先导出 JSON 备份。`,
      confirmLabel: '全部清空',
      onConfirm: () => {
        records = [];
        const saved = persistRecords();
        renderAll();
        showToast(saved ? '全部记录已清空' : '记录已清空，但本地存储写入失败', saved ? 'success' : 'error');
      }
    });
  }

  function openConfirmDialog({ title, message, confirmLabel, onConfirm }) {
    pendingConfirm = onConfirm;
    refs.confirmTitle.textContent = title;
    refs.confirmMessage.textContent = message;
    refs.confirmOk.textContent = confirmLabel;
    openModal(refs.confirmDialog);
    later(() => refs.confirmCancel.focus({ preventScroll: true }), 30);
  }

  function runConfirmAction() {
    const action = pendingConfirm;
    pendingConfirm = null;
    closeModal(refs.confirmDialog);
    if (typeof action === 'function') action();
  }

  function handleFileSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      showToast('文件过大，请选择 5MB 以内的 JSON 备份', 'error');
      return;
    }

    readImportFile(file);
  }

  async function readImportFile(file) {
    let parsed;

    try {
      const text = await file.text();
      if (disposed) return;
      parsed = JSON.parse(text);
    } catch (error) {
      if (!disposed) showToast('无法读取该 JSON 文件', 'error');
      return;
    }

    if (disposed) return;

    try {
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.records)
          ? parsed.records
          : null;

      if (!entries) throw new Error('记录格式无效');
      if (!entries.length) throw new Error('文件中没有记录');

      const normalized = normalizeRecords(entries, true);
      pendingImport = normalized.records;
      refs.importName.textContent = file.name;
      refs.importCount.textContent = `${normalized.records.length} 条记录`;
      openModal(refs.importDialog);
      later(() => refs.importCancel.focus({ preventScroll: true }), 30);
    } catch (error) {
      showToast(error.message === '文件中没有记录' ? '文件里没有可导入的记录' : 'JSON 中的记录格式无效', 'error');
    }
  }

  function finishImport(mode) {
    if (!pendingImport) return;

    if (mode === 'replace') {
      records = pendingImport.slice();
    } else {
      const merged = new Map(records.map((record) => [record.id, record]));
      pendingImport.forEach((record) => merged.set(record.id, record));
      records = Array.from(merged.values());
    }

    const importedCount = pendingImport.length;
    pendingImport = null;
    closeModal(refs.importDialog);
    const saved = persistRecords();
    renderAll();
    showToast(
      saved
        ? `已${mode === 'replace' ? '覆盖' : '合并'}导入 ${importedCount} 条记录`
        : '数据已导入，但本地存储写入失败',
      saved ? 'success' : 'error'
    );
  }

  function exportRecords() {
    const payload = {
      app: 'MY GEEK BASE',
      module: 'electricity',
      version: 1,
      exportedAt: new Date().toISOString(),
      records
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-geek-base-electricity-${todayKey()}.json`;
      link.hidden = true;
      container.appendChild(link);
      link.click();
      link.remove();
      later(() => URL.revokeObjectURL(url), 1200);
      showToast(`已导出 ${records.length} 条记录`, 'success');
    } catch (error) {
      showToast('导出失败，请稍后再试', 'error');
    }
  }

  function renderAll() {
    const metrics = getMetrics();

    refs.total.textContent = formatMoney(metrics.total);
    refs.current.textContent = metrics.latest ? formatMoney(metrics.latest.balance) : '—';
    refs.count.textContent = String(records.length);
    refs.listCount.textContent = `${records.length} 条`;
    refs.range.textContent = getRangeLabel(metrics);
    refs.empty.hidden = records.length > 0;
    refs.recordList.hidden = records.length === 0;

    if (!records.length) {
      refs.recordList.innerHTML = '';
      return;
    }

    const sorted = records.slice().sort(compareRecordsDesc);
    refs.recordList.innerHTML = sorted.map((record) => renderRecordItem(record, metrics, sorted)).join('');
  }

  function renderRecordItem(record, metrics, sorted) {
    const metric = metrics.byId.get(record.id);
    const change = metric?.change;
    let usageText = '首条余额基准';
    let usageClass = 'mod-electricity-usage--first';

    if (typeof change === 'number') {
      if (change > 0) {
        usageText = `较上次消耗 ${formatMoney(change)}`;
        usageClass = 'mod-electricity-usage--spent';
      } else if (change < 0) {
        usageText = `余额增加 ${formatMoney(Math.abs(change))}`;
        usageClass = 'mod-electricity-usage--credit';
      } else {
        usageText = '与上次持平';
        usageClass = 'mod-electricity-usage--flat';
      }
    }

    const isLatest = sorted[0]?.id === record.id;
    const safeId = escapeHTML(record.id);
    const dateLabel = escapeHTML(formatDate(record.date));

    return `
      <li class="mod-electricity-record">
        <div class="mod-electricity-record-top">
          <div class="mod-electricity-record-date-wrap">
            <p class="mod-electricity-record-date">${dateLabel}${isLatest ? '<span class="mod-electricity-latest">最新</span>' : ''}</p>
            <p class="mod-electricity-record-usage ${usageClass}">${escapeHTML(usageText)}</p>
          </div>
          <div class="mod-electricity-record-balance-wrap">
            <span class="mod-electricity-record-label">余额</span>
            <strong class="mod-electricity-record-balance">${escapeHTML(formatMoney(record.balance))}</strong>
          </div>
        </div>
        <div class="mod-electricity-record-actions">
          <button class="mod-electricity-icon-button" type="button" data-action="edit" data-id="${safeId}" aria-label="编辑 ${dateLabel} 的记录">编辑</button>
          <button class="mod-electricity-icon-button mod-electricity-icon-button--danger" type="button" data-action="delete" data-id="${safeId}" aria-label="删除 ${dateLabel} 的记录">删除</button>
        </div>
      </li>
    `;
  }

  function getMetrics() {
    const ascending = records.slice().sort(compareRecordsAsc);
    const byId = new Map();
    let previous = null;
    let total = 0;

    ascending.forEach((record) => {
      const change = previous ? previous.balance - record.balance : null;
      if (typeof change === 'number' && change > 0) total += change;
      byId.set(record.id, { change });
      previous = record;
    });

    return {
      total,
      byId,
      earliest: ascending[0] || null,
      latest: ascending[ascending.length - 1] || null
    };
  }

  function getRangeLabel(metrics) {
    if (!metrics.earliest) return '还没有记录';
    if (metrics.earliest.id === metrics.latest.id) {
      return `从 ${formatDateShort(metrics.earliest.date)} 开始记录`;
    }
    return `${formatDateShort(metrics.earliest.date)} → ${formatDateShort(metrics.latest.date)}`;
  }

  function compareRecordsAsc(first, second) {
    if (first.date !== second.date) return first.date.localeCompare(second.date);
    if (first.createdAt !== second.createdAt) return first.createdAt - second.createdAt;
    return first.id.localeCompare(second.id);
  }

  function compareRecordsDesc(first, second) {
    return compareRecordsAsc(second, first);
  }

  function setToday() {
    const now = new Date();
    refs.entryDate.value = toDateKey(now);
    refs.today.textContent = `今天 · ${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]}`;
  }

  function showToast(message, type = 'success') {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      timers.delete(toastTimer);
    }

    refs.toast.dataset.type = type;
    refs.toastMessage.textContent = message;
    refs.toast.classList.add('mod-electricity-toast--visible');
    toastTimer = later(() => {
      refs.toast.classList.remove('mod-electricity-toast--visible');
      toastTimer = 0;
    }, 2800);
  }

  function openModal(dialog) {
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeModal(dialog) {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
      return;
    }
    if (dialog.hasAttribute('open')) {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    }
  }

  function createRecordId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    controller.abort();

    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();

    [refs.editDialog, refs.importDialog, refs.confirmDialog].forEach((dialog) => {
      if (dialog.open) dialog.close();
    });

    container.replaceChildren();
  }

  return cleanup;
}

function isDateKey(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function parseDateKey(value) {
  if (!isDateKey(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  const date = parseDateKey(value);
  if (!date) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} · 周${WEEKDAYS[date.getDay()]}`;
}

function formatDateShort(value) {
  return value.replaceAll('-', '.');
}

function formatMoney(value) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function todayKey() {
  return toDateKey(new Date());
}
