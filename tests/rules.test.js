/* Автопроверки правил: node tests/rules.test.js */
const R = require("../rules.js");
const assert = require("assert");
let n = 0; const ok = (name, fn) => { try { fn(); n++; console.log("ok  -", name); } catch (e) { console.log("FAIL-", name, "\n   ", e.message); process.exitCode = 1; } };

ok("dateKey/addDays/diffDays", () => {
  assert.strictEqual(R.addDays("2026-10-30", 2), "2026-11-01");
  assert.strictEqual(R.diffDays("2026-10-01", "2026-10-08"), 7);
  assert.strictEqual(R.dateKey(new Date(2026, 9, 14, 1, 30).getTime()), "2026-10-14");
});
ok("phaseOf", () => {
  assert.strictEqual(R.phaseOf(1), "night"); assert.strictEqual(R.phaseOf(6), "morning"); assert.strictEqual(R.phaseOf(13), "day"); assert.strictEqual(R.phaseOf(20), "evening");
  assert.strictEqual(R.phaseOf(6, { morningStart: 7 }), "night");
});
ok("вечер вчерашнего дня доступен до конца следующего дня (сценарий 11)", () => {
  assert.ok(R.eveningCloseable("2026-10-13", "2026-10-14"));
  assert.ok(R.eveningCloseable("2026-10-14", "2026-10-14"));
  assert.ok(!R.eveningCloseable("2026-10-12", "2026-10-14"));
  assert.ok(R.isLate("2026-10-13", "2026-10-14"));
});
ok("окна недели и завершённые окна (сценарий 10: 8, 15, 30 дни)", () => {
  const s = "2026-10-01";
  assert.deepStrictEqual(R.currentWindow(s, "2026-10-08"), { idx: 1, start: "2026-10-08", end: "2026-10-14" });
  assert.strictEqual(R.completedWindows(s, "2026-10-07").length, 0);
  assert.strictEqual(R.completedWindows(s, "2026-10-08").length, 1);
  assert.strictEqual(R.completedWindows(s, "2026-10-15").length, 2);
  assert.strictEqual(R.completedWindows(s, "2026-10-30").length, 4);
  assert.strictEqual(R.weekIndex(s, "2026-09-30"), -1);
});
ok("итог недели доступен с 7-го дня и не дублируется", () => {
  const s = "2026-10-01";
  assert.strictEqual(R.reviewDue(s, "2026-10-06", []), null);
  assert.deepStrictEqual(R.reviewDue(s, "2026-10-07", []), { idx: 0, start: "2026-10-01", end: "2026-10-07" });
  assert.strictEqual(R.reviewDue(s, "2026-10-09", [{ windowStart: "2026-10-01" }]), null);
  assert.deepStrictEqual(R.reviewDue(s, "2026-10-14", [{ windowStart: "2026-10-01" }]).start, "2026-10-08");
  assert.deepStrictEqual(R.reviewDue(s, "2026-10-30", []).start, "2026-10-22", "пропущенные старые итоги не копятся — предлагается последний");
  assert.strictEqual(R.reviewDue(s, "2026-10-30", [{ windowStart: "2026-10-22" }]), null);
});

