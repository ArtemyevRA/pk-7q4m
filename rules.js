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
  /* Одна явно названная шкала для рюкзака: оценка состояния («как сейчас», утром или вечером). Сила эмоции события в камни не входит. */
  R.lastRating = function ({ checkins = {}, episodes = [], includeEpisodes = false }) {
    let best = null;
    const push = (value, kind, at) => { if (value == null || isNaN(value)) return; if (!best || at > best.at) best = { value: Number(value), kind, at }; };
    Object.values(checkins).forEach(c => {
      if (c.legacy) return;
      if (c.morning && c.morning.intensity != null) push(c.morning.intensity, "morning", c.morning.at);
      if (c.evening && c.evening.currentImpact != null) push(c.evening.currentImpact, "evening", c.evening.at);
    });
    if (includeEpisodes) episodes.forEach(e => { if (e.intensity != null && !e.legacy) push(e.intensity, "episode", e.loggedAt); });
    return best;
  };
  /* Старт практики: день 1 — день, когда человек начал практиковать выбранный ответ, не дата вспомненного случая.
     Вечерний первый запуск (после начала вечера) — практика начинается завтра, если сегодня не было реальной попытки. */
  R.practiceStartFor = function ({ todayKey, hour, times, actedToday }) {
    const ph = R.phaseOf(hour, times);
    /* Ночь (после полуночи) — утро этого же календарного дня ещё впереди: практика начинается сегодня. */
    return ph === "evening" && !actedToday ? R.addDays(todayKey, 1) : todayKey;
  };
  R.practiceStart = p => (p && (p.practiceStartDate || p.startDate)) || null;
  /* Схема 5: у действующих сюжетов старт практики = прежний startDate (история не переписывается). Возвращает число изменённых. */
  R.migrateV5 = function (patterns) {
    let n = 0;
    (patterns || []).forEach(p => { if (p && !p.legacy && p.startDate && !p.practiceStartDate) { p.practiceStartDate = p.startDate; p.practiceStartOrigin = "migrated"; n++; } });
    return n;
  };

  /* Подтверждённое применение выбранного ответа: не репетиция; пауза — только выбранная.
     Если указан навык, запись считается только при совпадении навыка, записанного в момент действия.
     Запись без навыка (неизвестная принадлежность) доказательством для навыка не является. Версия плана не важна: навык тот же — практика та же. */
  /* Совместимость версий (v6.3): попытка подтверждает навык только в своей линии плана (lineageId). Линия сохраняется при смене момента,
     упрощении/возврате полной версии и параметрах, не меняющих полное действие; меняется при новом действии, шаблоне, навыке или уроке.
     Попытки без lineageId (до v6.3) — по прежнему правилу навыка; новые записи никогда не получают их повторно. */
  R.isConfirmedAction = function (ep, skillId, lineageId) {
    const nr = ep && ep.newResponse; if (!nr || ep.isRehearsal || ep.legacy) return false;
    if (skillId && (nr.skillId !== skillId || nr.backfilled)) return false;
    if (lineageId && nr.lineageId && nr.lineageId !== lineageId) return false;
    /* v6: попытка подтверждает навык только когда выполнен именно шаг плана (status done) при реальном поводе.
       Частично, другое действие и репетиция — отдельные записи, не подтверждение. */
    if (nr.status) return nr.status === "done" && nr.opportunity !== "rehearsal" && nr.opportunity !== "none";
    if (nr.type === "pause") return nr.chosen === "chosen";
    return true;
  };
  R.isAttempt = ep => !!(ep && ep.newResponse && !ep.legacy && (ep.newResponse.status ? ["done", "partial", "other"].includes(ep.newResponse.status) && ep.newResponse.opportunity !== "rehearsal" : !ep.isRehearsal));
  /* Навык, восстановленный задним числом (backfilled), для флага не достаточен: прошлая версия позволяла менять навык плана на месте,
     поэтому исходный навык такой записи достоверно не известен. Запись остаётся в истории. */
  /* Вечер, производный от дневной попытки (fromEpisodeId), — не второе доказательство: подтверждает сама попытка. */
  R.eveningConfirms = (c, skillId, lineageId) => !!(c && c.evening && c.evening.actionStatus === "done" && !c.evening.fromEpisodeId && !c.evening.provenanceUnknown && (!skillId || (c.evening.skillId === skillId && !c.evening.backfilled)) && !(lineageId && c.evening.lineageId && c.evening.lineageId !== lineageId));
  R.confirmedActionDays = function ({ episodes = [], checkins = {}, patternId, skillId, lineageId }) {
    const days = new Set();
    episodes.forEach(e => { if (patternId && e.patternId === patternId && R.isConfirmedAction(e, skillId, lineageId)) days.add(e.dateKey); });
    Object.values(checkins).forEach(c => { if (R.eveningEvidence(c, patternId) && R.eveningConfirms(c, skillId, lineageId)) days.add(c.dateKey); });
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
  R.windowSummary = function ({ checkins = {}, episodes = [], window: w, patternId, skillId, experiment, lineageId }) {
    const days = []; for (let k = w.start; R.diffDays(k, w.end) >= 0; k = R.addDays(k, 1)) days.push(k);
    const evenings = Object.values(checkins).filter(c => R.eveningEvidence(c, patternId) && R.inWindow(c.dateKey, w)).sort((a, b) => a.dateKey < b.dateKey ? -1 : 1);
    const impactRatings = evenings.filter(c => c.evening.currentImpact != null).map(c => ({ dateKey: c.dateKey, value: Number(c.evening.currentImpact) }));
    const opportunities = evenings.filter(c => c.evening.hadOpportunity === "yes").length;
    const notSure = evenings.filter(c => c.evening.hadOpportunity === "unsure").length;
    const eps = episodes.filter(e => e.dateKey && R.inWindow(e.dateKey, w) && !e.legacy && patternId && e.patternId === patternId);
    const realEps = eps.filter(e => !e.isRehearsal);
    const actionDays = new Set();
    eps.forEach(e => { if (R.isConfirmedAction(e, skillId, lineageId)) actionDays.add(e.dateKey); });
    evenings.forEach(c => { if (R.eveningConfirms(c, skillId, lineageId)) actionDays.add(c.dateKey); });
    const partial = evenings.filter(c => c.evening.actionStatus === "partial" && !c.evening.fromEpisodeId).length + eps.filter(e => e.newResponse && e.newResponse.status === "partial" && !e.isRehearsal).length;
    const attempts = { done: 0, partial: 0, other: 0, rehearsal: 0, viewed: 0 };
    eps.forEach(e => { const nr = e.newResponse; if (!nr) return; const st = nr.status || (e.isRehearsal ? "rehearsal" : (R.isConfirmedAction(e) ? "done" : "other")); if (st in attempts) attempts[st]++; });
    const results = experiment ? (experiment.results || []).filter(r => { const e = episodes.find(x => x.id === r.episodeId); return e && e.dateKey && R.inWindow(e.dateKey, w); }) : [];
    const change = { better: 0, same: 0, worse: 0 };
    evenings.forEach(c => { if (c.evening.change in change) change[c.evening.change]++; });
    return { window: w, totalDays: days.length, eveningCount: evenings.length, impactRatings, maxImpact: impactRatings.length ? Math.max(...impactRatings.map(x => x.value)) : null,
      opportunities, notSure, realEpisodes: realEps.length, rehearsals: eps.length - realEps.length, actionDays: [...actionDays], partial, attempts, episodeDates: [...new Set(realEps.map(e => e.dateKey))].sort(), results, change };
  };

  /* v7: зеркало за период — только записи текущего сюжета; версия зеркала хранится в каждой записи */
  R.mirrorWeek = function ({ checkins = {}, pattern, window: w }) {
    const pid = pattern && pattern.id, M = (pattern && pattern.mirror) || {};
    const evs = Object.values(checkins).filter(c => c.patternId === pid && c.evening && !c.legacy && R.inWindow(c.dateKey, w)).sort((a, b) => a.dateKey < b.dateKey ? -1 : 1);
    const withExp = evs.filter(c => c.evening.experience);
    const ruleOn = withExp.filter(c => ["yes", "partly"].includes(c.evening.experience.rule)).map(c => ({ dateKey: c.dateKey, rule: c.evening.experience.rule, version: c.evening.experience.mirrorVersion }));
    const ruleOff = withExp.filter(c => c.evening.experience.rule === "no").map(c => c.dateKey);
    const exp = withExp.filter(c => c.evening.experience.outcome).map(c => ({ dateKey: c.dateKey, outcome: c.evening.experience.outcome, fact: c.evening.experience.fact || "" }));
    /* два-три эпизода, включая неудобные: сначала по одному каждого исхода, затем остальные по дате */
    const pick = []; ["not", "confirmed", "insufficient"].forEach(o => { const e = exp.find(x => x.outcome === o); if (e) pick.push(e); });
    exp.forEach(e => { if (pick.length < 3 && !pick.includes(e)) pick.push(e); });
    pick.sort((a, b) => a.dateKey < b.dateKey ? -1 : 1);
    const concl = {}; withExp.forEach(c => { const v = c.evening.experience.conclusion; if (v) concl[v] = (concl[v] || 0) + 1; });
    const thoughts = (M.otherThoughts || []).filter(t => R.inWindow(t.dateKey, w));
    return { evenings: evs.length, withExperience: withExp.length, ruleOn, ruleOff, expected: pick.slice(0, 3), conclusions: concl, otherThoughts: thoughts, allOtherThoughts: (M.otherThoughts || []).filter(t => t.status !== "used") };
  };
  /* v7: миграция данных v6.10 — только добавляет поля версии; текст, статус и источник зеркала не трогаются */
  R.migrateMirrorV7 = function (patterns) {
    const out = [];
    (patterns || []).forEach(p => {
      let ch = false; const M = p.mirror;
      if ((p.familyResult || p.storyResult) && !p.storyId) { p.storyId = p.id; ch = true; }
      if (M && M.text && !M.version) { M.version = 1; M.versions = [{ version: 1, text: M.text, at: M.at || p.createdAt || null, source: M.origin || "migrated" }]; M.migratedFrom = "v6.10"; ch = true; }
      if (M && !M.text && M.version == null) { M.version = 0; M.versions = M.versions || []; ch = true; }
      if (ch) out.push(p);
    });
    return out;
  };
  /* v7: текущая неделя практики для промежуточного обзора (не отмечается пройденной) */
  R.currentWindow = function (startKey, todayKey) { if (!startKey) return null; const i = R.weekIndex(startKey, todayKey); return i < 0 ? null : R.windowOf(startKey, i); };

  /* ---------- правило флага (продуктовая эвристика пилота) ---------- */
  R.DEFAULT_POLICY = { minElapsedCalendarDays: 21, stabilityWindowCount: 2, stabilityWindowDays: 7, minImpactRatingsPerWindow: 4, maxEachRecordedImpact: 2, minRealOpportunitiesPerWindow: 1, minConfirmedActionsAcrossWindowsOnDistinctDays: 3, countRehearsalsAsReal: false };
  R.flagEligibility = function ({ pattern, checkins = {}, episodes = [], todayKey, policy, experiment, skillId, lineageId }) {
    const P = Object.assign({}, R.DEFAULT_POLICY, policy || {});
    const skill = skillId || (experiment && experiment.skillId) || (pattern && pattern.skillId) || null;
    /* Срок считается от фактического старта практики, не от даты вспомненного случая. */
    const start = R.practiceStart(pattern);
    const out = { eligible: false, reasons: [], windows: [], skillId: skill, daysElapsed: start ? R.daysSince(start, todayKey) : -1 };
    if (!pattern || !start) { out.reasons.push("Нет первого реального эпизода."); return out; }
    if (!skill) { out.reasons.push("Навык для флага не выбран."); return out; }
    if (out.daysElapsed < 0) { out.reasons.push(`Практика начнётся ${R.human(start)}.`); return out; }
    if (out.daysElapsed < P.minElapsedCalendarDays) out.reasons.push(`Прошло ${out.daysElapsed} из ${P.minElapsedCalendarDays} календарных дней практики.`);
    const done = R.completedWindows(start, todayKey);
    if (done.length < P.stabilityWindowCount) { out.reasons.push(`Завершённых недель: ${done.length} из ${P.stabilityWindowCount}.`); return out; }
    const last = done.slice(-P.stabilityWindowCount).map(w => R.windowSummary({ checkins, episodes, window: w, patternId: pattern.id, skillId: skill, experiment, lineageId }));
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
    const plan = !!(x && (x.kind === "experiment" || x.kind === "plan") && x.hypothesisVersionId && x.hypothesisVersionId !== cur && x.keptFor !== cur);
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
  /* v6.4: прежний построитель buildEventDeck удалён — он добавлял карточки других сфер. Колоду строит R.selectDeck. */


  /* v6.4 Квиз по сфере (эталон karma-quiz-router.cjs, перенесён без изменения правил отбора).
     Сфера — жёсткая граница: карточки только выбранной сферы, для работы — только выбранного контекста («any» = любые рабочие).
     Тематическое предпочтение (от явного отклика) — не больше двух первых карточек и только внутри допустимого пула.
     Одно семейство события — одна карточка. Порядок задаёт сохранённый seed сессии; исчерпание пула не дополняется чужой сферой. */
  R.QUIZ_AREAS = ["close", "work", "money", "self"];
  R.QUIZ_CONTEXTS = ["boss", "colleagues", "clients", "chat", "load", "any"];
  R.qhash = function (value) { let h = 2166136261; for (const c of String(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  R.cardOf = v => ({ id: v.variantId, variantId: v.variantId, eventId: v.eventId, familyId: v.familyId, area: v.area, subtype: v.subtype || null, ctx: v.contexts || [], topicTags: v.topicTags || [], text: v.text, packId: v.packId, pathHint: v.pathHint || [] });
  /* v6.6: первая шестёрка покрывает смысловые подтипы. Для сферы (контекста) задан список основных подтипов; из каждого
     берётся редакторски репрезентативная карточка (порядок reps), seed меняет только порядок подтипов. Отклик пути поднимает
     до двух подтипов вперёд, но основной подтип им не вытесняется. focus — явный выбор «Уточнить, что искать»: только этот подтип. */
  R.selectDeck = function ({ variants = [], area, context = null, preferredSubtypes = [], focus = null, exclude = [], excludeSubtypes = [], seed = 0, limit = 6, subtypes = {}, mainSubtypes = [] }) {
    if (!R.QUIZ_AREAS.includes(area)) return { cards: [], reason: "choose_area", exhausted: false };
    if (area === "work" && !R.QUIZ_CONTEXTS.includes(context)) return { cards: [], reason: "choose_work_context", exhausted: false };
    const ex = new Set(exclude), pref = (preferredSubtypes || []).filter(Boolean);
    const eligible = variants.filter(c => c.area === area && (area !== "work" || context === "any" || (c.contexts || []).includes(context)) && !ex.has(c.variantId) && !ex.has(c.eventId) && !(excludeSubtypes || []).includes(c.subtype) && (!focus || c.subtype === focus));
    const repIdx = c => { const r = ((subtypes[c.subtype] || {}).reps || []).indexOf(c.eventId); return r < 0 ? 99 : r; };
    const groups = new Map();
    eligible.forEach(c => { const k = c.subtype || "other"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
    groups.forEach(g => g.sort((a, b) => repIdx(a) - repIdx(b) || R.qhash(`${seed}|${a.variantId}`) - R.qhash(`${seed}|${b.variantId}`) || a.variantId.localeCompare(b.variantId)));
    const hs = k => R.qhash(`${seed}|st|${k}`);
    const present = [...groups.keys()];
    const main = mainSubtypes.filter(k => groups.has(k)), rest = present.filter(k => !main.includes(k)).sort((a, b) => hs(a) - hs(b) || a.localeCompare(b));
    const prefMain = main.filter(k => pref.includes(k)).slice(0, 2);
    const order = [...prefMain, ...main.filter(k => !prefMain.includes(k)).sort((a, b) => hs(a) - hs(b) || a.localeCompare(b)), ...rest];
    const out = [], families = new Set();
    const take = c => { if (!c || families.has(c.familyId) || out.length >= limit) return false; out.push(c); families.add(c.familyId); return true; };
    const nextOf = k => (groups.get(k) || []).find(c => !families.has(c.familyId));
    for (const k of order) take(nextOf(k));
    /* v6.7: близкими повторениями не добираем — один пример на тип ситуации. Внутри явно выбранного типа (focus) — все его разные ситуации. */
    if (focus) { let c; while (out.length < limit && (c = nextOf(focus))) take(c); }
    return { cards: out.map(R.cardOf), reason: out.length ? (out.length < limit ? "short_domain_pool" : "ok") : "domain_exhausted", exhausted: out.length < limit };
  };

  /* Допустимые варианты ветки без отбора колоды: несколько вариантов одного семейства (например, для разных ролей) допустимы все. */
  R.eligibleVariants = ({ variants = [], area, context = null }) => R.QUIZ_AREAS.includes(area) ? variants.filter(c => c.area === area && (area !== "work" || !context || context === "any" || (c.contexts || []).includes(context))) : [];
  R.branchKey = ({ area, context, routingVersion }) => `${routingVersion}|${area}|${area === "work" ? context || "-" : "-"}`;
  /* Сохранённая колода годится только для той же ветки и версии маршрутизации и только из допустимых вариантов. */
  R.restoreDeck = function ({ deck, savedKey, variants, area, context, routingVersion }) {
    if (!Array.isArray(deck) || savedKey !== R.branchKey({ area, context, routingVersion })) return { valid: false, reason: "branch_changed" };
    const allowed = new Set(R.eligibleVariants({ variants, area, context }).map(v => v.variantId));
    const ids = deck.map(c => c && c.variantId);
    if (new Set(ids).size !== ids.length || ids.some(id => !allowed.has(id))) return { valid: false, reason: "invalid_saved_deck" };
    return { valid: true, reason: "ok" };
  };
  /* Кандидаты только из показанного в текущей ветке; последний ответ на карточку заменяет прежний. */
  R.quizCandidates = function ({ answers = [], presented = [], area }) {
    const known = new Map(presented.filter(c => c.area === area).map(c => [c.variantId, c]));
    const latest = new Map(); for (const a of answers) if (known.has(a.variantId || a.id)) latest.set(a.variantId || a.id, a);
    return [...latest.values()].filter(a => (a.response || a.r) === "yes" && !a.notStung).map(a => known.get(a.variantId || a.id));
  };
  /* Миграция незавершённого входа на ветки v6.4: автоматическая сфера из отклика пути не считается выбором человека;
     ответы старой колоды переносятся только если для их события есть вариант выбранной сферы; остальное — в архив ветки. */
  R.migrateOnbV64 = function (S, { variants, routingVersion, recognitionTopics }) {
    if (!S || S.routingVersion === routingVersion) return false;
    const byId = new Map(variants.map(v => [v.variantId, v]));
    const auto = !!S.recogMain && !S.areaExplicit;
    if (auto || S.area === "unclear") { S.area = null; S.ctx = null; }
    if (S.recogMain) { S.recogDone = true; S.preferSubtypes = (recognitionTopics && recognitionTopics[S.recogMain]) || []; }
    const explicit = !!S.area && R.QUIZ_AREAS.includes(S.area);
    S.areaExplicit = explicit || S.area === "own";
    const fits = v => v && explicit && v.area === S.area && (S.area !== "work" || !S.ctx || S.ctx === "any" || (v.contexts || []).includes(S.ctx));
    const map = id => { if (!id) return null; const v = byId.get(id) || byId.get(`${id}@${S.area}`); return fits(v) ? v : null; };
    const keep = [], drop = [];
    (S.picks || []).forEach(p => { const v = map(p.id); if (v && !keep.some(k => k.id === v.variantId)) keep.push(Object.assign({}, p, { id: v.variantId, variantId: v.variantId, area: v.area, text: v.text, packId: v.packId })); else drop.push(p); });
    if (drop.length) { S.archive = S.archive || []; S.archive.push({ key: "legacy", picks: drop, at: Date.now() }); }
    S.picks = keep;
    const ev = map(S.event);
    if (ev) S.event = ev.variantId;
    else if (S.event) { S.event = null; S.case = null; S.sting = null; S.want = null; S.confirmed = false; }
    if (!S.want && ["summary", "lesson", "path"].includes(S.step)) S.step = S.event || S.own ? "want" : S.step;
    if (!S.event && !S.own && ["teacher", "case", "sting", "want", "summary", "lesson", "path"].includes(S.step)) S.step = explicit ? "cards" : "area";
    delete S.prefer; delete S.areaSwitched; S.deck = null; S.deckKey = null; S.idx = 0; S.undo = null; S.shown = keep.map(p => p.id); S.choose = false;
    if (!explicit && ["cards", "workctx"].includes(S.step)) S.step = "area";
    S.routingVersion = routingVersion; return true;
  };


  /* ---------- v6.7 прототип: адаптивный диалог (локальный редакторский граф) ----------
     Состояние: answers {qid: {v, text}}, order [qid] — для отмены. Следующий вопрос вычисляется заново из ответов:
     сохранённый ответ применяется, только если он допустим для текущего вопроса; иначе вопрос задаётся снова.
     Поэтому правка одного поля не сбрасывает остальные, а смена события снимает только зависимые ответы.
     «Не знаю» не равно «нет». Число пути во входных данных не участвует. */
  R.YES = v => v === "yes" || v === "probably";
  R.trimEnd = t => String(t || "").trim().replace(/[\s.!…;,]+$/u, "");
  R.dialogNext = function (bank, st, { variants = [], lessonOf = null, actionOf = null } = {}) {
    const A = (st && st.answers) || {}, rejected = new Set((st && st.rejected) || []), f = {}, basis = [];
    let asked = 0;
    const get = q => A[q];
    const vById = id => variants.find(v => v.variantId === id) || null;
    /* 1. тип события */
    const types = bank.types.map(t => t.id), ta = get("type");
    const ask = q => ({ done: false, next: q, fields: f, basis, asked });
    if (!ta || !(types.includes(ta.v) || ta.v === "unknown")) return ask({ id: "type", kind: "choice", options: bank.types.map(t => [t.id, t.label]).concat([["unknown", "__unknown"]]) });
    asked++;
    let type = ta.v;
    if (type === "unknown") {
      type = null;
      for (const n of bank.narrow) {
        const a = get("n:" + n.id);
        if (!a || !["yes", "probably", "probablyNot", "no", "unknown"].includes(a.v)) return ask({ id: "n:" + n.id, kind: "yn", text: n.text, type: n.id });
        asked++;
        if (R.YES(a.v)) { type = n.id; basis.push({ q: n.text, a: a.v }); break; }
      }
      if (!type) return { done: false, next: { id: "unsupported", kind: "unsupported" }, fields: f, basis, asked };
    } else basis.push({ q: "type", a: type });
    f.type = type;
    /* 2. конкретное событие: примеры этого типа по одному, «знакомо / не про меня / не уверен» */
    const tdef = bank.types.find(t => t.id === type);
    let event = null;
    for (const eid of tdef.events) {
      if (rejected.has(eid)) continue;
      const a = get("e:" + eid);
      if (!a || !["yes", "no", "unsure"].includes(a.v)) return ask({ id: "e:" + eid, kind: "swipe", event: eid, text: bank.events[eid].card });
      asked++;
      if (a.v === "yes") { event = eid; break; }
    }
    if (!event) return { done: false, next: { id: "noEvent", kind: "noEvent", type }, fields: f, basis, asked };
    const ev = bank.events[event], variant = vById(ev.variantId);
    f.event = event; f.eventText = ev.card; f.when = ev.when; f.variantId = ev.variantId; basis.push({ q: "event", a: ev.card });
    /* 3. что задевает: проверенные для этой формулировки варианты + свои слова + «пока не понимаю» */
    const mOpts = (variant ? variant.meanings : []).map(m => [m.id, m.text]);
    const ma = get("meaning");
    const mValid = ma && (mOpts.some(o => o[0] === ma.v) || (ma.v === "__own" && ma.text) || ma.v === "__unsure");
    if (!mValid) return ask({ id: "meaning", kind: "choice", options: mOpts.concat([["__unsure", "__unsure"]]), own: true });
    asked++;
    const mm = variant && variant.meanings.find(m => m.id === ma.v);
    f.meaning = mm ? { id: mm.id, text: mm.text, lessonId: mm.lessonId || null, observe: mm.observe || null, origin: "user_selected" } : ma.v === "__own" ? { id: "own", text: ma.text, lessonId: null, origin: "user_written" } : { id: "unsure", text: "", lessonId: null, origin: "user_unsure" };
    if (f.meaning.text) basis.push({ q: "meaning", a: f.meaning.text });
    /* 4. привычный ответ */
    const ra = get("reaction");
    const rValid = ra && (bank.reactions.includes(ra.v) || (ra.v === "__own" && ra.text) || ra.v === "__unknown");
    if (!rValid) return ask({ id: "reaction", kind: "choice", options: bank.reactions.map(r => [r, r]).concat([["__unknown", "__unknown"]]), own: true });
    asked++;
    f.reaction = ra.v === "__own" ? ra.text : ra.v === "__unknown" ? "" : ra.v;
    if (f.reaction) basis.push({ q: "reaction", a: f.reaction });
    /* 5. уточнение, если оно различает направления для этого события */
    let prefer = [];
    if (ev.clarify) {
      const c = bank.clarifiers[ev.clarify], ca = get("c:" + ev.clarify);
      if (!ca || !["yes", "probably", "probablyNot", "no", "unknown"].includes(ca.v)) return ask({ id: "c:" + ev.clarify, kind: "yn", text: c.text });
      asked++;
      const key = R.YES(ca.v) ? "yes" : (ca.v === "no" || ca.v === "probablyNot") ? "no" : null;
      f.clarify = { id: ev.clarify, v: ca.v }; if (key) prefer = c.prefer[key] || [];
      basis.push({ q: c.text, a: ca.v });
    }
    /* 6. желаемое изменение (v6.7.1): только направления, связанные с выбранным «что задевает» (редакторская карта банка);
       если смысл не выбран — все направления варианта. Первым — урок смысла, затем по уточнению. */
    const lids = [...new Set((variant ? variant.meanings : []).map(m => m.lessonId).filter(Boolean))];
    const curated = mm && ev.desire && ev.desire[mm.id] ? ev.desire[mm.id].filter(id => lids.includes(id)) : null;
    const allowed = curated && curated.length ? curated : mm && mm.lessonId ? [mm.lessonId] : lids;
    const first = [f.meaning.lessonId, ...prefer].filter(id => id && allowed.includes(id));
    const ordered = [...new Set([...first, ...allowed])];
    const dOpts = ordered.map(id => ["L:" + id, lessonOf ? lessonOf(id, ev.variantId) : id]).concat([["__observe", "__observe"]]);
    const da = get("desire");
    const dValid = da && (dOpts.some(o => o[0] === da.v) || (da.v === "__own" && da.text));
    if (!dValid) return ask({ id: "desire", kind: "choice", options: dOpts, own: true, preferred: ordered[0] || null });
    asked++;
    f.desire = da.v.startsWith("L:") ? { kind: "lesson", lessonId: da.v.slice(2), text: lessonOf ? lessonOf(da.v.slice(2), ev.variantId) : da.v.slice(2) } : da.v === "__own" ? { kind: "own", lessonId: null, text: R.trimEnd(da.text) } : { kind: "observe", lessonId: null, text: "" };
    basis.push({ q: "desire", a: f.desire.text || "наблюдение" });
    /* 6а. своя цель сохраняется дословно; смысл свободного текста не угадывается — человек сам выбирает ближайший шаг,
       своё действие или наблюдение. Молчаливой подстановки наблюдения нет. */
    if (f.desire.kind === "own") {
      const sOpts = ordered.map(id => ["L:" + id, actionOf ? actionOf(id, ev.variantId) : id]).concat([["__ownAction", "__ownAction"], ["__observe", "__observe"]]);
      const sa = get("ownStep");
      const sValid = sa && (sOpts.some(o => o[0] === sa.v && o[0] !== "__ownAction") || (sa.v === "__ownAction" && sa.text));
      if (!sValid) return ask({ id: "ownStep", kind: "choice", options: sOpts, goal: f.desire.text });
      asked++;
      if (sa.v.startsWith("L:")) { f.desire.lessonId = sa.v.slice(2); f.desire.step = actionOf ? actionOf(f.desire.lessonId, ev.variantId) : f.desire.lessonId; }
      else if (sa.v === "__ownAction") { f.desire.lessonId = f.meaning.lessonId && allowed.includes(f.meaning.lessonId) ? f.meaning.lessonId : (ordered[0] || null); f.desire.ownAction = R.trimEnd(sa.text); f.desire.step = f.desire.ownAction; }
      else f.desire.observeStep = true;
      basis.push({ q: "ownStep", a: f.desire.step || "наблюдение" });
    }
    /* 7. когда — для честной даты случая */
    const wa = get("when");
    if (!wa || !wa.v) return ask({ id: "when", kind: "when" });
    asked++;
    f.whenCase = wa.v;
    return { done: true, next: { id: "summary", kind: "summary" }, fields: f, basis, asked };
  };
  /* ---------- v6.10 семейная ветка: учитель → зеркало → разрешение → шаг (локальный редакторский граф) ----------
     Тот же формат состояния, что у диалога руководителя (answers/order). Следующий вопрос вычисляется заново из ответов;
     у каждого вопроса — служебное «why»: что уже известно и что различает этот вопрос (для трассы, не для экрана).
     Кандидаты зеркала ранжируются по ответам человека (сцена, смысл, реакция, что дало сразу), не по числу пути.
     Узнавание учителя и узнавание зеркала — две разные проверки; ни одно поле не появляется без ответа. */
  R.familyMirrors = function (bank, f) {
    const g = f.group, e = f.event, tags = (f.meaning && f.meaning.tags) || [];
    const fit = m => (m.when.groups || []).includes(g) || (m.when.events || []).includes(e);
    const score = m => { const w = m.when; let s = 0; tags.forEach(t => { if ((w.tags || []).includes(t)) s += 2; }); if (f.reaction && (w.reactions || []).includes(f.reaction)) s += 2; if (f.now && (w.now || []).includes(f.now)) s += 1; if ((w.events || []).includes(e)) s += 2; return s; };
    const pool = bank.mirrors.filter(fit).map(m => ({ m, s: score(m) }));
    const inner = pool.filter(x => x.m.type !== "same").sort((a, b) => b.s - a.s);
    const strong = inner.filter(x => x.s >= 2), picked = (strong.length ? strong : inner).slice(0, 2).map(x => x.m);
    const same = pool.filter(x => x.m.type === "same").sort((a, b) => b.s - a.s).slice(0, 1).map(x => x.m);
    const need = bank.needs[g] ? [{ id: "need:" + g, type: "need", text: bank.needs[g].text, permissions: [], check: null, predictions: [] }] : [];
    return [...picked, ...same, ...need];
  };
  R.familyNext = function (bank, st, opts = {}) {
    const A = (st && st.answers) || {}, f = {}, trace = []; let asked = 0;
    const get = q => A[q];
    const ask = (q, why) => ({ done: false, next: Object.assign(q, { why }), fields: f, asked, trace });
    const W = { role: "учитель неизвестен; роль ограничивает допустимые сцены", group: "сцена неизвестна; вид сцены сужает примеры без шестёрки случайных карточек", n: "вид не выбран; вопрос различает один вид и остальные, «не знаю» ≠ «нет»",
      e: "вид известен; проверяем конкретную сцену (двоичный ответ — свайп)", meaning: "сцена узнана; смысл различает направления и кандидаты зеркала", reaction: "смысл известен; реакция нужна для цепочки и кандидатов зеркала",
      contra: "противоречие смысла и реакции — уточняем, не выбирая за человека", now: "реакция известна; что она дала сразу — без назначения мотива", later: "что было позже — цена прежнего ответа",
      confirmA: "учитель, сцена, смысл и реакция собраны — первое подтверждение", mir: "учитель подтверждён; гипотеза зеркала, выбранная по ответам", check: "зеркало узнано; пример или прогноз делает его проверяемым",
      perm: "зеркало узнано; разрешение — выбор человека, не обязанность", goal: "зеркало не узнано; помогаем с тем, что важно сейчас, без выдуманного объяснения", action: "направление выбрано; шаг рядом с учителем, фразу можно поправить", when: "дата последнего случая — для начала практики" };
    const ok = (q, why, a) => { asked++; trace.push({ q, why: (W[q.split(":")[0]] || why) + (q.startsWith("mir:") ? ` (${why})` : ""), a }); };
    /* 1. учитель: роль известна со входа — повторно не спрашиваем */
    const roles = bank.roles.map(r => r[0]);
    const role = st.role || (get("role") && get("role").v);
    if (!role || !(roles.includes(role) || role === "__own")) return ask({ id: "role", kind: "choice", options: bank.roles.map(r => [r[0], r[1]]), own: true }, "учитель неизвестен; роль ограничивает допустимые сцены");
    if (!st.role) ok("role", "роль учителя", role);
    f.role = role; f.roleLabel = role === "__own" ? (get("role").text || "близкий") : (bank.roles.find(r => r[0] === role) || [])[2];
    const roleOk = ev => role === "__own" || ev.roles.includes(role);
    /* 2. вид сцены: жизненные категории; «трудно сказать» — различающие вопросы, «не знаю» ≠ «нет» */
    const groups = bank.groups.filter(g => g.events.some(e => roleOk(bank.events[e])));
    const ga = get("group");
    if (!ga || !(groups.some(g => g.id === ga.v) || ga.v === "unknown")) return ask({ id: "group", kind: "choice", options: groups.map(g => [g.id, g.label]).concat([["unknown", "__unknown"]]) }, "сцена неизвестна; вид сцены сужает примеры без шестёрки случайных карточек");
    ok("group", "вид сцены", ga.v);
    let group = ga.v;
    if (group === "unknown") {
      group = null;
      for (const n of bank.narrow) {
        if (!groups.some(g => g.id === n.id)) continue;
        const a = get("n:" + n.id);
        if (!a || !["yes", "probably", "probablyNot", "no", "unknown"].includes(a.v)) return ask({ id: "n:" + n.id, kind: "yn", text: n.text, group: n.id }, "вид сцены не выбран; вопрос различает «" + n.id + "» и остальные");
        ok("n:" + n.id, "различение вида", a.v);
        if (R.YES(a.v)) { group = n.id; break; }
      }
      if (!group) return { done: false, next: { id: "unsupported", kind: "unsupported", why: "ни один вид не подтверждён — свой текст или наблюдение" }, fields: f, asked, trace };
    }
    f.group = group;
    /* 3. конкретная сцена: только совместимые с ролью; «не про меня» отклоняет пример, не весь вид */
    const g = bank.groups.find(x => x.id === group), evs = g.events.filter(e => roleOk(bank.events[e]));
    let event = null;
    for (const eid of evs) {
      if ((st.rejected || []).includes(eid)) continue;
      const a = get("e:" + eid);
      if (!a || !["yes", "no", "unsure"].includes(a.v)) return ask({ id: "e:" + eid, kind: "swipe", event: eid, text: bank.events[eid].card }, "вид известен; проверяем конкретную сцену (двоичный ответ — свайп)");
      ok("e:" + eid, "сцена", a.v);
      if (a.v === "yes") { event = eid; break; }
    }
    if (!event) return { done: false, next: { id: "noEvent", kind: "noEvent", why: "ни одна сцена вида не узнана" }, fields: f, asked, trace };
    const ev = bank.events[event]; f.event = event; f.eventText = ev.card; f.when = ev.when;
    /* 4. личный смысл */
    const ma = get("meaning");
    const mOk = ma && (ev.meanings.some(m => m.id === ma.v) || (ma.v === "__own" && ma.text) || ma.v === "__unsure");
    if (!mOk) return ask({ id: "meaning", kind: "choice", options: ev.meanings.map(m => [m.id, m.text]).concat([["__unsure", "__unsure"]]), own: true }, "сцена узнана; смысл различает направления и кандидаты зеркала");
    ok("meaning", "смысл", ma.v);
    const mm = ev.meanings.find(m => m.id === ma.v);
    f.meaning = mm ? { id: mm.id, text: mm.text, tags: mm.tags, origin: "user_selected" } : ma.v === "__own" ? { id: "own", text: R.trimEnd(ma.text), tags: [], origin: "user_written" } : { id: "unsure", text: "", tags: [], origin: "user_unsure" };
    /* 5. привычная реакция; при противоречии с выбранным смыслом — короткая проверка */
    const ra = get("reaction");
    const rOk = ra && (bank.reactions.includes(ra.v) || (ra.v === "__own" && ra.text) || ra.v === "__unknown");
    if (!rOk) return ask({ id: "reaction", kind: "choice", options: bank.reactions.map(r => [r, r]).concat([["__unknown", "__unknown"]]), own: true }, "смысл известен; реакция нужна для цепочки и кандидатов зеркала");
    ok("reaction", "реакция", ra.v);
    f.reaction = ra.v === "__own" ? R.trimEnd(ra.text) : ra.v === "__unknown" ? "" : ra.v;
    if (f.meaning.tags.includes("conflict") && f.reaction === "Спорю или оправдываюсь") {
      const ca = get("contra");
      if (!ca || !["agree", "argue", "mixed"].includes(ca.v)) return ask({ id: "contra", kind: "choice", text: `Сначала ты отметил «${f.meaning.text}», а сейчас — «${f.reaction}». Как точнее для этого случая?`, options: [["agree", "Чаще соглашаюсь"], ["argue", "Чаще спорю"], ["mixed", "Бывает по-разному"]] }, "противоречие смысла и реакции — уточняем, не выбирая за человека");
      ok("contra", "противоречие", ca.v);
      if (ca.v === "agree") f.reaction = "Соглашаюсь, чтобы не ссориться"; if (ca.v === "mixed") f.reaction = "По-разному: то соглашаюсь, то спорю";
    }
    /* 6. последствия: что дало сразу и что потом (мотив не назначается) */
    if (f.reaction) {
      for (const [qid, list] of [["now", bank.now], ["later", bank.later]]) {
        const a = get(qid);
        if (!a || !(list.includes(a.v) || (a.v === "__own" && a.text) || a.v === "__unknown")) return ask({ id: qid, kind: "choice", options: list.map(x => [x, x]).concat([["__unknown", "__unknown"]]), own: true }, qid === "now" ? "реакция известна; что она дала сразу — без назначения мотива" : "что было позже — цена прежнего ответа");
        ok(qid, qid, a.v);
        f[qid] = a.v === "__own" ? R.trimEnd(a.text) : a.v === "__unknown" ? "" : a.v;
      }
    } else { f.now = ""; f.later = ""; }
    /* 7. подтверждение учителя и ситуации — отдельно от зеркала */
    const cA = get("confirmA");
    if (!cA || cA.v !== "yes") return ask({ id: "confirmA", kind: "confirmA" }, "учитель, сцена, смысл и реакция собраны — первое подтверждение");
    ok("confirmA", "учитель подтверждён", "yes"); f.teacherConfirmed = true;
    /* 8. зеркало: 2–4 гипотезы по ответам; «не моё» отменяет только эту формулировку */
    const cands = R.familyMirrors(bank, f); f.candidates = cands.map(c => c.id);
    let chosen = null, mStatus = null;
    for (const c of cands) {
      const a = get("mir:" + c.id);
      if (!a || !["yes", "partly", "no", "own", "unsure"].includes(a.v) || ((a.v === "partly" || a.v === "own") && !a.text)) return ask({ id: "mir:" + c.id, kind: "mirror", mirror: c, index: cands.indexOf(c), total: cands.length }, "учитель подтверждён; проверяем гипотезу зеркала, выбранную по ответам (" + c.type + ")");
      ok("mir:" + c.id, "гипотеза " + c.type, a.v);
      if (a.v === "no") continue;
      if (a.v === "unsure") { mStatus = "unknown"; break; }
      chosen = { id: c.id, type: c.type, text: a.v === "yes" ? c.text : R.trimEnd(a.text), candidateText: c.text, origin: a.v === "yes" ? "candidate_recognized" : a.v === "partly" ? "candidate_edited" : "user_written", permissions: c.permissions, check: c.check, predictions: c.predictions };
      if (a.v === "own") { chosen.type = "own"; chosen.permissions = []; chosen.check = "prediction"; chosen.predictions = []; }
      break;
    }
    if (!chosen && !mStatus) mStatus = "none";
    /* 9. проверка зеркала опытом: пример (для «сам так делаю») или прогноз */
    if (chosen && chosen.type !== "need") {
      const ca = get("check");
      const preds = chosen.predictions.length ? chosen.predictions : ["Будет конфликт", "Меня осудят", "Мне самому будет неловко"];
      if (chosen.check === "example") {
        if (!ca || !((ca.v === "__example" && ca.text) || ca.v === "__later")) return ask({ id: "check", kind: "check", mode: "example", mirrorText: chosen.text }, "зеркало «сам так поступаю» — нужен собственный реальный пример, не вынужденное признание");
      } else if (!ca || !(preds.includes(ca.v) || (ca.v === "__own" && ca.text) || (ca.v === "__example" && ca.text) || ca.v === "__unknown")) return ask({ id: "check", kind: "check", mode: "prediction", options: preds, mirrorText: chosen.text }, "правило узнано; прогноз «если поступить иначе» делает его проверяемым");
      ok("check", "проверка зеркала", ca.v);
      chosen.example = ca.v === "__example" ? R.trimEnd(ca.text) : "";
      chosen.prediction = preds.includes(ca.v) ? ca.v : ca.v === "__own" ? R.trimEnd(ca.text) : "";
      chosen.status = chosen.example ? "recognized_with_example" : chosen.prediction ? "recognized" : "to_check";
      if (chosen.origin === "candidate_edited" && chosen.status !== "to_check") chosen.status = "partial";
      f.mirror = chosen;
    } else if (chosen && chosen.type === "need") { f.mirror = { status: "none" }; f.need = chosen.text; }
    else f.mirror = { status: mStatus };
    /* 10. внутреннее разрешение (если зеркало узнано) или что важно (если нет) — помощь не блокируется */
    let actIds = [];
    if (f.mirror.type && f.mirror.type !== "need") {
      const pa = get("perm"), ps = f.mirror.permissions || [];
      if (!pa || !(ps.some(p => p.id === pa.v) || (pa.v === "__own" && pa.text))) return ask({ id: "perm", kind: "choice", options: ps.map(p => [p.id, p.text]), own: true }, "зеркало узнано; разрешение — выбор человека, не обязанность");
      ok("perm", "разрешение", pa.v);
      const pp = ps.find(p => p.id === pa.v);
      f.permission = pp ? { id: pp.id, text: pp.text, short: pp.short, origin: "user_selected" } : { id: "own", text: R.trimEnd(pa.text), short: R.trimEnd(pa.text), origin: "user_written" };
      actIds = pp ? pp.actions : bank.needs[group].goals.flatMap(gl => gl[2]);
    } else {
      const goals = bank.needs[group].goals, gA = get("goal");
      if (!gA || !(goals.some(gl => gl[0] === gA.v) || (gA.v === "__own" && gA.text) || gA.v === "__observe")) return ask({ id: "goal", kind: "choice", options: goals.map(gl => [gl[0], gl[1]]).concat([["__observe", "__observe"]]), own: true, mirrorStatus: f.mirror.status }, "зеркало не узнано (" + f.mirror.status + "); помогаем с тем, что важно сейчас, без выдуманного объяснения");
      ok("goal", "что важно", gA.v);
      const gl = goals.find(x => x[0] === gA.v);
      f.goal = gl ? { id: gl[0], text: gl[1], origin: "user_selected" } : gA.v === "__own" ? { id: "own", text: R.trimEnd(gA.text), origin: "user_written" } : { id: "observe", text: "", origin: "user_selected" };
      actIds = gl ? gl[2] : gA.v === "__own" ? [...new Set(goals.flatMap(x => x[2]))].slice(0, 3) : [];
    }
    /* 11. поступок рядом с учителем: редактируемая фраза; своё действие; наблюдение */
    if (!(f.goal && f.goal.id === "observe")) {
      const aa = get("action");
      if (!aa || !((actIds.includes(aa.v) && aa.text) || (aa.v === "__own" && aa.text) || aa.v === "__observe")) return ask({ id: "action", kind: "action", options: actIds.map(id => bank.actions[id]).filter(Boolean) }, "направление выбрано; шаг — поступок рядом с учителем, фразу можно поправить");
      ok("action", "шаг", aa.v);
      f.action = aa.v === "__observe" ? { id: "observe", phrase: "", origin: "user_selected" } : aa.v === "__own" ? { id: "own", phrase: R.trimEnd(aa.text), origin: "user_written" } : { id: aa.v, phrase: String(aa.text).trim(), origin: aa.text.trim() === bank.actions[aa.v].phrase ? "user_selected" : "user_edited" };
    } else f.action = { id: "observe", phrase: "", origin: "user_selected" };
    /* 12. когда — для честной даты случая */
    const wa = get("when");
    if (!wa || !wa.v) return ask({ id: "when", kind: "when" }, "дата последнего случая — для начала практики");
    ok("when", "когда", wa.v); f.whenCase = wa.v;
    return { done: true, next: { id: "summary", kind: "summary", why: "всё собрано — итог подтверждается отдельно по полям" }, fields: f, asked, trace };
  };
  /* Правка части: снимаются только зависимые непроверенные выводы; учитель и сцена сохраняются, если не правятся сами */
  R.familyFix = function (st, part) {
    const drop = q => { delete st.answers[q]; st.order = (st.order || []).filter(x => x !== q); };
    const mirrorChain = () => { Object.keys(st.answers).filter(q => q.startsWith("mir:")).forEach(drop); ["check", "perm", "goal", "action"].forEach(drop); };
    if (part === "event") { Object.keys(st.answers).filter(q => q.startsWith("e:")).forEach(q => { if (st.answers[q].v === "yes") st.rejected = [...new Set([...(st.rejected || []), q.slice(2)])]; drop(q); }); ["meaning", "contra", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "meaning") { ["meaning", "contra", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "reaction") { ["reaction", "contra", "now", "later", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "mirror") mirrorChain();
    if (part === "goal") { ["perm", "goal", "action"].forEach(drop); }
    if (part === "action") drop("action");
    if (part === "all") { st.misses = (st.misses || 0) + 1; st.answers = {}; st.order = []; st.rejected = []; }
    return st;
  };
  /* ---------- v7 единый маршрут сюжета для всех сфер: учитель → триггер → зеркало → разрешение → первый эксперимент ----------
     Один граф для готовой сцены и своего случая. Следующий вопрос вычисляется заново из ответов; у каждого — служебное «why».
     Кандидаты зеркала — только по ответам человека (смысл, реакция, последствия, мысль); число пути не участвует. */
  R.storyScenes = (B, sphere, role) => Object.values(B.scenes).filter(sc => sc.spheres.includes(sphere) && (role === "__own" || sc.roles.includes(role)));
  R.storyMirrorScore = function (m, f) {
    const w = m.when || {}, tags = (f.meaning && f.meaning.tags) || []; let s = 0; const why = [];
    if (w.roles && !(w.roles.includes(f.role) || f.role === "__own")) return { s: -1, why };
    const tg = tags.filter(t => (w.tags || []).includes(t)); if (tg.length) { s += 3 * tg.length; why.push(`ты отметил: «${f.meaning.text}»`); }
    if (f.reaction && (w.reactions || []).includes(f.reaction)) { s += 2; why.push(`обычно: «${f.reaction}»`); }
    if (f.now && (w.now || []).includes(f.now)) { s += 1; why.push(`сразу это дало: «${f.now}»`); }
    if (f.scene && (w.scenes || []).includes(f.scene)) { s += 1; }
    return { s, why };
  };
  R.storyCandidates = function (B, f) {
    const fit = m => ((m.when.groups || []).includes(f.group) || (f.scene && (m.when.scenes || []).includes(f.scene)) || (!m.when.groups && !m.when.scenes && m.when.roles && m.when.roles.includes(f.role)));
    const all = B.mirrors.filter(fit).map(m => Object.assign({ m }, R.storyMirrorScore(m, f))).filter(x => x.s >= 0);
    const inner = all.filter(x => x.m.type !== "same" && x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 2);
    const same = all.filter(x => x.m.type === "same" && (x.s >= 1)).sort((a, b) => b.s - a.s).slice(0, 1);
    return [...inner, ...same].map(x => ({ id: x.m.id, type: x.m.type, text: x.m.text, why: x.why, permissions: x.m.permissions, check: x.m.check, predictions: x.m.predictions, thought: x.m.thought }));
  };
  R.storyNext = function (B, st) {
    const A = (st && st.answers) || {}, f = {}, trace = []; let asked = 0;
    const get = q => A[q];
    const W = { group: "сцена неизвестна; вид ситуации сужает примеры", n: "вид не выбран; вопрос различает один вид и остальные, «не знаю» ≠ «нет»", ownScene: "свой случай: текст сохраняется дословно", ownKind: "свободный текст не толкуем — человек сам выбирает, что важнее",
      e: "вид известен; проверяем конкретную сцену (двоичный ответ — свайп)", miss2: "два «не про меня» подряд — предлагаем другой способ описать", meaning: "сцена известна; что именно задело — различает направления и гипотезы",
      reaction: "смысл известен; привычная реакция нужна для цепочки и гипотез", conseq: "реакция известна; что она дала сразу и потом — без назначения мотива", when: "дата случая — для начала практики", confirmA: "учитель, сцена, смысл и реакция собраны — первое подтверждение",
      mir: "учитель подтверждён; гипотеза зеркала по ответам человека", thought: "гипотеза не подошла — спрашиваем реальную первую мысль вместо новой догадки", ownrule: "человек сам назвал мысль/правило — предлагаем проверить его",
      check: "зеркало узнано; пример или прогноз делает его проверяемым", perm: "зеркало узнано; разрешение — выбор человека", goal: "зеркала пока нет; помогаем с тем, что важно сейчас", confirmB: "отдельное подтверждение зеркала перед работой",
      action: "направление выбрано; шаг из сцены и цели, фразу можно поправить", pred: "прогноз, который можно сравнить с опытом", pause: "десять решений за визит — предлагаем продолжить, сохранить или понаблюдать" };
    /* после десяти решений в одном разборе — обязательно предложить паузу, на каком бы вопросе это ни случилось */
    const ask = (q) => { if (asked >= 10 && !get("pause") && q.id !== "pause") q = { id: "pause", kind: "pause" }; return { done: false, next: Object.assign(q, { why: W[q.id.split(":")[0]] || "" }), fields: f, asked, trace }; };
    const ok = (q, a, note) => { asked++; trace.push({ q, a, why: (W[q.split(":")[0]] || "") + (note ? ` (${note})` : "") }); };
    const pauseGate = () => asked >= 10 && !get("pause") ? ask({ id: "pause", kind: "pause" }) : null;
    f.sphere = st.sphere; f.role = st.role; f.roleLabel = st.roleLabel || ((B.spheres[st.sphere].roles.find(r => r[0] === st.role) || [])[2]) || "";
    const scenes = R.storyScenes(B, st.sphere, st.role);
    const groupIds = Object.keys(B.groups).filter(g => scenes.some(x => x.group === g));
    /* 1. вид ситуации или свой случай */
    const ga = get("group");
    if (!ga || !(groupIds.includes(ga.v) || ["unknown", "__own", "danger"].includes(ga.v))) return ask({ id: "group", kind: "choice", options: groupIds.map(g => [g, B.groups[g]]).concat([["unknown", "__unknown"]]), ownCase: true, danger: st.sphere !== "self" });
    if (ga.v === "danger") return { done: false, next: { id: "danger", kind: "danger", why: "угроза безопасности — сначала помощь, не поиск своей вины" }, fields: f, asked, trace };
    ok("group", ga.v);
    let group = ga.v, own = ga.v === "__own";
    if (group === "unknown") {
      group = null;
      for (const g of groupIds) {
        const a = get("n:" + g);
        if (!a || !["yes", "probably", "probablyNot", "no", "unknown"].includes(a.v)) return ask({ id: "n:" + g, kind: "yn", text: `Ближе всего это: «${B.groups[g]}»?`, group: g });
        ok("n:" + g, a.v);
        if (R.YES(a.v)) { group = g; break; }
      }
      if (!group) return { done: false, next: { id: "unsupported", kind: "unsupported", why: "ни один вид не подтверждён — свой случай или наблюдение" }, fields: f, asked, trace };
    }
    /* 2. сцена: готовая (свайп) или свой случай; два «не про меня» подряд — предложить описать своими словами */
    let scene = null;
    if (!own) {
      const gsc = scenes.filter(x => x.group === group); let noRun = 0;
      let ownByMiss = !!(get("miss2") && get("miss2").v === "own" && !gsc.some(sc => (get("e:" + sc.id) || {}).v === "yes"));
      if (ownByMiss) ok("miss2", "own");
      for (const sc of (ownByMiss ? [] : gsc)) {
        if ((st.rejected || []).includes(sc.id)) continue;
        if (noRun >= 2) { const m2 = get("miss2"); if (!m2 || !["more", "own"].includes(m2.v)) return ask({ id: "miss2", kind: "miss2" }); if (noRun === 2) ok("miss2", m2.v); if (m2.v === "own") { ownByMiss = true; break; } }
        const a = get("e:" + sc.id);
        if (!a || !["yes", "no", "unsure"].includes(a.v)) return ask({ id: "e:" + sc.id, kind: "swipe", scene: sc.id, text: sc.card });
        ok("e:" + sc.id, a.v);
        if (a.v === "yes") { scene = sc; break; }
        noRun = a.v === "no" ? noRun + 1 : 0;
      }
      if (!scene && !ownByMiss && noRun >= 2 && get("miss2") && get("miss2").v === "own") ownByMiss = true;
      if (!scene && ownByMiss) own = true;
      if (!scene && !own) return { done: false, next: { id: "noEvent", kind: "noEvent", why: "ни одна сцена вида не узнана" }, fields: f, asked, trace };
    }
    if (own) {
      const oa = get("ownScene");
      if (!oa || !oa.text) return ask({ id: "ownScene", kind: "text" });
      ok("ownScene", "свой текст");
      if (ga.v === "__own") {
        const ka = get("ownKind"), kinds = B.ownKinds.filter(k => k[0] === "other" || groupIds.includes(k[0]));
        if (!ka || !kinds.some(k => k[0] === ka.v)) return ask({ id: "ownKind", kind: "choice", options: kinds });
        ok("ownKind", ka.v); group = ka.v;
      }
      f.own = true; f.eventText = R.trimEnd(oa.text); f.when = f.eventText;
    } else { f.scene = scene.id; f.eventText = scene.card; f.when = scene.when; }
    f.group = group;
    /* 3. что задело */
    const gScenes = scenes.filter(x => x.group === group);
    const meanings = scene ? scene.meanings : [...new Map(gScenes.flatMap(x => x.meanings).map(m => [m.text, m])).values()].slice(0, 5);
    const ma = get("meaning");
    if (!ma || !(meanings.some(m => m.id === ma.v) || (ma.v === "__own" && ma.text) || ma.v === "__unsure")) return ask({ id: "meaning", kind: "choice", options: meanings.map(m => [m.id, m.text]).concat([["__unsure", "__unsure"]]), own: true });
    ok("meaning", ma.v);
    const mm = meanings.find(m => m.id === ma.v);
    f.meaning = mm ? { id: mm.id, text: mm.text, tags: mm.tags, origin: "user_selected" } : ma.v === "__own" ? { id: "own", text: R.trimEnd(ma.text), tags: [], origin: "user_written" } : { id: "unsure", text: "", tags: [], origin: "user_unsure" };
    /* 4. привычная реакция */
    const rl = st.role === "child" ? B.reactions.child : (B.reactions[group] || B.reactions.default);
    const ra = get("reaction");
    if (!ra || !(rl.includes(ra.v) || (ra.v === "__own" && ra.text) || ra.v === "__unknown")) return ask({ id: "reaction", kind: "choice", options: rl.map(r => [r, r]).concat([["__unknown", "__unknown"]]), own: true });
    ok("reaction", ra.v);
    f.reaction = ra.v === "__own" ? R.trimEnd(ra.text) : ra.v === "__unknown" ? "" : ra.v; f.reactionOrigin = ra.v === "__own" ? "user_written" : ra.v === "__unknown" ? "unknown" : "user_selected";
    /* 5. последствия: сразу и потом — один экран */
    if (f.reaction) {
      const na = get("now"), la = get("later");
      const okv = (a, list) => a && (list.includes(a.v) || (a.v === "__own" && a.text) || a.v === "__unknown");
      if (!okv(na, B.now) || !okv(la, B.later)) return ask({ id: "conseq", kind: "conseq", now: B.now, later: B.later });
      ok("conseq", `${na.v} / ${la.v}`);
      f.now = na.v === "__own" ? R.trimEnd(na.text) : na.v === "__unknown" ? "" : na.v; f.later = la.v === "__own" ? R.trimEnd(la.text) : la.v === "__unknown" ? "" : la.v;
    } else { f.now = ""; f.later = ""; }
    /* 6. подтверждение учителя и ситуации (+ когда было) — отдельно от зеркала */
    const wa = get("when"), cA = get("confirmA");
    if (!wa || !wa.v || !cA || cA.v !== "yes") return ask({ id: "confirmA", kind: "confirmA" });
    ok("confirmA", "yes"); f.whenCase = wa.v; f.teacherConfirmed = true;
    { const pg = pauseGate(); if (pg) return pg; } if (get("pause")) trace.push({ q: "pause", a: get("pause").v, why: W.pause }); /* пауза — не решение по существу: в счётчик не входит */
    /* 7. зеркало: гипотезы по ответам; после непопадания — реальная первая мысль; свои слова — отдельная карточка подтверждения */
    let chosen = null, mStatus = null; const shown = [];
    const tryCand = (c, note) => {
      const a = get("mir:" + c.id);
      if (!a || !["yes", "partly", "no", "own", "unsure"].includes(a.v) || ((a.v === "partly" || a.v === "own") && !a.text)) return ask({ id: "mir:" + c.id, kind: "mirror", mirror: c, index: shown.length, note });
      ok("mir:" + c.id, a.v, c.type); shown.push(c.id);
      if (a.v === "no") return null;
      if (a.v === "unsure") { mStatus = "unknown"; return "stop"; }
      chosen = { id: c.id, type: a.v === "own" ? "own" : c.type, text: a.v === "yes" ? c.text : R.trimEnd(a.text), candidateText: c.text, origin: a.v === "yes" ? "candidate_recognized" : a.v === "partly" ? "candidate_edited" : "user_written",
        permissions: a.v === "own" ? [] : c.permissions, check: a.v === "own" ? "prediction" : c.check, predictions: a.v === "own" ? [] : c.predictions, basis: c.why || [] };
      return "stop";
    };
    if (!st.mirrorDropped) {
      const cands = R.storyCandidates(B, f); f.candidates = cands.map(c => c.id);
      let r = null;
      if (cands[0]) { r = tryCand(cands[0]); if (r && r.next) return r; }
      if (!chosen && !mStatus) {
        /* мысль в тот момент: не новая догадка, а то, что человек сам заметит */
        const ta = get("thought");
        const tOpts = [...B.mirrors.filter(m => m.thought && !shown.includes(m.id) && (((m.when.groups || []).includes(group)) || (scene && (m.when.scenes || []).includes(scene.id))) && R.storyMirrorScore(m, f).s >= 0).map(m => [m.id, m.thought]),
          ...(B.thoughtsExtra || []).filter(t => t.groups.includes(group)).map(t => ["x:" + t.text, t.text])];
        const tUniq = [...new Map(tOpts.map(o => [o[1], o])).values()].slice(0, 4);
        if (!ta || !(tUniq.some(o => o[0] === ta.v) || (ta.v === "__own" && ta.text) || ta.v === "__skip")) return ask({ id: "thought", kind: "thought", options: tUniq });
        ok("thought", ta.v);
        f.thought = ta.v === "__own" ? R.trimEnd(ta.text) : ta.v === "__skip" ? "" : (tUniq.find(o => o[0] === ta.v) || [])[1] || "";
        if (ta.v === "__own") {
          const oa = get("ownrule");
          if (!oa || !["yes", "edit", "no"].includes(oa.v) || (oa.v === "edit" && !oa.text)) return ask({ id: "ownrule", kind: "ownrule", text: f.thought });
          ok("ownrule", oa.v);
          if (oa.v !== "no") chosen = { id: "own", type: "own", text: oa.v === "edit" ? R.trimEnd(oa.text) : f.thought, origin: "user_written", permissions: [], check: "prediction", predictions: [], basis: ["ты сам назвал эту мысль"] };
        } else if (ta.v !== "__skip" && !ta.v.startsWith("x:")) {
          const m = B.mirrors.find(x => x.id === ta.v);
          if (m) { const c = { id: m.id, type: m.type, text: m.text, why: [`ты отметил мысль: «${m.thought}»`], permissions: m.permissions, check: m.check, predictions: m.predictions }; const rr = tryCand(c, "по твоей мысли"); if (rr && rr.next) return rr; }
        } else if (ta.v.startsWith("x:")) {
          const t = (B.thoughtsExtra || []).find(x => "x:" + x.text === ta.v);
          const m = t && t.mirror ? B.mirrors.find(x => x.id === t.mirror) : null;
          if (m && !shown.includes(m.id)) { const c = { id: m.id, type: m.type, text: m.text, why: [`ты отметил мысль: «${t.text}»`], permissions: m.permissions, check: m.check, predictions: m.predictions }; const rr = tryCand(c, "по твоей мысли"); if (rr && rr.next) return rr; }
        }
        if (!chosen && !mStatus) for (const c of cands.slice(1)) { if (shown.includes(c.id)) continue; const rr = tryCand(c); if (rr && rr.next) return rr; if (chosen || mStatus) break; }
      }
      if (!chosen && !mStatus) mStatus = "searching";
    } else mStatus = "searching";
    f.need = (B.needs[group] || B.needs.other).text;
    /* 8. проверка опытом: пример или прогноз (пример ещё не собран) */
    if (chosen) {
      const ca = get("check"), preds = chosen.predictions.length ? chosen.predictions : ["Будет конфликт", "Меня осудят", "Мне самому будет неловко"];
      if (chosen.check === "example") { if (!ca || !((ca.v === "__example" && ca.text) || ca.v === "__later")) return ask({ id: "check", kind: "check", mode: "example", mirrorText: chosen.text }); }
      else if (!ca || !(preds.includes(ca.v) || (ca.v === "__own" && ca.text) || (ca.v === "__example" && ca.text) || ca.v === "__unknown")) return ask({ id: "check", kind: "check", mode: "prediction", options: preds, mirrorText: chosen.text });
      ok("check", ca.v);
      chosen.example = ca.v === "__example" ? R.trimEnd(ca.text) : "";
      chosen.prediction = preds.includes(ca.v) ? ca.v : ca.v === "__own" ? R.trimEnd(ca.text) : "";
      /* «узнаю своё похожее поведение» без собственного примера не повышает статус: остаётся «нужен пример» */
      chosen.status = chosen.example ? "example" : chosen.check === "example" ? "to_check" : "recognized";
      f.mirror = chosen;
    } else f.mirror = { status: mStatus || "searching", text: "" };
    /* 9. внутреннее разрешение (зеркало есть) или что важно (зеркала нет) */
    let actIds = [], dir = null;
    /* действие допустимо для этой сферы и роли, если оно есть хотя бы в одной сцене этой сферы и роли (ребёнку — не взрослые реплики, другу — не карточка клиента) */
    const actFits = id => Object.values(B.scenes).some(x => x.actions.includes(id) && x.spheres.includes(st.sphere) && (st.role === "__own" || x.roles.includes(st.role)));
    const goals = (B.needs[group] || B.needs.other).goals.filter(gl => scene ? gl[2].some(id => scene.actions.includes(id)) : gl[2].some(actFits));
    if (chosen) {
      const pa = get("perm"), ps = chosen.permissions || [];
      if (!pa || !(ps.some(p => p.id === pa.v) || (pa.v === "__own" && pa.text))) return ask({ id: "perm", kind: "choice", options: ps.map(p => [p.id, p.text]), own: true, mirrorText: chosen.text });
      ok("perm", pa.v);
      const pp = ps.find(p => p.id === pa.v);
      f.permission = pp ? { id: pp.id, text: pp.text, short: pp.short, origin: "user_selected" } : { id: "own", text: R.trimEnd(pa.text), short: R.trimEnd(pa.text), origin: "user_written" };
      actIds = pp ? pp.actions : goals.flatMap(gl => gl[2]); dir = f.permission;
    } else {
      const gA = get("goal");
      if (!gA || !(goals.some(gl => gl[0] === gA.v) || (gA.v === "__own" && gA.text) || gA.v === "__observe")) return ask({ id: "goal", kind: "choice", options: goals.map(gl => [gl[0], gl[1]]).concat([["__observe", "__observe"]]), own: true, need: f.need });
      ok("goal", gA.v);
      const gl = goals.find(x => x[0] === gA.v);
      f.goal = gl ? { id: gl[0], text: gl[1], origin: "user_selected" } : gA.v === "__own" ? { id: "own", text: R.trimEnd(gA.text), origin: "user_written" } : { id: "observe", text: "", origin: "user_selected" };
      actIds = gl ? gl[2] : gA.v === "__own" ? [...new Set(goals.flatMap(x => x[2]))] : []; dir = f.goal;
    }
    /* 10. отдельное подтверждение зеркала перед работой */
    const cb = get("confirmB");
    if (!cb || !["yes", "drop"].includes(cb.v)) return ask({ id: "confirmB", kind: "confirmB" });
    ok("confirmB", cb.v);
    if (f.goal && f.goal.id === "observe") { f.action = { id: "observe", phrase: "", origin: "user_selected" }; return { done: true, next: { id: "step", kind: "step", why: "наблюдение без выдуманного действия" }, fields: f, asked, trace }; }
    /* 11. шаг: только действия этой сцены (или вида — для своего случая) и выбранного направления; ожидание */
    const groupActs = new Set([...gScenes.flatMap(x => x.actions), ...goals.flatMap(gl => gl[2])]);
    let allowed = actIds.filter(id => scene ? scene.actions.includes(id) : groupActs.has(id) && actFits(id));
    if (!allowed.length) allowed = scene ? scene.actions.slice() : actIds.filter(id => B.actions[id]);
    const aa = get("action");
    if (!aa || !((allowed.includes(aa.v) && aa.text) || (aa.v === "__own" && aa.text) || aa.v === "__observe")) return ask({ id: "action", kind: "action", options: allowed.map(id => B.actions[id]).filter(Boolean), dir: dir ? dir.text : "" });
    ok("action", aa.v);
    f.action = aa.v === "__observe" ? { id: "observe", phrase: "", origin: "user_selected" } : aa.v === "__own" ? { id: "own", phrase: R.trimEnd(aa.text), origin: "user_written" } : { id: aa.v, phrase: String(aa.text).trim(), origin: aa.text.trim() === B.actions[aa.v].phrase ? "user_selected" : "user_edited" };
    if (f.action.id !== "observe") {
      const pr = get("pred"), base = chosen && chosen.prediction ? chosen.prediction : "";
      /* прогноз уже назван при проверке зеркала — переносится, не спрашиваем повторно (можно поправить в плане) */
      if (base && !pr) f.pred = base;
      else {
        if (!pr || !(pr.v === "__unknown" || (pr.v === "__own" && pr.text) || (pr.v === "__base" && base))) return ask({ id: "pred", kind: "pred", base });
        ok("pred", pr.v);
        f.pred = pr.v === "__base" ? base : pr.v === "__own" ? R.trimEnd(pr.text) : "";
      }
    }
    return { done: true, next: { id: "step", kind: "step", why: "всё собрано — первый эксперимент" }, fields: f, asked, trace };
  };
  R.storyFix = function (st, part) {
    const drop = q => { delete st.answers[q]; st.order = (st.order || []).filter(x => x !== q); };
    const mirrorChain = () => { Object.keys(st.answers).filter(q => q.startsWith("mir:")).forEach(drop); ["thought", "ownrule", "check", "perm", "goal", "confirmB", "action", "pred"].forEach(drop); st.mirrorDropped = false; };
    if (part === "event") { Object.keys(st.answers).filter(q => q.startsWith("e:")).forEach(q => { if (st.answers[q].v === "yes") st.rejected = [...new Set([...(st.rejected || []), q.slice(2)])]; drop(q); }); ["miss2", "meaning", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "meaning") { ["meaning", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "reaction") { ["reaction", "now", "later", "confirmA"].forEach(drop); mirrorChain(); }
    if (part === "mirror") mirrorChain();
    if (part === "dropMirror") { ["perm", "confirmB", "action", "pred"].forEach(drop); st.mirrorDropped = true; }
    if (part === "goal") ["perm", "goal", "confirmB", "action", "pred"].forEach(drop);
    if (part === "action") ["action", "pred"].forEach(drop);
    if (part === "all") { st.misses = (st.misses || 0) + 1; st.answers = {}; st.order = []; st.rejected = []; st.mirrorDropped = false; }
    return st;
  };
  R.dialogAnswer = function (st, qid, v, text) { st.answers = st.answers || {}; st.order = (st.order || []).filter(q => q !== qid); st.answers[qid] = { v, text: text || "", at: Date.now() }; st.order.push(qid); return st; };
  R.dialogUndo = function (st) { const q = (st.order || []).pop(); if (q) delete st.answers[q]; return q || null; };
  /* Поправить часть: снимаются только ответы этого поля (и для события — выбор примера). */
  R.dialogFix = function (st, part, bankEvents) {
    const drop = q => { delete st.answers[q]; st.order = (st.order || []).filter(x => x !== q); };
    if (part === "event") { Object.keys(st.answers).filter(q => q.startsWith("e:")).forEach(q => { if (st.answers[q].v === "yes") { st.rejected = [...new Set([...(st.rejected || []), q.slice(2)])]; } drop(q); }); drop("meaning"); drop("desire"); drop("ownStep"); Object.keys(st.answers).filter(q => q.startsWith("c:")).forEach(drop); }
    if (part === "meaning") { drop("meaning"); drop("desire"); drop("ownStep"); } /* желаемое изменение зависит от того, что задевает */
    if (part === "reaction") drop("reaction");
    if (part === "desire") { drop("desire"); drop("ownStep"); }
    if (part === "all") { st.misses = (st.misses || 0) + 1; const keep = {}; st.answers = keep; st.order = []; st.rejected = []; }
    return st;
  };
  /* Резюме только из ответов; неизвестное остаётся неизвестным. */
  R.dialogSummary = function (f, T) {
    const parts = [];
    /* собственная завершающая точка не склеивается с точкой шаблона */
    parts.push(`${f.when[0].toUpperCase()}${f.when.slice(1)}${f.meaning && f.meaning.text ? `, тебя задевает: «${R.trimEnd(f.meaning.text)}».` : `, ${T.meaningUnknown}.`}`);
    parts.push(f.reaction ? `Обычно: «${R.trimEnd(f.reaction)}».` : `${T.reactionUnknown[0].toUpperCase()}${T.reactionUnknown.slice(1)}.`);
    if (f.desire && f.desire.kind !== "observe" && f.desire.text) parts.push(f.desire.kind === "own" ? `Хочется: «${R.trimEnd(f.desire.text)}».` : `Хочется: ${R.trimEnd(f.desire.text)}.`);
    else if (f.desire && f.desire.kind === "observe") parts.push("Направление пока не выбрано — начнём с наблюдения.");
    return parts.join(" ");
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
  R.SCHEMA_VERSION = 8;
  R.MIN_IMPORT_SCHEMA = 2;
  R.COLLECTIONS = ["patterns", "episodes", "hypotheses", "experiments", "reviews", "flags", "tools"];
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
    if (iv < 5) R.migrateV5(out.patterns);
    if (iv < 6) R.migrateV6(out);
    if (iv < 7) R.migrateV63(out);
    if (iv < 8) R.migrateV66(out);
    return { data: out, stats };
  };

  /* ---------- v6: личный план — шаблон каталога, заполненный ответами человека ---------- */
  R.PLAN_SLOT_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  R.templateSlots = tpl => { const out = []; String(tpl || "").replace(R.PLAN_SLOT_RE, (m, k) => { if (!out.includes(k)) out.push(k); return m; }); return out; };
  /* v6.6: ответ человека подставляется как есть. Шаблоны ставят место вставки после двоеточия или в кавычки, чтобы не зависеть от падежа. */
  /* слово человека не меняется; только его завершающий знак не склеивается со знаком шаблона («формат: наедине.» + «.») */
  R.fillTemplate = (tpl, slots) => { const t = String(tpl || ""); return t.replace(R.PLAN_SLOT_RE, (m, k, off) => { const v = slots && slots[k]; if (v == null || !String(v).trim()) return m; let s = String(v).trim(); const nx = t.charAt(off + m.length); if (/[.,;:!?]/.test(nx)) s = s.replace(/[.,;:!?…]+$/u, ""); return s; }); };
  R.hasUnfilled = txt => /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(String(txt || ""));
  /* Проверка значения слота по типу: минуты — положительное целое; время/срок — непустая строка (дата или контекст); остальное — непустой текст. */
  R.validateSlot = function (key, value) {
    const v = String(value == null ? "" : value).trim();
    if (!v) return "Заполни это поле";
    if (/minutes/i.test(key)) { const n = Number(v); if (!Number.isInteger(n) || n <= 0) return "Нужно целое число минут больше нуля"; if (n > 240) return "Слишком долго для одного шага"; }
    if (/time|deadline|checkTime|replyTime|reviewTime|newTime/i.test(key) && v.length < 2) return "Укажи время или момент";
    return "";
  };
  /* Сборка личного плана из шаблона. Пример поля — не ответ: слоты заполняются только словами человека. */
  R.planFromTemplate = function ({ template, kind = "card", patternId, lessonId, skillId, basisIds = [], desiredChange = "", painText = "", slots = {}, version = 1, createdAt, mode, once }) {
    const t = template || {};
    return {
      patternId, kind: "plan", version, status: "active", planStatus: "draft", createdAt: createdAt || Date.now(), results: [],
      templateId: t.id || null, templateKind: kind, templateVersion: t.catalogVersion || "karma-practice-v6-2026-10-15",
      lessonId: lessonId || null, skillId: skillId || t.skillId || null, userBasisIds: basisIds, desiredChange, painText, goalConfirmed: !!desiredChange, goalOrigin: desiredChange ? "user_confirmed" : (lessonId ? "pending" : "none"), smallerUser: "",
      purpose: t.purpose || "", cueTemplate: t.cueTemplate || "", actionTemplate: t.actionTemplate || "", effort: t.effortLabel || "", afterQuestion: t.afterQuestion || "", completedWhen: t.completedWhen || "", smallerVersion: t.smallerVersion || "", limits: t.limits || "", fitQuestion: t.fitQuestion || "",
      setup: (t.setup || []).map(s => Object.assign({ key: s.key, question: s.question, example: s.example || "" }, s.label ? { label: true } : {})), slots: Object.assign({}, slots), tip: t.tip || "", adapted: !!t.adapted, variantId: t.variantId || null,
      mode: mode || (t.countsAsBehaviorChange === false ? "observation" : "behavior"), schedule: { kind: once ? "once" : "cue", repeat: !once }, simplified: false,
      cue: "", action: "", ifThen: null, permission: t.permissionCandidate || "", permissionConfirmed: false, prediction: "", criterion: "",
    };
  };
  /* Текущий вид плана: момент и действие с подставленными ответами; упрощённая версия — та же цель, меньший шаг. */
  R.planView = function (x) {
    if (!x) return null;
    const cue = x.cueUser || R.fillTemplate(x.cueTemplate, x.slots);
    /* Полная и уменьшенная формулировки хранятся отдельно; активная выбирается флагом simplified.
       Своё или перенесённое действие уменьшается только своей лёгкой версией (smallerUser), не меньшей версией шаблона. */
    const full = x.actionUser || R.fillTemplate(x.actionTemplate, x.slots);
    const small = x.smallerUser || (x.actionUser ? "" : (x.smallerVersion ? R.fillTemplate(x.smallerVersion, x.slots) : ""));
    const action = x.simplified ? small : full;
    /* Вопрос после попытки шаблона описывает шаблонное действие; для своего действия — общий вопрос. */
    const tplFull = R.fillTemplate(x.actionTemplate, x.slots), tplSmall = x.smallerVersion ? R.fillTemplate(x.smallerVersion, x.slots) : "";
    const ownFull = !!x.actionUser && x.actionUser !== tplFull, own = x.simplified ? ownFull || (!!x.smallerUser && x.smallerUser !== tplSmall) : ownFull;
    const who = x.slots && x.slots.person && String(x.slots.person).trim() && !R.templateSlots(String(x.cueTemplate) + " " + x.actionTemplate + " " + (x.smallerVersion || "")).includes("person") ? String(x.slots.person).trim() : "";
    return { cue, action, full, small, own, who, canSimplify: !!small || !!x.actionUser, needsSmall: !!x.simplified && !small, purpose: x.purpose || "", effort: x.effort || "", after: own ? R.OWN_AFTER : (x.afterQuestion || ""), limits: x.limits || "", simplified: !!x.simplified && !!small && small !== full, mode: x.mode || "behavior" };
  };
  /* Готовность: шаблон с незаполненными слотами или без момента/действия не становится активной рекомендацией. */
  R.planReady = function (x) {
    if (!x) return { ready: false, missing: ["plan"], errors: {} };
    if (x.kind !== "plan") return { ready: !!(x.action && x.ifThen && x.ifThen.signal), missing: x.action ? ["cue"] : ["action"], legacy: true, errors: {} };
    const errors = {}, missing = [];
    const cueKeys = x.cueUser ? [] : R.templateSlots(x.cueTemplate), actKeys = x.actionUser ? [] : R.templateSlots(x.actionTemplate + " " + (x.simplified && !x.smallerUser && x.smallerVersion ? x.smallerVersion : ""));
    (x.setup || []).forEach(sl => { if (!(cueKeys.includes(sl.key) || actKeys.includes(sl.key))) return; const err = R.validateSlot(sl.key, (x.slots || {})[sl.key]); if (err) errors[sl.key] = err; });
    const v = R.planView(x);
    if (!v.cue || R.hasUnfilled(v.cue)) missing.push("cue");
    if (!v.action || R.hasUnfilled(v.action)) missing.push("action");
    if (!v.purpose) missing.push("purpose");
    const ready = !missing.length && !Object.keys(errors).length;
    return { ready, missing, errors, accepted: x.planStatus === "accepted", legacy: false };
  };
  /* Описание попытки словами, по факту: что именно сделал, без вывода о внутренних переменах. */
  R.attemptStatusLabel = st => ({ done: "сделал", partial: "частично", other: "другое действие", rehearsal: "репетиция", none: "повода не было" })[st] || st || "";
  /* Старт практики и тропа: доля — завершённые вечера в текущей семидневке, не календарь. */
  R.trailProgress = function ({ checkins = {}, patternId, practiceStart, todayKey }) {
    if (!practiceStart) return { week: 0, done: 0, of: 7, ratio: 0 };
    const w = R.currentWindow(practiceStart, todayKey); if (!w) return { week: 0, done: 0, of: 7, ratio: 0 };
    const days = new Set(); Object.values(checkins).forEach(c => { if (c.evening && !c.legacy && c.patternId === patternId && R.inWindow(c.dateKey, w)) days.add(c.dateKey); });
    return { week: w.idx + 1, done: days.size, of: 7, ratio: days.size / 7, window: w };
  };
  /* Вечерний вывод — только из записей дня. Нет данных — нет выдуманного инсайта. */
  /* Попытки дня делятся по принадлежности: текущего плана (planId совпадает) и прежних версий. Производный вечер берёт только попытку текущего плана
     и наследует её принадлежность; попытки прежнего шага остаются фактами дня. */
  R.eveningFacts = function ({ episodes = [], dateKey, patternId, planId, lineageId }) {
    const eps = episodes.filter(e => e.dateKey === dateKey && !e.legacy && (!patternId || e.patternId === patternId) && e.verificationStatus !== "onboarding");
    const all = eps.filter(e => e.newResponse && e.newResponse.status).map(e => Object.assign({ episodeId: e.id }, e.newResponse));
    const mine = a => !planId || !a.planId || a.planId === planId || (!!lineageId && a.lineageId === lineageId);
    const attempts = all.filter(mine), other = all.filter(a => !mine(a) && a.status !== "rehearsal");
    const pick = list => list.find(a => a.status === "done") || list.find(a => a.status === "partial") || list.find(a => a.status === "other") || list.find(a => a.status === "rehearsal") || null;
    const best = pick(attempts);
    return { opportunities: eps.filter(e => !(e.newResponse && e.newResponse.opportunity === "rehearsal") && !e.isRehearsal).length, attempts, other, all, best, otherBest: pick(other), noted: attempts.map(a => a.afterAnswer).filter(Boolean), episodes: eps };
  };
  /* Недельный рассказ: «раньше» только при явной исходной записи; сравнение — по сопоставимым реальным записям. */
  R.weekNarrative = function ({ pattern, summary: s, episodes = [] }) {
    const out = { before: null, now: [], source: null };
    const base = pattern && (pattern.habitualResponse || (pattern.scenario && pattern.scenario.reaction)) || null;
    if (base) { out.before = base; out.source = pattern.habitualResponse ? "habitualResponse" : "scenario.reaction"; }
    const a = (s && s.attempts) || {};
    if (a.done) out.now.push(`${a.done} ${R.plural(a.done, "раз", "раза", "раз")} выполнил свой шаг`);
    if (a.partial) out.now.push(`${a.partial} ${R.plural(a.partial, "раз", "раза", "раз")} — частично`);
    if (a.other) out.now.push(`${a.other} ${R.plural(a.other, "раз", "раза", "раз")} сделал иначе`);
    if (a.rehearsal) out.now.push(`${a.rehearsal} ${R.plural(a.rehearsal, "репетиция", "репетиции", "репетиций")}`);
    if (s && s.opportunities && !out.now.length) out.now.push(`${s.opportunities} ${R.plural(s.opportunities, "повод", "повода", "поводов")} без записанной попытки`);
    return out;
  };
  /* Следующий инструмент — по недостающему полезному результату, не по номеру дня. Не больше одного нового разбора в день. */
  R.nextTool = function ({ pattern, plan, hypothesis, research, episodes = [], runsToday = 0 }) {
    if (runsToday >= 1) return null;
    const mods = (research && research.modules) || {}, p = pattern || {}, x = plan || {}, v = x.kind === "plan" ? R.planView(x) : { cue: x.ifThen && x.ifThen.signal, action: x.action };
    const skill = x.skillId || p.skillId;
    const results = (x.results || []);
    if (!v || !v.cue || R.hasUnfilled(v.cue)) return { id: "if_then", why: "У шага нет узнаваемого момента." };
    if (skill === "refuse" && !x.actionUser && !(p.phrases && p.phrases.refuse)) return { id: "assertive_no", why: "Для отказа нужна своя фраза." };
    if (skill === "need" && !x.actionUser && !(p.phrases && p.phrases.request)) return { id: "assertive_request", why: "Для просьбы нужна своя формулировка." };
    if (skill === "boundary" && !p.boundary) return { id: "boundary", why: "Граница не определена твоим действием." };
    if (p.resource && !p.resource.step) return { id: "resource_step", why: "Нехватка ресурса подтверждена, изменение нагрузки не выбрано." };
    if (!p.thought && !(mods.meaning && mods.meaning.status === "done")) return { id: "thought_check", why: "Мысль в момент случая ещё не записана." };
    const h = hypothesis;
    if (!h && !(mods.need && mods.need.status === "done")) return { id: "need_module", why: "Объяснение ещё не выбрано." };
    if (h && h.branch === "rule" && !(mods.rule && mods.rule.status === "done")) return { id: "rule_permission", why: "Правило названо, гибкая проверка не выбрана." };
    if (!x.prediction && !(mods.experiment && mods.experiment.status === "done")) return { id: "behavior_experiment", why: "Ожидание не названо — нечего сравнивать с фактом." };
    if (results.length && results[results.length - 1].outcome === "not") return { id: "thought_check", why: "Ожидание не подтвердилось — уточним вывод." };
    return null;
  };
  /* Схема 6: прежние планы остаются; им предлагается «Уточнить шаг», выдуманные ответы не добавляются. */
  R.migrateV6 = function (data) {
    let n = 0; (data.experiments || []).forEach(x => { if (x && !x.planStatus) { x.planStatus = x.kind === "plan" ? "draft" : "legacy"; n++; } });
    data.tools = data.tools || [];
    return n;
  };

  /* Линия плана: сохраняется, если навык, шаблон и полное действие те же (момент, упрощение, параметры момента). Иначе — новая линия. */
  R.planLineage = function (oldX, newX) {
    if (!oldX || oldX.kind !== "plan" || newX.kind !== "plan") return newX.id;
    const fullOf = x => x.actionUser || R.fillTemplate(x.actionTemplate, x.slots);
    const same = oldX.skillId === newX.skillId && (oldX.templateId || null) === (newX.templateId || null) && (oldX.lessonId || null) === (newX.lessonId || null) && fullOf(oldX) === fullOf(newX);
    return same ? (oldX.lineageId || oldX.id) : newX.id;
  };
  /* Схема 7 (v6.3), повторяемо: 1) desiredChange без подтверждения не считается целью — исходный текст сохраняется в desiredChangeLegacy;
     2) у планов появляется lineageId; 3) вечер с выведенным статусом без достоверного источника исключается из строгих подтверждений. */
  /* v6.6: «Другой сюжет» — архив, не прохождение. Прохождение подтверждается флагом навыка этого сюжета.
     Прежние записи со статусом done без флага становятся archived; доказательство не выдумывается. Повторный запуск безопасен. */
  R.migrateV66 = function (data) {
    let n = 0; const flags = (data.flags || []).filter(f => !f.legacy);
    (data.patterns || []).forEach(p => {
      if (p.status !== "done" || p.completedBasis) return;
      const fl = flags.filter(f => f.patternId === p.id);
      if (fl.length) { p.completedBasis = { kind: "flag", flagIds: fl.map(f => f.id), skillIds: fl.map(f => f.skillId), at: Math.min(...fl.map(f => f.awardedAt || f.at || Date.now())), migrated: true }; }
      else { p.status = "archived"; p.archivedAt = p.archivedAt || p.updatedAt || null; p.archiveReason = p.archiveReason || "migrated_done_without_flag"; }
      n++;
    });
    return n;
  };
  /* v6.7.2: восстановление данных после дефекта v6.7.1 — два действующих сюжета одновременно (новый вход создавал второй).
     Остаётся один: с принятым шагом, затем самый поздний; остальные — в историю (не прохождение, не флаг). Повторный запуск безопасен. */
  R.resolveDuplicateCurrent = function (data, now) {
    const cur = (data.patterns || []).filter(p => ["active", "observe", "paused"].includes(p.status));
    if (cur.length < 2) return [];
    const xs = new Map((data.experiments || []).map(x => [x.id, x]));
    const acc = p => { const x = xs.get(p.experimentId); return x && x.kind === "plan" && x.planStatus === "accepted" ? 1 : 0; };
    const st = p => p.status === "paused" ? 0 : 1;
    const keep = cur.slice().sort((a, b) => (acc(b) - acc(a)) || (st(b) - st(a)) || ((b.createdAt || 0) - (a.createdAt || 0)))[0];
    const out = [];
    cur.forEach(p => { if (p === keep) return; p.status = "archived"; p.archivedAt = now || Date.now(); p.archiveReason = "duplicate_current"; p.duplicateOf = keep.id; out.push(p); });
    return out;
  };
  R.isCompleted = p => !!p && p.status === "done" && !!p.completedBasis;
  R.migrateV63 = function (data) {
    let n = 0;
    (data.experiments || []).forEach(x => {
      if (!x || x.kind !== "plan") return;
      if (!x.lineageId) { x.lineageId = x.id; n++; }
      if (!x.goalOrigin) { if (x.desiredChange) { x.desiredChangeLegacy = x.desiredChange; x.painText = x.painText || x.desiredChange; x.desiredChange = ""; } x.goalOrigin = "unconfirmed_legacy"; x.goalConfirmed = false; n++; }
    });
    const eps = new Map((data.episodes || []).map(e => [e.id, e]));
    Object.values(data.checkins || {}).forEach(c => {
      const ev = c && c.evening; if (!ev || !ev.fromEpisodeId || ev.provenanceChecked) return;
      const src = eps.get(ev.fromEpisodeId), nr = src && src.newResponse;
      if (nr && nr.planId) { ev.planId = nr.planId; ev.planVersion = nr.planVersion; ev.skillId = nr.skillId; ev.experimentId = nr.experimentId || nr.planId; }
      else ev.provenanceUnknown = true;
      ev.provenanceChecked = true; n++;
    });
    return n;
  };
  /* Сопровождение дня: 1) редакторская связка число × урок; 2) текст урока без числовой интерпретации; 3) без плана — приглашение к наблюдению. */
  R.OWN_AFTER = "Что ты сделал? Что произошло дальше?";
  /* Порядок: своё действие → подсказка адаптированной карточки → связка число × урок → подсказка урока → наблюдение.
     Подсказка не описывает сцену, которой нет в шаге человека. */
  R.pickCompanion = function ({ companions = [], tips = {}, observeTip = "", pathNumber, lessonId, hasPlan, ownAction = false, ownText = "", tip = "" }) {
    if (hasPlan && ownAction && ownText) return { text: ownText, src: "own", id: "own" };
    if (hasPlan && tip) return { text: tip, src: "card", id: lessonId || "card" };
    const exact = pathNumber && lessonId ? companions.find(c => c.pathNumber === Number(pathNumber) && c.lessonId === lessonId) : null;
    if (exact) return { text: exact.text, src: "path", id: exact.id };
    if (lessonId && tips[lessonId]) return { text: tips[lessonId], src: "lesson", id: lessonId };
    if (!hasPlan || !lessonId) return { text: observeTip, src: "observe", id: "observe" };
    return null;
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
