/* Путь кармы v2 — правила трека. Чистые функции без DOM. Работает в браузере (window.KARMA_RULES) и в Node (module.exports). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KARMA_RULES = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const R = {};
  const pad = n => String(n).padStart(2, "0");
  R.pad = pad;
  const HOUR = 3600e3, DAY = 864e5;

  /* ---------- идентификаторы ---------- */
  R.uuid = function () {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    const h = "0123456789abcdef"; let s = "";
    for (let i = 0; i < 36; i++) s += i === 8 || i === 13 || i === 18 || i === 23 ? "-" : i === 14 ? "4" : i === 19 ? h[8 + Math.floor(Math.random() * 4)] : h[Math.floor(Math.random() * 16)];
    return s;
  };

  /* ---------- даты: локальный календарный день ---------- */
  R.dateKey = function (ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  R.parseKey = function (k) { const [y, m, d] = String(k).split("-").map(Number); return new Date(y, m - 1, d, 12); };
  R.addDays = function (k, n) { const x = R.parseKey(k); x.setDate(x.getDate() + n); return R.dateKey(x.getTime()); };
  R.diffDays = function (a, b) { return Math.round((R.parseKey(b) - R.parseKey(a)) / DAY); };
  R.isKey = k => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ""));
  R.tz = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } };
  R.fmtTime = function (ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  R.human = function (k) { const d = R.parseKey(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
  R.humanShort = function (k) { const d = R.parseKey(k); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };

  /* Фаза дня. Окна только меняют предлагаемый шаг и фон, не доступ к записям. */
  R.DEFAULT_TIMES = { morningStart: 5, dayStart: 12, eveningStart: 17 };
  R.phaseOf = function (hour, t) {
    t = Object.assign({}, R.DEFAULT_TIMES, t || {});
    if (hour < t.morningStart) return "night";
    if (hour < t.dayStart) return "morning";
    if (hour < t.eveningStart) return "day";
    return "evening";
  };
  /* Вечер даты D можно закрыть в день D и до конца следующего календарного дня. */
  R.eveningCloseable = function (dateKey, todayKey) { const d = R.diffDays(dateKey, todayKey); return d === 0 || d === 1; };
  R.isLate = function (dateKey, todayKey) { return R.diffDays(dateKey, todayKey) >= 1; };

  /* ---------- недели трека ---------- */
  /* Неделя начинается с первого реального эпизода. Окна [start+7k, start+7k+6]. */
  R.daysSince = function (startKey, todayKey) { return startKey ? R.diffDays(startKey, todayKey) : -1; };
  R.weekIndex = function (startKey, dateKey) { const d = R.daysSince(startKey, dateKey); return d < 0 ? -1 : Math.floor(d / 7); };
  R.windowOf = function (startKey, idx) { return { idx, start: R.addDays(startKey, idx * 7), end: R.addDays(startKey, idx * 7 + 6) }; };
  R.currentWindow = function (startKey, todayKey) { const i = R.weekIndex(startKey, todayKey); return i < 0 ? null : R.windowOf(startKey, i); };
  R.completedWindows = function (startKey, todayKey) {
    const out = []; if (!startKey) return out;
    for (let i = 0; ; i++) { const w = R.windowOf(startKey, i); if (R.diffDays(w.end, todayKey) < 1) break; out.push(w); if (i > 520) break; }
    return out;
  };
  R.inWindow = (k, w) => R.diffDays(w.start, k) >= 0 && R.diffDays(k, w.end) >= 0;
  /* Итог недели доступен с 7-го дня окна (end == today) и позже. */
  /* Возвращает самое свежее окно, чей итог не сделан (end <= today). Старые пропущенные итоги не копятся. */
  R.reviewDue = function (startKey, todayKey, reviews) {
    if (!startKey) return null;
    const idx = R.weekIndex(startKey, todayKey); if (idx < 0) return null;
    for (let i = idx; i >= 0; i--) {
      const w = R.windowOf(startKey, i);
      if (R.diffDays(w.end, todayKey) < 0) continue;
      if ((reviews || []).some(r => r.windowStart === w.start)) return null;
      return w;
    }
    return null;
  };

  /* ---------- фаза работы по данным, не по номеру недели ---------- */
  R.workPhase = function ({ hypothesis, experiment, confirmedActionDays, eligible }) {
    if (eligible) return "закрепляем";
    if (confirmedActionDays >= 1) return "практикуем";
    if (hypothesis && hypothesis.status !== "rejected") return "проверяем";
    return "наблюдаем";
  };

  /* ---------- записи дня: ключ «дата|сюжет», чтобы вечер одного сюжета не приписывался другому ---------- */
  R.checkinId = (dateKey, patternId) => `${dateKey}|${patternId || "-"}`;
  /* Приводит карту записей (старый формат по дате или новый по id) к формату по id. Принадлежность не додумывается. */
  R.normalizeCheckins = function (map) {
    const out = {};
    Object.entries(map || {}).forEach(([k, c]) => {
      if (!c || typeof c !== "object") return;
      const dateKey = c.dateKey || (R.isKey(k) ? k : null); if (!dateKey) return;
      const patternId = c.patternId || null, id = c.id || R.checkinId(dateKey, patternId);
      out[id] = Object.assign({}, c, { id, dateKey, patternId });
    });
    return out;
  };
  R.checkinsOn = (map, dateKey) => Object.values(map || {}).filter(c => c && c.dateKey === dateKey);
  R.checkinFor = (map, dateKey, patternId) => (map || {})[R.checkinId(dateKey, patternId)] || null;
  /* Вечер годится как доказательство по сюжету только при явной принадлежности и не из прошлой версии. */
  R.eveningEvidence = (c, patternId) => !!(c && c.evening && !c.legacy && !c.evening.legacy && patternId && c.patternId === patternId);

  /* ---------- измеренное состояние: только явные оценки ---------- */
  R.lastRating = function ({ checkins = {}, episodes = [] }) {
    let best = null;
    const push = (value, kind, at) => { if (value == null || isNaN(value)) return; if (!best || at > best.at) best = { value: Number(value), kind, at }; };
    Object.values(checkins).forEach(c => {
      if (c.legacy) return;
      if (c.morning && c.morning.intensity != null) push(c.morning.intensity, "morning", c.morning.at);
      if (c.evening && c.evening.currentImpact != null) push(c.evening.currentImpact, "evening", c.evening.at);
    });
    episodes.forEach(e => { if (e.intensity != null && !e.legacy) push(e.intensity, "episode", e.loggedAt); });
    return best;
  };

  /* Подтверждённое применение выбранного ответа: не репетиция; пауза — только выбранная.
     Если указан навык, запись считается только при совпадении навыка, записанного в момент действия.
     Запись без навыка (неизвестная принадлежность) доказательством для навыка не является. Версия плана не важна: навык тот же — практика та же. */
  R.isConfirmedAction = function (ep, skillId) {
    const nr = ep && ep.newResponse; if (!nr || ep.isRehearsal || ep.legacy) return false;
    if (skillId && (nr.skillId !== skillId || nr.backfilled)) return false;
    if (nr.type === "pause") return nr.chosen === "chosen";
    return true;
  };
  /* Навык, восстановленный задним числом (backfilled), для флага не достаточен: прошлая версия позволяла менять навык плана на месте,
     поэтому исходный навык такой записи достоверно не известен. Запись остаётся в истории. */
  R.eveningConfirms = (c, skillId) => !!(c && c.evening && c.evening.actionStatus === "done" && (!skillId || (c.evening.skillId === skillId && !c.evening.backfilled)));
  R.confirmedActionDays = function ({ episodes = [], checkins = {}, patternId, skillId }) {
    const days = new Set();
    episodes.forEach(e => { if (patternId && e.patternId === patternId && R.isConfirmedAction(e, skillId)) days.add(e.dateKey); });
    Object.values(checkins).forEach(c => { if (R.eveningEvidence(c, patternId) && R.eveningConfirms(c, skillId)) days.add(c.dateKey); });
    return days;
  };
  /* Шаги на тропе: один за завершённый вечер (любой честный ответ), максимум один в день, без прошлой версии. */
  R.practiceDays = function (checkins) { const s = new Set(); Object.values(checkins || {}).forEach(c => { if (c.evening && !c.legacy) s.add(c.dateKey); }); return [...s]; };

  /* Восстановление принадлежности старых записей действий: навык берётся из плана, действовавшего в момент записи.
     Если план определить нельзя, запись остаётся без навыка и в флаг не входит. */
  R.backfillEvidence = function (data) {
    const exps = data.experiments || []; let n = 0;
    const at = (patternId, ts) => exps.filter(x => x.patternId === patternId && (x.createdAt || 0) <= (ts || 0)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
    (data.episodes || []).forEach(e => { const nr = e.newResponse; if (!nr || nr.skillId || e.legacy || !e.patternId) return; const x = at(e.patternId, nr.at || e.loggedAt); if (x && x.skillId) { nr.skillId = x.skillId; nr.experimentId = x.id; nr.planVersion = x.version; nr.backfilled = true; n++; } });
    Object.values(data.checkins || {}).forEach(c => { const ev = c.evening; if (!ev || ev.skillId || c.legacy || !c.patternId || !ev.actionStatus) return; const x = at(c.patternId, ev.at); if (x && x.skillId) { ev.skillId = x.skillId; ev.experimentId = x.id; ev.planVersion = x.version; ev.backfilled = true; n++; } });
    return n;
  };

  /* ---------- итог окна с фактическими знаменателями: только записи этого сюжета и этого навыка ---------- */
  R.windowSummary = function ({ checkins = {}, episodes = [], window: w, patternId, skillId, experiment }) {
    const days = []; for (let k = w.start; R.diffDays(k, w.end) >= 0; k = R.addDays(k, 1)) days.push(k);
    const evenings = Object.values(checkins).filter(c => R.eveningEvidence(c, patternId) && R.inWindow(c.dateKey, w)).sort((a, b) => a.dateKey < b.dateKey ? -1 : 1);
    const impactRatings = evenings.filter(c => c.evening.currentImpact != null).map(c => ({ dateKey: c.dateKey, value: Number(c.evening.currentImpact) }));
    const opportunities = evenings.filter(c => c.evening.hadOpportunity === "yes").length;
    const notSure = evenings.filter(c => c.evening.hadOpportunity === "unsure").length;
    const eps = episodes.filter(e => e.dateKey && R.inWindow(e.dateKey, w) && !e.legacy && patternId && e.patternId === patternId);
    const realEps = eps.filter(e => !e.isRehearsal);
    const actionDays = new Set();
    eps.forEach(e => { if (R.isConfirmedAction(e, skillId)) actionDays.add(e.dateKey); });
    evenings.forEach(c => { if (R.eveningConfirms(c, skillId)) actionDays.add(c.dateKey); });
    const partial = evenings.filter(c => c.evening.actionStatus === "partial").length;
    const results = experiment ? (experiment.results || []).filter(r => { const e = episodes.find(x => x.id === r.episodeId); return e && e.dateKey && R.inWindow(e.dateKey, w); }) : [];
    const change = { better: 0, same: 0, worse: 0 };
    evenings.forEach(c => { if (c.evening.change in change) change[c.evening.change]++; });
    return { window: w, totalDays: days.length, eveningCount: evenings.length, impactRatings, maxImpact: impactRatings.length ? Math.max(...impactRatings.map(x => x.value)) : null,
      opportunities, notSure, realEpisodes: realEps.length, rehearsals: eps.length - realEps.length, actionDays: [...actionDays], partial, results, change };
  };

  /* ---------- правило флага (продуктовая эвристика пилота) ---------- */
  R.DEFAULT_POLICY = { minElapsedCalendarDays: 21, stabilityWindowCount: 2, stabilityWindowDays: 7, minImpactRatingsPerWindow: 4, maxEachRecordedImpact: 2, minRealOpportunitiesPerWindow: 1, minConfirmedActionsAcrossWindowsOnDistinctDays: 3, countRehearsalsAsReal: false };
  R.flagEligibility = function ({ pattern, checkins = {}, episodes = [], todayKey, policy, experiment, skillId }) {
    const P = Object.assign({}, R.DEFAULT_POLICY, policy || {});
    const skill = skillId || (experiment && experiment.skillId) || (pattern && pattern.skillId) || null;
    const out = { eligible: false, reasons: [], windows: [], skillId: skill, daysElapsed: pattern && pattern.startDate ? R.daysSince(pattern.startDate, todayKey) : -1 };
    if (!pattern || !pattern.startDate) { out.reasons.push("Нет первого реального эпизода."); return out; }
    if (!skill) { out.reasons.push("Навык для флага не выбран."); return out; }
    if (out.daysElapsed < P.minElapsedCalendarDays) out.reasons.push(`Прошло ${out.daysElapsed} из ${P.minElapsedCalendarDays} календарных дней.`);
    const done = R.completedWindows(pattern.startDate, todayKey);
    if (done.length < P.stabilityWindowCount) { out.reasons.push(`Завершённых недель: ${done.length} из ${P.stabilityWindowCount}.`); return out; }
    const last = done.slice(-P.stabilityWindowCount).map(w => R.windowSummary({ checkins, episodes, window: w, patternId: pattern.id, skillId: skill, experiment }));
    out.windows = last;
    let actionDays = new Set();
    last.forEach((s, i) => {
      const n = i + 1;
      if (s.impactRatings.length < P.minImpactRatingsPerWindow) out.reasons.push(`Окно ${n}: вечерних оценок ${s.impactRatings.length} из ${P.minImpactRatingsPerWindow}.`);
      else if (s.maxImpact > P.maxEachRecordedImpact) out.reasons.push(`Окно ${n}: есть оценка трудности выше ${P.maxEachRecordedImpact} (${s.maxImpact}).`);
      const opp = s.opportunities + (P.countRehearsalsAsReal ? 0 : 0) + s.realEpisodes;
      if (opp < P.minRealOpportunitiesPerWindow) out.reasons.push(`Окно ${n}: не было реального повода потренироваться.`);
      s.actionDays.forEach(d => actionDays.add(d));
    });
    if (actionDays.size < P.minConfirmedActionsAcrossWindowsOnDistinctDays) out.reasons.push(`Подтверждённых применений в разные дни: ${actionDays.size} из ${P.minConfirmedActionsAcrossWindowsOnDistinctDays}.`);
    out.actionDays = [...actionDays];
    out.eligible = out.reasons.length === 0;
    return out;
  };
  /* Ясность неба — только уникальные освоенные навыки (без legacy). */
  R.clarity = function (flags, totalSkills) {
    const ids = new Set((flags || []).filter(f => !f.legacy && f.skillId).map(f => f.skillId));
    return { pct: totalSkills ? Math.round(ids.size / totalSkills * 100) : 0, count: ids.size, total: totalSkills };
  };

  /* ---------- исследование: максимум один новый модуль в день ---------- */
  R.MODULE_ORDER = ["episode", "meaning", "need", "rule", "experiment", "transfer"];
  R.researchState = function (research, todayKey, deep) {
    const mods = (research && research.modules) || {};
    const doneToday = Object.values(mods).some(m => m.status === "done" && m.dateKey === todayKey);
    const next = R.MODULE_ORDER.find(id => !(mods[id] && mods[id].status === "done")) || null;
    const doneCount = R.MODULE_ORDER.filter(id => mods[id] && mods[id].status === "done").length;
    return { next, doneCount, total: R.MODULE_ORDER.length, lockedToday: !!doneToday && !deep, doneToday };
  };

  /* Поддержка гипотезы: статус продукта, не вероятность истинности. */
  R.hypothesisRecognition = function (hyp, episodes) {
    const ids = new Set((hyp && hyp.supportingEpisodeIds) || []);
    const days = new Set(); episodes.forEach(e => { if (ids.has(e.id) && e.dateKey) days.add(e.dateKey); });
    const contra = ((hyp && hyp.contradictingEpisodeIds) || []).length;
    if (!hyp) return { label: "", days: 0, contra: 0 };
    if (hyp.status === "rejected") return { label: "Это объяснение пока не подходит", days: days.size, contra };
    if (days.size >= 2) return { label: "Ты узнаёшь это объяснение в нескольких случаях", days: days.size, contra };
    return { label: "Проверяем", days: days.size, contra };
  };
  R.HYP_TRANSITIONS = { candidate: ["selected", "rejected"], selected: ["supported_by_user", "rejected", "revised"], supported_by_user: ["rejected", "revised"], rejected: ["selected"], revised: [] };
  R.canTransition = (from, to) => (R.HYP_TRANSITIONS[from] || []).includes(to);

  /* Происхождение рекомендаций. Разрешение и план помнят, под какую версию объяснения были подобраны.
     Если объяснение сменилось или отвергнуто, они ждут решения пользователя: оставить (keptFor = текущая версия) или выбрать другие.
     Первый план (kind first-plan) от объяснения не зависит. */
  R.dependencyReview = function ({ pattern, experiment }) {
    const cur = (pattern && pattern.hypothesisVersionId) || null;
    const ps = pattern && pattern.permissionSource;
    /* Разрешение ждёт решения, если записано под другую версию объяснения (включая «до объяснения» для записей неизвестного происхождения).
       Своя формулировка, написанная до выбора объяснения, от него не зависит. */
    const psHyp = ps ? (ps.hypothesisVersionId || null) : null;
    const permission = !!(pattern && pattern.permission && ps && psHyp !== cur && ps.keptFor !== cur && !(ps.origin === "user" && !psHyp));
    const x = experiment;
    const plan = !!(x && x.kind === "experiment" && x.hypothesisVersionId && x.hypothesisVersionId !== cur && x.keptFor !== cur);
    return { permission, plan, any: permission || plan, permissionOrigin: ps ? ps.origin : null };
  };
  /* Записи прежней сборки: у разрешения нет происхождения. Помечаем как migrated и привязываем к объяснению на момент обновления,
     чтобы при первой смене объяснения оно попало в проверку. Текст не меняется. */
  R.markMigratedPermissions = function (patterns) {
    let n = 0;
    (patterns || []).forEach(p => { if (p && p.permission && !p.permissionSource && !p.legacy) { p.permissionSource = { origin: "migrated", hypothesisVersionId: p.hypothesisVersionId || null }; n++; } });
    return n;
  };
  /* Черновики прежней сборки (ключи без области) переносятся в новую схему, если принадлежность однозначна:
     один активный сюжет — его область; «new» без сюжета — first; detail — сюжет эпизода. Остальные с текстом сохраняются как восстановимые записи. */
  R.migrateDrafts = function (drafts, { patterns = [], episodes = [] } = {}, version) {
    const out = {}, recovered = []; const V = version || 2;
    const live = patterns.filter(p => !p.legacy && (p.status === "active" || p.status === "observe"));
    const pid = live.length === 1 ? live[0].id : null;
    Object.entries(drafts || {}).forEach(([k, d]) => {
      if (k.includes("|") || ["cards", "cardPick", "fromEpisode"].includes(k)) { out[k] = d; return; }
      if (!d || typeof d !== "object") return;
      let scope = null;
      if (k === "new") scope = pid || "first";
      else if (k === "event" || k === "action") scope = pid || "-";
      else if (/^detail-/.test(k)) { const e = episodes.find(x => x.id === k.slice(7)); scope = e ? (e.patternId || "-") : null; }
      else if (/^(evening-|mod-|review-)/.test(k)) scope = pid;
      const hasText = Object.values(d.ans || {}).some(v => typeof v === "string" && v.trim());
      if (scope) out[`${k}|${scope}|${V}`] = d;
      else if (hasText) recovered.push({ id: k, at: d.at || null, ans: d.ans });
    });
    return { drafts: out, recovered };
  };

  /* Урок и практика: если действующий план тренирует другой навык, чем записано в уроке, подпись урока ждёт решения
     (уточнить или сохранить формулировку). Сохранённое решение привязано к версии плана. */
  R.lessonDrift = function ({ pattern, experiment }) {
    const L = pattern && pattern.lesson, x = experiment;
    if (!L || !x || !x.skillId || !L.skillId) return { drift: false };
    if (x.skillId === L.skillId || L.keptForExperimentId === x.id) return { drift: false };
    return { drift: true, oldSkill: L.skillId, newSkill: x.skillId };
  };

  /* ---------- колода карточек ----------
     Число пути задаёт только порядок первой подборки: pathCards карточек из сценариев пути и otherCards из других тем.
     Без числа — карточки из разных тем. Это редакционная настройка, не диагностическая шкала. Дубликатов нет; exclude — уже показанные. */
  R.buildDeck = function ({ packs = [], pathPacks = null, pathCards = 4, otherCards = 2, seed = 0, exclude = [] }) {
    const ex = new Set(exclude), out = [], used = new Set();
    const card = (pk, c) => ({ id: c.id, text: c.text, recognition: c.recognition || "", packId: pk.id, packTitle: pk.title });
    const roundRobin = (list, n, start) => {
      const res = []; if (!list.length || n <= 0) return res;
      const queues = list.map(pk => pk.cards.filter(c => !ex.has(c.id) && !used.has(c.id)).map(c => card(pk, c)));
      let i = start % list.length, guard = 0;
      while (res.length < n && guard++ < 200) { const q = queues[i]; if (q && q.length) { const c = q.shift(); if (!used.has(c.id)) { used.add(c.id); res.push(c); } } if (queues.every(q => !q.length)) break; i = (i + 1) % list.length; }
      return res;
    };
    const s = Math.abs(Number(seed) || 0);
    if (pathPacks && pathPacks.length) {
      const own = pathPacks.map(id => packs.find(p => p.id === id)).filter(Boolean), rest = packs.filter(p => !pathPacks.includes(p.id));
      out.push(...roundRobin(own, pathCards, 0), ...roundRobin(rest, otherCards, s));
    } else out.push(...roundRobin(packs, pathCards + otherCards, s));
    return out;
  };
  /* Колода событий v4: сфера определяет подборку (до first карточек), число не влияет. «Пока трудно понять» — по одному событию из разных сфер.
     Расширение — следующие события той же сферы, затем других. exclude — уже показанные. */
  R.buildEventDeck = function ({ events = [], area = null, first = 4, seed = 0, exclude = [] }) {
    const ex = new Set(exclude), s = Math.abs(Number(seed) || 0);
    const pool = events.filter(e => !ex.has(e.id));
    const own = area && area !== "unclear" ? pool.filter(e => (e.areas || []).includes(area)) : [];
    const rest = pool.filter(e => !own.includes(e));
    const rot = (list, k) => list.length ? [...list.slice(k % list.length), ...list.slice(0, k % list.length)] : [];
    const out = [];
    if (own.length) out.push(...rot(own, s).slice(0, first));
    if (out.length < first) {
      /* разные сферы по очереди */
      const byArea = {}; rest.forEach(e => { const a = (e.areas || ["other"])[0]; (byArea[a] = byArea[a] || []).push(e); });
      const keys = rot(Object.keys(byArea).sort(), s); let i = 0, guard = 0;
      while (out.length < first && guard++ < 100) { const q = byArea[keys[i % keys.length]]; if (q && q.length) out.push(q.shift()); if (Object.values(byArea).every(q => !q.length)) break; i++; }
    }
    return out.map(e => ({ id: e.id, text: e.text, packId: e.packId, areas: e.areas, pathHint: e.pathHint || [] }));
  };

  /* Ответы по колоде: один ответ на карточку; отмена возвращает карточку и прежний ответ; дубликатов нет. */
  R.deckAnswer = function (S, r) {
    const deck = S.deck || [], idx = S.idx || 0; if (idx >= deck.length) return false;
    const c = deck[idx]; S.picks = (S.picks || []).filter(p => p.id !== c.id);
    S.picks.push({ id: c.id, packId: c.packId, text: c.text, recognition: c.recognition, r, at: Date.now() });
    S.idx = idx + 1; S.undo = { id: c.id, r }; return true;
  };
  R.deckUndo = function (S) {
    if (!S.undo || !(S.idx > 0)) return false;
    const c = (S.deck || [])[S.idx - 1]; if (!c || c.id !== S.undo.id) { S.undo = null; return false; }
    S.picks = (S.picks || []).filter(p => p.id !== c.id); S.idx = S.idx - 1; S.undo = null; return true;
  };
  R.deckYes = S => (S.picks || []).filter(p => p.r === "yes");
  /* Кандидаты для разбора: «было» без пометки «не задело». Факт события сохраняется, пересмотр — явным действием. */
  R.deckCandidates = S => (S.picks || []).filter(p => p.r === "yes" && !p.notStung);
  R.deckNotStung = S => (S.picks || []).filter(p => p.r === "yes" && p.notStung);
  /* Урок по глобальному id: направление задаёт выбранное значение события, а не пакет события. */
  R.findLesson = (packs, id) => { for (const pk of packs || []) { const l = (pk.lessons || []).find(x => x.id === id); if (l) return Object.assign({ packId: pk.id, packTitle: pk.title }, l); } return null; };

  /* Короткий вечер: один ответ фиксирует и повод, и действие. Репетиции поводом не являются. */
  R.QUICK_EVENING = [["done", "Был повод и получилось", "yes", "done"], ["partial", "Был повод, частично", "yes", "partial"], ["not", "Был повод, не получилось", "yes", "not"], ["none", "Повода не было", "no", null], ["unsure", "Не уверен", "unsure", null]];
  R.quickEvening = v => { const r = R.QUICK_EVENING.find(x => x[0] === v); return r ? { hadOpportunity: r[2], actionStatus: r[3] } : { hadOpportunity: null, actionStatus: null }; };

  /* ---------- ICS: только включённые напоминания, стабильные UID ---------- */
  R.icsText = function ({ reminders, installId, url, nowTs, labels }) {
    const d = new Date(nowTs || Date.now()), ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const stamp = new Date(nowTs || Date.now()).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const L = Object.assign({ morning: ["Путь кармы: шаг на день", "Полминуты: взять с собой свой шаг."], day: ["Путь кармы: проверь себя", "Зацепило или сделал по-новому? Отметь момент."], evening: ["Путь кармы: вечерний итог", "Минута: был ли повод, что получилось, как сейчас."] }, labels || {});
    const ev = [];
    Object.entries(reminders || {}).forEach(([k, r]) => {
      if (!r || !r.on || !/^\d{2}:\d{2}$/.test(r.time || "")) return;
      const [h, mi] = r.time.split(":");
      ev.push(["BEGIN:VEVENT", `UID:putkarmy-${k}-${installId || "local"}@putkarmy`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${pad(h)}${pad(mi)}00`, "DURATION:PT10M", "RRULE:FREQ=DAILY", `SUMMARY:${L[k][0]}`, `DESCRIPTION:${L[k][1]}${url ? "\\n" + url : ""}`, url ? `URL:${url}` : "", "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${L[k][0]}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n"));
    });
    if (!ev.length) return "";
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Put karmy v2//RU", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
  };

  /* ---------- число по дате: символическая тема ---------- */
  R.calcNum = function (dateStr) {
    const [y, m, d] = String(dateStr).split("-"); if (!y || !m || !d) return null;
    const digits = (d + m + y).split("").map(Number);
    let s = digits.reduce((a, b) => a + b, 0); const chain = [s];
    while (s > 9) { s = String(s).split("").reduce((a, b) => a + Number(b), 0); chain.push(s); }
    return { digits, chain, num: s };
  };

  /* ---------- миграция из put-karmy-v9 (исходник не удаляется) ---------- */
  R.migrateV9 = function (raw, nowTs) {
    const now = nowTs || Date.now();
    const out = { patterns: [], episodes: [], checkins: {}, flags: [], hypotheses: [], experiments: [], reviews: [], meta: { migratedFromV9: true, migratedAt: now, source: "put-karmy-v9" }, profile: {} };
    if (!raw || typeof raw !== "object") return out;
    if (raw.theme) out.profile.theme = raw.theme === "auto" ? "auto" : raw.theme;
    if (raw.birth) out.profile.symbolic = { birth: raw.birth, num: raw.num || null };
    const rm = raw.remind || {};
    out.profile.reminders = { morning: { on: false, time: rm.m || "08:30" }, day: { on: false, time: rm.d || "13:00" }, evening: { on: true, time: rm.e || "20:30" } };
    const sprints = [...(raw.archive || []), ...(raw.sprint ? [raw.sprint] : [])].filter(Boolean);
    const byTeacher = {};
    sprints.forEach((sp, si) => {
      const key = `${sp.teacher || "?"}|${sp.teacherType || "person"}`;
      let p = byTeacher[key];
      if (!p) {
        p = { id: R.uuid(), title: sp.teacher || "Без названия", contexts: [sp.teacherType === "sit" ? "ситуация" : "человек"], status: "legacy", legacy: true, startDate: sp.start || null, createdAt: now, hypothesisVersionId: null, experimentId: null, queue: [], legacyInfo: { step: sp.step, weeks: 0, teacherType: sp.teacherType } };
        if (raw.portrait && raw.teacher === sp.teacher) p.legacyInfo.portrait = raw.portrait;
        byTeacher[key] = p; out.patterns.push(p);
      }
      p.legacyInfo.weeks++;
      if (sp.start && (!p.startDate || R.diffDays(sp.start, p.startDate) > 0)) p.startDate = sp.start;
      const days = sp.days || {};
      Object.keys(days).forEach(n => {
        const r = days[n], k = sp.start ? R.addDays(sp.start, Number(n) - 1) : null; if (!k) return;
        const cid = R.checkinId(k, p.id);
        const c = out.checkins[cid] || (out.checkins[cid] = { id: cid, dateKey: k, tz: "", legacy: true, patternId: p.id });
        if (r.morning) c.morning = { at: r.morning.at || now, intensity: r.morning.score, legacy: true, late: !!r.morning.late };
        if (r.evening) c.evening = { at: r.evening.at || now, legacy: true, currentImpact: r.evening.weight != null ? r.evening.weight : null, hadOpportunity: null, actionStatus: null, note: Object.values(r.evening.answers || {}).filter(v => typeof v === "string" && v).join(" · ").slice(0, 500) };
        (r.moments || []).forEach(m => out.episodes.push({ id: R.uuid(), patternId: p.id, linkStatus: "confirmed", legacy: true, occurredAt: m.at || now, loggedAt: m.at || now, dateKey: k, tz: "", event: m.note || "", emotion: m.kind === "hit" ? "Злость" : null, intensity: null, newResponse: m.kind === "hold" ? { type: "other", chosen: "unknown", note: m.note || "", at: m.at || now, legacy: true } : null, verificationStatus: "legacy", isRehearsal: false }));
      });
      if (sp.summary) {
        out.reviews.push({ id: R.uuid(), patternId: p.id, legacy: true, windowStart: sp.start || null, windowEnd: sp.start ? R.addDays(sp.start, 6) : null, snapshot: { legacyScore: sp.summary.score, me: sp.summary.me, around: sp.summary.around }, conclusion: sp.summary.me || "", decision: sp.summary.passed ? "legacy-passed" : "legacy-continue", createdAt: sp.summary.at || now });
        if (sp.summary.passed) out.flags.push({ id: R.uuid(), skillId: null, patternId: p.id, legacy: true, legacyStep: sp.step, awardedAt: sp.summary.at || now, evidenceIds: [], note: "Флаг прошлой версии: по старым правилам" });
      }
    });
    if (raw.queue && raw.queue.length) raw.queue.forEach(q => out.episodes.push({ id: R.uuid(), patternId: null, linkStatus: "queued", legacy: true, occurredAt: q.at || now, loggedAt: q.at || now, dateKey: q.at ? R.dateKey(q.at) : R.dateKey(now), tz: "", event: q.text || "", intensity: q.heat != null ? q.heat : null, verificationStatus: "legacy", isRehearsal: false }));
    if (raw.signs && raw.signs.length) out.meta.legacySigns = raw.signs.map(s => ({ at: s.at, text: s.text, teacher: s.teacher || "" }));
    return out;
  };

  /* ---------- экспорт / импорт ---------- */
  /* Схема 3: записи дня по ключу «дата|сюжет», действия помнят навык. Схема 4: у разрешений есть происхождение.
     Файлы схем 2–4 читаются и приводятся к текущей. Валидатор никогда не бросает исключение: всегда {ok, errors}. */
  R.SCHEMA_VERSION = 4;
  R.MIN_IMPORT_SCHEMA = 2;
  R.COLLECTIONS = ["patterns", "episodes", "hypotheses", "experiments", "reviews", "flags"];
  R.validateImport = function (obj) {
    const errors = [];
    try {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false, errors: ["Это не JSON-объект"], schemaVersion: 0, legacy: false };
      const v = Number(obj.schemaVersion);
      if (!v) errors.push("Нет schemaVersion");
      if (v && v > R.SCHEMA_VERSION) errors.push(`Версия файла ${v} новее поддерживаемой ${R.SCHEMA_VERSION}`);
      if (v && v < R.MIN_IMPORT_SCHEMA && !(obj.sprint !== undefined || obj.archive !== undefined || obj.num !== undefined)) errors.push("Старый формат без известной структуры");
      if (v >= R.MIN_IMPORT_SCHEMA && v <= R.SCHEMA_VERSION) {
        R.COLLECTIONS.forEach(c => {
          const list = obj[c]; if (list == null) return;
          if (!Array.isArray(list)) { errors.push(`${c} должен быть списком`); return; }
          let bad = 0; list.forEach(x => { if (!x || typeof x !== "object" || !x.id) bad++; }); if (bad) errors.push(`${c}: ${bad} ${R.plural(bad, "запись", "записи", "записей")} без id`);
        });
        const ck = obj.checkins;
        if (ck != null && (typeof ck !== "object" || Array.isArray(ck))) errors.push("checkins должен быть объектом");
        else Object.entries(ck || {}).forEach(([k, c]) => { const dk = (c && typeof c === "object" && c.dateKey) || k; if (!R.isKey(dk)) errors.push(`checkins: неверная дата ${k}`); });
        if (obj.research != null && (typeof obj.research !== "object" || Array.isArray(obj.research))) errors.push("research должен быть объектом");
      }
      return { ok: errors.length === 0, errors, schemaVersion: v, legacy: v > 0 && v < R.MIN_IMPORT_SCHEMA };
    } catch (e) { errors.push(`Файл не удалось разобрать: ${e && e.message ? e.message : e}`); return { ok: false, errors, schemaVersion: 0, legacy: false }; }
  };
  R.importPreview = function (obj) {
    const p = {}; R.COLLECTIONS.forEach(c => p[c] = (obj[c] || []).length); p.checkins = Object.keys(obj.checkins || {}).length; p.research = Object.keys(obj.research || {}).length; return p;
  };
  /* Объединение по UUID: входящая запись с тем же id заменяет текущую только если новее (updatedAt/createdAt); иначе остаётся текущая. Дубликаты не создаются. */
  R.mergeImport = function (current, incoming, incomingVersion) {
    const out = JSON.parse(JSON.stringify(current)); const stats = { added: 0, updated: 0, skipped: 0 };
    const newer = (a, b) => (b.updatedAt || b.createdAt || b.loggedAt || 0) > (a.updatedAt || a.createdAt || a.loggedAt || 0);
    R.COLLECTIONS.forEach(c => {
      out[c] = out[c] || []; const idx = new Map(out[c].map((x, i) => [x.id, i]));
      (Array.isArray(incoming[c]) ? incoming[c] : []).forEach(x => { if (!x || !x.id) return; if (idx.has(x.id)) { const cur = out[c][idx.get(x.id)]; if (newer(cur, x)) { out[c][idx.get(x.id)] = x; stats.updated++; } else stats.skipped++; } else { out[c].push(x); idx.set(x.id, out[c].length - 1); stats.added++; } });
    });
    out.checkins = R.normalizeCheckins(out.checkins || {});
    Object.entries(R.normalizeCheckins(incoming.checkins || {})).forEach(([k, c]) => { if (!out.checkins[k]) { out.checkins[k] = c; stats.added++; } else { const cur = out.checkins[k]; const m = Object.assign({}, cur); if (c.morning && (!cur.morning || (c.morning.at || 0) > (cur.morning.at || 0))) m.morning = c.morning; if (c.evening && (!cur.evening || (c.evening.at || 0) > (cur.evening.at || 0))) m.evening = c.evening; if (c.help) m.help = [...(cur.help || []), ...c.help.filter(h => !(cur.help || []).some(x => x.at === h.at))]; out.checkins[k] = m; stats.updated++; } });
    out.research = out.research || {};
    Object.entries(incoming.research || {}).forEach(([pid, r]) => { if (!out.research[pid]) { out.research[pid] = r; stats.added++; } else { const cur = out.research[pid]; cur.modules = cur.modules || {}; Object.entries(r.modules || {}).forEach(([mid, m]) => { if (!cur.modules[mid] || (m.doneAt || 0) > (cur.modules[mid].doneAt || 0)) cur.modules[mid] = m; }); } });
    if (incoming.profile && !out.profile) out.profile = incoming.profile;
    /* Файлы прежних схем: действиям восстанавливается навык (помечается backfilled), разрешениям — происхождение migrated. */
    const iv = Number(incomingVersion) || R.SCHEMA_VERSION;
    if (iv < 3) R.backfillEvidence(out);
    if (iv < 4) R.markMigratedPermissions(out.patterns);
    return { data: out, stats };
  };

  /* ---------- вспомогательное ---------- */
  R.stonesWord = n => n === 1 ? "камень" : n >= 2 && n <= 4 ? "камня" : "камней";
  R.plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return h >= 11 && h <= 14 ? c : m === 1 ? a : m >= 2 && m <= 4 ? b : c; };
  /* Совместные наблюдения тела и эмоций: только подсчёт, не причина. */
  R.bodyCooccurrence = function (episodes) {
    const m = {};
    (episodes || []).forEach(e => { const locs = (e.body && e.body.locations) || []; if (!e.emotion || !locs.length) return; locs.forEach(l => { if (/ничего|не хочу/i.test(l)) return; const k = `${l}|${e.emotion}`; m[k] = (m[k] || 0) + 1; }); });
    return Object.entries(m).map(([k, n]) => { const [a, b] = k.split("|"); return { a, b, n }; }).filter(x => x.n >= 2).sort((x, y) => y.n - x.n);
  };
  return R;
});