function mkData({ start, days, impact = 1, opp = "yes", action = "done", withEpisode = true, intensityHigh = false, patternId = "p", skillId = "refuse" }) {
  const checkins = {}, episodes = [];
  for (let i = 0; i < days; i++) {
    const k = R.addDays(start, i), id = R.checkinId(k, patternId);
    checkins[id] = { id, dateKey: k, patternId, evening: { at: 1, currentImpact: impact, hadOpportunity: opp, actionStatus: action, skillId } };
    if (withEpisode && i % 3 === 0) episodes.push({ id: "e" + i, patternId, dateKey: k, loggedAt: 1, intensity: intensityHigh ? 9 : 3, newResponse: { type: "refuse", skillId } });
  }
  return { checkins, episodes };
}
const PAT = { id: "p", startDate: "2026-09-01", skillId: "refuse" };
ok("флаг начисляется при выполнении всех условий", () => {
  const start = "2026-09-01", today = "2026-09-22"; const d = mkData({ start, days: 21 });
  const e = R.flagEligibility({ pattern: PAT, todayKey: today, ...d });
  assert.ok(e.eligible, e.reasons.join("; "));
});
ok("P1-1: вечера другого сюжета не входят в сводку и флаг текущего (воспроизведение из ревью)", () => {
  const start = "2026-09-01", today = "2026-09-22";
  const other = mkData({ start, days: 21, patternId: "other-story", withEpisode: false });
  const e = R.flagEligibility({ pattern: { id: "current-story", startDate: start, skillId: "refuse" }, todayKey: today, checkins: other.checkins, episodes: [] });
  assert.ok(!e.eligible, "флаг не должен открываться по чужим вечерам");
  assert.strictEqual(e.actionDays.length, 0);
  assert.ok(e.reasons.some(r => /вечерних оценок 0/.test(r)), e.reasons.join("; "));
  const s = R.windowSummary({ checkins: other.checkins, episodes: [], window: R.windowOf(start, 0), patternId: "current-story", skillId: "refuse" });
  assert.strictEqual(s.eveningCount, 0); assert.strictEqual(s.opportunities, 0); assert.strictEqual(s.impactRatings.length, 0);
  /* записи A не меняются от записей B; оба сюжета в один день живут отдельно */
  const a = mkData({ start, days: 21, patternId: "A" }); Object.assign(a.checkins, other.checkins);
  const ea = R.flagEligibility({ pattern: { id: "A", startDate: start, skillId: "refuse" }, todayKey: today, ...a });
  assert.ok(ea.eligible, ea.reasons.join("; "));
  assert.strictEqual(Object.keys(a.checkins).length, 42, "смена сюжета в течение дня не уничтожает прежние записи");
});
ok("P1-1: вечера без принадлежности и из прошлой версии — не доказательство", () => {
  const start = "2026-09-01", today = "2026-09-22";
  const d = mkData({ start, days: 21 });
  Object.values(d.checkins).forEach(c => { c.patternId = null; });
  const e = R.flagEligibility({ pattern: PAT, todayKey: today, ...d });
  assert.ok(!e.eligible);
  const l = mkData({ start, days: 21 }); Object.values(l.checkins).forEach(c => { c.legacy = true; });
  assert.ok(!R.flagEligibility({ pattern: PAT, todayKey: today, ...l }).eligible);
  assert.ok(!R.eveningEvidence({ dateKey: "2026-09-01", patternId: "p", evening: { legacy: true } }, "p"));
  assert.strictEqual(R.practiceDays(l.checkins).length, 0, "шаги тропы без прошлой версии");
});
ok("P1-2: доказательства привязаны к навыку; смена навыка не переносит старые действия", () => {
  const start = "2026-09-01", today = "2026-09-22";
  const d = mkData({ start, days: 21, skillId: "pause" });
  d.episodes.forEach(e => { e.newResponse = { type: "pause", chosen: "chosen", skillId: "pause" }; });
  assert.ok(R.flagEligibility({ pattern: { id: "p", startDate: start }, skillId: "pause", todayKey: today, ...d }).eligible);
  const e = R.flagEligibility({ pattern: { id: "p", startDate: start }, skillId: "refuse", todayKey: today, ...d });
  assert.ok(!e.eligible, "практика паузы не подтверждает навык отказа"); assert.strictEqual(e.actionDays.length, 0);
  assert.ok(!R.isConfirmedAction({ newResponse: { type: "refuse" } }, "refuse"), "запись без навыка — не доказательство для навыка");
  assert.ok(R.isConfirmedAction({ newResponse: { type: "refuse", skillId: "refuse", planVersion: 1 } }, "refuse"), "версия плана не важна, навык тот же");
  assert.ok(!R.eveningConfirms({ evening: { actionStatus: "done" } }, "refuse"));
  assert.strictEqual(R.flagEligibility({ pattern: { id: "p", startDate: start }, todayKey: today, ...d }).reasons[0], "Навык для флага не выбран.");
  const days = R.confirmedActionDays({ episodes: d.episodes, checkins: d.checkins, patternId: "p", skillId: "pause" });
  assert.strictEqual(days.size, 21);
});
ok("P1-2: восстановление навыка у старых записей — из плана, действовавшего в момент записи", () => {
  const data = { experiments: [{ id: "x1", patternId: "p", skillId: "pause", version: 1, createdAt: 100 }, { id: "x2", patternId: "p", skillId: "refuse", version: 2, createdAt: 500 }],
    episodes: [{ id: "a", patternId: "p", loggedAt: 200, newResponse: { type: "other", at: 200 } }, { id: "b", patternId: "p", loggedAt: 600, newResponse: { type: "refuse", at: 600 } }, { id: "c", patternId: "p", loggedAt: 50, newResponse: { type: "refuse", at: 50 } }, { id: "d", patternId: "q", loggedAt: 600, newResponse: { type: "refuse", at: 600 } }],
    checkins: { "2026-10-01|p": { id: "2026-10-01|p", dateKey: "2026-10-01", patternId: "p", evening: { at: 700, actionStatus: "done" } }, "2026-10-02|-": { id: "2026-10-02|-", dateKey: "2026-10-02", patternId: null, evening: { at: 700, actionStatus: "done" } } } };
  const n = R.backfillEvidence(data);
  assert.strictEqual(n, 3);
  assert.strictEqual(data.episodes[0].newResponse.skillId, "pause"); assert.strictEqual(data.episodes[1].newResponse.skillId, "refuse"); assert.strictEqual(data.episodes[1].newResponse.planVersion, 2);
  assert.strictEqual(data.episodes[2].newResponse.skillId, undefined, "до первого плана — принадлежность неизвестна");
  assert.strictEqual(data.episodes[3].newResponse.skillId, undefined, "другой сюжет без планов");
  assert.strictEqual(data.checkins["2026-10-01|p"].evening.skillId, "refuse"); assert.strictEqual(data.checkins["2026-10-02|-"].evening.skillId, undefined);
});
ok("записи дня: ключ «дата|сюжет», старый формат по дате приводится без додумывания", () => {
  const n = R.normalizeCheckins({ "2026-10-01": { dateKey: "2026-10-01", patternId: "p", evening: { at: 1 } }, "2026-10-02": { dateKey: "2026-10-02", help: [] }, "x": { foo: 1 } });
  assert.deepStrictEqual(Object.keys(n).sort(), ["2026-10-01|p", "2026-10-02|-"]);
  assert.strictEqual(n["2026-10-02|-"].patternId, null);
  assert.strictEqual(R.checkinFor(n, "2026-10-01", "p").evening.at, 1); assert.strictEqual(R.checkinFor(n, "2026-10-01", "q"), null);
  assert.strictEqual(R.checkinsOn(n, "2026-10-01").length, 1);
});
ok("P2-5: короткий вечер фиксирует повод и действие одним ответом; репетиция — не повод", () => {
  assert.deepStrictEqual(R.quickEvening("done"), { hadOpportunity: "yes", actionStatus: "done" });
  assert.deepStrictEqual(R.quickEvening("not"), { hadOpportunity: "yes", actionStatus: "not" });
  assert.deepStrictEqual(R.quickEvening("none"), { hadOpportunity: "no", actionStatus: null });
  assert.deepStrictEqual(R.quickEvening("unsure"), { hadOpportunity: "unsure", actionStatus: null });
  assert.deepStrictEqual(R.quickEvening(undefined), { hadOpportunity: null, actionStatus: null });
  const w = R.windowOf("2026-09-01", 0);
  const s = R.windowSummary({ checkins: { "2026-09-02|p": { id: "2026-09-02|p", dateKey: "2026-09-02", patternId: "p", evening: { hadOpportunity: null, actionStatus: null, currentImpact: 2 } } }, episodes: [{ id: "r", patternId: "p", dateKey: "2026-09-02", isRehearsal: true, newResponse: { type: "refuse", skillId: "refuse" } }], window: w, patternId: "p", skillId: "refuse" });
  assert.strictEqual(s.opportunities + s.realEpisodes, 0); assert.strictEqual(s.rehearsals, 1); assert.strictEqual(s.actionDays.length, 0);
});
ok("P2-6: смена или отказ от объяснения помечает разрешение и план на пересмотр; «оставить» снимает пометку", () => {
  const p = { hypothesisVersionId: "h2", permission: "Мои потребности тоже имеют значение", permissionSource: { origin: "pack", hypothesisVersionId: "h1" } };
  const x = { kind: "experiment", hypothesisVersionId: "h1", action: "скажу нет" };
  assert.deepStrictEqual(R.dependencyReview({ pattern: p, experiment: x }), { permission: true, plan: true, any: true, permissionOrigin: "pack" });
  assert.ok(R.dependencyReview({ pattern: Object.assign({}, p, { hypothesisVersionId: null }), experiment: x }).any, "отвергнутое объяснение");
  p.permissionSource.keptFor = "h2"; x.keptFor = "h2";
  assert.ok(!R.dependencyReview({ pattern: p, experiment: x }).any);
  assert.ok(!R.dependencyReview({ pattern: { hypothesisVersionId: "h1", permission: "x", permissionSource: { origin: "user", hypothesisVersionId: "h1" } }, experiment: { kind: "first-plan", hypothesisVersionId: null } }).any, "первый план от объяснения не зависит");
  assert.ok(!R.dependencyReview({ pattern: { hypothesisVersionId: "h1", permission: "x" }, experiment: null }).any, "без источника пересмотр не требуется");
});
ok("повторная проверка 2: разрешение прежней сборки получает происхождение migrated и попадает в проверку при первой смене объяснения", () => {
  const p = { permission: "Старое разрешение", hypothesisVersionId: "h1" }, p0 = { permission: "Без объяснения", hypothesisVersionId: null }, pl = { permission: "x", legacy: true };
  assert.ok(!R.dependencyReview({ pattern: p, experiment: null }).any, "без происхождения до миграции — как в ревью");
  assert.strictEqual(R.markMigratedPermissions([p, p0, pl, { permission: "", hypothesisVersionId: "h" }]), 2);
  assert.deepStrictEqual(p.permissionSource, { origin: "migrated", hypothesisVersionId: "h1" }); assert.ok(!pl.permissionSource);
  assert.ok(!R.dependencyReview({ pattern: p, experiment: null }).any, "пока объяснение то же — проверка не нужна");
  p.hypothesisVersionId = "h2"; const d = R.dependencyReview({ pattern: p, experiment: null });
  assert.ok(d.permission && d.permissionOrigin === "migrated", "смена объяснения → проверка");
  p0.hypothesisVersionId = "h9"; assert.ok(R.dependencyReview({ pattern: p0, experiment: null }).permission, "записано до объяснения, происхождение неизвестно → проверка при первом объяснении");
  const pu = { permission: "моё", hypothesisVersionId: "h9", permissionSource: { origin: "user", hypothesisVersionId: null } };
  assert.ok(!R.dependencyReview({ pattern: pu, experiment: null }).permission, "своя формулировка до объяснения от него не зависит");
  assert.strictEqual(R.markMigratedPermissions([p]), 0, "повторно не помечается");
});
ok("повторная проверка 1: черновики прежней сборки переносятся, неоднозначные сохраняются текстом", () => {
  const drafts = { new: { i: 0, ans: { event: "Партнёр перенёс встречу" }, at: 5 }, event: { i: 1, ans: { relation: "same" } }, "mod-need": { i: 0, ans: { need: "Уважение" } }, "detail-e1": { i: 0, ans: { thought: "x" } }, "evening-2026-10-10": { i: 0, ans: {} }, cards: { idx: 1 }, "x|y|2": { i: 0, ans: {} } };
  const one = R.migrateDrafts(drafts, { patterns: [{ id: "pA", status: "active" }, { id: "pL", status: "legacy", legacy: true }], episodes: [{ id: "e1", patternId: "pA" }] }, 2);
  assert.deepStrictEqual(Object.keys(one.drafts).sort(), ["cards", "detail-e1|pA|2", "evening-2026-10-10|pA|2", "event|pA|2", "mod-need|pA|2", "new|pA|2", "x|y|2"]);
  assert.strictEqual(one.drafts["new|pA|2"].ans.event, "Партнёр перенёс встречу"); assert.strictEqual(one.recovered.length, 0);
  const none = R.migrateDrafts(drafts, { patterns: [{ id: "pD", status: "done" }], episodes: [] }, 2);
  assert.ok(none.drafts["new|first|2"] && none.drafts["event|-|2"], "без сюжета: первый случай и «зацепило» без области");
  assert.ok(!none.drafts["mod-need|-|2"] && !Object.keys(none.drafts).some(k => k.startsWith("evening-")), "модуль и вечер без сюжета не приписываются случайному сюжету");
  assert.deepStrictEqual(none.recovered.map(r => r.id), ["mod-need", "detail-e1"], "текст сохранён как восстановимая запись; пустой вечер отброшен");
  const two = R.migrateDrafts({ "mod-need": { ans: { need: "a" } } }, { patterns: [{ id: "a", status: "active" }, { id: "b", status: "observe" }] }, 2);
  assert.strictEqual(two.recovered.length, 1, "два живых сюжета — принадлежность неоднозначна");
});
ok("повторная проверка 3: валидатор импорта не бросает исключений и объясняет причину", () => {
  const cases = [{ schemaVersion: 3, patterns: {} }, { schemaVersion: 3, episodes: [null, { id: "a" }, {}] }, { schemaVersion: 3, checkins: [] }, { schemaVersion: 3, checkins: { "x": null } }, { schemaVersion: 99 }, { schemaVersion: 3, research: [] }, [], "str", 42];
  cases.forEach(c => { let r; assert.doesNotThrow(() => { r = R.validateImport(c); }, `бросает на ${JSON.stringify(c)}`); assert.ok(r && r.ok === false && r.errors.length, `нет причины для ${JSON.stringify(c)}`); });
  assert.ok(/списком/.test(R.validateImport({ schemaVersion: 3, patterns: {} }).errors[0]));
  assert.ok(/2 записи без id/.test(R.validateImport({ schemaVersion: 3, episodes: [null, { id: "a" }, {}] }).errors[0]));
  assert.ok(/новее/.test(R.validateImport({ schemaVersion: 99 }).errors[0]));
  assert.ok(R.validateImport({ schemaVersion: 4, patterns: [] }).ok); assert.ok(R.validateImport({ schemaVersion: 5, patterns: [] }).ok);
  assert.doesNotThrow(() => R.mergeImport({ patterns: [], episodes: [], hypotheses: [], experiments: [], reviews: [], flags: [], checkins: {}, research: {} }, { patterns: {}, episodes: "x", checkins: null }, 3));
});
ok("восстановленный задним числом навык — не доказательство для флага, запись остаётся", () => {
  assert.ok(!R.isConfirmedAction({ newResponse: { type: "refuse", skillId: "refuse", backfilled: true } }, "refuse"));
  assert.ok(R.isConfirmedAction({ newResponse: { type: "refuse", skillId: "refuse", backfilled: true } }), "без фильтра по навыку действие видно как действие");
  assert.ok(!R.eveningConfirms({ evening: { actionStatus: "done", skillId: "refuse", backfilled: true } }, "refuse"));
  const m = R.mergeImport({ patterns: [], episodes: [], hypotheses: [], experiments: [], reviews: [], flags: [], checkins: {}, research: {} }, { patterns: [{ id: "p", permission: "старое", hypothesisVersionId: "h" }], experiments: [{ id: "x", patternId: "p", skillId: "pause", version: 1, createdAt: 1 }], episodes: [{ id: "e", patternId: "p", loggedAt: 5, newResponse: { type: "pause", chosen: "chosen", at: 5 } }] }, 2);
  assert.ok(m.data.episodes[0].newResponse.backfilled && m.data.episodes[0].newResponse.skillId === "pause", "импорт схемы 2 восстанавливает навык с пометкой");
  assert.strictEqual(m.data.patterns[0].permissionSource.origin, "migrated");
});
ok("P2-7: заголовки пакетов карточек — нейтральные контексты, без утверждений о причине", () => {
  const fs = require("fs"); const w = {}; new Function("window", fs.readFileSync(require("path").join(__dirname, "..", "content.js"), "utf8"))(w);
  const C = w.KARMA_CONTENT; assert.ok(C.packs.length >= 8);
  C.packs.forEach(pk => assert.ok(!/^(мне |меня |я |мной )|трудно|задевает/i.test(pk.title), `заголовок пакета объясняет человека: ${pk.title}`));
  C.packs.forEach(pk => pk.cards.forEach(c => assert.ok(!/потому что|значит,? я|на самом деле я/i.test(c.text), `карточка с причиной: ${c.text}`)));
});
ok("сценарий 9: стартовая позиция 90 не сокращает 21 день", () => {
  const start = "2026-09-01"; const d = mkData({ start, days: 14 });
  const e = R.flagEligibility({ pattern: Object.assign({ startPt: 90 }, PAT), todayKey: "2026-09-15", ...d });
  assert.ok(!e.eligible); assert.ok(e.reasons.some(r => /календарных дней/.test(r)));
});
ok("сценарий 7: две недели без реального повода — флага нет, нули не выдумываются", () => {
  const start = "2026-09-01"; const d = mkData({ start, days: 21, opp: "no", action: null, withEpisode: false });
  const e = R.flagEligibility({ pattern: PAT, todayKey: "2026-09-22", ...d });
  assert.ok(!e.eligible); assert.ok(e.reasons.some(r => /реального повода/.test(r)));
  const s = R.windowSummary({ ...d, window: R.windowOf(start, 1), patternId: "p", skillId: "refuse" });
  assert.strictEqual(s.opportunities, 0); assert.strictEqual(s.realEpisodes, 0);
});
ok("сценарий 8: низкие итоговые слайдеры при пустых ежедневных — флага нет", () => {
  const start = "2026-09-01"; const checkins = {}; // ни одной вечерней оценки
  const reviews = [{ windowStart: "2026-09-01", snapshot: { finalClaim: 1 } }, { windowStart: "2026-09-08", snapshot: { finalClaim: 0 } }];
  const e = R.flagEligibility({ pattern: PAT, todayKey: "2026-09-22", checkins, episodes: [], reviews });
  assert.ok(!e.eligible); assert.ok(e.reasons.some(r => /вечерних оценок/.test(r)));
});
ok("высокая ежедневная трудность в одном окне блокирует флаг; пропуски остаются пропусками", () => {
  const start = "2026-09-01"; const d = mkData({ start, days: 21 });
  d.checkins["2026-09-10|p"].evening.currentImpact = 6;
  const e = R.flagEligibility({ pattern: PAT, todayKey: "2026-09-22", ...d });
  assert.ok(!e.eligible); assert.ok(e.reasons.some(r => /выше 2/.test(r)));
  delete d.checkins["2026-09-10|p"]; delete d.checkins["2026-09-11|p"]; delete d.checkins["2026-09-12|p"]; delete d.checkins["2026-09-13|p"];
  const e2 = R.flagEligibility({ pattern: PAT, todayKey: "2026-09-22", ...d });
  assert.ok(e2.reasons.some(r => /вечерних оценок 3 из 4/.test(r)));
});
ok("репетиции не считаются реальным поводом; пауза «страшно сказать» не подтверждает действие", () => {
  assert.ok(!R.isConfirmedAction({ newResponse: { type: "refuse" }, isRehearsal: true }));
  assert.ok(!R.isConfirmedAction({ newResponse: { type: "pause", chosen: "scared" } }));
  assert.ok(R.isConfirmedAction({ newResponse: { type: "pause", chosen: "chosen" } }));
  assert.ok(R.isConfirmedAction({ newResponse: { type: "request" } }));
});
ok("сценарий 13: 25 недель без флагов — ясность 0, не 100", () => {
  assert.strictEqual(R.clarity([], 6).pct, 0);
  assert.strictEqual(R.clarity([{ skillId: "pause", legacy: true }], 6).pct, 0);
  assert.strictEqual(R.clarity([{ skillId: "pause" }, { skillId: "pause" }, { skillId: "need" }], 6).pct, 33);
});
ok("состояние — только последняя явная оценка состояния; сила эмоции события и действия её не меняют (v5)", () => {
  const ck = { "2026-10-01": { dateKey: "2026-10-01", morning: { at: 10, intensity: 7 } } }, eps = [{ loggedAt: 20, intensity: 4, newResponse: { type: "pause", chosen: "chosen" } }];
  const r = R.lastRating({ checkins: ck, episodes: eps });
  assert.strictEqual(r.value, 7); assert.strictEqual(r.kind, "morning");
  assert.strictEqual(R.lastRating({ checkins: ck, episodes: eps, includeEpisodes: true }).value, 4, "сила эмоции — только по явному запросу");
  assert.strictEqual(R.lastRating({ checkins: {}, episodes: eps }), null, "до первой оценки камней нет");
  assert.strictEqual(R.lastRating({ checkins: { a: { dateKey: "2026-10-01", morning: { at: 10, intensity: 7 }, evening: { at: 30, currentImpact: 2 } } } }).value, 2);
});
ok("v5: старт практики — сейчас, не дата вспомненного случая; вечером — завтра; ночью — сегодня; флаг считает срок от старта практики", () => {
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 18 }), "2026-10-16");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 23 }), "2026-10-16");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-16", hour: 0 }), "2026-10-16", "после полуночи подготовка не становится пропуском");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 9 }), "2026-10-15");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 14 }), "2026-10-15");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 20, actedToday: true }), "2026-10-15", "реальная попытка вечером — день 1 сегодня");
  assert.strictEqual(R.practiceStartFor({ todayKey: "2026-10-15", hour: 17, times: { eveningStart: 19 } }), "2026-10-15", "границы вечера из настроек");
  const p = { id: "p", startDate: "2026-10-12", practiceStartDate: "2026-10-15", skillId: "refuse" };
  assert.strictEqual(R.practiceStart(p), "2026-10-15");
  const e = R.flagEligibility({ pattern: p, todayKey: "2026-10-16", checkins: {}, episodes: [] });
  assert.strictEqual(e.daysElapsed, 1, "срок от старта практики, не от старого эпизода");
  assert.ok(/Практика начнётся/.test(R.flagEligibility({ pattern: p, todayKey: "2026-10-14", checkins: {}, episodes: [] }).reasons[0]));
  const pats = [{ id: "a", startDate: "2026-10-01" }, { id: "b", startDate: null }, { id: "c", startDate: "2026-10-02", practiceStartDate: "2026-10-03" }, { id: "d", startDate: "2026-10-01", legacy: true }];
  assert.strictEqual(R.migrateV5(pats), 1); assert.strictEqual(pats[0].practiceStartDate, "2026-10-01"); assert.strictEqual(pats[0].practiceStartOrigin, "migrated"); assert.strictEqual(pats[2].practiceStartDate, "2026-10-03"); assert.ok(!pats[3].practiceStartDate);
  assert.strictEqual(R.SCHEMA_VERSION, 5);
  assert.strictEqual(R.mergeImport({ patterns: [], episodes: [], hypotheses: [], experiments: [], reviews: [], flags: [], checkins: {}, research: {} }, { patterns: [{ id: "z", startDate: "2026-10-05", createdAt: 1 }] }, 4).data.patterns[0].practiceStartDate, "2026-10-05", "импорт прежней схемы получает старт практики");
});
ok("шаги на тропе: один в день", () => {
  const days = R.practiceDays({ a: { dateKey: "2026-10-01", evening: {} }, b: { dateKey: "2026-10-02", evening: {} }, c: { dateKey: "2026-10-03" }, d: { dateKey: "2026-10-02", patternId: "q", evening: {} } });
  assert.strictEqual(days.length, 2, "два сюжета в один день — один шаг");
});
ok("исследование: максимум один новый модуль в день", () => {
  const s = R.researchState({ modules: { episode: { status: "done", dateKey: "2026-10-01" } } }, "2026-10-01");
  assert.strictEqual(s.next, "meaning"); assert.ok(s.lockedToday);
  assert.ok(!R.researchState({ modules: { episode: { status: "done", dateKey: "2026-10-01" } } }, "2026-10-02").lockedToday);
  assert.ok(!R.researchState({ modules: { episode: { status: "done", dateKey: "2026-10-01" } } }, "2026-10-01", true).lockedToday);
});
ok("узнавание гипотезы после двух эпизодов в разные дни", () => {
  const eps = [{ id: "a", dateKey: "2026-10-01" }, { id: "b", dateKey: "2026-10-01" }, { id: "c", dateKey: "2026-10-03" }];
  assert.strictEqual(R.hypothesisRecognition({ status: "selected", supportingEpisodeIds: ["a", "b"] }, eps).label, "Проверяем");
  assert.strictEqual(R.hypothesisRecognition({ status: "selected", supportingEpisodeIds: ["a", "c"] }, eps).label, "Ты узнаёшь это объяснение в нескольких случаях");
  assert.strictEqual(R.hypothesisRecognition({ status: "rejected", supportingEpisodeIds: ["a", "c"] }, eps).label, "Это объяснение пока не подходит");
});
ok("ICS: только включённые, стабильные UID", () => {
  const t = R.icsText({ reminders: { evening: { on: true, time: "20:30" }, morning: { on: false, time: "08:00" } }, installId: "abc", nowTs: 0 });
  assert.ok(/UID:putkarmy-evening-abc@putkarmy/.test(t)); assert.ok(!/morning/.test(t));
  assert.strictEqual(R.icsText({ reminders: { evening: { on: false, time: "20:30" } }, installId: "abc" }), "");
});
ok("число по дате", () => { assert.strictEqual(R.calcNum("1981-01-22").num, 6); assert.strictEqual(R.calcNum("1993-12-11").num, 9); assert.strictEqual(R.calcNum("x"), null); });

