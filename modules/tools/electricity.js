import { readJSON, writeJSON } from '../../shared/storage.js';

export const id = 'electricity';
export const title = '电费管家';
export const status = 'available';

const LIVE_CACHE_KEY = 'mod-electricity-live-cache-v1';
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_RECORDS = 200;
const MAX_USAGE_GAP_MINUTES = 6 * 60;
const LOW_BALANCE_THRESHOLD = 20;
const MAX_BALANCE = 1e12;
const LIVE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const CHINA_TIME_ZONE = 'Asia/Shanghai';
const moneyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Module-level cache survives route changes in the same document. A cached
// render is immediate; data is revalidated only after the short TTL.
let liveMemoryCache = null;

const TEMPLATE = `
  <section class="mod-electricity-root" aria-label="电费管家">
    <section class="mod-electricity-live" id="mod-electricity-live" aria-labelledby="mod-electricity-live-title">
      <div class="mod-electricity-live-head">
        <div>
          <p class="mod-electricity-kicker">AUTO_READER // 自动采集</p>
          <h3 class="mod-electricity-live-title" id="mod-electricity-live-title">今日用电</h3>
        </div>
        <button class="mod-electricity-refresh" id="mod-electricity-refresh" type="button" aria-label="立即同步最新电费数据">
          <svg class="mod-electricity-refresh-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4.8 9.8A7.5 7.5 0 1 1 5 15.4M4.8 4.8v5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span id="mod-electricity-refresh-label">同步</span>
        </button>
      </div>

      <div class="mod-electricity-update">
        <span class="mod-electricity-live-state" id="mod-electricity-live-state" data-state="loading">同步中</span>
        <span class="mod-electricity-live-updated" id="mod-electricity-live-updated" aria-live="polite">正在同步自动余额…</span>
      </div>

      <div class="mod-electricity-metrics">
        <article class="mod-electricity-metric mod-electricity-metric--today">
          <span class="mod-electricity-metric-label">今日已用</span>
          <strong class="mod-electricity-metric-value" id="mod-electricity-today">—</strong>
          <span class="mod-electricity-compare" id="mod-electricity-compare" data-trend="none">数据积累中</span>
        </article>

        <article class="mod-electricity-metric mod-electricity-metric--yesterday">
          <span class="mod-electricity-metric-label">昨日同期</span>
          <strong class="mod-electricity-metric-value" id="mod-electricity-yesterday-same">—</strong>
          <span class="mod-electricity-metric-note" id="mod-electricity-yesterday-total">昨日全天 —</span>
        </article>

        <article class="mod-electricity-metric mod-electricity-metric--balance">
          <span class="mod-electricity-metric-label">当前余额</span>
          <strong class="mod-electricity-metric-value mod-electricity-metric-value--balance" id="mod-electricity-balance">—</strong>
          <span class="mod-electricity-low" id="mod-electricity-low" hidden>余额偏低 · 低于 ¥20</span>
        </article>
      </div>

      <figure class="mod-electricity-chart-panel">
        <div class="mod-electricity-chart-head">
          <div class="mod-electricity-chart-heading">
            <span class="mod-electricity-chart-title">两日累计用量</span>
            <span class="mod-electricity-chart-sub" id="mod-electricity-chart-sub">等待数据</span>
          </div>
          <div class="mod-electricity-legend" aria-label="图例">
            <span class="mod-electricity-legend-item">
              <span class="mod-electricity-legend-dot mod-electricity-legend-dot--today" aria-hidden="true"></span>
              今天 <b id="mod-electricity-legend-today">—</b>
            </span>
            <span class="mod-electricity-legend-item">
              <span class="mod-electricity-legend-dot mod-electricity-legend-dot--yesterday" aria-hidden="true"></span>
              昨天全天 <b id="mod-electricity-legend-yesterday">—</b>
            </span>
          </div>
        </div>

        <div class="mod-electricity-chart-wrap">
          <svg class="mod-electricity-chart" id="mod-electricity-chart" viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="两日累计用电量对比图"></svg>
          <p class="mod-electricity-chart-empty" id="mod-electricity-chart-empty">数据生成中，请稍候...</p>
        </div>

        <figcaption class="mod-electricity-chart-axis" aria-hidden="true">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </figcaption>
      </figure>

      <p class="mod-electricity-live-note">按相邻两次采集的余额差估算，用量从已有采集区间开始累计；充值等余额上升不计入，超过 6 小时的空档也不计入。页面只读取同源 data.json，不直接访问外部缴费网站。</p>
    </section>
  </section>
`;

export function mount(container) {
  container.innerHTML = TEMPLATE;

  const $ = (selector) => container.querySelector(selector);
  const refs = {
    liveSection: $('#mod-electricity-live'),
    liveState: $('#mod-electricity-live-state'),
    liveUpdated: $('#mod-electricity-live-updated'),
    liveRefresh: $('#mod-electricity-refresh'),
    liveRefreshLabel: $('#mod-electricity-refresh-label'),
    today: $('#mod-electricity-today'),
    compare: $('#mod-electricity-compare'),
    yesterdaySame: $('#mod-electricity-yesterday-same'),
    yesterdayTotal: $('#mod-electricity-yesterday-total'),
    balance: $('#mod-electricity-balance'),
    low: $('#mod-electricity-low'),
    chart: $('#mod-electricity-chart'),
    chartSub: $('#mod-electricity-chart-sub'),
    chartEmpty: $('#mod-electricity-chart-empty'),
    legendToday: $('#mod-electricity-legend-today'),
    legendYesterday: $('#mod-electricity-legend-yesterday')
  };

  const controller = new AbortController();
  const { signal } = controller;
  let disposed = false;
  let liveLoading = false;
  let liveAbortController = null;
  let liveRequestId = 0;

  init();

  function init() {
    refs.liveRefresh.addEventListener(
      'click',
      () => loadLiveBalance({ force: true }),
      { signal }
    );
    loadLiveBalance();
  }

  function readLiveCache() {
    if (liveMemoryCache) return liveMemoryCache;

    const stored = readJSON(LIVE_CACHE_KEY, null);
    if (!stored || typeof stored !== 'object') return null;

    const liveRecords = normalizeLiveRecords(stored.records);
    if (!liveRecords.length) return null;

    const fetchedAt = Number(stored.fetchedAt);
    liveMemoryCache = {
      records: liveRecords,
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0
    };
    return liveMemoryCache;
  }

  function normalizeLiveRecords(rawRecords) {
    if (!Array.isArray(rawRecords)) return [];

    const recordsByTime = new Map();
    rawRecords.forEach((source) => {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return;

      const time = typeof source.time === 'string' ? source.time.trim() : '';
      if (!LIVE_TIME_PATTERN.test(time)) return;

      const balance = typeof source.balance === 'number' ? source.balance : Number(source.balance);
      if (!Number.isFinite(balance) || Math.abs(balance) > MAX_BALANCE) return;

      recordsByTime.set(time, {
        time,
        balance: roundMoney(balance)
      });
    });

    return Array.from(recordsByTime.values())
      .sort((first, second) => first.time.localeCompare(second.time))
      .slice(-MAX_RECORDS);
  }

  function rememberLiveData(liveRecords) {
    const cached = {
      records: liveRecords.slice(-MAX_RECORDS),
      fetchedAt: Date.now()
    };
    liveMemoryCache = cached;
    writeJSON(LIVE_CACHE_KEY, cached);
  }

  async function loadLiveBalance(options = {}) {
    const { force = false } = options;
    if (disposed || liveLoading) return;

    const cached = readLiveCache();
    if (cached) {
      renderLiveData(cached.records, 'cached');
      if (!force && Date.now() - cached.fetchedAt < LIVE_CACHE_TTL_MS) {
        setLiveState('cached', '已缓存');
        return;
      }
    }

    liveLoading = true;
    setLiveBusy(true);
    setLiveState('loading', '同步中');

    if (cached) {
      const latest = cached.records[cached.records.length - 1];
      refs.liveUpdated.textContent = `最后更新 ${latest.time} · 正在检查更新`;
    } else {
      showLoadingState();
    }

    const requestId = ++liveRequestId;
    if (liveAbortController) liveAbortController.abort();
    const requestController = new AbortController();
    liveAbortController = requestController;

    try {
      const response = await fetch(new URL('data.json', document.baseURI), {
        cache: 'no-cache',
        headers: { Accept: 'application/json' },
        signal: requestController.signal
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      const liveRecords = normalizeLiveRecords(payload);
      if (!liveRecords.length) {
        const error = new Error('No usable live records');
        error.code = 'empty';
        throw error;
      }

      if (disposed || requestId !== liveRequestId) return;

      rememberLiveData(liveRecords);
      renderLiveData(liveRecords, 'live');
    } catch (error) {
      if (error.name === 'AbortError' || disposed || requestId !== liveRequestId) return;

      if (cached) {
        const latest = cached.records[cached.records.length - 1];
        renderLiveData(cached.records, 'cached');
        setLiveState('error', '同步失败');
        refs.liveUpdated.textContent = `同步失败 · 缓存至 ${latest.time}`;
      } else {
        const missing = error.status === 404 || error.code === 'empty';
        showEmptyState(
          missing ? '数据生成中，请稍候...' : '自动余额暂不可用，请稍后重试',
          missing ? 'waiting' : 'error',
          missing ? '等待数据' : '同步失败',
          missing ? '数据生成中，请稍候...' : '暂时无法加载用量数据'
        );
      }
    } finally {
      if (requestId === liveRequestId) {
        liveLoading = false;
        liveAbortController = null;
        setLiveBusy(false);
      }
    }
  }

  function renderLiveData(liveRecords, mode) {
    const latest = liveRecords[liveRecords.length - 1];
    const analysis = analyzeUsage(liveRecords);
    const isLow = latest.balance < LOW_BALANCE_THRESHOLD;
    const compare = buildComparison(analysis.todayUsed, analysis.yesterdaySame);

    refs.liveSection.classList.toggle('mod-electricity-live--low', isLow);
    refs.liveUpdated.textContent = `最后更新 ${latest.time}`;
    refs.balance.textContent = formatMoney(latest.balance);
    refs.low.hidden = !isLow;

    refs.today.textContent = analysis.todayUsed === null ? '—' : formatMoney(analysis.todayUsed);
    refs.compare.textContent = compare.text;
    refs.compare.dataset.trend = compare.trend;
    refs.yesterdaySame.textContent =
      analysis.yesterdaySame === null ? '—' : formatMoney(analysis.yesterdaySame);
    refs.yesterdayTotal.textContent =
      analysis.yesterdayTotal === null ? '昨日全天 —' : `昨日全天 ${formatMoney(analysis.yesterdayTotal)}`;
    refs.legendToday.textContent =
      analysis.todayUsed === null ? '—' : formatMoney(analysis.todayUsed);
    refs.legendYesterday.textContent =
      analysis.yesterdayTotal === null ? '—' : formatMoney(analysis.yesterdayTotal);
    refs.chartSub.textContent =
      analysis.cutoffMinute === null ? '今日暂无采集' : `截至 ${formatMinute(analysis.cutoffMinute)}`;

    renderUsageChart(analysis);
    setLiveState(mode === 'live' ? 'live' : 'cached', mode === 'live' ? '已同步' : '已缓存');
  }

  function showLoadingState() {
    refs.liveUpdated.textContent = '正在同步自动余额…';
    refs.today.textContent = '—';
    refs.compare.textContent = '数据积累中';
    refs.compare.dataset.trend = 'none';
    refs.yesterdaySame.textContent = '—';
    refs.yesterdayTotal.textContent = '昨日全天 —';
    refs.balance.textContent = '—';
    refs.low.hidden = true;
    refs.legendToday.textContent = '—';
    refs.legendYesterday.textContent = '—';
    refs.chartSub.textContent = '正在获取数据';
    refs.chart.innerHTML = '';
    refs.chartEmpty.hidden = false;
    refs.chartEmpty.textContent = '正在同步…';
    refs.chart.setAttribute('aria-label', '两日累计用电量对比图，暂无数据');
    refs.liveSection.classList.remove('mod-electricity-live--low');
    setLiveState('loading', '同步中');
  }

  function showEmptyState(message, state, statusText, chartMessage) {
    refs.liveUpdated.textContent = message;
    refs.today.textContent = '—';
    refs.compare.textContent = '等待数据';
    refs.compare.dataset.trend = 'none';
    refs.yesterdaySame.textContent = '—';
    refs.yesterdayTotal.textContent = '昨日全天 —';
    refs.balance.textContent = '—';
    refs.low.hidden = true;
    refs.legendToday.textContent = '—';
    refs.legendYesterday.textContent = '—';
    refs.chartSub.textContent = '等待数据';
    refs.chart.innerHTML = '';
    refs.chartEmpty.hidden = false;
    refs.chartEmpty.textContent = chartMessage;
    refs.chart.setAttribute('aria-label', '两日累计用电量对比图，暂无数据');
    refs.liveSection.classList.remove('mod-electricity-live--low');
    setLiveState(state, statusText);
  }

  function setLiveState(state, label) {
    refs.liveState.dataset.state = state;
    refs.liveState.textContent = label;
  }

  function setLiveBusy(isBusy) {
    refs.liveRefresh.disabled = isBusy;
    refs.liveRefresh.setAttribute('aria-busy', String(isBusy));
    refs.liveRefreshLabel.textContent = isBusy ? '同步中' : '同步';
  }

  function analyzeUsage(liveRecords) {
    const todayKey = chinaDateKey();
    const yesterdayKey = chinaDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const makeDay = () => ({
      samples: [],
      used: 0,
      measured: false,
      latestMinute: null
    });
    const days = new Map([
      [todayKey, makeDay()],
      [yesterdayKey, makeDay()]
    ]);

    const parsed = liveRecords.map((record) => ({
      ...record,
      ...parseRecordTime(record.time)
    }));

    for (let index = 0; index < parsed.length; index += 1) {
      const current = parsed[index];
      const currentDay = days.get(current.date);
      if (!currentDay) continue;
      currentDay.latestMinute = current.minuteOfDay;

      if (index === 0) continue;

      const previous = parsed[index - 1];
      const gap = current.absoluteMinute - previous.absoluteMinute;
      if (gap <= 0 || gap > MAX_USAGE_GAP_MINUTES) continue;

      const spent = Math.max(0, roundMoney(previous.balance - current.balance));
      currentDay.used = roundMoney(currentDay.used + spent);
      currentDay.measured = true;
      currentDay.samples.push({
        minute: current.minuteOfDay,
        value: currentDay.used
      });
    }

    const today = days.get(todayKey);
    const yesterday = days.get(yesterdayKey);
    const cutoffMinute = today.latestMinute;
    const yesterdaySame =
      cutoffMinute === null ? null : valueAtMinute(yesterday.samples, cutoffMinute);

    return {
      today,
      yesterday,
      cutoffMinute,
      todayUsed: today.measured ? today.used : null,
      yesterdaySame,
      yesterdayTotal: yesterday.measured ? yesterday.used : null
    };
  }

  function renderUsageChart(analysis) {
    const chart = buildUsageChart(analysis);
    if (!chart) {
      refs.chart.innerHTML = '';
      refs.chartEmpty.hidden = false;
      refs.chartEmpty.textContent = '至少需要 2 次采集才能生成用量趋势';
      refs.chart.setAttribute('aria-label', '两日累计用电量对比图，数据不足');
      return;
    }

    refs.chart.innerHTML = chart.markup;
    refs.chartEmpty.hidden = true;
    refs.chart.setAttribute('aria-label', chart.label);
  }

  function buildUsageChart(analysis) {
    const todayPoints = analysis.today.samples;
    const yesterdayPoints = analysis.yesterday.samples;
    if (!todayPoints.length && !yesterdayPoints.length) return null;

    const width = 760;
    const height = 220;
    const paddingX = 10;
    const paddingY = 18;
    const plotWidth = width - paddingX * 2;
    const plotHeight = height - paddingY * 2;
    const allPoints = [...todayPoints, ...yesterdayPoints];
    const maximum = Math.max(1, ...allPoints.map((point) => point.value));
    const yMax = Math.ceil(maximum * 2) / 2;
    const xFor = (minute) => paddingX + (minute / 1440) * plotWidth;
    const yFor = (value) => paddingY + (1 - value / yMax) * plotHeight;

    const horizontalGrid = [0.25, 0.5, 0.75, 1]
      .map((ratio) => {
        const y = (paddingY + plotHeight * ratio).toFixed(2);
        return `<line class="mod-electricity-chart-grid" x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"/>`;
      })
      .join('');
    const verticalGrid = [0, 360, 720, 1080, 1440]
      .map((minute) => {
        const x = xFor(minute).toFixed(2);
        return `<line class="mod-electricity-chart-grid" x1="${x}" y1="${paddingY}" x2="${x}" y2="${height - paddingY}"/>`;
      })
      .join('');

    const yesterdayPath = buildLinePath(yesterdayPoints, xFor, yFor);
    const todayPath = buildLinePath(todayPoints, xFor, yFor);
    const todayArea = todayPath
      ? `<path class="mod-electricity-usage-area" d="${todayPath} L ${xFor(todayPoints[todayPoints.length - 1].minute).toFixed(2)} ${height - paddingY} L ${xFor(todayPoints[0].minute).toFixed(2)} ${height - paddingY} Z"/>`
      : '';
    const nowLine = analysis.cutoffMinute === null
      ? ''
      : `<line class="mod-electricity-usage-now" x1="${xFor(analysis.cutoffMinute).toFixed(2)}" y1="${paddingY}" x2="${xFor(analysis.cutoffMinute).toFixed(2)}" y2="${height - paddingY}"/>`;
    const yesterdayMarkup = yesterdayPath
      ? `<path class="mod-electricity-usage-line mod-electricity-usage-line--yesterday" d="${yesterdayPath}"/>`
      : '';
    const todayMarkup = todayPath
      ? `<path class="mod-electricity-usage-line mod-electricity-usage-line--today" d="${todayPath}"/>`
      : '';
    const yesterdayDot = yesterdayPoints.length
      ? `<circle class="mod-electricity-usage-dot mod-electricity-usage-dot--yesterday" cx="${xFor(yesterdayPoints[yesterdayPoints.length - 1].minute).toFixed(2)}" cy="${yFor(yesterdayPoints[yesterdayPoints.length - 1].value).toFixed(2)}" r="3.5"/>`
      : '';
    const todayDot = todayPoints.length
      ? `<circle class="mod-electricity-usage-dot mod-electricity-usage-dot--today" cx="${xFor(todayPoints[todayPoints.length - 1].minute).toFixed(2)}" cy="${yFor(todayPoints[todayPoints.length - 1].value).toFixed(2)}" r="3.5"/>`
      : '';

    const todayText = analysis.todayUsed === null ? '暂无' : formatMoney(analysis.todayUsed);
    const yesterdayText =
      analysis.yesterdaySame === null ? '暂无' : formatMoney(analysis.yesterdaySame);

    return {
      markup: `${horizontalGrid}${verticalGrid}${nowLine}${todayArea}${yesterdayMarkup}${todayMarkup}${yesterdayDot}${todayDot}`,
      label: `两日累计用电量对比图。今日已用 ${todayText}，昨日同期 ${yesterdayText}。`
    };
  }

  function buildLinePath(points, xFor, yFor) {
    if (!points.length) return '';
    return points
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${xFor(point.minute).toFixed(2)} ${yFor(point.value).toFixed(2)}`;
      })
      .join(' ');
  }

  function valueAtMinute(samples, cutoffMinute) {
    let value = null;
    for (const sample of samples) {
      if (sample.minute > cutoffMinute) break;
      value = sample.value;
    }
    return value;
  }

  function buildComparison(todayUsed, yesterdaySame) {
    if (todayUsed === null) {
      return { text: '数据积累中', trend: 'none' };
    }
    if (yesterdaySame === null) {
      return { text: '昨日同期数据不足', trend: 'none' };
    }

    const difference = roundMoney(todayUsed - yesterdaySame);
    if (Math.abs(difference) < 0.005) {
      return { text: '与昨日同期持平', trend: 'flat' };
    }
    if (difference > 0) {
      return { text: `较昨日同期多 ${formatMoney(difference)}`, trend: 'more' };
    }
    return { text: `较昨日同期少 ${formatMoney(Math.abs(difference))}`, trend: 'less' };
  }

  function parseRecordTime(time) {
    const [date, clock] = time.split(' ');
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = clock.split(':').map(Number);
    return {
      date,
      minuteOfDay: hour * 60 + minute,
      absoluteMinute: Date.UTC(year, month - 1, day, hour, minute) / 60000
    };
  }

  function chinaDateKey(date = new Date()) {
    const parts = datePartsFormatter.formatToParts(date);
    const values = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    return `${values.year}-${values.month}-${values.day}`;
  }

  function formatMinute(minute) {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function formatMoney(value) {
    return moneyFormatter.format(value);
  }

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    liveRequestId += 1;
    if (liveAbortController) {
      liveAbortController.abort();
      liveAbortController = null;
    }
    liveLoading = false;
    controller.abort();
    container.replaceChildren();
  }

  return cleanup;
}