const V9 = { num: 6, birth: "1981-01-22", theme: "dark", teacher: "Брат", teacherType: "person", portrait: { quality: "контроль", action: "спрашиваю" }, queue: [{ text: "болячка", heat: 6, at: 1760000000000 }], signs: [{ at: 1760000000000, text: "позвонил сам", teacher: "Брат" }],
  archive: [{ start: "2026-09-01", step: 1, teacher: "Брат", teacherType: "person", round: 1, days: { 1: { morning: { at: 1, score: 7 }, moments: [{ kind: "hold", note: "промолчал", at: 2 }], evening: { at: 3, weight: 5, answers: { x: "было равнодушие" } } } }, summary: { at: 4, score: 1, me: "спокойнее", around: "", passed: true } }],
  sprint: { start: "2026-09-08", step: 1, teacher: "Брат", teacherType: "person", round: 2, days: { 2: { morning: { at: 5, score: 2 } } }, summary: null } };
ok("сценарий 19: миграция сохраняет записи, помечает legacy, не трогает исходник", () => {
  const raw = JSON.parse(JSON.stringify(V9)); const m = R.migrateV9(raw, 100);
  assert.strictEqual(m.patterns.length, 1); assert.ok(m.patterns[0].legacy); assert.strictEqual(m.patterns[0].startDate, "2026-09-01"); assert.strictEqual(m.patterns[0].legacyInfo.weeks, 2);
  const pid = m.patterns[0].id; assert.strictEqual(m.checkins[`2026-09-01|${pid}`].morning.intensity, 7); assert.strictEqual(m.checkins[`2026-09-09|${pid}`].morning.intensity, 2);
  assert.strictEqual(m.episodes.filter(e => e.legacy).length, 2); assert.strictEqual(m.flags.length, 1); assert.ok(m.flags[0].legacy); assert.strictEqual(m.flags[0].skillId, null);
  assert.strictEqual(R.clarity(m.flags, 6).pct, 0);
  assert.deepStrictEqual(raw, V9); assert.strictEqual(m.profile.symbolic.num, 6); assert.strictEqual(m.profile.reminders.evening.on, true);
});
ok("сценарий 14: повторный импорт не дублирует записи", () => {
  const cur = { patterns: [{ id: "p1", createdAt: 1 }], episodes: [{ id: "e1", loggedAt: 1 }], hypotheses: [], experiments: [], reviews: [], flags: [{ id: "f1", createdAt: 1 }], checkins: { "2026-10-01|p1": { id: "2026-10-01|p1", dateKey: "2026-10-01", patternId: "p1", evening: { at: 1 } } }, research: {} };
  /* входящий файл схемы 2: записи дня по дате */
  const inc = { patterns: cur.patterns, episodes: [{ id: "e1", loggedAt: 1 }, { id: "e2", loggedAt: 2 }], flags: cur.flags, checkins: { "2026-10-01": { dateKey: "2026-10-01", patternId: "p1", evening: { at: 5, currentImpact: 2 } }, "2026-10-02": { dateKey: "2026-10-02", morning: { at: 1 } } } };
  const { data, stats } = R.mergeImport(cur, inc);
  assert.strictEqual(data.episodes.length, 2); assert.strictEqual(data.patterns.length, 1); assert.strictEqual(data.flags.length, 1);
  assert.strictEqual(data.checkins["2026-10-01|p1"].evening.currentImpact, 2); assert.strictEqual(Object.keys(data.checkins).length, 2); assert.ok(data.checkins["2026-10-02|-"]);
  const again = R.mergeImport(data, inc); assert.strictEqual(again.data.episodes.length, 2); assert.strictEqual(again.data.flags.length, 1);
  assert.ok(stats.added >= 2);
});
ok("валидация импорта", () => {
  assert.ok(!R.validateImport(null).ok); assert.ok(!R.validateImport({ schemaVersion: 9 }).ok);
  assert.ok(R.validateImport({ schemaVersion: 2, patterns: [{ id: "a" }], checkins: { "2026-10-01": { dateKey: "2026-10-01" } } }).ok, "схема 2 читается");
  assert.ok(R.validateImport({ schemaVersion: 3, patterns: [{ id: "a" }], checkins: { "2026-10-01|a": { id: "2026-10-01|a", dateKey: "2026-10-01" } } }).ok, "схема 3 читается");
  assert.ok(!R.validateImport({ schemaVersion: 3, checkins: { "x|a": { id: "x|a", dateKey: "x" } } }).ok);
  assert.ok(!R.validateImport({ schemaVersion: 2, patterns: [{}] }).ok);
  assert.ok(R.validateImport(V9).errors.length > 0 || R.validateImport(Object.assign({ schemaVersion: 1 }, V9)).legacy);
});
ok("совместные наблюдения тела — подсчёт, не причина", () => {
  const c = R.bodyCooccurrence([{ emotion: "Злость", body: { locations: ["Плечи"] } }, { emotion: "Злость", body: { locations: ["Плечи", "Ничего заметного"] } }, { emotion: "Обида", body: { locations: ["Плечи"] } }]);
  assert.deepStrictEqual(c, [{ a: "Плечи", b: "Злость", n: 2 }]);
});
/* ---------- v3: колода, ответы, каталог ---------- */
const CW = {}; new Function("window", require("fs").readFileSync(require("path").join(__dirname, "..", "content.js"), "utf8"))(CW); const CC = CW.KARMA_CONTENT, XX = CC.extra;
ok("v3: колода по числу — 4 из сценариев пути + 2 из других, без дублей; без числа — 6 разных тем; exclude даёт следующую подборку", () => {
  const d = R.buildDeck({ packs: CC.packs, pathPacks: XX.paths["5"].packs, seed: 7 });
  assert.strictEqual(d.length, 6); assert.strictEqual(new Set(d.map(c => c.id)).size, 6);
  assert.ok(d.slice(0, 4).every(c => XX.paths["5"].packs.includes(c.packId))); assert.ok(d.slice(4).every(c => !XX.paths["5"].packs.includes(c.packId)));
  const g = R.buildDeck({ packs: CC.packs, seed: 3 }); assert.strictEqual(g.length, 6); assert.strictEqual(new Set(g.map(c => c.packId)).size, 6);
  const next = R.buildDeck({ packs: CC.packs, pathPacks: XX.paths["5"].packs, seed: 7, exclude: d.map(c => c.id) });
  assert.strictEqual(next.length, 6); assert.ok(next.every(c => !d.some(x => x.id === c.id)), "следующая подборка не повторяет показанные");
  const all = CC.packs.reduce((a, p) => a + p.cards.length, 0); let shown = [], rounds = 0; while (rounds++ < 20) { const dd = R.buildDeck({ packs: CC.packs, exclude: shown }); if (!dd.length) break; shown.push(...dd.map(c => c.id)); }
  assert.strictEqual(new Set(shown).size, all, "все карточки показываются по одному разу");
  assert.ok(d.every(c => c.recognition && c.text));
});
ok("v3: ответы по колоде — один ответ на карточку, отмена возвращает карточку, дублей нет", () => {
  const S = { deck: [{ id: "a", packId: "p" }, { id: "b", packId: "p" }], idx: 0, picks: [] };
  assert.ok(R.deckAnswer(S, "yes")); assert.strictEqual(S.idx, 1); assert.deepStrictEqual(S.undo, { id: "a", r: "yes" });
  assert.ok(R.deckUndo(S)); assert.strictEqual(S.idx, 0); assert.strictEqual(S.picks.length, 0); assert.ok(!R.deckUndo(S), "вторая отмена подряд невозможна");
  R.deckAnswer(S, "unsure"); R.deckAnswer(S, "no"); assert.ok(!R.deckAnswer(S, "yes"), "колода закончилась — ответ не принимается");
  assert.strictEqual(S.picks.length, 2); assert.strictEqual(R.deckYes(S).length, 0, "«не уверен» и «не про меня» не считаются узнаванием");
  S.idx = 1; R.deckAnswer(S, "yes"); assert.strictEqual(S.picks.filter(p => p.id === "b").length, 1, "повторный ответ по той же карточке заменяет, не дублирует");
});
ok("v3: каталог — 9 путей со сценариями, у каждого сценария учителя и уроки с навыком, разрешением, действием и версией объяснения", () => {
  const ids = new Set(CC.packs.map(p => p.id)), skills = new Set(XX.skills.map(s => s.id));
  assert.strictEqual(Object.keys(XX.paths).length, 9);
  Object.entries(XX.paths).forEach(([k, t]) => { assert.ok(t.name && t.theme && t.intro, `путь ${k}`); assert.ok(t.packs.length >= 2 && t.packs.every(id => ids.has(id)), `пакеты пути ${k}`); });
  CC.packs.forEach(pk => {
    assert.ok(pk.teacherExamples.length >= 3, pk.id); assert.ok(pk.lessons.length >= 2, pk.id); assert.ok(pk.summary);
    pk.lessons.forEach(l => { assert.ok(l.title && l.inner && l.action && l.signal, l.id); assert.ok(skills.has(l.skillId), `навык ${l.skillId}`); assert.ok(pk.hypotheses.some(h => h.id === l.hypothesisId), `объяснение ${l.hypothesisId}`); });
    pk.cards.forEach(c => { assert.ok(c.recognition, c.id); const sent = c.text.split(/[.!?]\s+/).filter(Boolean).length; assert.ok(sent <= 2, `карточка длиннее двух фраз: ${c.id}`); assert.ok(!/потому что|на самом деле ты/i.test(c.text + c.recognition), `причина как факт: ${c.id}`); });
  });
  assert.ok(XX.lessonUnknown.skillId === "pause" && !XX.lessonUnknown.hypothesisId, "«пока не знаю» — наблюдение и универсальная пауза");
  assert.ok(XX.teachers.length >= 5 && XX.lastTime.some(x => x[0] === "none"));
  const titles = CC.firstWeekModules.map(m => m.title); assert.ok(titles.some(t => /услышал/.test(t)) && titles.some(t => /важно/.test(t)) && titles.some(t => /могу менять/.test(t)));
});
ok("v3: правила флага не зависят от числа и свайпов", () => {
  const start = "2026-09-01", today = "2026-09-22"; const d = mkData({ start, days: 21 });
  const a = R.flagEligibility({ pattern: PAT, todayKey: today, ...d }), b = R.flagEligibility({ pattern: Object.assign({ scenario: { cardId: "x" }, lesson: { id: "l" } }, PAT), todayKey: today, ...d });
  assert.strictEqual(a.eligible, b.eligible); assert.deepStrictEqual(a.reasons, b.reasons);
  assert.ok(Object.keys(R.DEFAULT_POLICY).every(k => !/swipe|card|num|path/i.test(k)));
});
ok("v3.1: расхождение урока и практики по навыку; «сохранить формулировку» привязано к версии плана", () => {
  const p = { lesson: { id: "l", title: "x", skillId: "need" } };
  assert.ok(!R.lessonDrift({ pattern: p, experiment: { id: "x1", skillId: "need" } }).drift);
  const d = R.lessonDrift({ pattern: p, experiment: { id: "x2", skillId: "refuse" } }); assert.ok(d.drift && d.oldSkill === "need" && d.newSkill === "refuse");
  p.lesson.keptForExperimentId = "x2"; assert.ok(!R.lessonDrift({ pattern: p, experiment: { id: "x2", skillId: "refuse" } }).drift);
  assert.ok(R.lessonDrift({ pattern: p, experiment: { id: "x3", skillId: "pause" } }).drift, "новая версия плана с другим навыком снова требует решения");
  assert.ok(!R.lessonDrift({ pattern: {}, experiment: { id: "x", skillId: "need" } }).drift, "без урока расхождения нет");
});
ok("v4: колода событий — сфера определяет подборку, число не участвует; «пока трудно понять» — разные сферы; без дублей и с продолжением", () => {
  const d = R.buildEventDeck({ events: XX.events, area: "money", first: 4, seed: 5 });
  assert.ok(d.length === 4 && d.every(e => e.areas.includes("money")) && new Set(d.map(e => e.id)).size === 4);
  const g = R.buildEventDeck({ events: XX.events, area: "unclear", first: 4, seed: 2 }); assert.strictEqual(new Set(g.map(e => e.areas[0])).size, 4);
  const next = R.buildEventDeck({ events: XX.events, area: "money", first: 4, seed: 5, exclude: d.map(e => e.id) }); assert.ok(next.length === 4 && next.every(e => !d.some(x => x.id === e.id)));
  const all = XX.events.length; let shown = [], rounds = 0; while (rounds++ < 20) { const dd = R.buildEventDeck({ events: XX.events, area: "work", exclude: shown }); if (!dd.length) break; shown.push(...dd.map(e => e.id)); }
  assert.strictEqual(new Set(shown).size, all, "расширение доходит до всех событий");
  assert.deepStrictEqual(R.buildEventDeck({ events: XX.events, area: "work", seed: 1 }).map(e => e.id), R.buildEventDeck({ events: XX.events, area: "work", seed: 1, num: 3 }).map(e => e.id), "число не меняет подборку");
});
ok("v4: каталог — 9 понятных тем, события без реакции и причины, значения ссылаются на существующие уроки", () => {
  Object.entries(XX.paths).forEach(([k, t]) => { assert.ok(t.title && t.description && t.question && t.offer, `тема ${k}`); assert.ok(!/ты (молчишь|боишься|запрещаешь)/i.test(t.description), `черта как факт: ${k}`); });
  const lessons = new Set(CC.packs.flatMap(p => p.lessons.map(l => l.id))), packs = new Set(CC.packs.map(p => p.id)), areas = new Set(XX.areas.map(a => a[0]));
  assert.ok(XX.events.length >= 20);
  XX.events.forEach(e => {
    assert.ok(e.areas.length && e.areas.every(a => areas.has(a)) && packs.has(e.packId), e.id);
    assert.ok(e.meanings.length >= 3 && e.meanings.every(m => m.text && (m.lessonId === null || lessons.has(m.lessonId))), `значения ${e.id}`);
    assert.ok(!/потому что|значит,? (я|что)|запрещаю себе/i.test(e.text), `причина в событии: ${e.id}`);
    assert.ok(e.text.split(/[.!?]\s+/).filter(Boolean).length === 1, `событие — одна фраза: ${e.id}`);
  });
  assert.ok(XX.lessonObserve && !XX.lessonObserve.inner && XX.lessonObserve.skillId === "pause", "без объяснения — наблюдение без внутреннего запрета");
  assert.ok(XX.meaningExtra.some(x => x[0] === "__none") && XX.repeat.length === 3 && XX.ownMeanings.length >= 4);
});
ok("v4.1: каждое значение события ведёт к уроку (глобальный id) или предметному наблюдению; реакции — у каждого события; «не задело» — не кандидат", () => {
  XX.events.forEach(e => {
    assert.ok(Array.isArray(e.reactions) && e.reactions.length >= 3, `реакции ${e.id}`);
    e.meanings.forEach(m => { if (m.lessonId) { const l = R.findLesson(CC.packs, m.lessonId); assert.ok(l && l.packId && l.action && l.skillId, `${e.id}:${m.id} → ${m.lessonId}`); } else { assert.ok(m.observe && m.observe.title && m.observe.action && m.observe.signal, `${e.id}:${m.id} без направления`); } assert.ok(!/^(не могу|молчу|сам |делаю|переделываю)/i.test(m.text), `значение как поведение: ${e.id}:${m.id} ${m.text}`); });
  });
  const cross = XX.events.flatMap(e => e.meanings.filter(m => m.lessonId && R.findLesson(CC.packs, m.lessonId).packId !== e.packId).map(m => `${e.id}:${m.lessonId}`));
  assert.ok(cross.length >= 4 && cross.includes("ev-decide:control-l3") && cross.includes("ev-double:criticism-l1"), cross.join(","));
  const money = XX.events.find(e => e.id === "ev-money"); assert.ok(money.meanings.filter(m => m.observe).length >= 3 && money.meanings.every(m => !/инвест|кредит|вклад под/i.test(m.observe ? m.observe.action : "")));
  const S = { picks: [{ id: "a", r: "yes" }, { id: "b", r: "yes", notStung: true }, { id: "c", r: "no" }] };
  assert.deepStrictEqual(R.deckCandidates(S).map(p => p.id), ["a"]); assert.deepStrictEqual(R.deckNotStung(S).map(p => p.id), ["b"]); assert.strictEqual(R.deckYes(S).length, 2, "факт «было» сохраняется");
  assert.strictEqual(R.findLesson(CC.packs, "nope"), null);
});
ok("v5: колода — шесть событий: четыре под контекст работы и два соседних; переписка — рабочая; без контекста — четыре сферы + соседние", () => {
  const ctxOf = (ctx) => R.buildEventDeck({ events: XX.events, area: "work", ctx, first: 6, primary: 4, seed: 3 });
  ["boss", "colleagues", "clients", "chat", "load"].forEach(ctx => {
    const d = ctxOf(ctx); assert.strictEqual(d.length, 6, ctx); assert.strictEqual(new Set(d.map(e => e.id)).size, 6);
    assert.ok(d.slice(0, 4).every(e => (e.ctx || []).includes(ctx)), `${ctx}: первые четыре под контекст`); assert.ok(d.every(e => e.areas.includes("work")), `${ctx}: сфера работа`);
  });
  assert.ok(!ctxOf("boss").slice(0, 4).some(e => e.id === "ev-silence"), "для руководителя личная переписка не первая");
  assert.ok(ctxOf("chat").slice(0, 4).some(e => e.id === "ev-workreply"), "переписка конкретизирована как рабочая");
  const any = R.buildEventDeck({ events: XX.events, area: "work", ctx: "any", first: 6, primary: 4, seed: 3 }); assert.strictEqual(any.length, 6); assert.ok(any.slice(0, 4).every(e => e.areas.includes("work")));
  const cl = R.buildEventDeck({ events: XX.events, area: "close", first: 6, primary: 4, seed: 1 }); assert.strictEqual(cl.length, 6); assert.ok(cl.slice(0, 4).every(e => e.areas.includes("close")) && cl.slice(4).some(e => !e.areas.includes("close")), "четыре по сфере и соседние");
  const un = R.buildEventDeck({ events: XX.events, area: "unclear", first: 6, seed: 2 }); assert.strictEqual(un.length, 6); assert.ok(new Set(un.map(e => e.areas[0])).size >= 4);
  assert.ok(XX.workContexts.length === 6 && XX.teachers.some(t => t[0] === "client") && XX.workTeacher.boss === "boss");
  assert.ok(XX.onboarding.approach.consent && XX.onboarding.approach.version && XX.onboarding.firstDay.take && XX.onboarding.buttons.event.label === "Меня зацепило" && XX.onboarding.trail.tips.length === 3 && XX.onboarding.map.lines.length === 3);
});
console.log(`\n${n} проверок прошли${process.exitCode ? ", есть ошибки" : ""}`);
