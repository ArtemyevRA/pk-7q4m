/* Путь кармы v2 — интерфейс. Контент: content.js, правила: rules.js, хранилище: store.js. */
(function () {
  const C = window.KARMA_CONTENT, X = C.extra, R = window.KARMA_RULES, ST = window.KARMA_STORE;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const app = $("#app"), nav = $("#nav"), hero = $("#hero"), tabs = $("#tabs");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const IMG = k => `img/${k}.webp`;
  const ic = (k, cls = "ic") => `<img class="${cls}" src="${IMG("ic-" + k)}" alt="">`;
  const lc1 = x => { x = String(x || "").trim().replace(/[.!]+$/, ""); return x ? x.charAt(0).toLowerCase() + x.slice(1) : ""; };
  const uc1 = x => { x = String(x || "").trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : ""; };
  const SKILLS = X.skills, TOTAL_SKILLS = SKILLS.length;
  const skillLabel = id => (SKILLS.find(s => s.id === id) || {}).label || "";
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let D = null, P = null, deepToday = false;

  /* ---------- время ---------- */
  const nowTs = () => Date.now() + (P && P.devMode ? (P.offsetH || 0) * 3600e3 : 0);
  const today = () => R.dateKey(nowTs());
  const yesterday = () => R.addDays(today(), -1);
  const hour = () => new Date(nowTs()).getHours();
  const phase = () => R.phaseOf(hour(), P.times);
  const PHASE_TXT = { night: "ночь", morning: "утро", day: "день", evening: "вечер" };
  const phaseIc = () => ({ night: "moon", morning: "sunrise", day: "star", evening: "moon" })[phase()];

  /* ---------- уведомления ---------- */
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200); }
  function savedFlash() { const s = $("#saved"); s.classList.add("on"); clearTimeout(savedFlash._t); savedFlash._t = setTimeout(() => s.classList.remove("on"), 1200); }
  function banner(html, cls) { $("#banner").innerHTML = html ? `<div class="banner ${cls || ""}">${html}</div>` : ""; }
  function saveError(e) { banner(`Не удалось сохранить: ${esc((e && e.message) || "ошибка хранилища")}. Запись осталась только на экране. <button id="retrySave">Повторить</button>`); const b = $("#retrySave"); if (b) b.onclick = () => flushAll(); }
  async function flushAll() { try { await ST.replaceAll(D); banner(""); savedFlash(); } catch (e) { saveError(e); } }

  /* ---------- сохранение сущностей ---------- */
  let failCount = 0; /* счётчик неудачных записей: поток вопросов не удаляет черновик, если во время завершения была ошибка */
  /* Сообщение об ошибке снимается только после успешного повтора («Повторить»), а не любой следующей удачной записью. */
  async function put(store, obj, silent) { try { await ST.put(store, obj); if (!silent) savedFlash(); return true; } catch (e) { failCount++; saveError(e); return false; } }
  const upsert = (arr, obj) => { const i = arr.findIndex(x => x.id === obj.id); if (i >= 0) arr[i] = obj; else arr.push(obj); };
  async function saveProfile(silent) { D.profile = P; return put("kv", { key: "profile", value: P }, silent); }
  async function saveMeta() { return put("kv", { key: "meta", value: D.meta }); }
  async function savePattern(p) { p.updatedAt = nowTs(); upsert(D.patterns, p); return put("patterns", p); }
  async function saveEpisode(e) { e.updatedAt = nowTs(); upsert(D.episodes, e); return put("episodes", e); }
  async function saveHyp(h) { h.updatedAt = nowTs(); upsert(D.hypotheses, h); return put("hypotheses", h); }
  async function saveExp(x) { x.updatedAt = nowTs(); upsert(D.experiments, x); return put("experiments", x); }
  async function saveReview(r) { upsert(D.reviews, r); return put("reviews", r); }
  async function saveFlag(f) { upsert(D.flags, f); return put("flags", f); }
  async function saveCheckin(c) { if (!c.id) c.id = R.checkinId(c.dateKey, c.patternId); D.checkins[c.id] = c; return put("checkins", c); }
  async function saveResearch(r) { D.research[r.patternId] = r; return put("research", r); }
  /* Запись дня принадлежит сюжету: ключ «дата|сюжет». Без сюжета (помощь) — «дата|-». */
  const checkin = (k, p) => { const pid = p ? p.id : null; return D.checkins[R.checkinId(k, pid)] || { id: R.checkinId(k, pid), dateKey: k, patternId: pid, tz: R.tz() }; };
  const checkinOf = (k, p) => D.checkins[R.checkinId(k, p ? p.id : null)] || null;

  /* ---------- доступ к данным ---------- */
  /* «Другой сюжет» и старт сохранённого — архив: не прохождение, не флаг и не небо. */
  const archivePattern = (p, reason) => { p.status = "archived"; p.archivedAt = nowTs(); p.archiveReason = reason; };
  const activePattern = () => D.patterns.find(p => p.status === "active") || D.patterns.find(p => p.status === "observe") || null;
  const anyPattern = () => activePattern() || D.patterns.find(p => p.status === "paused") || null;
  const hypOf = p => p && p.hypothesisVersionId ? D.hypotheses.find(h => h.id === p.hypothesisVersionId) : null;
  const expOf = p => p && p.experimentId ? D.experiments.find(x => x.id === p.experimentId) : null;
  const researchOf = p => (p && D.research[p.id]) || { patternId: p ? p.id : null, modules: {} };
  const episodesOf = p => D.episodes.filter(e => p && e.patternId === p.id && !e.legacy);
  const episodesOn = (k, p) => D.episodes.filter(e => e.dateKey === k && !e.legacy && (!p || e.patternId === p.id || !e.patternId));
  const packOf = p => p && p.packId ? C.packs.find(x => x.id === p.packId) : null;
  const flagsReal = () => D.flags.filter(f => !f.legacy);
  const policy = () => Object.assign({}, R.DEFAULT_POLICY, C.progressPolicy || {});
  function skillOfPattern(p) { const x = expOf(p); return (x && x.skillId) || (p && p.skillId) || null; }
  const lineageOf = p => { const x = expOf(p); return x && x.kind === "plan" ? (x.lineageId || x.id) : null; };
  function eligibility(p) { return R.flagEligibility({ pattern: p, checkins: D.checkins, episodes: D.episodes, todayKey: today(), policy: policy(), experiment: expOf(p), skillId: skillOfPattern(p), lineageId: lineageOf(p) }); }
  /* Метка доказательства: навык и версия плана в момент записи. Смена навыка потом не переименовывает историю. */
  function evidenceTag(p) { const x = expOf(p); return { skillId: (x && x.skillId) || (p && p.skillId) || null, experimentId: x ? x.id : null, planId: x ? x.id : null, planVersion: x ? x.version : null, lineageId: lineageOf(p), storyId: p ? (p.storyId || p.id) : null, mirrorVersion: mirrorVer(p) }; }
  /* v7: версия зеркала, к которой относится запись; 0 — зеркало ищем или не найдено */
  function mirrorVer(p) { const m = p && p.mirror; if (!m) return null; return m.text ? (m.version || 1) : 0; }
  /* Разрешение из пакета не затирает формулировку пользователя; источник запоминается для пересмотра при смене объяснения. */
  function setPermissionFromPack(p, text, hypId) { const ps = p.permissionSource; if (!text) return; if (!p.permission || !ps || ps.origin !== "user") { p.permission = text; p.permissionSource = { origin: "pack", hypothesisVersionId: hypId || null }; } }
  function setPermissionByUser(p, text) { p.permission = text; p.permissionSource = { origin: "user", hypothesisVersionId: p.hypothesisVersionId || null }; }
  function hasFlag(p) { return flagsReal().some(f => f.patternId === p.id && f.skillId === skillOfPattern(p)); }
  /* v6: единое представление шага — момент и действие из личного плана (шаблон каталога + слова человека). Прежние планы читаются как есть. */
  const PR = X.practice;
  function planView(p) { const x = expOf(p); if (!x) return null; if (x.kind === "plan") return R.planView(x); return { cue: x.ifThen ? x.ifThen.signal : "", action: x.action || "", purpose: x.purpose || "", effort: "", after: "", limits: "", legacy: true, mode: "behavior" }; }
  function planReady(p) { return R.planReady(expOf(p)); }
  function planText(p) { const v = planView(p); return v ? (v.action || "") : (p && p.firstPlan ? p.firstPlan.text : ""); }
  function ifThen(p) { const v = planView(p); if (!v) { const it = p && p.firstPlan ? { signal: p.firstPlan.signal, action: p.firstPlan.action } : null; return it ? `Если ${lc1(it.signal)}, то ${lc1(it.action)}.` : ""; } return v.cue ? `${uc1(v.cue)} — ${lc1(v.action)}.` : ""; }
  /* Короткий вид шага: «Когда … / Что …», с «Зачем этот шаг?» по раскрытию. */
  function stepHTML(p, { why = true, lead = "" } = {}) {
    const v = planView(p); if (!v) return "";
    const lt = learningText(p);
    return `${lead ? `<p class="small" style="margin:2px 0 6px">${esc(lead)}</p>` : ""}<div class="plines">${v.who ? `<div><span>${esc(OB.plan.whoL)}:</span> ${esc(v.who)}</div>` : ""}<div><span>${esc(OB.plan.whenL)}:</span> ${esc(uc1(v.cue) || "—")}</div><div><span>${esc(v.mode === "observation" ? OB.plan.whatObs : OB.plan.whatL)}:</span> ${esc(uc1(v.action))}${v.simplified ? ` <span class="tiny">· ${esc(OB.plan.simplified)}</span>` : ""}</div>${v.after ? `<div><span>${esc(OB.plan.afterL)}:</span> ${esc(v.after)}</div>` : ""}</div>${why && v.purpose ? `<details class="plain"><summary>${esc(OB.plan.whyStep)}</summary><p class="small">${lt ? `${esc(OB.plan.learn)}: ${esc(lt)}. ` : ""}${esc(v.purpose)}</p></details>` : ""}`;
  }
  const bridgeText = p => { const v = planView(p); if (!v || !p.lesson) return ""; return OB.plan.bridge.replace("{lesson}", lc1(p.lesson.title)).replace("{action}", lc1(v.action.split(/[.;]/)[0])).replace("{purpose}", lc1(v.purpose).replace(/[.!]+$/, "")) + "."; };
  /* Разрешение показывается в ежедневном потоке только подтверждённым человеком (свои слова или шаг «Что я себе разрешаю»); кандидат из каталога — по раскрытию. */
  const permissionConfirmed = p => !!(p && p.permission && p.permissionSource && (p.permissionSource.origin === "user" || p.permissionSource.confirmed || p.permissionSource.origin === "pack" || p.permissionSource.origin === "migrated"));
  async function saveTool(t) { D.tools = D.tools || []; upsert(D.tools, t); return put("tools", t); }
  const toolRunsOn = k => (D.tools || []).filter(t => t.dateKey === k && t.endedAt);
  function permissionText(p) { return permissionConfirmed(p) ? p.permission : ""; }

  /* ---------- тема и фон ---------- */
  function applyTheme() {
    /* v6.10: единственная тема — «Звёздный вечер»; время суток остаётся функциональным (окна практики, подписи), не меняет палитру */
    const mode = "dark";
    const r = document.documentElement; r.setAttribute("data-theme", mode); r.setAttribute("data-big", P.bigText ? "1" : "0");
    const im = $("#bgimg"), src = IMG(mode === "dark" ? "bg-evening" : "bg-morning"); if (im.getAttribute("src") !== src) im.setAttribute("src", src);
  }

  /* ---------- тропа ---------- */
  /* Камни — только последняя явная оценка состояния (сила эмоции события не входит); шаги — завершённые вечера; небо — освоенные навыки числом, не процентом.
     Линия тропы — дни практики до срока проверки навыка; до старта практики она пуста. До обучения и первой практики — иллюстрация без панели метрик. */
  function trailHTML(p) {
    const T = OB.trail, steps = R.practiceDays(D.checkins).length;
    const cl = R.clarity(D.flags, TOTAL_SKILLS), rating = R.lastRating({ checkins: D.checkins });
    const ps = R.practiceStart(p), d = ps ? R.daysSince(ps, today()) : -1, horizon = policy().minElapsedCalendarDays || 21;
    const elig = p && ps && d >= 0 ? eligibility(p) : null;
    /* Линия тропы — участие: закрытые вечера текущей семидневки, не календарь. Срок до проверки навыка — отдельная подпись. */
    const tp = R.trailProgress({ checkins: D.checkins, patternId: p ? p.id : null, practiceStart: ps, todayKey: today() });
    const prog = d >= 0 ? Math.min(0.92, 0.06 + tp.ratio * 0.86) : 0.06;
    const veil = Math.max(0, 0.55 - cl.pct / 100 * 0.55);
    const st = rating ? `${rating.value} ${R.stonesWord(rating.value)}` : T.noRating;
    const stepsTxt = `${steps} ${R.plural(steps, "шаг", "шага", "шагов")} практики`;
    const cap = d >= 0 ? `неделя ${tp.week} · вечеров ${tp.done} из ${tp.of}` + (d + 1 < horizon ? ` · флаг не раньше дня ${horizon}` : "") : ps ? T.before.replace("{d}", R.human(ps)) : (p ? T.observe : "");
    const bare = !P.seen.trail && !steps;
    return `<div class="trail ${bare ? "bare" : ""}" role="img" aria-label="Тропа. Состояние: ${esc(st)}. ${esc(stepsTxt)}. ${esc(T.skills)}: ${cl.count} из ${cl.total}.">
      <img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:${veil.toFixed(2)}"></i>${elig && elig.eligible ? `<i class="glow"></i>` : ""}
      ${bare ? "" : `<span class="tb l">${ic("backpack", "")}${esc(st)}</span><span class="tb r">${ic("star", "")}${esc(T.skills)}: ${cl.count}</span><span class="tb c2">${ic("mountain", "")}${esc(stepsTxt)}</span>${cap ? `<span class="tcap">${esc(cap)}</span>` : ""}`}
      <div class="tpath"><div class="tline"><i style="width:${(prog * 100).toFixed(1)}%"></i></div><span class="me" style="left:${(prog * 100).toFixed(1)}%"></span>${ic("flag", "tflag")}</div>
      <div id="trailpop"></div></div>`;
  }

  /* ---------- универсальный поток вопросов с черновиками ----------
     Ключ черновика: сценарий | сюжет | версия схемы. Текст, шкалы и «своё» сохраняются по вводу (с задержкой) и сразу при переходах.
     Черновик удаляется только после успешного завершения; при ошибке хранилища остаётся для повторной записи.
     Устаревший черновик (старше 36 часов) не теряется молча: предлагается продолжить или начать заново. */
  const DRAFT_V = 2, DRAFT_STALE_MS = 36 * 3600e3;
  const draftKey = (id, scope) => `${id}|${scope || "-"}|${DRAFT_V}`;
  const hasDraft = (id, scope) => !!(P.drafts && P.drafts[draftKey(id, scope)]);
  const dropDraft = (id, scope) => { if (P.drafts) delete P.drafts[draftKey(id, scope)]; };
  let flowFlush = null;
  document.addEventListener("visibilitychange", () => { if (document.hidden && flowFlush) flowFlush(); if (document.hidden && typeof planFlush === "function" && planFlush) planFlush(); });
  window.addEventListener("pagehide", () => { if (flowFlush) flowFlush(); if (typeof planFlush === "function") planFlush(); });
  function flow({ id, scope, steps, title, onDone, onCancel, cancelLabel }) {
    P.drafts = P.drafts || {};
    const key = draftKey(id, scope), saved = P.drafts[key];
    if (saved && saved.at && nowTs() - saved.at > DRAFT_STALE_MS && Object.keys(saved.ans || {}).length) {
      app.innerHTML = `<h1 class="q">Есть незаконченная запись</h1><p class="muted">${esc(title || "Запись")} · начата ${esc(R.human(R.dateKey(saved.at)))}. Продолжить с того места или начать заново?</p>
        <div class="row"><button class="btn block" id="cont">Продолжить</button></div><div class="row tight"><button class="btn ghost" id="restart">Начать заново</button>${onCancel ? `<button class="btn ghost" id="cancel">${esc(cancelLabel || "Позже")}</button>` : ""}</div>`;
      $("#cont").onclick = () => { saved.at = nowTs(); saveProfile(true); flowRun({ id, key, steps, title, onDone, onCancel, cancelLabel }, saved); };
      $("#restart").onclick = () => { delete P.drafts[key]; saveProfile(true); flowRun({ id, key, steps, title, onDone, onCancel, cancelLabel }, null); };
      const cn = $("#cancel"); if (cn) cn.onclick = () => onCancel();
      return;
    }
    flowRun({ id, key, steps, title, onDone, onCancel, cancelLabel }, saved);
  }
  function flowRun({ id, key, steps, title, onDone, onCancel, cancelLabel }, dr) {
    let i = (dr && dr.i) || 0; const ans = (dr && dr.ans) || {};
    const visible = () => steps.filter(s => !(s.skip && s.skip(ans)));
    let timer = null, curStep = null;
    const alive = () => app.dataset.flow === key;
    const persist = () => { P.drafts[key] = { i, ans, at: nowTs() }; return saveProfile(true); };
    /* Снимает текущие значения полей без проверки, чтобы ничего не потерять при уходе. Только пока на экране этот поток. */
    const collect = s => {
      if (!s || !alive()) return;
      if (s.type === "text") { const a = $("#a"); if (a) { const v = a.value.trim(); if (v) ans[s.k] = v; else if (ans[s.k] != null) delete ans[s.k]; } }
      if (s.type === "date") { const d = $("#dt"); if (d && d.value && R.isKey(d.value)) ans[s.k] = d.value; }
      if ((s.type === "choice" || s.type === "multi") && s.own) { const own = $("#own"); if (own) { const v = own.value.trim(); if (v) ans[s.k + "_own"] = v; } }
      if (s.type === "card") $$(".gown").forEach(o => { const v = o.value.trim(); if (v) ans[o.dataset.gk + "_own"] = v; else delete ans[o.dataset.gk + "_own"]; });
    };
    const saveDraft = () => { clearTimeout(timer); collect(curStep); return persist(); };
    const later = () => { clearTimeout(timer); timer = setTimeout(() => { if (!alive()) return; collect(curStep); persist(); }, 400); };
    flowFlush = () => { clearTimeout(timer); if (!alive() || !curStep) return; collect(curStep); P.drafts[key] = { i, ans, at: nowTs() }; saveProfile(true); };
    const finish = async () => {
      clearTimeout(timer); flowFlush = null;
      const f0 = failCount; let threw = false;
      try { await onDone(ans); } catch (e) { threw = true; saveError(e); }
      if (!threw && failCount === f0) { delete P.drafts[key]; saveProfile(true); } else { P.drafts[key] = { i, ans, at: nowTs() }; saveProfile(true); }
    };
    const render = () => {
      const vis = visible(); if (i >= vis.length) i = vis.length - 1; if (i < 0) i = 0;
      const s = vis[i]; curStep = s; const q = typeof s.q === "function" ? s.q(ans) : s.q, lead = typeof s.lead === "function" ? s.lead(ans) : s.lead;
      const opts = (typeof s.opts === "function" ? s.opts(ans) : s.opts || []).map(o => Array.isArray(o) ? o : [o, o]);
      let body = "";
      const cur = ans[s.k];
      if (s.type === "choice" || s.type === "multi") {
        const sel = s.type === "multi" ? (cur || []) : [cur];
        body = `<div class="chips col" id="ch">${opts.map(([v, l]) => `<button class="chip ${sel.includes(v) ? "on" : ""}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}${s.own ? `<button class="chip ${cur === "__own" || (s.type === "multi" && sel.includes("__own")) ? "on" : ""}" data-v="__own">Своё</button>` : ""}${s.unknown ? `<button class="chip dim ${sel.includes("unknown") ? "on" : ""}" data-v="unknown">Пока не знаю</button>` : ""}</div>
          ${s.own ? `<input type="text" id="own" placeholder="${esc(s.ownPh || "Своими словами")}" value="${esc(ans[s.k + "_own"] || "")}" style="display:${cur === "__own" || (s.type === "multi" && sel.includes("__own")) ? "block" : "none"}">` : ""}`;
      } else if (s.type === "text") {
        body = `${s.tags ? `<div class="chips" id="tg">${(typeof s.tags === "function" ? s.tags(ans) : s.tags).map(t => `<button class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}<textarea id="a" placeholder="${esc(s.ph || "")}">${esc(cur != null ? cur : (typeof s.def === "function" ? s.def(ans) : s.def) || "")}</textarea>`;
      } else if (s.type === "scale") {
        const v = cur != null ? cur : (s.def != null ? s.def : 5);
        body = `<div class="range-val" id="scv">${cur == null && s.optional ? "—" : v}</div><input type="range" id="sc" min="0" max="10" step="1" value="${v}" aria-label="${esc(q)}"><div class="range-hint"><span>${esc(s.lo || "0")}</span><span>${esc(s.hi || "10")}</span></div>`;
      } else if (s.type === "date") {
        const min = typeof s.min === "function" ? s.min(ans) : s.min, max = typeof s.max === "function" ? s.max(ans) : s.max;
        const def = typeof s.def === "function" ? s.def(ans) : s.def;
        body = `<input type="date" id="dt" value="${esc(cur || def || "")}"${min ? ` min="${esc(min)}"` : ""}${max ? ` max="${esc(max)}"` : ""} aria-label="${esc(q)}">`;
      } else if (s.type === "card") {
        /* v7: компактная карточка опыта — несколько коротких выборов на одном экране, каждый можно пропустить */
        const gs = (typeof s.groups === "function" ? s.groups(ans) : s.groups).filter(g => !(g.skip && g.skip(ans)));
        body = gs.map(g => `<div class="card tight expg" data-g="${esc(g.k)}">${g.lead ? `<p class="small muted" style="margin:0 0 4px">${esc(typeof g.lead === "function" ? g.lead(ans) : g.lead)}</p>` : ""}<p class="small" style="margin:0 0 6px"><b>${esc(g.label)}</b></p><div class="chips">${g.opts.map(([v, l]) => `<button class="chip ${ans[g.k] === v ? "on" : ""}" data-gk="${esc(g.k)}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>${g.ownOn ? `<input type="text" class="gown" id="gown-${esc(g.k)}" data-gk="${esc(g.k)}" data-on="${esc(g.ownOn.join(","))}" placeholder="${esc(g.ph || "Своими словами")}" value="${esc(ans[g.k + "_own"] || "")}" style="display:${g.ownOn.includes(ans[g.k]) ? "block" : "none"}">` : ""}</div>`).join("");
      } else if (s.type === "info") body = s.html ? (typeof s.html === "function" ? s.html(ans) : s.html) : "";
      const last = i === vis.length - 1;
      app.dataset.flow = key;
      app.innerHTML = `${title ? `<p class="tiny" style="margin:0 0 4px">${esc(title)}</p>` : ""}<div class="progress"><i style="width:${((i + (s.type === "info" ? 1 : 0)) / vis.length * 100).toFixed(0)}%"></i></div>
        ${lead ? `<p class="muted small" style="margin-bottom:6px">${esc(lead)}</p>` : ""}<h1 class="q">${esc(q)}</h1>${body}
        ${s.hint ? `<p class="hint">${esc(typeof s.hint === "function" ? s.hint(ans) : s.hint)}</p>` : ""}<div id="flag"></div>
        <div class="row"><button class="btn block" id="next">${s.nextLabel || (last ? "Готово" : "Дальше")}</button></div>
        <div class="row tight">${i > 0 ? `<button class="btn ghost" id="back">Назад</button>` : ""}${s.optional && s.type !== "info" ? `<button class="btn ghost" id="skipq">Пропустить</button>` : ""}${onCancel ? `<button class="btn ghost" id="cancel">${esc(cancelLabel || "Позже")}</button>` : ""}</div>`;
      const own = $("#own"), a = $("#a"), dt = $("#dt");
      if (a) { a.focus(); a.oninput = later; }
      if (own) own.oninput = later;
      if (dt) dt.onchange = later;
      $$("#ch .chip").forEach(b => b.onclick = () => {
        const v = b.dataset.v;
        if (s.type === "choice") {
          ans[s.k] = v; $$("#ch .chip").forEach(x => x.classList.toggle("on", x === b));
          if (own) { own.style.display = v === "__own" ? "block" : "none"; if (v === "__own") own.focus(); }
          if (s.note) $("#flag").innerHTML = s.note(ans) || "";
          if (v !== "__own" && !s.noAuto) { saveDraft(); setTimeout(() => advance(), 120); } else later();
        } else { const arr = ans[s.k] = ans[s.k] || []; const ix = arr.indexOf(v); if (ix >= 0) arr.splice(ix, 1); else arr.push(v); b.classList.toggle("on"); if (own) own.style.display = arr.includes("__own") ? "block" : "none"; later(); }
      });
      $$(".expg .chip").forEach(b => b.onclick = () => {
        const gk = b.dataset.gk, v = b.dataset.v; ans[gk] = ans[gk] === v ? undefined : v; if (ans[gk] === undefined) delete ans[gk];
        $$(`.expg .chip[data-gk="${gk}"]`).forEach(x => x.classList.toggle("on", x.dataset.v === ans[gk]));
        const o = document.getElementById("gown-" + gk); if (o) { const on = o.dataset.on.split(",").includes(ans[gk]); o.style.display = on ? "block" : "none"; if (on && !o.value) o.focus(); }
        later();
      });
      $$(".gown").forEach(o => o.oninput = later);
      $$("#tg .chip").forEach(b => b.onclick = () => { if (a) { a.value = a.value.trim() ? a.value.trim() + ". " + b.dataset.v : b.dataset.v; a.focus(); later(); } });
      const sc = $("#sc"); if (sc) sc.oninput = () => { $("#scv").textContent = sc.value; ans[s.k] = Number(sc.value); later(); };
      const advance = () => {
        if (s.type === "choice") { if (!ans[s.k] && !s.optional) return toast("Выбери вариант"); if (ans[s.k] === "__own") { const v = own.value.trim(); if (!v) return toast("Напиши своё"); ans[s.k + "_own"] = v; } }
        if (s.type === "multi") { const arr = ans[s.k] || []; if (arr.includes("__own")) { const v = own.value.trim(); if (!v) return toast("Напиши своё"); ans[s.k + "_own"] = v; } if (!arr.length && !s.optional) return toast("Отметь хотя бы одно"); }
        if (s.type === "text") { const v = a.value.trim(); if (!v && !s.optional) return toast(s.req || "Напиши хотя бы пару слов"); ans[s.k] = v; }
        if (s.type === "scale") { if (ans[s.k] == null) ans[s.k] = Number($("#sc").value); }
        if (s.type === "card") { collect(s); const gs = (typeof s.groups === "function" ? s.groups(ans) : s.groups).filter(g => !(g.skip && g.skip(ans))); for (const g of gs) { if (ans[g.k] === "__own" && !ans[g.k + "_own"]) return toast("Напиши своё"); if (g.needOwn && g.needOwn.includes(ans[g.k]) && !ans[g.k + "_own"]) return toast(g.needOwnMsg || "Напиши пару слов"); } }
        if (s.type === "date") { const v = $("#dt").value; if (!v && !s.optional) return toast("Укажи дату"); if (v && !R.isKey(v)) return toast("Укажи дату"); if (v) ans[s.k] = v; else delete ans[s.k]; }
        if (s.validate) { const m = s.validate(ans); if (m) { $("#flag").innerHTML = `<div class="nudge">${esc(m)}</div>`; return; } }
        if (i >= visible().length - 1) { clearTimeout(timer); finish(); } else { i++; saveDraft(); render(); window.scrollTo(0, 0); }
      };
      $("#next").onclick = advance;
      const sk = $("#skipq"); if (sk) sk.onclick = () => { delete ans[s.k]; if (s.type === "card") (typeof s.groups === "function" ? s.groups(ans) : s.groups).forEach(g => { delete ans[g.k]; delete ans[g.k + "_own"]; }); if (i >= visible().length - 1) { clearTimeout(timer); finish(); } else { i++; saveDraft(); render(); } };
      const bk = $("#back"); if (bk) bk.onclick = () => { collect(s); i--; saveDraft(); render(); };
      const cn = $("#cancel"); if (cn) cn.onclick = () => { saveDraft(); flowFlush = null; onCancel(); };
    };
    render();
  }
  const val = (ans, k) => ans[k] === "__own" ? ans[k + "_own"] : ans[k];
  const vals = (ans, k) => (ans[k] || []).map(v => v === "__own" ? ans[k + "_own"] : v).filter(Boolean);

  /* ---------- роутер ---------- */
  const go = h => { if (location.hash === "#" + h) route(); else location.hash = h; };
  function route() {
    if (!D) return;
    if (flowFlush) { flowFlush(); flowFlush = null; } if (planFlush) { planFlush(); planFlush = null; } app.dataset.flow = ""; app.dataset.sq = ""; app.dataset.sk = "";
    applyTheme();
    let [h, arg] = (location.hash || "#today").slice(1).split("/");
    const p = anyPattern();
    /* Новому человеку — вход (проблема → дата → число → сфера → события → фокус → учитель → случай → что задело → резюме → урок → карта дня). Действующий сюжет или записи прошлой версии — сразу свой путь. */
    const STEPS = ["start", "birth", "symbol", "area", "ctx", "sd", "workctx", "closectx", "fdialog", "cards", "dialog", "own", "teacher", "case", "sting", "want", "summary", "path", "lesson"];
    const ONB = [...STEPS, "plan", "map", "guide", "new", "entry", "help", "about", "settings"];
    const needStart = !p && !D.meta.migratedFromV9 && !(P.seen.start && !P.onb);
    if (needStart && !ONB.includes(h)) h = (P.onb && P.onb.step && ONB.includes(P.onb.step)) ? P.onb.step : "start";
    if (needStart && STEPS.includes(h)) { P.onb = P.onb || {}; if (P.onb.step !== h) { P.onb.step = h; saveProfile(true); } }
    /* Карта дня — один раз, до обычной главной: отдельное состояние обучения, не часть смыслового входа. */
    /* Черновик личного шага: сначала момент и действие словами человека, потом карта дня и главная. */
    const xp = p && expOf(p);
    if (xp && xp.kind === "plan" && xp.planStatus === "draft" && ["today", "map", "morning", "evening"].includes(h)) h = "plan";
    if (p && !P.seen.map && !D.meta.migratedFromV9 && h === "today") h = "map";
    const live = !!p || !!D.meta.migratedFromV9 || (P.seen.start && !P.onb);
    document.body.classList.toggle("live", live && !["start", "entry", "birth"].includes(h));
    hero.innerHTML = ""; $("#stagebar").innerHTML = "";
    nav.innerHTML = `<a class="pill sos" href="#help" aria-label="Сейчас тяжело">${ic("flame", "")}<span>Сейчас тяжело</span></a><a class="pill ${h === "settings" ? "on" : ""}" href="#settings" aria-label="Настройки">${ic("key", "")}</a>`;
    tabs.innerHTML = [["today", "Сегодня", phaseIc()], ["story", "Мой путь", "eye"], ["history", "История", "hourglass"]].map(([k, l, i]) => `<a href="#${k}" class="${h === k ? "on" : ""}">${ic(i, "")}${l}</a>`).join("");
    $("#testbar").innerHTML = P.devMode && P.offsetH ? `<div class="testbar">Тестовое время: ${R.human(today())}, ${R.fmtTime(nowTs())} (сдвиг ${P.offsetH > 0 ? "+" : ""}${P.offsetH} ч) — <a href="#settings">сбросить</a></div>` : "";
    const V = { start, birth, entry, new: newEpisode, area, workctx: ctxScreen, ctx: ctxScreen, sd, cards, own: ownRoute, teacher, case: caseScreen, sting, want, summary, dialog: sd, closectx: ctxScreen, fdialog: sd, path: summary, lesson, plan: planScreen, map: mapScreen, guide, tool: toolScreen, help, today: todayScreen, story, history, settings, morning, event, action, evening, module: moduleScreen, review, flag: flagScreen, about, symbol, detail, legacy, episode: episodeView };
    (V[h] || V.today)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  let lastKey = null, lastPhase = null;
  setInterval(() => { if (!P) return; if (today() !== lastKey || phase() !== lastPhase) { lastKey = today(); lastPhase = phase(); if (/^#?(today)?$/.test(location.hash)) route(); else applyTheme(); } }, 30e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && P && (today() !== lastKey || phase() !== lastPhase)) { lastKey = today(); lastPhase = phase(); route(); } });

  /* =================== ВХОД v5: число (интрига) → сфера (+контекст работы) → шесть событий → фокус → учитель → случай → что задело → резюме → урок → карта дня =================== */
  const OB = X.onboarding;
  const onb = () => { P.onb = P.onb || {}; return P.onb; };
  const pathOf = () => (P.symbolic && P.symbolic.num) ? X.paths[P.symbolic.chosen || P.symbolic.num] : null;
  const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const humanWd = k => `${WD[R.parseKey(k).getDay()]}, ${R.human(k)}`;
  /* Шаг 1. Узнавание проблемы и «О подходе»: одна раскрываемая справка и пустой чекбокс. Согласие хранится локально с версией текста; чекбокс не проставляется сам. */
  function start() {
    document.body.classList.remove("live");
    const A = OB.approach, agreed = !!(P.consent && P.consent.version === A.version);
    app.innerHTML = `
      <h1>${esc(OB.problem.title)}</h1>
      <p>${esc(OB.problem.text)}</p>
      <p class="quote">${esc(OB.problem.hint)}</p>
      <div class="trail" style="height:120px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.3"></i></div>
      <p style="margin:8px 0 2px"><b>${esc(OB.frame.title)}</b></p><p class="small" style="margin:0 0 8px">${esc(OB.frame.text)}</p>
      <div class="card tight" id="approach"><p class="small" style="margin:0 0 2px">${esc(OB.problem.approachLine)}</p>
        <details class="plain"><summary>${esc(A.title)}</summary><p class="small" style="margin:0 0 6px">${esc(A.text)}</p></details>
        <label class="consent"><input type="checkbox" id="consent" ${agreed ? "checked" : ""}><span>${esc(A.consent)}</span></label></div>
      <div class="row"><button class="btn block" id="go" ${agreed ? "" : "disabled"}>${esc(OB.problem.cta)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#help">${esc(OB.buttons.sos.label)}</a><a class="btn ghost" href="#about">Как это работает</a></div>`;
    $("#consent").onchange = e => { $("#go").disabled = !e.target.checked; };
    $("#go").onclick = async () => { if (!$("#consent").checked) return toast("Отметь, что прочитал(а) о подходе"); P.consent = { version: A.version, at: nowTs() }; P.seen.start = true; onb().step = "birth"; await saveProfile(true); go("birth"); };
  }
  /* Шаг 2. Дата рождения — по желанию. Без даты путь тот же, только без темы числа. */
  function birth() {
    document.body.classList.remove("live");
    const S = P.symbolic || {}, O = onb();
    app.innerHTML = `<h1>${esc(OB.birth.title)}</h1><p>${esc(OB.birth.text)}</p>
      <label for="b">Дата рождения</label><input type="date" id="b" min="1920-01-01" max="${today()}" value="${esc(O.birthDraft || S.birth || "")}">
      <p class="tiny" style="margin:4px 0 10px">${esc(OB.birth.note)}</p>
      <div class="row"><button class="btn block" id="go">${esc(OB.birth.cta)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#area" id="skip">${esc(OB.birth.skip)}</a><a class="btn ghost" href="#help">${esc(OB.buttons.sos.label)}</a></div>`;
    $("#b").onchange = () => { O.birthDraft = $("#b").value; saveProfile(true); };
    const back = () => onb().sting ? "summary" : null;
    $("#go").onclick = async () => {
      const v = $("#b").value; const r = R.calcNum(v); if (!r || !R.isKey(v)) return toast("Укажи дату");
      P.symbolic = Object.assign({}, S, { birth: v, num: r.num, chosen: S.birth === v ? S.chosen : null }); onb().step = "symbol"; await saveProfile(true); go(back() || "symbol");
    };
    $("#skip").onclick = async e => { e.preventDefault(); const b = back() || "area"; onb().step = b; await saveProfile(true); go(b); };
  }
  function entry() {
    document.body.classList.remove("live");
    app.innerHTML = `<h1>С чем начнём?</h1><p class="muted">Один вопрос за раз. Можно уйти в любой момент — всё сохранится.</p>
      <div class="chips col">
        <a class="btn block" href="#area">Найти, с чего начать</a>
        <button class="btn block secondary" id="entOwn">${esc(OB.story.ownCase)}</button>
        <a class="btn block sos" href="#help">${esc(C.entryCopy.choices[2])}</a>
      </div>
      ${anyPattern() ? `<div class="row tight"><a class="btn ghost" href="#today">На главную</a></div>` : ""}`;
    /* v7: свой случай — тот же маршрут (сфера → учитель → своя сцена → зеркало), без обхода через старую запись */
    $("#entOwn").onclick = async () => { P.onb = { step: "area" }; await saveProfile(true); ownRoute(); };
  }
  const EMOTIONS = C.emotions.primary;
  /* Эпизод и первый план. Создаёт сюжет, если его нет. Старт практики — день записи, не дата вспомненного случая. */
  function newEpisode(arg) {
    const existing = activePattern();
    const fromCard = P.drafts && P.drafts.cardPick;
    const steps = [
      { k: "event", q: "Что случилось?", lead: fromCard ? `Ты выбрал: «${fromCard.text}»` : "Опиши наблюдаемое событие, как запись камеры. Без оценок.", type: "text", ph: fromCard ? "Что именно произошло в тот раз? Можно взять вариант выше и поправить" : "Например: коллега попросил подменить, я согласился, хотя не хотел", tags: fromCard ? [fromCard.text] : X.quickEvents, req: "Нужна короткая конкретика: что именно произошло. Можно взять готовый вариант и поправить." },
      { k: "who", q: "С кем это было?", lead: "Имя не нужно. Можно пропустить.", type: "choice", opts: X.people, own: true, optional: true },
      { k: "emotion", q: "Что ты чувствовал?", lead: C.emotions.instruction, type: "choice", opts: EMOTIONS.filter(e => e !== "Другое" && e !== "Не знаю"), own: true, unknown: true },
      { k: "intensity", q: "Насколько сильно задело?", type: "scale", lo: "0, совсем нет", hi: "10, очень", def: 5 },
      { k: "response", q: "Что ты обычно делаешь в такой момент?", type: "choice", opts: X.habitualResponses.filter(x => x !== "Другое" && x !== "Не знаю"), own: true, unknown: true },
      ...(existing ? [] : [{ k: "plan", q: "Первый шаг на сегодня", lead: "Без причины и диагноза. Просто то, что ты попробуешь, когда заденет снова.", type: "choice", opts: X.firstPlans.map(f => [f.id, f.text]), noAuto: true }]),
    ];
    flow({ id: "new", scope: existing ? existing.id : "first", steps, title: existing ? "Новый случай" : "Первый случай", onCancel: () => go(existing ? "today" : "entry"), cancelLabel: "Позже",
      onDone: async ans => {
        const ts = nowTs(), k = today();
        let p = existing;
        if (!p) {
          const plan = X.firstPlans.find(f => f.id === ans.plan) || X.firstPlans[0];
          p = { id: R.uuid(), title: shortTitle(ans.event, fromCard), packId: fromCard ? fromCard.packId : null, contexts: val(ans, "who") ? [val(ans, "who")] : [], status: "active", startDate: k, practiceStartDate: k, practiceStartOrigin: "user", createdAt: ts, hypothesisVersionId: null, experimentId: null, queue: [], firstPlan: plan, skillId: plan.skill || null, habitualResponse: val(ans, "response") || null, legacy: false };
          /* Стартовый план без слотов принят явным выбором человека; момент и действие — из стартового шаблона. */
          const f = PR.fallback[plan.id] || PR.fallback.pause;
          const x = Object.assign(R.planFromTemplate({ template: Object.assign({ catalogVersion: PR.catalogVersion }, f), kind: "fallback", patternId: p.id, lessonId: null, skillId: plan.skill || null, basisIds: [], desiredChange: "", createdAt: ts, mode: plan.id === "observe" ? "observation" : "behavior" }), { id: R.uuid(), hypothesisVersionId: null }); x.lineageId = x.id;
          const v = R.planView(x); Object.assign(x, { planStatus: "accepted", acceptedAt: ts, cue: v.cue, action: v.action, ifThen: { signal: v.cue, action: v.action } });
          p.experimentId = x.id; await saveExp(x); await savePattern(p);
          const r = { patternId: p.id, modules: { episode: { status: "done", dateKey: k, doneAt: ts, answers: { response: val(ans, "response") } } } }; await saveResearch(r);
        } else if (p.status === "observe") { p.status = "active"; p.startDate = p.startDate || k; p.practiceStartDate = p.practiceStartDate || p.startDate; if (!p.habitualResponse && val(ans, "response")) p.habitualResponse = val(ans, "response"); await savePattern(p); const r = researchOf(p); r.modules.episode = r.modules.episode || { status: "done", dateKey: k, doneAt: ts }; await saveResearch(r); }
        const fromId = P.drafts && P.drafts.fromEpisode, prev = fromId ? D.episodes.find(x => x.id === fromId) : null;
        const e = prev || { id: R.uuid(), occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), isRehearsal: false, legacy: false };
        Object.assign(e, { patternId: p.id, linkStatus: "confirmed", event: ans.event, person: val(ans, "who") || e.person || "", emotion: val(ans, "emotion") || e.emotion || null, intensity: ans.intensity, response: val(ans, "response") || null, verificationStatus: "detailed" });
        await saveEpisode(e);
        if (P.drafts) { delete P.drafts.cardPick; delete P.drafts.fromEpisode; }
        P.onb = null; P.seen.start = true; P.lastResult = { kind: "first", title: p.title, plan: planText(p) }; await saveProfile();
        go(P.seen.map ? "today" : "map");
      } });
  }
  function shortTitle(event, card) {
    const src = card ? card.text : String(event || "").trim();
    let t = src.split(/[,.;:!?]|\s[—–-]\s|\sи\s|\sа\s|\sно\s/)[0].trim();
    const w = t.split(/\s+/); if (w.length > 6) t = w.slice(0, 6).join(" ");
    if (t.length > 44) t = t.slice(0, 42).trim() + "…";
    return uc1(t) || "Мой сюжет";
  }

  const CI = C.cardInteraction, OE = OB.events, OA = OB.area, OSg = OB.sting, OPth = OB.path;
  const DECK_N = CI.firstDeck || 6, DECK_MIN = CI.minAnsweredBeforePick || 5;
  const persistOnb = () => saveProfile(true);
  const areaLabel = a => (X.areas.find(x => x[0] === a) || [])[1] || "";
  const ctxLabel = c => (X.workContexts.find(x => x[0] === c) || [])[1] || "";
  /* Черновик шага входа заполняется прежним ответом, когда человек возвращается поправить: ответы не исчезают. */
  const seedDraft = (id, ans) => { P.drafts = P.drafts || {}; const key = draftKey(id, "onb"); if (!P.drafts[key] && ans) P.drafts[key] = { i: 0, ans, at: nowTs() }; };
  /* Сфера: навигация, не тест. Конкретная ситуация — сразу свой текст. Работа — ещё один короткий выбор контекста. */
  /* Узнавание темы пути (если число известно): три ситуации пути и равноправное «Сейчас у меня другая история».
     Выбор только сужает первые примеры колоды; сюжет назначается после пяти ответов и явного подтверждения. Отклик хранится отдельно от числа. */
  const pathNum = () => P.symbolic && P.symbolic.num ? (P.symbolic.chosen || P.symbolic.num) : null;
  /* v6.4 Ветки квиза. Сфера выбирается только человеком; отклик пути хранит темы-предпочтения и сферу не назначает.
     Ветка = версия маршрутизации + сфера + рабочий контекст. Ответы другой ветки уходят в её архив и не участвуют в счётчике и выборе. */
  const RV = X.routingVersion;
  const variantById = id => X.variants.find(v => v.variantId === id) || null;
  const eventById = variantById;
  /* Урок для выбранного варианта: если сцена карточки урока не совпадает с событием, используется адаптированная карточка
     (своё название направления, действие, момент, вопрос после и подсказка дня). Источник проверки — extra.directionReview. */
  const adaptedCard = (lessonId, variantId) => (variantId && PR.adapted && PR.adapted[`${lessonId}@${variantId}`]) || null;
  const lessonView = (lessonId, variantId) => { const L = R.findLesson(C.packs, lessonId); if (!L) return null; const a = adaptedCard(lessonId, variantId); return a ? Object.assign({}, L, { title: a.lessonTitle, action: a.lessonAction, variantId, adapted: true }) : Object.assign({}, L, { variantId: variantId || null }); };
  const curKey = S => R.branchKey({ area: S.area, context: S.area === "work" ? S.ctx : null, routingVersion: RV });
  function stashBranch(S) {
    if (!S.area || S.area === "own" || !((S.picks || []).length || (S.shown || []).length)) return;
    S.branches = S.branches || {}; S.branches[curKey(S)] = { picks: S.picks || [], shown: S.shown || [], deck: S.deck || null, deckKey: S.deckKey || null, idx: S.idx || 0, at: nowTs() };
  }
  /* Смена ветки: прежние ответы сохраняются в своей ветке; зависимые ответы (случай, что задело, цель) сбрасываются; учитель переносится только совместимый. */
  function setBranch(S, area, ctx) {
    const sameArea = S.area === area;
    if (S.area !== area || (area === "work" && S.ctx !== ctx)) {
      stashBranch(S);
      S.area = area; S.ctx = area === "work" ? ctx : null;
      const b = (S.branches || {})[curKey(S)];
      Object.assign(S, b ? { picks: b.picks, shown: b.shown, deck: b.deck, deckKey: b.deckKey, idx: b.idx } : { picks: [], shown: [], deck: null, deckKey: null, idx: 0 });
      S.undo = null; S.choose = false; S.focus = null;
      const ev = S.event ? variantById(S.event) : null;
      if (S.own || (ev && ev.area !== area) || (ev && area === "work" && ctx !== "any" && !(ev.contexts || []).includes(ctx))) { S.event = null; S.own = null; S.case = null; S.sting = null; S.want = null; S.confirmed = false; }
      if (!sameArea && S.teacher && X.teacherArea[S.teacher.kind] && X.teacherArea[S.teacher.kind] !== area) S.teacher = null;
    }
    S.areaExplicit = true; S.routingVersion = RV;
  }
  function recogStart(S, item) { S.recogMain = item.id; S.preferSubtypes = item.preferSubtypes || []; S.recogDone = true; S.deck = null; S.deckKey = null; S.choose = false; }
  function area(arg) {
    const S = onb(), num = pathNum(), pr = num ? X.pathProfiles[String(num)] : null, RG = OB.recog;
    S.routingVersion = S.routingVersion || RV;
    const afterRecog = async () => { await persistOnb(); if (S.areaExplicit && S.area && S.area !== "own") return go(S.role ? "sd" : "ctx"); area(); };
    if (pr && !S.otherStory && !S.recogDone && !S.areaExplicit) {
      const sel = S.recogSel || [];
      if (S.recogPickOne && sel.length > 1) {
        app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${num} · ${esc(pr.displayName)}</p><h1 class="q">${esc(RG.pickOne)}</h1><p class="muted small">${esc(RG.pickSub)}</p><div class="chips col">${sel.map(id => `<button class="chip" data-one="${id}">${esc(pr.recognitionItems.find(i => i.id === id).text)}</button>`).join("")}</div><div class="row tight"><button class="btn ghost sm" id="rgBack">Назад</button></div>`;
        $$("[data-one]").forEach(b => b.onclick = async () => { recogStart(S, pr.recognitionItems.find(i => i.id === b.dataset.one)); S.recogPickOne = false; afterRecog(); });
        $("#rgBack").onclick = async () => { S.recogPickOne = false; await persistOnb(); area(); };
        return;
      }
      app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${num} · ${esc(pr.displayName)}</p><h1 class="q">${esc(RG.title)}</h1><p class="muted small">${esc(RG.sub)}</p>
        <div class="chips col recog">${pr.recognitionItems.map(i => `<button class="chip ${sel.includes(i.id) ? "on" : ""}" data-rg="${i.id}" aria-pressed="${sel.includes(i.id)}">${esc(i.text)}</button>`).join("")}<button class="chip dim" id="otherStory">${esc(RG.other)}</button></div>
        <div class="row"><button class="btn block" id="rgNext" ${sel.length ? "" : "disabled"}>${esc(RG.next)}</button></div>
        <div class="row tight"><a class="btn ghost sm" href="#help">${esc(OB.buttons.sos.label)}</a></div>`;
      $$("[data-rg]").forEach(b => b.onclick = async () => { const id = b.dataset.rg; S.recogSel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; await persistOnb(); area(); });
      $("#otherStory").onclick = async () => { S.otherStory = true; S.preferTopics = []; S.recogMain = null; await persistOnb(); area(); };
      $("#rgNext").onclick = async () => {
        P.pathRecognition = [...(P.pathRecognition || []), ...sel.map(id => ({ itemId: id, answer: "familiar", date: today(), pathNumber: num, contentVersion: C.contentVersion }))];
        if (sel.length === 1) { recogStart(S, pr.recognitionItems.find(i => i.id === sel[0])); return afterRecog(); }
        S.recogPickOne = true; await persistOnb(); area();
      };
      return;
    }
    const pick = async v => {
      if (v === "own") { S.ownFirst = true; S.unclearView = false; await persistOnb(); return area(); }
      if (v === "unclear") { S.unclearView = true; await persistOnb(); return area(); }
      S.unclearView = false;
      if (SB().spheres[v]) { if (S.area !== v) { setBranch(S, v, null); S.role = null; S.roleLabel = null; S.sd = null; } else S.areaExplicit = true; S.step = "ctx"; await persistOnb(); return go("ctx"); }
      setBranch(S, v, null); S.step = "cards"; await persistOnb(); go("cards");
    };
    /* «Пока трудно понять»: по одному примеру из каждой сферы, подписанному сферой. Выбор — явный, колода — только этой сферы. */
    if (S.unclearView) {
      const ex = R.QUIZ_AREAS.map(a => [a, R.selectDeck({ variants: X.variants, area: a, context: a === "work" ? "any" : null, seed: S.seed || 0, limit: 1 }).cards[0]]);
      app.innerHTML = `<h1 class="q">${esc(OA.unclearTitle)}</h1><p class="muted small">${esc(OA.unclearSub)}</p>
        <div class="chips col">${ex.map(([a, c]) => `<button class="chip" data-v="${a}"><b>${esc(areaLabel(a))}</b><br><span class="small muted">например: ${esc(lc1(c ? c.text : ""))}</span></button>`).join("")}<button class="chip dim" data-v="own">${esc(OA.ownCta)}</button></div>
        <div class="row tight"><button class="btn ghost sm" id="ucBack">Назад</button></div>`;
      $$("[data-v]").forEach(b => b.onclick = () => pick(b.dataset.v));
      $("#ucBack").onclick = async () => { S.unclearView = false; await persistOnb(); area(); };
      return;
    }
    const cur = S.areaExplicit ? S.area : null;
    app.innerHTML = `${pr ? `<p class="tiny" style="margin:0 0 4px">${num} · ${esc(pr.displayName)}</p>` : ""}<h1 class="q">${esc(S.ownFirst ? "Где это происходит?" : OA.title)}</h1><p class="muted small">${esc(S.ownFirst ? "Свой случай опишешь сам — сначала выберем сферу и учителя." : OA.sub)}</p>
      <div class="chips col">${X.areas.filter(([v]) => !S.ownFirst || SB().spheres[v]).map(([v, l]) => `<button class="chip ${cur === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}</div>
      <div class="row tight"><a class="btn ghost sm" href="#help">${esc(OB.buttons.sos.label)}</a>${pr ? `<button class="btn ghost sm" id="backRecog">${esc(RG.title)}</button>` : ""}</div>`;
    const br = $("#backRecog"); if (br) br.onclick = async () => { S.otherStory = false; S.recogDone = false; S.areaExplicit = false; S.recogSel = []; await persistOnb(); area(); };
    $$("[data-v]").forEach(b => b.onclick = () => pick(b.dataset.v));
  }
  /* Работа и общение: где именно напряжение. «По-разному» — любые рабочие примеры, не любые сферы. */
  function workctx() {
    const S = onb(); if (S.area !== "work") return go("area");
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(areaLabel("work"))}</p><h1 class="q">${esc(OB.workctx.title)}</h1><p class="muted small">${esc(OB.workctx.sub)}</p>
      <div class="chips col">${X.workContexts.map(([v, l]) => `<button class="chip ${S.ctx === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}</div>
      <div class="row tight"><a class="btn ghost sm" href="#area">Другая сфера</a><a class="btn ghost sm" href="#own">${esc(OE.own)}</a></div>`;
    $$("[data-v]").forEach(b => b.onclick = async () => { const v = b.dataset.v; if (S.ctx !== v) setBranch(S, "work", v); else { S.areaExplicit = true; S.routingVersion = RV; } S.step = dialogFor(S) ? "dialog" : "cards"; await persistOnb(); go(S.step); });
  }
  const deckOpts = S => ({ variants: X.variants, area: S.area, context: S.area === "work" ? S.ctx : null, preferredSubtypes: S.preferSubtypes || [], focus: S.focus || null, excludeSubtypes: S.excludedSubtypes || [], seed: S.seed, subtypes: X.subtypes, mainSubtypes: X.areaMainSubtypes[S.area] || [] });
  /* Новая колода: только допустимые карточки ветки, без уже показанных. Пустой пул — честное исчерпание, без чужих сфер и без сброса показанного. */
  function newDeck(S) {
    if (!S.seed) S.seed = `${P.installId || "x"}:${nowTs()}`;
    const res = R.selectDeck(Object.assign(deckOpts(S), { exclude: S.shown || [], limit: DECK_N }));
    S.deck = res.cards; S.deckKey = curKey(S); S.idx = 0; S.picks = S.picks || []; S.undo = null; S.choose = false; S.offer = null; S.exhausted = !res.cards.length;
    S.shown = [...(S.shown || []), ...res.cards.map(c => c.id)];
  }
  const moreLeft = S => R.selectDeck(Object.assign(deckOpts(S), { exclude: S.shown || [], limit: 1 })).cards.length > 0;
  /* Восстановленная колода проверяется: другая ветка или устаревшие карточки — перестраиваем, сохраняя совместимые ответы. */
  function checkDeck(S) {
    if (!S.deck) return;
    const ok = R.restoreDeck({ deck: S.deck, savedKey: S.deckKey, variants: X.variants, area: S.area, context: S.area === "work" ? S.ctx : null, routingVersion: RV }).valid;
    if (ok) return;
    const allowed = new Set(R.eligibleVariants({ variants: X.variants, area: S.area, context: S.area === "work" ? S.ctx : null }).map(v => v.variantId));
    const keep = (S.picks || []).filter(p => allowed.has(p.id)), drop = (S.picks || []).filter(p => !allowed.has(p.id));
    if (drop.length) { S.archive = S.archive || []; S.archive.push({ key: S.deckKey || "unknown", picks: drop, at: nowTs() }); }
    S.picks = keep; S.shown = (S.shown || []).filter(id => allowed.has(id) && keep.some(p => p.id === id)); S.deck = null; S.rebuilt = true;
  }
  const branchCandidates = S => R.deckCandidates(S).filter(p => { const v = variantById(p.id); return v && v.area === S.area; });
  /* Чекап: шесть событий выбранной сферы, ответ «знакомо / не про меня / не уверен» — первичное узнавание, не триггер и не тест. */
  /* =================== v6.8 Карточка-свайп: один вопрос «Эта ситуация тебе знакома?» ===================
     Вправо — «Знакомо», влево — «Не про меня», «Не уверен» — отдельная кнопка. Подсветка и значок на самой карточке во время движения;
     до порога ответ не принят; кнопки и клавиши ← / → (в фокусе карточки) вызывают тот же обработчик; двойная запись заблокирована. */
  const SW = () => OB.swipe;
  const swAns = r => r === "yes" ? SW().ansYes : r === "no" ? SW().ansNo : SW().ansUnsure;
  function swipeHTML({ text, label, prev, tutorial }) {
    const W = SW(), red = reduce();
    return `<p class="swinstr" id="swInstr">${esc(W.instr)}</p>
      ${tutorial ? `<div class="swtut" id="swTut" aria-hidden="true"><div class="swtut-h"><b>${esc(W.tutTitle)}</b> <span class="tiny">${esc(W.tutSample)}</span></div><div class="swtut-card ${red ? "static" : "play"}"><span class="swtut-badge r">${esc(W.yes)}</span><span class="swtut-badge l">${esc(W.no)}</span><span class="swtut-line"></span><span class="swtut-line short"></span></div><p class="tiny" style="margin:4px 0 0">${esc(W.tutCaption)}</p></div>` : ""}
      <div class="swwrap"><div class="swcard" id="swc" tabindex="0" role="group" aria-roledescription="карточка" aria-label="${esc(label || text)}"><div class="swband"><span class="swbadge" id="swBadge" aria-hidden="true"></span></div><div class="swtext">${esc(text)}</div></div></div>
      <div class="sw2"><button class="btn secondary swbtn" id="no" aria-label="Не про меня">${esc(W.no)}</button><button class="btn secondary swbtn" id="yes" aria-label="Знакомо">${esc(W.yes)}</button></div>
      <div class="row tight" style="justify-content:center"><button class="btn ghost sm" id="unsure">${esc(W.unsure)}</button><button class="linkbtn tiny" id="swReplay">${esc(W.tutReplay)}</button></div>
      <div class="swstatus" id="swStatus">${prev ? `${esc(W.prev.replace("{a}", swAns(prev)))} · <button class="linkbtn" id="undo">${esc(W.undo)}</button>` : ""}</div>
      <div class="sr" aria-live="polite" id="swLive"></div>`;
  }
  /* onAnswer(r) — асинхронная запись; при ошибке карточка остаётся. onUndo — отмена предыдущего ответа. */
  function bindSwipe({ onAnswer, onUndo, announce }) {
    const sw = $("#swc"), badge = $("#swBadge"), W = SW(), red = reduce(); if (!sw) return;
    let busy = false, sx = null, sy = null, mode = null, dx = 0, pid = null;
    const th = () => Math.max(64, Math.min(100, 0.25 * sw.getBoundingClientRect().width));
    /* Образец останавливается сразу при касании (без сдвига карточки под пальцем) и сворачивается после жеста. */
    const pauseTut = () => { const t = $("#swTut"); if (t) t.classList.add("stopped"); };
    const stopTut = () => { const t = $("#swTut"); if (t) t.remove(); };
    const paint = d => {
      const k = Math.min(1, Math.abs(d) / th()), side = d > 0 ? "r" : d < 0 ? "l" : "";
      sw.classList.toggle("is-r", side === "r"); sw.classList.toggle("is-l", side === "l"); sw.style.setProperty("--k", k.toFixed(2));
      const ready = Math.abs(d) >= th(); sw.classList.toggle("ready", ready);
      badge.textContent = side ? (ready ? (side === "r" ? W.releaseYes : W.releaseNo) : (side === "r" ? W.yes : W.no)) : "";
      sw.style.transform = red ? "" : `translateX(${d}px) rotate(${Math.max(-6, Math.min(6, d / 20))}deg)`;
    };
    const reset = () => { if ($("#swTut") && $("#swTut").classList.contains("stopped")) stopTut(); sx = sy = null; mode = null; dx = 0; pid = null; sw.classList.remove("drag", "is-r", "is-l", "ready"); sw.style.transform = ""; sw.style.removeProperty("--k"); badge.textContent = ""; };
    const answer = async r => {
      if (busy) return; busy = true; stopTut();
      if (r !== "unsure") { sw.classList.add(r === "yes" ? "is-r" : "is-l", "ready"); sw.style.setProperty("--k", "1"); badge.textContent = r === "yes" ? W.yes : W.no; }
      let ok = true; try { ok = (await onAnswer(r)) !== false; } catch (e) { ok = false; }
      if (!ok) { busy = false; reset(); const st = $("#swStatus"); if (st) st.textContent = W.saveErr; return; }
      if (announce) { const lv = $("#swLive"); if (lv) lv.textContent = announce(r); }
      if (!red && r !== "unsure") sw.classList.add(r === "yes" ? "out-r" : "out-l");
    };
    $("#yes").onclick = () => answer("yes"); $("#no").onclick = () => answer("no"); $("#unsure").onclick = () => answer("unsure");
    const un = $("#undo"); if (un) un.onclick = () => { if (!busy && onUndo) onUndo(); };
    const rp = $("#swReplay"); if (rp) rp.onclick = () => { stopTut(); $("#swInstr").insertAdjacentHTML("afterend", `<div class="swtut" id="swTut" aria-hidden="true"><div class="swtut-h"><b>${esc(W.tutTitle)}</b> <span class="tiny">${esc(W.tutSample)}</span></div><div class="swtut-card ${red ? "static" : "play"}"><span class="swtut-badge r">${esc(W.yes)}</span><span class="swtut-badge l">${esc(W.no)}</span><span class="swtut-line"></span><span class="swtut-line short"></span></div><p class="tiny" style="margin:4px 0 0">${esc(W.tutCaption)}</p></div>`); };
    sw.onkeydown = e => { if (e.target !== sw) return; if (e.key === "ArrowRight") { e.preventDefault(); answer("yes"); } if (e.key === "ArrowLeft") { e.preventDefault(); answer("no"); } };
    sw.onpointerdown = e => { pauseTut(); if (busy || e.button) return; if (pid !== null && e.pointerId !== pid) { reset(); return; } /* второй палец отменяет жест */ pid = e.pointerId; sx = e.clientX; sy = e.clientY; mode = null; dx = 0; };
    sw.onpointermove = e => {
      if (sx == null || e.pointerId !== pid) return; const ddx = e.clientX - sx, ddy = e.clientY - sy;
      if (!mode) { if (Math.abs(ddx) > 10 && Math.abs(ddx) > 1.3 * Math.abs(ddy)) { mode = "h"; sw.classList.add("drag"); try { sw.setPointerCapture(pid); } catch (_) {} } else if (Math.abs(ddy) > 10) { mode = "v"; return; } else return; }
      if (mode !== "h") return; e.preventDefault(); dx = ddx; paint(dx);
    };
    sw.onpointerup = e => { if (e.pointerId !== pid) return; const m = mode, d = dx; try { sw.releasePointerCapture(pid); } catch (_) {} if (m === "h" && Math.abs(d) >= th()) { pid = null; sx = null; mode = null; answer(d > 0 ? "yes" : "no"); } else reset(); };
    sw.onpointercancel = () => reset();
    /* отпускание вне карточки (вертикальная прокрутка, уход указателя) — жест без ответа */
    const offUp = e => { if (pid !== null && e.pointerId === pid && mode !== "h") reset(); }; if (window.__swOff) { window.removeEventListener("pointerup", window.__swOff); window.removeEventListener("pointercancel", window.__swOff); } window.__swOff = offUp; window.addEventListener("pointerup", offUp); window.addEventListener("pointercancel", offUp); sw.onlostpointercapture = () => { if (mode === "h" && !busy && !sw.classList.contains("out-r") && !sw.classList.contains("out-l") && pid !== null) reset(); };
    const vis = () => { if (document.hidden && !busy) reset(); }; document.addEventListener("visibilitychange", vis, { once: true });
  }
  function cards() {
    const S = onb(); if (!S.area || !S.areaExplicit || S.area === "own") return go("area"); if (S.area === "work" && !S.ctx) return go("workctx");
    checkDeck(S); if (!S.deck) newDeck(S);
    if (S.rebuilt) { S.rebuilt = false; setTimeout(() => toast(OB.deck.branchRebuilt), 50); }
    const deck = S.deck; let busy = false;
    const answered = () => (S.picks || []).length;
    const cands = () => branchCandidates(S);
    const canPick = () => answered() >= Math.min(DECK_MIN, deck.length) && cands().length > 0;
    const render = () => {
      S.offer = null;
      if (S.choose) return choose();
      if (S.idx >= deck.length) return cands().length ? choose() : nothingFits();
      const c = deck[S.idx], tut = !P.seen.swipe, red = reduce(), first = !answered();
      const ctxTxt = areaLabel(S.area) + (S.area === "work" && S.ctx && S.ctx !== "any" ? ` · ${ctxLabel(S.ctx)}` : "");
      const prev = S.undo ? S.undo.r : null;
      app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${S.idx + 1} из ${deck.length} · ${esc(ctxTxt)}</p>
        <h1 class="q">${esc(OE.title)}</h1><p class="muted small" style="margin:0 0 6px">${first ? esc(OE.intro) : esc(OE.sub)}</p>
        ${swipeHTML({ text: c.text, prev, tutorial: tut })}
        ${canPick() ? `<div class="row tight"><button class="btn secondary block sm" id="pick">${esc(OE.pick)} (${cands().length})</button></div>` : (cands().length ? `<p class="tiny" style="margin:4px 0 0;text-align:center">${esc(Math.min(DECK_MIN, deck.length) - answered() === 1 && OE.minHint1 ? OE.minHint1 : OE.minHint)}</p>` : "")}
        ${threeNo() ? `<div class="row tight"><button class="btn secondary block sm" id="refine">${esc(OB.refine.cta)}</button></div>` : ""}
        <div class="row tight"><a class="btn ghost sm" href="#own">${esc(OE.own)}</a><a class="btn ghost sm" href="${S.area === "work" ? "#workctx" : S.area === "close" && famBank() ? "#closectx" : "#area"}">${S.area === "work" || (S.area === "close" && famBank()) ? "Другой контекст" : "Другая сфера"}</a>${S.area === "close" && S.famRole && S.famRole !== "child" && famBank() ? `<a class="btn ghost sm" href="#fdialog">${esc(OB.family.start)}</a>` : ""}${dialogFor(S) ? `<a class="btn ghost sm" href="#dialog">${esc(OB.dialog.start)}</a>` : ""}</div>
        ${first ? readingCard("karma-scene") : ""}`;
      $("#swc").dataset.variant = c.id;
      /* Сначала запись, потом счётчик: ответ сохраняется до перехода к следующей карточке. */
      bindSwipe({
        onAnswer: async r => {
          if (!R.deckAnswer(S, r)) return false;
          const last = S.picks[S.picks.length - 1]; if (last) { last.variantId = c.id; last.area = c.area; }
          if (tut) P.seen.swipe = true;
          const ok = await persistOnb(); if (ok === false) { R.deckUndo(S); return false; }
          setTimeout(render, red ? 0 : 230); return true;
        },
        onUndo: () => { if (R.deckUndo(S)) { persistOnb(); render(); } },
        announce: r => `${OB.swipe.prev.replace("{a}", swAns(r))}.`,
      });
      const pk = $("#pick"); if (pk) pk.onclick = () => { S.choose = true; persistOnb(); choose(); };
      const rf = $("#refine"); if (rf) rf.onclick = () => refine();
    };
    /* Три «не про меня» подряд — необязательное «Уточнить, что искать»: подтипы текущей сферы/контекста, где ещё есть примеры. */
    const threeNo = () => { const ps = S.picks || []; return ps.length >= 3 && ps.slice(-3).every(x => x.r === "no"); };
    /* v6.7: «Не про меня» относится к карточке, не к типу. Все типы ветки остаются в «Уточнить, что искать»;
       тип исключается только явной кнопкой «Тема не про меня». Если примеров типа больше нет — свой случай (для руководителя — вопросы). */
    const refine = () => {
      const pool = R.eligibleVariants({ variants: X.variants, area: S.area, context: S.area === "work" ? S.ctx : null });
      const mainL = X.areaMainSubtypes[S.area] || [], rank = k => { const i = mainL.indexOf(k); return i < 0 ? 100 : i; };
      const excl = S.excludedSubtypes || [];
      const subs = [...new Set(pool.map(v => v.subtype))].filter(k => k && !excl.includes(k)).sort((a, b) => rank(a) - rank(b));
      const left = k => pool.some(v => v.subtype === k && (!(S.shown || []).includes(v.variantId) || deck.slice(S.idx).some(c => c.id === v.variantId)));
      const row = k => `<div class="strow"><button class="chip" data-st="${k}">${esc(X.subtypes[k].label)}</button><button class="linkbtn tiny" data-nm="${k}" aria-label="${esc(OB.refine.notMine)}: ${esc(X.subtypes[k].label)}">${esc(OB.refine.notMine)}</button></div>`;
      app.innerHTML = `<h1 class="q">${esc(OB.refine.title)}</h1><p class="muted small">${esc(OB.refine.sub)}</p>
        <div class="chips col">${subs.slice(0, 6).map(row).join("")}</div>
        ${subs.length > 6 ? `<details class="plain"><summary>Ещё виды · ${subs.length - 6}</summary><div class="chips col">${subs.slice(6).map(row).join("")}</div></details>` : ""}
        <div id="rfMsg"></div>
        <div class="chips col"><a class="chip dim" href="#own">${esc(OB.refine.own)}</a>${dialogFor(S) ? `<a class="chip dim" href="#dialog">${esc(OB.dialog.start)}</a>` : ""}</div>
        <div class="row tight"><button class="btn ghost" id="rfBack">${esc(OB.refine.cont)}</button></div>`;
      $$("[data-st]").forEach(b => b.onclick = () => {
        const k = b.dataset.st;
        if (!left(k)) { $("#rfMsg").innerHTML = `<p class="small" style="margin:6px 0">${esc(OB.refine.empty)}</p>`; return; }
        S.focus = k; S.shown = (S.shown || []).filter(id => !deck.slice(S.idx).some(c => c.id === id)); newDeck(S); persistOnb(); cards();
      });
      $$("[data-nm]").forEach(b => b.onclick = () => { S.excludedSubtypes = [...new Set([...(S.excludedSubtypes || []), b.dataset.nm])]; persistOnb(); refine(); });
      $("#rfBack").onclick = () => render();
    };
    const altLinks = () => `<a class="btn block secondary" href="#own">${esc(OE.own)}</a><a class="btn block secondary" href="${S.area === "work" ? "#workctx" : "#area"}">${S.area === "work" ? "Другой контекст" : OB.deck.changeArea}</a>`;
    const reviewList = ns => ns.length ? `<details class="plain"><summary>${esc(OSg.notStung)} · ${ns.length}</summary><div class="chips col">${ns.map(x => `<button class="chip dim" data-rs="${esc(x.id)}">${esc(x.text)} — пересмотреть</button>`).join("")}</div></details>` : "";
    const moreBtn = id => moreLeft(S) ? `<button class="btn block" id="${id}">${esc(OE.moreEvents)}</button>` : "";
    /* Ничего не зацепило — нормальный результат: ещё примеры этой сферы (если есть), свои слова, другая сфера или наблюдение. Найденный триггер не объявляется. */
    const nothingFits = () => {
      if (S.focus && !moreLeft(S)) { S.focus = null; persistOnb(); }
      const ns = R.deckNotStung(S), left = moreLeft(S);
      const short = left && deck.length < 6;
      app.innerHTML = `<h1 class="q">${ns.length ? esc(OSg.notStung) : short ? esc(OB.deck.distinctEnd) : left ? "Ничего не зацепило" : esc(OB.deck.exhausted)}</h1><p>${esc(short ? OB.deck.distinctText : left ? OE.none : OB.deck.exhaustedText)}</p>
        <div class="chips col"><button class="btn block secondary" id="refine2">${esc(OB.refine.cta)}</button>${moreBtn("more")}${altLinks()}${dialogFor(S) ? `<a class="btn block secondary" href="#dialog">${esc(OB.dialog.start)}</a>` : ""}<button class="btn block secondary" id="observe">${esc(OE.observe)}</button></div>
        ${reviewList(ns)}${S.undo ? `<div class="row tight"><button class="btn ghost sm" id="undo">${esc(OE.undo)}</button></div>` : ""}`;
      const m = $("#more"); if (m) m.onclick = () => { newDeck(S); persistOnb(); cards(); };
      $("#refine2").onclick = () => refine();
      $("#observe").onclick = () => observeMode();
      bindReview();
      const un = $("#undo"); if (un) un.onclick = () => { if (R.deckUndo(S)) { persistOnb(); render(); } };
    };
    /* Горячая точка: из отмеченных в этой ветке — одна на неделю; остальное сохраняется на потом. */
    const choose = () => {
      const ys = cands(), ns = R.deckNotStung(S);
      if (!ys.length) { S.choose = false; return nothingFits(); }
      app.innerHTML = `<h1 class="q">${esc(OE.which)}</h1><p class="muted small">${esc(OE.whichSub)}</p>
        <div class="chips col">${ys.map((x, i) => `<button class="chip" data-i="${i}">${esc(x.text)}</button>`).join("")}</div>
        ${reviewList(ns)}
        <div class="row tight">${S.idx < deck.length ? `<button class="btn ghost sm" id="back">Досмотреть события</button>` : (moreLeft(S) ? `<button class="btn ghost sm" id="more">${esc(OE.moreEvents)}</button>` : "")}<a class="btn ghost sm" href="#own">${esc(OE.own)}</a></div>
        ${S.undo ? `<div class="row tight"><button class="btn ghost sm" id="undo">${esc(OE.undo)}</button></div>` : ""}`;
      $$(".chip[data-i]").forEach(b => b.onclick = () => pickEvent(ys[Number(b.dataset.i)].id));
      bindReview();
      const bk = $("#back"); if (bk) bk.onclick = () => { S.choose = false; persistOnb(); render(); };
      const m = $("#more"); if (m) m.onclick = () => { newDeck(S); persistOnb(); cards(); };
      const un = $("#undo"); if (un) un.onclick = () => { if (R.deckUndo(S)) { S.choose = false; persistOnb(); render(); } };
    };
    const bindReview = () => $$("[data-rs]").forEach(b => b.onclick = () => { const pk = (S.picks || []).find(x => x.id === b.dataset.rs); if (pk) { delete pk.notStung; persistOnb(); } pickEvent(b.dataset.rs); });
    /* Выбор фокуса: дальше все уточнения относятся к выбранному варианту карточки. */
    /* v7: пример из колоды — подсказка вспомнить; дальше тот же единый маршрут (текст карточки — описание сцены, человек может поправить) */
    const pickEvent = async (variantId) => { const v = variantById(variantId); S.deckPick = v ? v.text : ""; S.offer = null; S.choose = false;
      /* колода с конкретным рабочим контекстом уже назвала учителя — не спрашиваем роль повторно */
      const ctxRole = { boss: "boss", colleagues: "colleague", clients: "client" }[S.ctx];
      if (!S.role && S.area === "work" && ctxRole) S.role = ctxRole;
      await persistOnb(); if (!S.role || !SB().spheres[S.area]) { S.step = "ctx"; await persistOnb(); return go("ctx"); } S.sd = null; S.step = "sd"; await persistOnb(); go("sd"); };
    if (!deck.length) return nothingFits();
    render();
  }
  /* Своя ситуация: текст — полноценный вход, без колоды. Дальше те же уточнения: учитель, когда было, что задело. */
  /* =================== v6.7 прототип: адаптивный диалог «работа → руководитель» ===================
     Один вопрос на экране. Ответы сохраняются в onb.dialog и пересчитываются R.dialogNext; «Назад» отменяет последний ответ.
     Колода примеров остаётся необязательной — диалог и колода не идут друг за другом. Резюме — только из ответов. */
  const dialogFor = S => S && S.area === "work" && S.ctx === "boss" ? (X.dialogs || {})["work:boss"] || null : null;
  const lessonTitleFor = (id, vid) => { const l = lessonView(id, vid); return l ? l.title : id; };
  const lessonActionFor = (id, vid) => { const l = lessonView(id, vid); return l ? uc1(l.action) : id; };
  function sparkHTML(state) {
    const D = OB.dialog;
    if (P.sparkOff) return `<div class="spark off"><button class="linkbtn tiny" id="sparkTgl">${esc(D.show)}</button></div>`;
    return `<div class="spark ${state || "listen"}" aria-label="${esc(D.spark)}"><span class="spark-orb" aria-hidden="true"><i></i></span><div><b>${esc(D.spark)}</b> <span class="tiny">· ${esc(D.sparkRole)}</span><br><span class="small" id="sparkSay">${esc(D.say[state] || D.say.listen)}</span></div><button class="linkbtn tiny" id="sparkTgl">${esc(D.hide)}</button></div>`;
  }
  const bindSpark = () => { const t = $("#sparkTgl"); if (t) t.onclick = async () => { P.sparkOff = !P.sparkOff; await saveProfile(true); dialog(); }; };
  function dialog() {
    const S = onb(), B = dialogFor(S), D = OB.dialog;
    if (!B) return go(S.area ? "cards" : "area");
    if (!S.dialog) S.dialog = { bank: B.id, bankVersion: B.version, answers: {}, order: [], rejected: [], misses: 0, status: "intro", startedAt: nowTs() };
    const st = S.dialog;
    if (st.status === "intro") {
      app.innerHTML = `${sparkHTML("listen")}<p class="tiny" style="margin:0 0 4px">${esc(areaLabel("work"))} · ${esc(ctxLabel("boss"))}</p><h1 class="q">${esc(D.introTitle)}</h1><p>${esc(D.intro)}</p>
        <div class="row"><button class="btn block" id="dStart">${esc(D.start)}</button></div>
        <div class="chips col"><a class="chip" href="#own">${esc(D.own)}</a><a class="chip dim" href="#cards" id="dExamples">${esc(D.examples)}</a></div>
        <div class="row tight"><a class="btn ghost sm" href="#workctx">Другой контекст</a></div>`;
      bindSpark(); $("#dStart").onclick = async () => { st.status = "asking"; await persistOnb(); dialog(); }; return;
    }
    const res = R.dialogNext(B, st, { variants: X.variants, lessonOf: lessonTitleFor, actionOf: lessonActionFor }), q = res.next, f = res.fields;
    const answer = async (qid, v, text) => { R.dialogAnswer(st, qid, v, text); st.status = "asking"; const ok = await persistOnb(); dialog(); return ok !== false; };
    const back = async () => { if (st.status === "summary" || st.status === "step") st.status = "asking"; R.dialogUndo(st); await persistOnb(); dialog(); };
    const head = sparkState => `${sparkHTML(sparkState)}<div class="row tight" style="justify-content:space-between;margin:0 0 4px"><span class="tiny" id="dQn">${res.done || q.kind === "noEvent" || q.kind === "unsupported" ? `Вопросов: ${res.asked}` : esc(D.qn.replace("{n}", res.asked + 1))}</span>${st.order.length ? `<button class="linkbtn tiny" id="dBack">${esc(D.back)}</button>` : `<a class="linkbtn tiny" href="#workctx">${esc(D.back)}</a>`}</div>`;
    const bindHead = () => { bindSpark(); const b = $("#dBack"); if (b) b.onclick = back; };
    const lbl = v => v === "__unknown" ? (q.id === "type" ? D.typeUnknown : D.unknown) : v === "__unsure" ? D.unsureMeaning : v === "__observe" ? D.observe : null;
    if (q.kind === "choice" || q.kind === "when") {
      /* ownStep: своя цель показана дословно; «своё действие» — отдельное поле ввода, не вариант */
      const isOS = q.id === "ownStep";
      const opts = q.kind === "when" ? X.lastTime : q.options.filter(([v]) => v !== "__ownAction").map(([v, t]) => [v, (String(t).startsWith("__") ? lbl(t) : null) || (q.id === "desire" && v.startsWith("L:") ? "Учиться " + t : t)]);
      if (isOS) q.own = true;
      const title = { type: D.qType, meaning: D.qMeaning, reaction: D.qReaction, desire: D.qDesire, when: D.qWhen, ownStep: D.qOwnStep }[q.id] || "";
      const lead = isOS ? D.ownGoalLead.replace("{g}", R.trimEnd(q.goal)) : q.id === "meaning" || q.id === "reaction" || q.id === "desire" ? `«${f.eventText}»` : "";
      app.innerHTML = `${head("listen")}${lead ? `<p class="tiny" style="margin:0 0 4px">${esc(lead)}</p>` : ""}<h1 class="q">${esc(title)}</h1>
        <div class="chips col" id="dOpts">${opts.map(([v, t]) => `<button class="chip ${(st.answers[q.id] || {}).v === v ? "on" : ""}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}${q.own ? `<button class="chip dim" id="dOwn">${esc(isOS ? D.ownAction : D.own)}</button>` : ""}</div>
        ${isOS ? `<p class="tiny muted" style="margin:6px 0 0">${esc(D.ownStepNote)}</p>` : ""}<div id="dOwnBox"></div>`;
      bindHead();
      $$("#dOpts [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v));
      const ow = $("#dOwn"); if (ow) ow.onclick = () => { $("#dOwnBox").innerHTML = `<textarea id="dOwnT" placeholder="${esc(isOS ? D.ownActionPh : D.ownPh)}"></textarea><div class="row tight"><button class="btn secondary sm" id="dOwnOk">Готово</button></div>`; $("#dOwnT").focus(); $("#dOwnOk").onclick = () => { const t = $("#dOwnT").value.trim(); if (!t) return toast("Напиши пару слов"); answer(q.id, isOS ? "__ownAction" : "__own", t); }; };
      return;
    }
    if (q.kind === "yn") {
      app.innerHTML = `${head(q.id.startsWith("n:") ? "think" : "listen")}<h1 class="q">${esc(q.text)}</h1><div class="chips col" id="dYn">${D.yn.map(([v, t]) => `<button class="chip" data-v="${v}">${esc(t)}</button>`).join("")}</div>`;
      bindHead(); $$("#dYn [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v)); return;
    }
    if (q.kind === "swipe") {
      const lastQ = st.order[st.order.length - 1], prev = lastQ && lastQ.startsWith("e:") && st.answers[lastQ] ? st.answers[lastQ].v : null;
      app.innerHTML = `${head("listen")}<h1 class="q">${esc(D.qEvent)}</h1>${swipeHTML({ text: q.text, prev, tutorial: !P.seen.swipe })}`;
      bindHead();
      bindSwipe({ onAnswer: async r => { P.seen.swipe = true; R.dialogAnswer(st, q.id, r); const ok = await persistOnb(); if (ok === false) { R.dialogUndo(st); return false; } setTimeout(dialog, reduce() ? 0 : 230); return true; }, onUndo: back, announce: r => OB.swipe.prev.replace("{a}", swAns(r)) });
      return;
    }
    if (q.kind === "noEvent" || q.kind === "unsupported") {
      const ne = q.kind === "noEvent";
      app.innerHTML = `${head("think")}<h1 class="q">${esc(ne ? D.noEvent : D.unsupported)}</h1><p>${esc(ne ? D.noEventText : D.unsupportedText)}</p>
        <div class="chips col">${ne ? `<button class="btn block secondary" id="dOther">${esc(D.otherType)}</button>` : ""}<a class="btn block secondary" href="#own">${esc(D.own)}</a><a class="btn block secondary" href="#cards">${esc(D.examples)}</a><button class="btn block secondary" id="dObs">${esc(D.observe)}</button></div>`;
      bindHead();
      const o = $("#dOther"); if (o) o.onclick = async () => { Object.keys(st.answers).filter(k => k === "type" || k.startsWith("e:") || k.startsWith("n:")).forEach(k => { delete st.answers[k]; }); st.order = st.order.filter(k => st.answers[k]); await persistOnb(); dialog(); };
      $("#dObs").onclick = () => observeMode();
      return;
    }
    /* резюме: «Кажется, я уловил твой сюжет» — только из ответов */
    if (st.status !== "step") {
      st.status = "summary";
      const sum = R.dialogSummary(f, D);
      const basisTxt = res.basis.filter(x => x.q === "event" || x.q === "meaning" || x.q === "reaction").map(x => x.q === "event" ? `выбрал пример «${x.a}»` : x.q === "meaning" ? `отметил «${x.a}»` : `рассказал: «${x.a}»`);
      const misses = st.misses || 0;
      app.innerHTML = `${head("summary")}<div class="card mark" id="dSummary"><p style="margin:0 0 6px"><b>${esc(D.sumTitle)}</b></p><p style="margin:0 0 8px" id="dSumText">${esc(sum)}</p>
          <details class="plain"><summary>${esc(D.basis)}</summary><p class="small" style="margin:0" id="dBasis">${esc(uc1(basisTxt.join("; ")))}.</p></details></div>
        <p style="margin:8px 0 4px"><b>${esc(D.sumAsk)}</b></p>
        <div class="chips col"><button class="chip" id="dYes">${esc(D.yes)}</button><button class="chip" id="dAlmost">${esc(D.almost)}</button><button class="chip dim" id="dMiss">${esc(D.miss)}</button></div><div id="dFix"></div>`;
      bindHead();
      const fixChips = all => { $("#dFix").innerHTML = `<p class="small muted" style="margin:6px 0 4px">${esc(D.fixWhat)}</p><div class="chips">${[["event", D.fixEvent], ["meaning", D.fixMeaning], ["reaction", D.fixReaction], ["desire", D.fixDesire]].concat(all ? [["all", D.fixAll]] : []).map(([k, t]) => `<button class="chip" data-fx="${k}">${esc(t)}</button>`).join("")}</div>`;
        $$("[data-fx]").forEach(b => b.onclick = async () => { R.dialogFix(st, b.dataset.fx); st.status = "asking"; await persistOnb(); toast(D.say.fix); dialog(); }); };
      $("#dYes").onclick = async () => { st.status = "step"; st.confirmedAt = nowTs(); await persistOnb(); dialog(); };
      $("#dAlmost").onclick = () => fixChips(false);
      $("#dMiss").onclick = async () => {
        if (misses >= 1) { st.misses = misses + 1; await persistOnb(); app.innerHTML = `${sparkHTML("think")}<p id="dMissTwice">${esc(D.missTwice)}</p><div class="chips col"><a class="btn block secondary" href="#own">${esc(D.own)}</a><button class="btn block secondary" id="dObs2">${esc(D.observe)}</button><button class="btn ghost" id="dRetry">${esc(D.fixWhat)}</button></div>`; bindSpark(); $("#dObs2").onclick = () => observeMode(); $("#dRetry").onclick = () => { dialog(); setTimeout(() => { const a = $("#dAlmost"); if (a) a.click(); }, 0); }; return; }
        st.misses = misses + 1; await persistOnb(); fixChips(true);
      };
      return;
    }
    /* подтверждённая история → предложение шага: подтверждение истории ≠ согласие с методом */
    const vid = f.variantId, ownG = f.desire.kind === "own", L = (f.desire.kind === "lesson" || (ownG && f.desire.lessonId && !f.desire.observeStep)) ? lessonView(f.desire.lessonId, vid) : null;
    const tpl = L ? templateFor(L, { event: vid, sting: {} }) : null, card = tpl && !(ownG && f.desire.ownAction) ? tpl.template : null;
    const firstStep = ownG && f.desire.ownAction ? uc1(f.desire.ownAction) : L ? uc1(L.action) : (f.meaning && f.meaning.observe ? uc1(f.meaning.observe.action) : uc1(X.lessonObserve.action));
    app.innerHTML = `${head("support")}<h1 class="q">${esc(D.stepTitle)}</h1>
      <div class="card mark" id="dStep"><div class="plines">
        <div><span>${esc(D.stepTeacher)}:</span> руководитель</div>
        <div><span>${esc(ownG ? D.stepGoal : D.stepLesson)}:</span> ${esc(ownG ? `«${R.trimEnd(f.desire.text)}»` : L ? L.title : X.lessonObserve.headline)}</div>
        <div><span>${esc(D.stepFirst)}:</span> ${esc(firstStep)}</div>
        ${card && card.afterQuestion ? `<div><span>${esc(D.stepCheck)}:</span> ${esc(card.afterQuestion)}</div>` : ownG && f.desire.ownAction ? `<div><span>${esc(D.stepCheck)}:</span> ${esc(D.ownCheck)}</div>` : ""}
      </div></div>
      <div class="row"><button class="btn block" id="dOk">${esc(D.stepOk)}</button></div>
      <div class="row tight"><button class="btn ghost" id="dChange">${esc(D.stepChange)}</button><button class="btn ghost" id="dObs3">${esc(D.stepObserve)}</button></div>`;
    bindHead();
    const handoff = async observe => {
      S.event = vid; S.own = null; S.area = "work"; S.ctx = "boss"; S.areaExplicit = true;
      S.teacher = { kind: "boss", label: X.teacherLabels.boss, ownName: "", area: "work" };
      S.case = { text: f.eventText, when: f.whenCase, date: null, repeat: null, origin: "dialog_selected" };
      S.sting = { meaningId: f.meaning.id, text: f.meaning.text || "", lessonId: f.meaning.lessonId || null, observe: f.meaning.observe || null, origin: f.meaning.origin, repeat: null, reaction: f.reaction || null };
      const obsW = observe || f.desire.kind === "observe" || (ownG && f.desire.observeStep);
      S.want = obsW ? { kind: "observe", text: OB.plan.observeGoal, origin: "user_selected", lessonId: null, goalText: ownG ? R.trimEnd(f.desire.text) : undefined } : f.desire.kind === "lesson" ? { kind: "lesson", key: "L:" + f.desire.lessonId, lessonId: f.desire.lessonId, text: uc1(L.title), origin: "user_selected" } : { kind: "own", text: uc1(R.trimEnd(f.desire.text)), origin: "user_written", lessonId: f.desire.lessonId || null, ownAction: f.desire.ownAction || null };
      S.confirmed = true; S.lesson = null; S.rejected = [];
      S.dialogResult = { bank: B.id, bankVersion: B.version, answers: JSON.parse(JSON.stringify(st.answers)), order: [...st.order], summary: R.dialogSummary(f, D), asked: res.asked, confirmedAt: st.confirmedAt || nowTs(), misses: st.misses || 0 };
      const LL = S.want.kind === "observe" ? X.lessonObserve : (lessonByWant(S) || X.lessonObserve);
      await startLesson(S, LL);
    };
    $("#dOk").onclick = () => handoff(false);
    $("#dObs3").onclick = () => handoff(true);
    $("#dChange").onclick = async () => { R.dialogFix(st, "desire"); st.status = "asking"; await persistOnb(); dialog(); };
  }
  /* =================== v6.10 Семейная ветка: учитель → зеркало → разрешение → шаг ===================
     Вход: «Отношения с близкими» → «С кем это связано?» (известная роль больше не спрашивается). Ребёнок и примеры — прежние карточки.
     Две независимые проверки: «Ты узнал учителя и ситуацию?» и «Это внутреннее правило тебе знакомо?». Гипотезы — от первого лица,
     ранжируются по ответам; «не моё» снимает одну формулировку. Без узнанного зеркала помощь с границей не блокируется. */
  const famBank = () => (X.dialogs || {})["close:adult"] || null;
  const FAM_KIND = { partner: "partner", mother: "parent", father: "parent", brother: "relative", sister: "relative", relative: "relative", friend: "friend", __own: "other" };
  function closectx() {
    const S = onb(), F = OB.family, B = famBank(); if (S.area !== "close" || !B) return go("area");
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(areaLabel("close"))}</p><h1 class="q">${esc(F.ctxTitle)}</h1><p class="muted small">${esc(F.ctxSub)}</p>
      <div class="chips col" id="fRoles">${B.roles.map(([v, l]) => `<button class="chip ${S.famRole === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}<button class="chip dim" data-v="child">${esc(F.child)} <span class="tiny">· ${esc(F.childNote)}</span></button></div>
      <div class="row tight"><a class="btn ghost sm" href="#cards" id="fExamples">${esc(F.examples)}</a><a class="btn ghost sm" href="#area">Другая сфера</a><a class="btn ghost sm" href="#own">${esc(OE.own)}</a></div>`;
    $$("#fRoles [data-v]").forEach(b => b.onclick = async () => {
      const v = b.dataset.v;
      if (v === "child") { S.famRole = "child"; S.step = "cards"; await persistOnb(); return go("cards"); }
      if (S.famRole !== v) { S.famRole = v; S.fdialog = null; }
      S.step = "fdialog"; await persistOnb(); go("fdialog");
    });
  }
  const famSummaryLines = (f, B, F) => {
    const u = t => t ? uc1(R.trimEnd(t)) : F.unknownField, ms = F.mirrorStatus;
    const lines = [[F.fTeacher, f.roleLabel ? uc1(f.roleLabel) : F.unknownField], [F.fEpisode, uc1(f.when)], [F.fMeaning, f.meaning && f.meaning.text ? `«${R.trimEnd(f.meaning.text)}»` : F.unknownField], [F.fReaction, f.reaction ? `«${R.trimEnd(f.reaction)}»` : F.unknownField]];
    if (f.reaction) lines.push([F.fNow, u(f.now)], [F.fLater, u(f.later)]);
    if (f.mirror) lines.push([F.fMirror, f.mirror.text ? `«${R.trimEnd(f.mirror.text)}» — ${ms[f.mirror.status] || ""}${f.mirror.example ? `; пример: «${R.trimEnd(f.mirror.example)}»` : ""}${f.mirror.prediction ? `; ожидание: «${R.trimEnd(f.mirror.prediction)}»` : ""}` : (ms[f.mirror.status] || F.unknownField)]);
    if (f.need) lines.push([F.fGoal, uc1(f.need)]);
    if (f.permission) lines.push([F.fPermission, uc1(R.trimEnd(f.permission.text))]);
    if (f.goal && f.goal.text) lines.push([F.fGoal, uc1(R.trimEnd(f.goal.text))]);
    if (f.action) lines.push([F.fAction, f.action.phrase ? `«${R.trimEnd(f.action.phrase)}»` : F.observeAction]);
    return lines;
  };
  function fdialog() {
    const S = onb(), B = famBank(), F = OB.family, D = OB.dialog;
    if (!B || S.area !== "close" || !S.famRole || S.famRole === "child") return go(S.area === "close" ? "closectx" : "area");
    if (!S.fdialog) S.fdialog = { bank: B.id, bankVersion: B.version, role: S.famRole, answers: {}, order: [], rejected: [], misses: 0, status: "intro", startedAt: nowTs() };
    const st = S.fdialog; st.role = S.famRole;
    if (st.status === "intro") {
      app.innerHTML = `${sparkHTML("listen")}<h1 class="q">${esc(F.introTitle)}</h1><p>${esc(F.intro)}</p>
        <div class="row"><button class="btn block" id="fStart">${esc(F.start)}</button></div>
        <div class="chips col"><a class="chip" href="#own">${esc(D.own)}</a><a class="chip dim" href="#cards">${esc(F.examples)}</a></div>
        <div class="row tight"><a class="btn ghost sm" href="#closectx">Другой учитель</a></div>`;
      bindSpark(); $("#fStart").onclick = async () => { st.status = "asking"; await persistOnb(); fdialog(); }; return;
    }
    const res = R.familyNext(B, st), q = res.next, f = res.fields;
    st.trace = res.trace;
    const answer = async (qid, v, text) => { R.dialogAnswer(st, qid, v, text); st.status = "asking"; const ok = await persistOnb(); fdialog(); return ok !== false; };
    const back = async () => { if (st.status === "summary" || st.status === "step") st.status = "asking"; R.dialogUndo(st); await persistOnb(); fdialog(); };
    const head = sp => `${sparkHTML(sp)}<div class="row tight" style="justify-content:space-between;margin:0 0 4px"><span class="tiny" id="fQn">${res.done || q.kind === "noEvent" || q.kind === "unsupported" ? `Вопросов: ${res.asked}` : esc(D.qn.replace("{n}", res.asked + 1))}</span>${st.order.length ? `<button class="linkbtn tiny" id="fBack">${esc(D.back)}</button>` : `<a class="linkbtn tiny" href="#closectx">${esc(D.back)}</a>`}</div>
      ${res.asked >= 10 && !res.done && (q.kind === "mirror" || q.kind === "yn") ? `<div class="card tight" id="fTooMany"><p class="small" style="margin:0 0 6px">${esc(F.tooMany)}</p><div class="row tight"><a class="btn ghost sm" href="#today">Продолжить позже</a><a class="btn ghost sm" href="#own">${esc(D.own)}</a></div></div>` : ""}`;
    const bindHead = () => { bindSpark(); const b = $("#fBack"); if (b) b.onclick = back; };
    const ownBox = (qid, ph, v, prefill) => { $("#fOwnBox").innerHTML = `<textarea id="fOwnT" placeholder="${esc(ph || D.ownPh)}">${esc(prefill || "")}</textarea><div class="row tight"><button class="btn secondary sm" id="fOwnOk">Готово</button></div>`; $("#fOwnT").focus(); $("#fOwnOk").onclick = () => { const t = $("#fOwnT").value.trim(); if (!t) return toast("Напиши пару слов"); answer(qid, v || "__own", t); }; };
    const lbl = v => v === "__unknown" ? (q.id === "group" ? D.typeUnknown : F.unknown) : v === "__unsure" ? F.unsure : v === "__observe" ? F.observe : null;
    const titleOf = { role: F.qRole, group: F.qGroup, meaning: F.qMeaning, reaction: F.qReaction, now: F.qNow, later: F.qLater, perm: F.qPermission, goal: F.qGoal, when: F.qWhen };
    if (q.kind === "choice" || q.kind === "when") {
      const opts = q.kind === "when" ? X.lastTime : q.options.map(([v, t]) => [v, (String(t).startsWith("__") ? lbl(t) : null) || t]);
      const lead = ["meaning", "reaction", "now", "later"].includes(q.id) ? `«${f.eventText}»` : q.id === "perm" && f.mirror && f.mirror.text ? `«${R.trimEnd(f.mirror.text)}»` : q.id === "goal" && f.mirror && f.mirror.status !== "unknown" ? F.mirrorNone : "";
      app.innerHTML = `${head(q.id === "contra" ? "think" : "listen")}${lead ? `<p class="tiny" style="margin:0 0 4px">${esc(lead)}</p>` : ""}<h1 class="q">${esc(q.text || titleOf[q.id] || "")}</h1>
        <div class="chips col" id="fOpts">${opts.map(([v, t]) => `<button class="chip ${(st.answers[q.id] || {}).v === v ? "on" : ""}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}${q.own ? `<button class="chip dim" id="fOwn">${esc(F.own)}</button>` : ""}</div><div id="fOwnBox"></div>`;
      bindHead();
      $$("#fOpts [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v));
      const ow = $("#fOwn"); if (ow) ow.onclick = () => ownBox(q.id); return;
    }
    if (q.kind === "yn") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(q.text)}</h1><div class="chips col" id="fYn">${D.yn.map(([v, t]) => `<button class="chip" data-v="${v}">${esc(t)}</button>`).join("")}</div>`;
      bindHead(); $$("#fYn [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v)); return;
    }
    if (q.kind === "swipe") {
      const lastQ = st.order[st.order.length - 1], prev = lastQ && lastQ.startsWith("e:") && st.answers[lastQ] ? st.answers[lastQ].v : null;
      app.innerHTML = `${head("listen")}<h1 class="q">${esc(F.qEvent)}</h1>${swipeHTML({ text: q.text, prev, tutorial: !P.seen.swipe })}`;
      bindHead();
      bindSwipe({ onAnswer: async r => { P.seen.swipe = true; R.dialogAnswer(st, q.id, r); const ok = await persistOnb(); if (ok === false) { R.dialogUndo(st); return false; } setTimeout(fdialog, reduce() ? 0 : 230); return true; }, onUndo: back, announce: r => OB.swipe.prev.replace("{a}", swAns(r)) });
      return;
    }
    if (q.kind === "confirmA") {
      app.innerHTML = `${head("summary")}<h1 class="q">${esc(F.confirmA)}</h1><div class="card mark" id="fSumA"><div class="plines">${famSummaryLines(f, B, F).map(([k, v]) => `<div><span>${esc(k)}:</span> ${esc(v)}</div>`).join("")}</div></div>
        <div class="chips col"><button class="chip" id="fAYes">${esc(F.confirmAYes)}</button><button class="chip" id="fAFix">${esc(F.confirmAFix)}</button><button class="chip dim" id="fANo">${esc(F.confirmANo)}</button></div><div id="fFix"></div>`;
      bindHead();
      $("#fAYes").onclick = () => answer("confirmA", "yes");
      const fix = all => { $("#fFix").innerHTML = `<p class="small muted" style="margin:6px 0 4px">${esc(F.fixWhat)}</p><div class="chips">${[["event", F.fixEvent], ["meaning", F.fixMeaning], ["reaction", F.fixReaction]].concat(all ? [["all", D.fixAll]] : []).map(([k, t]) => `<button class="chip" data-fx="${k}">${esc(t)}</button>`).join("")}</div>`; $$("[data-fx]").forEach(b => b.onclick = async () => { R.familyFix(st, b.dataset.fx); await persistOnb(); toast(D.say.fix); fdialog(); }); };
      $("#fAFix").onclick = () => fix(false);
      $("#fANo").onclick = async () => { st.misses = (st.misses || 0) + 1; await persistOnb(); if (st.misses >= 2) { app.innerHTML = `${sparkHTML("think")}<p id="fMissTwice">${esc(D.missTwice)}</p><div class="chips col"><a class="btn block secondary" href="#own">${esc(D.own)}</a><button class="btn block secondary" id="fObs2">${esc(F.observe)}</button></div>`; bindSpark(); $("#fObs2").onclick = () => observeMode(); return; } fix(true); };
      return;
    }
    if (q.kind === "mirror") {
      const M = q.mirror, T = F.mirrorTypes[M.type] || "";
      app.innerHTML = `${head("think")}${q.index === 0 ? `<p class="small" id="fBridge" style="margin:0 0 6px">${esc(F.bridge)}</p>` : ""}<h1 class="q">${esc(F.qMirror)}</h1>
        <div class="card mark" id="fMirror"><div class="tiny">${esc(T)} · ${q.index + 1} из ${q.total}</div><p style="margin:4px 0 0"><b>${esc(M.text)}</b></p></div>
        <div class="chips col" id="fMOpts"><button class="chip" data-v="yes">${esc(F.mYes)}</button><button class="chip" data-v="partly">${esc(F.mPartly)}</button><button class="chip" data-v="no">${esc(F.mNo)}</button><button class="chip dim" data-v="own">${esc(F.mOwn)}</button><button class="chip dim" data-v="unsure">${esc(F.mUnsure)}</button></div><div id="fOwnBox"></div>`;
      bindHead();
      $$("#fMOpts [data-v]").forEach(b => b.onclick = () => {
        const v = b.dataset.v;
        if (v === "partly") return ownBox(q.id, "", "partly", M.text);
        if (v === "own") return ownBox(q.id, "моё правило, от первого лица", "own");
        answer(q.id, v);
      });
      return;
    }
    if (q.kind === "check") {
      const ex = q.mode === "example";
      app.innerHTML = `${head("listen")}<p class="tiny" style="margin:0 0 4px">«${esc(R.trimEnd(q.mirrorText || ""))}»</p><h1 class="q">${esc(ex ? F.qCheckExample : F.qCheckPredict)}</h1>
        <div class="chips col" id="fOpts">${ex ? "" : q.options.map(o => `<button class="chip" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<button class="chip" id="fEx">${esc(F.checkExampleOwn)}</button>${ex ? "" : `<button class="chip dim" id="fOwn">${esc(F.own)}</button><button class="chip dim" data-v="__unknown">${esc(F.unknown)}</button>`}<button class="chip dim" data-v="__later">${esc(F.checkLater)}</button></div><div id="fOwnBox"></div>`;
      bindHead();
      $$("#fOpts [data-v]").forEach(b => b.onclick = () => answer("check", b.dataset.v === "__later" && !ex ? "__unknown" : b.dataset.v));
      $("#fEx").onclick = () => ownBox("check", "когда это было и что ты сделал", "__example");
      const ow = $("#fOwn"); if (ow) ow.onclick = () => ownBox("check", "", "__own");
      return;
    }
    if (q.kind === "action") {
      app.innerHTML = `${head("support")}<p class="tiny" style="margin:0 0 4px">${esc(f.permission ? uc1(R.trimEnd(f.permission.text)) : f.goal ? uc1(f.goal.text) : "")}</p><h1 class="q">${esc(F.qAction)}</h1>
        <div class="chips col" id="fActs">${q.options.map(a => `<button class="chip" data-a="${esc(a.id)}"><b>${esc(a.label)}</b><br><span class="small">«${esc(a.phrase)}»</span></button>`).join("")}<button class="chip dim" id="fOwn">${esc(D.ownAction)}</button><button class="chip dim" data-a="__observe">${esc(F.observe)}</button></div><div id="fOwnBox"></div>`;
      bindHead();
      $$("#fActs [data-a]").forEach(b => b.onclick = () => {
        const id = b.dataset.a; if (id === "__observe") return answer("action", "__observe");
        const a = q.options.find(x => x.id === id);
        $("#fOwnBox").innerHTML = `<label for="fPhrase">${esc(F.editPhrase)}</label><textarea id="fPhrase">${esc(a.phrase)}</textarea><div class="row tight"><button class="btn secondary sm" id="fPhraseOk">${esc(F.phraseOk)}</button></div>`;
        $("#fPhraseOk").onclick = () => { const t = $("#fPhrase").value.trim(); if (!t) return toast("Напиши фразу"); answer("action", id, t); };
      });
      $("#fOwn").onclick = () => ownBox("action", D.ownActionPh);
      return;
    }
    if (q.kind === "noEvent" || q.kind === "unsupported") {
      const ne = q.kind === "noEvent";
      app.innerHTML = `${head("think")}<h1 class="q">${esc(ne ? D.noEvent : D.unsupported)}</h1><p>${esc(ne ? D.noEventText : D.unsupportedText)}</p>
        <div class="chips col">${ne ? `<button class="btn block secondary" id="fOther">${esc(D.otherType)}</button>` : ""}<a class="btn block secondary" href="#own">${esc(D.own)}</a><a class="btn block secondary" href="#cards">${esc(F.examples)}</a><button class="btn block secondary" id="fObs">${esc(F.observe)}</button></div>`;
      bindHead();
      const o = $("#fOther"); if (o) o.onclick = async () => { Object.keys(st.answers).filter(k => k === "group" || k.startsWith("e:") || k.startsWith("n:")).forEach(k => { delete st.answers[k]; }); st.order = st.order.filter(k => st.answers[k]); await persistOnb(); fdialog(); };
      $("#fObs").onclick = () => observeMode(); return;
    }
    /* итог: подтверждается отдельно, затем шаг — отдельным экраном */
    if (st.status !== "step") {
      st.status = "summary";
      app.innerHTML = `${head("summary")}<h1 class="q">${esc(F.sumTitle)}</h1><div class="card mark" id="fSum"><div class="plines">${famSummaryLines(f, B, F).map(([k, v]) => `<div><span>${esc(k)}:</span> ${esc(v)}</div>`).join("")}</div></div>
        <p style="margin:8px 0 4px"><b>${esc(F.sumAsk)}</b></p><div class="chips col"><button class="chip" id="fYes">${esc(F.sumYes)}</button><button class="chip" id="fFixB">${esc(F.sumFix)}</button></div><div id="fFix"></div>`;
      bindHead();
      $("#fYes").onclick = async () => { st.status = "step"; st.confirmedAt = nowTs(); await persistOnb(); fdialog(); };
      $("#fFixB").onclick = () => { $("#fFix").innerHTML = `<div class="chips">${[["event", F.fixEvent], ["meaning", F.fixMeaning], ["reaction", F.fixReaction], ["mirror", F.fixMirror], ["goal", F.fixGoal], ["action", F.fixAction]].map(([k, t]) => `<button class="chip" data-fx="${k}">${esc(t)}</button>`).join("")}</div>`; $$("[data-fx]").forEach(b => b.onclick = async () => { R.familyFix(st, b.dataset.fx); st.status = "asking"; await persistOnb(); toast(D.say.fix); fdialog(); }); };
      return;
    }
    /* шаг: внутри — правило и разрешение; снаружи — поступок рядом с учителем; «зачем» относится к разговору */
    const a = f.action && f.action.id !== "observe" && f.action.id !== "own" ? B.actions[f.action.id] : null;
    const why = a ? (f.mirror && f.mirror.text ? `Проверяем правило «${R.trimEnd(f.mirror.text)}»: ${lc1(a.why)}` : a.why) : "";
    const pl = (B.pathLinks || {})[`${pathNum()}|${f.group}`] || "";
    app.innerHTML = `${head("support")}<h1 class="q">${esc(F.stepTitle)}</h1>
      <div class="card mark" id="fStep"><div class="plines">
        <div><span>${esc(D.stepTeacher)}:</span> ${esc(f.roleLabel || "")}</div>
        ${f.mirror && f.mirror.text ? `<div><span>${esc(F.stepInside)}:</span> ${esc(f.permission ? uc1(R.trimEnd(f.permission.text)) : "")}</div>` : f.goal && f.goal.text ? `<div><span>${esc(F.fGoal)}:</span> ${esc(uc1(f.goal.text))}</div>` : ""}
        <div><span>${esc(F.stepOutside)}:</span> ${esc(f.action && f.action.phrase ? `«${R.trimEnd(f.action.phrase)}»` : F.observeAction)}</div>
        ${why ? `<div><span>${esc(F.stepWhy)}:</span> ${esc(why)}</div>` : ""}
        ${a ? `<div><span>${esc(D.stepCheck)}:</span> ${esc(a.afterQuestion)}</div>` : f.action && f.action.id === "own" ? `<div><span>${esc(D.stepCheck)}:</span> ${esc(D.ownCheck)}</div>` : ""}
      </div></div>${pl ? `<p class="small" id="fPath" style="margin:6px 0">${esc(pl)}</p>` : ""}
      <div class="row"><button class="btn block" id="fOk">${esc(F.stepOk)}</button></div>
      <div class="row tight"><button class="btn ghost" id="fChange">${esc(F.stepChange)}</button><button class="btn ghost" id="fObs3">${esc(F.observe)}</button></div>`;
    bindHead();
    const handoff = async observe => {
      const obs = observe || !f.action || f.action.id === "observe";
      const kind = FAM_KIND[f.role] || "other", label = f.roleLabel || "близкий";
      S.event = null; S.area = "close"; S.areaExplicit = true;
      const pk = a ? a.packId : null;
      S.own = { text: uc1(f.eventText), packId: pk, version: C.contentVersion, area: "close", origin: "family_dialog" };
      S.teacher = { kind, label, ownName: f.role === "__own" ? label : "", area: "close", origin: "dialog_selected" };
      S.case = { text: uc1(f.eventText), when: f.whenCase, date: null, repeat: null, origin: "dialog_selected" };
      S.sting = { meaningId: f.meaning.id, text: f.meaning.text || "", lessonId: null, observe: null, origin: f.meaning.origin, repeat: null, reaction: f.reaction || null };
      const title = f.permission ? R.trimEnd(f.permission.short || f.permission.text) : f.goal && f.goal.text ? R.trimEnd(f.goal.text) : "";
      const purpose = why || (a ? a.why : "");
      const L = obs || !a && !(f.action && f.action.id === "own") ? X.lessonObserve : {
        id: "fam:" + (a ? a.id : "own") + ":" + (f.permission ? f.permission.id : f.goal ? f.goal.id : "x"), family: true, packId: pk || "fairness", title: lc1(title || (a ? a.label : "свой шаг")), homeTitle: null,
        inner: f.permission ? R.trimEnd(f.permission.text) : "", action: f.action.phrase, skillId: a ? a.skillId : "boundary", signal: a ? a.cueTemplate : "", hypothesisId: null,
        template: Object.assign({ id: "fam:" + (a ? a.id : "own"), title: lc1(title || ""), lessonTitle: lc1(title || ""), lessonAction: f.action.phrase, cueTemplate: a ? a.cueTemplate : "Когда это повторится", actionTemplate: f.action.phrase,
          afterQuestion: a ? a.afterQuestion : D.ownCheck, purpose, effortLabel: a ? a.effortLabel : "Один небольшой поступок", limits: a ? a.limits : "", smallerVersion: "Сказать только первую часть фразы.", setup: [], skillId: a ? a.skillId : "boundary", packId: pk || "fairness", adapted: true, family: true }) };
      S.want = obs ? { kind: "observe", text: OB.plan.observeGoal, origin: "user_selected", lessonId: null } : (f.permission && f.permission.origin === "user_selected") || (f.goal && f.goal.origin === "user_selected")
        ? { kind: "lesson", key: "L:" + L.id, lessonId: L.id, text: uc1(L.title), origin: "user_selected", ownAction: f.action.phrase }
        : { kind: "own", text: uc1(title), origin: "user_written", lessonId: null, ownAction: f.action.phrase };
      S.confirmed = true; S.lesson = null; S.rejected = [];
      S.familyResult = { bank: B.id, bankVersion: B.version, role: f.role, group: f.group, event: f.event, meaning: f.meaning, reaction: f.reaction, now: f.now, later: f.later, mirror: f.mirror, need: f.need || null, permission: f.permission || null, goal: f.goal || null, action: f.action, answers: JSON.parse(JSON.stringify(st.answers)), order: [...st.order], trace: res.trace, asked: res.asked, confirmedAt: st.confirmedAt || nowTs(), misses: st.misses || 0 };
      await startLesson(S, L);
    };
    $("#fOk").onclick = () => handoff(false);
    $("#fObs3").onclick = () => handoff(true);
    $("#fChange").onclick = async () => { R.familyFix(st, "action"); st.status = "asking"; await persistOnb(); fdialog(); };
  }
  /* =================== v7 ЕДИНЫЙ МАРШРУТ: сфера → учитель → сцена (или свой случай) → что задело → реакция и последствия →
     подтверждение учителя → зеркало (по ответам; после непопадания — первая мысль) → проверка → разрешение → подтверждение зеркала →
     шаг и ожидание → первый эксперимент. Готовый и индивидуальный случаи идут одним процессом. =================== */
  const SB = () => X.stories;
  const KIND_OF = { partner: "partner", mother: "parent", father: "parent", brother: "relative", sister: "relative", relative: "relative", friend: "friend", child: "child", boss: "boss", colleague: "colleague", client: "client",
    m_friend: "friend", m_relative: "relative", m_client: "client", m_partner: "partner", s_mistake: "situation", s_rest: "situation", s_choice: "situation", s_delay: "situation", __own: "other" };
  const DECK_CTX = { boss: "boss", colleague: "colleagues", client: "clients" };
  /* Учитель/контекст для выбранной сферы: известный учитель дальше не спрашивается. Колода — необязательные примеры. */
  function ctxScreen() {
    const S = onb(), B = SB(), O = OB.story; if (!S.area || !B.spheres[S.area]) return go("area");
    const sp = B.spheres[S.area];
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(sp.label)}</p><h1 class="q">${esc(sp.teacherQ)}</h1><p class="muted small">${esc(OB.family.ctxSub)}</p>
      <div class="chips col" id="sRoles">${sp.roles.map(([v, l]) => `<button class="chip ${S.role === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}<button class="chip dim" id="sRoleOwn">${esc(O.own)}</button></div><div id="sRoleBox"></div>
      <div class="row tight"><a class="btn ghost sm" href="#cards" id="sExamples">${esc(O.examples)}</a><a class="btn ghost sm" href="#area">Другая сфера</a></div>`;
    const pick = async (v, label) => {
      if (S.role !== v || (label && S.roleLabel !== label)) { S.role = v; S.roleLabel = label || null; S.sd = null; }
      if (S.area === "work" && DECK_CTX[v]) { S.ctx = DECK_CTX[v]; } if (S.area === "close") S.famRole = v;
      S.step = "sd"; await persistOnb(); go("sd");
    };
    $$("#sRoles [data-v]").forEach(b => b.onclick = () => pick(b.dataset.v));
    $("#sRoleOwn").onclick = () => { $("#sRoleBox").innerHTML = `<input id="sRoleT" placeholder="кто или что, без имени"><div class="row tight"><button class="btn secondary sm" id="sRoleOk">Готово</button></div>`; $("#sRoleT").focus(); $("#sRoleOk").onclick = () => { const t = $("#sRoleT").value.trim(); if (!t) return toast("Напиши пару слов"); pick("__own", t); }; };
    $("#sExamples").onclick = async e => { e.preventDefault(); if (S.area === "work" && !S.ctx) S.ctx = "any"; S.step = "cards"; await persistOnb(); go("cards"); };
  }
  const sdLines = (f, B) => {
    const O = OB.story, u = t => t ? uc1(R.trimEnd(t)) : O.unknownField;
    const L = [["Учитель", f.roleLabel ? uc1(f.roleLabel) : O.unknownField], ["Ситуация", f.own ? `«${f.eventText}»` : uc1(f.when)], ["Задевает", f.meaning && f.meaning.text ? `«${R.trimEnd(f.meaning.text)}»` : O.unknownField]];
    if (f.thought) L.push(["Первая мысль", `«${R.trimEnd(f.thought)}»`]);
    L.push(["Обычно", f.reaction ? `«${R.trimEnd(f.reaction)}»` : O.unknownField]);
    if (f.reaction) L.push(["Сразу это дало", u(f.now)], ["Потом", u(f.later)]);
    return L;
  };
  const mirrorLine = (m, B) => !m || !m.text ? OB.story.noMirror : `«${R.trimEnd(m.text)}» — ${B.mirrorStatus[m.status] || ""}`;
  function sd() {
    const S = onb(), B = SB(), O = OB.story, D = OB.dialog;
    if (!B || !S.area || !B.spheres[S.area] || !S.role) return go(S.area ? "ctx" : "area");
    if (!S.sd) { const direct = !!(S.ownFirst || S.deckPick); S.sd = { bank: B.version, sphere: S.area, role: S.role, roleLabel: S.roleLabel || null, answers: {}, order: [], rejected: [], misses: 0, status: direct ? "asking" : "intro", startedAt: nowTs() }; if (direct) R.dialogAnswer(S.sd, "group", "__own"); S.ownFirst = false; }
    const st = S.sd; st.sphere = S.area; st.role = S.role; if (S.roleLabel) st.roleLabel = S.roleLabel;
    if (st.status === "intro") {
      app.innerHTML = `${sparkHTML("listen")}<p class="tiny" style="margin:0 0 4px">${esc(B.spheres[S.area].label)} · ${esc(S.roleLabel || (B.spheres[S.area].roles.find(r => r[0] === S.role) || [])[1] || "")}</p><h1 class="q">${esc(O.introTitle)}</h1><p>${esc(O.intro)}</p>
        <div class="row"><button class="btn block" id="sStart">${esc(O.start)}</button></div>
        <div class="chips col"><button class="chip" id="sOwnStart">${esc(O.ownCase)}</button><a class="chip dim" href="#cards" id="sEx">${esc(O.examples)}</a></div>
        <div class="row tight"><a class="btn ghost sm" href="#ctx">Другой учитель</a></div>`;
      bindSpark();
      $("#sStart").onclick = async () => { st.status = "asking"; await persistOnb(); sd(); };
      $("#sOwnStart").onclick = async () => { st.status = "asking"; R.dialogAnswer(st, "group", "__own"); await persistOnb(); sd(); };
      $("#sEx").onclick = async e => { e.preventDefault(); if (S.area === "work" && !S.ctx) S.ctx = DECK_CTX[S.role] || "any"; await persistOnb(); go("cards"); };
      return;
    }
    const res = R.storyNext(B, st), q = res.next, f = res.fields; st.trace = res.trace; app.dataset.sq = q.id; app.dataset.sk = q.kind;
    const answer = async (qid, v, text) => { R.dialogAnswer(st, qid, v, text); st.status = "asking"; const ok = await persistOnb(); sd(); return ok !== false; };
    /* «Назад» отменяет весь последний экран: «сразу/потом» отвечаются на одном экране и снимаются вместе */
    const back = async () => { if (st.status === "step") st.status = "asking"; const last = st.order[st.order.length - 1]; R.dialogUndo(st); if (last === "later" && st.order[st.order.length - 1] === "now") R.dialogUndo(st); await persistOnb(); sd(); };
    const phase = q.kind === "pause" ? (st.answers.confirmB ? "step" : st.answers.confirmA ? "mirror" : "teacher") : ["mirror", "thought", "ownrule", "check", "perm", "goal", "confirmB"].includes(q.kind) || q.id.startsWith("mir:") || ["thought", "ownrule", "check", "perm", "goal", "confirmB"].includes(q.id) ? "mirror" : ["action", "pred", "step"].includes(q.kind) ? "step" : "teacher";
    const head = sp => `${sparkHTML(sp)}<div class="row tight" style="justify-content:space-between;margin:0 0 4px"><span class="tiny" id="sPhase">${esc(O.phase[phase])}</span>${st.order.length ? `<button class="linkbtn tiny" id="sBack">${esc(D.back)}</button>` : `<a class="linkbtn tiny" href="#ctx">${esc(D.back)}</a>`}</div>`;
    const bindHead = () => { bindSpark(); const b = $("#sBack"); if (b) b.onclick = back; };
    const ownBox = (qid, ph, v, prefill, input) => { $("#sOwnBox").innerHTML = `<textarea id="sOwnT" placeholder="${esc(ph || D.ownPh)}">${esc(prefill || "")}</textarea><div class="row tight"><button class="btn secondary sm" id="sOwnOk">Готово</button></div>`; $("#sOwnT").focus(); $("#sOwnOk").onclick = () => { const t = $("#sOwnT").value.trim(); if (!t) return toast("Напиши пару слов"); answer(qid, v || "__own", t); }; };
    const lbl = v => v === "__unknown" ? (q.id === "group" ? O.typeUnknown : O.unknown) : v === "__unsure" ? O.unsure : v === "__observe" ? O.observe : null;
    const titleOf = { group: O.qGroup, meaning: O.qMeaning, reaction: O.qReaction, perm: O.qPermission, goal: O.qGoal, ownKind: O.qOwnKind };
    if (q.kind === "choice") {
      const opts = q.options.map(([v, t]) => [v, (String(t).startsWith("__") ? lbl(t) : null) || t]);
      const lead = q.id === "ownKind" ? O.ownKindLead : ["meaning", "reaction"].includes(q.id) ? `«${f.eventText}»` : q.id === "perm" ? `«${R.trimEnd(q.mirrorText || "")}»` : q.id === "goal" ? O.needLead.replace("{need}", R.trimEnd(q.need || "")) : "";
      app.innerHTML = `${head("listen")}${lead ? `<p class="tiny" id="sLead" style="margin:0 0 4px">${esc(lead)}</p>` : ""}<h1 class="q">${esc(q.text || titleOf[q.id] || "")}</h1>
        <div class="chips col" id="sOpts">${opts.map(([v, t]) => `<button class="chip ${(st.answers[q.id] || {}).v === v ? "on" : ""}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}${q.own ? `<button class="chip dim" id="sOwn">${esc(O.own)}</button>` : ""}${q.ownCase ? `<button class="chip dim" data-v="__own" id="sOwnCase">${esc(O.ownCase)}</button>` : ""}${q.danger ? `<button class="chip dim" data-v="danger" id="sDanger">${esc(O.dangerOpen)}</button>` : ""}</div><div id="sOwnBox"></div>`;
      bindHead();
      $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v));
      const ow = $("#sOwn"); if (ow) ow.onclick = () => ownBox(q.id); return;
    }
    if (q.kind === "text") {
      app.innerHTML = `${head("listen")}<h1 class="q">${esc(O.qOwnScene)}</h1><p class="small muted">${esc(O.ownSceneLead)}</p>${S.deckPick && !(st.answers.ownScene || {}).text ? `<p class="tiny muted">Пример из карточек — поправь под свой случай.</p>` : ""}<textarea id="sScene" placeholder="${esc(O.ownScenePh)}">${esc((st.answers.ownScene || {}).text || S.deckPick || "")}</textarea><div class="row"><button class="btn block" id="sSceneOk">${esc(O.next)}</button></div>`;
      bindHead(); $("#sSceneOk").onclick = () => { const t = $("#sScene").value.trim(); if (!t) return toast("Одна короткая фраза: что произошло"); answer("ownScene", "__own", t); }; return;
    }
    if (q.kind === "yn") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(q.text)}</h1><div class="chips col" id="sYn">${D.yn.map(([v, t]) => `<button class="chip" data-v="${v}">${esc(t)}</button>`).join("")}</div>`;
      bindHead(); $$("#sYn [data-v]").forEach(b => b.onclick = () => answer(q.id, b.dataset.v)); return;
    }
    if (q.kind === "swipe") {
      const lastQ = st.order[st.order.length - 1], prev = lastQ && lastQ.startsWith("e:") && st.answers[lastQ] ? st.answers[lastQ].v : null;
      app.innerHTML = `${head("listen")}<h1 class="q">${esc(O.qEvent)}</h1>${swipeHTML({ text: q.text, prev, tutorial: !P.seen.swipe })}<div class="row tight" style="justify-content:center"><button class="linkbtn tiny" id="sOwnSw">${esc(O.ownCase)}</button></div>`;
      bindHead();
      $("#sOwnSw").onclick = () => answer("miss2", "own");
      bindSwipe({ onAnswer: async r => { P.seen.swipe = true; R.dialogAnswer(st, q.id, r); const ok = await persistOnb(); if (ok === false) { R.dialogUndo(st); return false; } setTimeout(sd, reduce() ? 0 : 230); return true; }, onUndo: back, announce: r => OB.swipe.prev.replace("{a}", swAns(r)) });
      return;
    }
    if (q.kind === "miss2") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(O.miss2Title)}</h1><p>${esc(O.miss2Text)}</p><div class="chips col" id="sOpts"><button class="chip" data-v="more">${esc(O.miss2More)}</button><button class="chip" data-v="own">${esc(O.miss2Own)}</button></div>`;
      bindHead(); $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer("miss2", b.dataset.v)); return;
    }
    if (q.kind === "conseq") {
      const row = (id, list) => `<div class="chips" id="sC_${id}">${list.map(x => `<button class="chip ${(st.answers[id] || {}).v === x ? "on" : ""}" data-v="${esc(x)}">${esc(x)}</button>`).join("")}<button class="chip dim" data-v="__unknown">${esc(O.unknown)}</button><button class="chip dim" data-own="${id}">${esc(O.own)}</button></div><div id="sOwn_${id}"></div>`;
      app.innerHTML = `${head("listen")}<p class="tiny" style="margin:0 0 4px">«${esc(R.trimEnd(f.reaction))}»</p><h1 class="q">${esc(O.qConseq)}</h1><p class="small" style="margin:6px 0 2px"><b>${esc(O.qNow)}</b></p>${row("now", q.now)}<p class="small" style="margin:8px 0 2px"><b>${esc(O.qLater)}</b></p>${row("later", q.later)}<div class="row"><button class="btn block" id="sCOk" disabled>${esc(O.next)}</button></div>`;
      bindHead();
      const sel = { now: st.answers.now || null, later: st.answers.later || null };
      const upd = () => { $("#sCOk").disabled = !(sel.now && sel.later); };
      ["now", "later"].forEach(id => {
        $$(`#sC_${id} [data-v]`).forEach(b => b.onclick = () => { sel[id] = { v: b.dataset.v }; $$(`#sC_${id} .chip`).forEach(x => x.classList.toggle("on", x === b)); upd(); });
        $(`#sC_${id} [data-own]`).onclick = () => { $(`#sOwn_${id}`).innerHTML = `<input id="sOT_${id}" placeholder="своими словами">`; const inp = $(`#sOT_${id}`); inp.focus(); inp.oninput = () => { sel[id] = inp.value.trim() ? { v: "__own", text: inp.value.trim() } : null; upd(); }; };
      });
      upd();
      $("#sCOk").onclick = async () => { R.dialogAnswer(st, "now", sel.now.v, sel.now.text); R.dialogAnswer(st, "later", sel.later.v, sel.later.text); await persistOnb(); sd(); };
      return;
    }
    if (q.kind === "confirmA") {
      app.innerHTML = `${head("summary")}<h1 class="q">${esc(O.confirmA)}</h1><div class="card mark" id="sSumA"><div class="plines">${sdLines(f, B).map(([k, v]) => `<div><span>${esc(k)}:</span> ${esc(v)}</div>`).join("")}</div></div>
        <p class="small" style="margin:6px 0 2px"><b>${esc(O.whenQ)}</b></p><div class="chips" id="sWhen">${X.lastTime.map(([v, l]) => `<button class="chip ${(st.answers.when || {}).v === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}</div>
        <p class="tiny muted" style="margin:6px 0">${esc(O.confirmANote)}</p>
        <div class="chips col"><button class="chip" id="sAYes" ${(st.answers.when || {}).v ? "" : "disabled"}>${esc(O.confirmAYes)}</button><button class="chip" id="sAFix">${esc(O.confirmAFix)}</button><button class="chip dim" id="sANo">${esc(O.confirmANo)}</button></div><div id="sFix"></div>`;
      bindHead();
      $$("#sWhen [data-v]").forEach(b => b.onclick = async () => { R.dialogAnswer(st, "when", b.dataset.v); await persistOnb(); $$("#sWhen .chip").forEach(x => x.classList.toggle("on", x === b)); $("#sAYes").disabled = false; });
      $("#sAYes").onclick = () => answer("confirmA", "yes");
      const fix = all => { $("#sFix").innerHTML = `<p class="small muted" style="margin:6px 0 4px">${esc(O.fixWhat)}</p><div class="chips">${[["event", O.fixEvent], ["meaning", O.fixMeaning], ["reaction", O.fixReaction]].concat(all ? [["all", D.fixAll]] : []).map(([k, t]) => `<button class="chip" data-fx="${k}">${esc(t)}</button>`).join("")}</div>`; $$("[data-fx]").forEach(b => b.onclick = async () => { R.storyFix(st, b.dataset.fx); await persistOnb(); toast(D.say.fix); sd(); }); };
      $("#sAFix").onclick = () => fix(false);
      $("#sANo").onclick = async () => { st.misses = (st.misses || 0) + 1; await persistOnb(); if (st.misses >= 2) { app.innerHTML = `${sparkHTML("think")}<p id="sMissTwice">${esc(O.missTwice)}</p><div class="chips col"><button class="btn block secondary" id="sOwn2">${esc(O.miss2Own)}</button><button class="btn block secondary" id="sObs2">${esc(O.observe)}</button></div>`; bindSpark(); $("#sOwn2").onclick = async () => { R.storyFix(st, "all"); R.dialogAnswer(st, "group", "__own"); st.misses = 2; await persistOnb(); sd(); }; $("#sObs2").onclick = () => observeMode(); return; } fix(true); };
      return;
    }
    if (q.kind === "pause") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(O.pauseTitle)}</h1><p>${esc(O.pauseText)}</p><div class="chips col" id="sPause"><button class="chip" data-v="go">${esc(O.pauseGo)}</button><button class="chip" data-v="save">${esc(O.pauseSave)}</button><button class="chip dim" data-v="obs">${esc(O.pauseObs)}</button></div>`;
      bindHead();
      $$("#sPause [data-v]").forEach(b => b.onclick = async () => { const v = b.dataset.v; if (v === "obs") return observeMode(); R.dialogAnswer(st, "pause", "go"); await persistOnb(); if (v === "save") { toast("Сохранено — продолжишь с этого места"); return go(anyPattern() ? "today" : "area"); } sd(); });
      return;
    }
    if (q.kind === "mirror") {
      const M = q.mirror, T = O.mirrorTypes[M.type] || "";
      app.innerHTML = `${head("think")}${q.index === 0 && !q.note ? `<p class="small" id="sBridge" style="margin:0 0 6px">${esc(O.bridge)}</p>` : ""}<h1 class="q">${esc(O.qMirror)}</h1>
        <div class="card mark" id="sMirror"><div class="tiny">${esc(T)}${q.note ? ` · ${esc(q.note)}` : ""}</div><p style="margin:4px 0 0"><b>${esc(M.text)}</b></p>${M.why && M.why.length ? `<p class="tiny" id="sWhy" style="margin:6px 0 0">${esc(O.whyAsk)}: ${esc(M.why.join("; "))}.</p>` : ""}</div>
        <div class="chips col" id="sMOpts"><button class="chip" data-v="yes">${esc(O.mYes)}</button><button class="chip" data-v="partly">${esc(O.mPartly)}</button><button class="chip" data-v="no">${esc(O.mNo)}</button><button class="chip dim" data-v="own">${esc(O.mOwn)}</button><button class="chip dim" data-v="unsure">${esc(O.mUnsure)}</button></div><div id="sOwnBox"></div>`;
      bindHead();
      $$("#sMOpts [data-v]").forEach(b => b.onclick = () => { const v = b.dataset.v; if (v === "partly") return ownBox(q.id, "", "partly", M.text); if (v === "own") return ownBox(q.id, "моё правило, от первого лица", "own"); answer(q.id, v); });
      return;
    }
    if (q.kind === "thought") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(O.qThought)}</h1><p class="small muted">${esc(O.thoughtLead)}</p>
        <div class="chips col" id="sOpts">${q.options.map(([v, t]) => `<button class="chip" data-v="${esc(v)}">«${esc(t)}»</button>`).join("")}<button class="chip dim" id="sTOwn">${esc(O.thoughtOwn)}</button><button class="chip dim" data-v="__skip">${esc(O.thoughtSkip)}</button></div><div id="sOwnBox"></div>`;
      bindHead();
      $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer("thought", b.dataset.v));
      $("#sTOwn").onclick = () => ownBox("thought", "моя мысль или правило, как есть", "__own"); return;
    }
    if (q.kind === "ownrule") {
      app.innerHTML = `${head("think")}<h1 class="q">${esc(O.ownRuleTitle)}</h1><div class="card mark" id="sOwnRule"><p style="margin:0"><b>«${esc(q.text)}»</b></p></div><p style="margin:8px 0 4px"><b>${esc(O.ownRuleAsk)}</b></p>
        <div class="chips col" id="sOpts"><button class="chip" data-v="yes">${esc(O.ownRuleYes)}</button><button class="chip" id="sREdit">${esc(O.ownRuleEdit)}</button><button class="chip dim" data-v="no">${esc(O.ownRuleNo)}</button></div><div id="sOwnBox"></div>`;
      bindHead(); $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer("ownrule", b.dataset.v)); $("#sREdit").onclick = () => ownBox("ownrule", "", "edit", q.text); return;
    }
    if (q.kind === "check") {
      const ex = q.mode === "example";
      app.innerHTML = `${head("listen")}<p class="tiny" style="margin:0 0 4px">«${esc(R.trimEnd(q.mirrorText || ""))}»</p><h1 class="q">${esc(ex ? O.qCheckExample : O.qCheckPredict)}</h1>${ex ? "" : `<p class="tiny muted">${esc(O.predNote)}</p>`}
        <div class="chips col" id="sOpts">${ex ? "" : q.options.map(o => `<button class="chip" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<button class="chip" id="sEx">${esc(O.checkExampleOwn)}</button>${ex ? `<button class="chip dim" data-v="__later">${esc(O.checkLater)}</button>` : `<button class="chip dim" id="sOwn">${esc(O.own)}</button><button class="chip dim" data-v="__unknown">${esc(O.unknown)}</button>`}</div><div id="sOwnBox"></div>`;
      bindHead();
      $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer("check", b.dataset.v));
      $("#sEx").onclick = () => ownBox("check", "когда это было и что ты сделал", "__example");
      const ow = $("#sOwn"); if (ow) ow.onclick = () => ownBox("check", "", "__own"); return;
    }
    if (q.kind === "confirmB") {
      const F = O.sumBFields, m = f.mirror, dir = f.permission ? f.permission.text : f.goal && f.goal.text ? f.goal.text : O.observe;
      const basis = m && m.text ? [m.example ? `пример: «${m.example}»` : "", m.prediction ? `ожидание: «${m.prediction}»` : "", ...(m.basis || [])].filter(Boolean).join("; ") : f.need ? `важно: «${R.trimEnd(f.need)}»` : "";
      app.innerHTML = `${head("summary")}<h1 class="q">${esc(O.sumB)}</h1><div class="card mark" id="sSumB"><div class="plines">
          <div><span>${esc(F.teacher)}:</span> ${esc(uc1(f.roleLabel || ""))}</div><div><span>${esc(F.trigger)}:</span> ${esc(f.own ? `«${f.eventText}»` : uc1(f.when))}${f.meaning && f.meaning.text ? ` — «${esc(R.trimEnd(f.meaning.text))}»` : ""}</div>
          <div><span>${esc(F.mirror)}:</span> ${esc(mirrorLine(m, B))}</div>${basis ? `<div><span>${esc(F.basis)}:</span> ${esc(basis)}</div>` : ""}<div><span>${esc(F.change)}:</span> ${esc(uc1(R.trimEnd(dir)))}</div></div></div>
        <div class="chips col"><button class="chip" id="sBYes">${esc(m && m.text ? O.sumBYes : O.sumBNoMirror)}</button>${m && m.text ? `<button class="chip" id="sBFix">${esc(O.sumBFix)}</button><button class="chip dim" id="sBDrop">${esc(O.sumBDrop)}</button>` : ""}</div>`;
      bindHead();
      $("#sBYes").onclick = () => answer("confirmB", "yes");
      const fx = $("#sBFix"); if (fx) fx.onclick = async () => { R.storyFix(st, "mirror"); await persistOnb(); sd(); };
      const dr = $("#sBDrop"); if (dr) dr.onclick = async () => { R.storyFix(st, "dropMirror"); await persistOnb(); sd(); };
      return;
    }
    if (q.kind === "action") {
      app.innerHTML = `${head("support")}${q.dir ? `<p class="tiny" style="margin:0 0 4px">${esc(uc1(R.trimEnd(q.dir)))}</p>` : ""}<h1 class="q">${esc(O.qAction)}</h1>
        <div class="chips col" id="sActs">${q.options.map(a => `<button class="chip" data-a="${esc(a.id)}"><b>${esc(a.label)}</b><br><span class="small">«${esc(a.phrase)}»</span></button>`).join("")}<button class="chip dim" id="sOwn">${esc(O.ownAction)}</button><button class="chip dim" data-a="__observe">${esc(O.observe)}</button></div><div id="sOwnBox"></div>`;
      bindHead();
      $$("#sActs [data-a]").forEach(b => b.onclick = () => {
        const id = b.dataset.a; if (id === "__observe") return answer("action", "__observe");
        const a = q.options.find(x => x.id === id);
        $("#sOwnBox").innerHTML = `<label for="sPhrase">${esc(O.editPhrase)}</label><textarea id="sPhrase">${esc(a.phrase)}</textarea><div class="row tight"><button class="btn secondary sm" id="sPhraseOk">${esc(O.phraseOk)}</button></div>`;
        $("#sPhraseOk").onclick = () => { const t = $("#sPhrase").value.trim(); if (!t) return toast("Напиши фразу"); answer("action", id, t); };
      });
      $("#sOwn").onclick = () => ownBox("action", D.ownActionPh); return;
    }
    if (q.kind === "pred") {
      app.innerHTML = `${head("support")}<p class="tiny" style="margin:0 0 4px">«${esc(R.trimEnd(f.action.phrase))}»</p><h1 class="q">${esc(O.qPred)}</h1>
        <div class="chips col" id="sOpts">${q.base ? `<button class="chip" data-v="__base">«${esc(q.base)}»</button>` : ""}<button class="chip dim" id="sOwn">${esc(O.own)}</button><button class="chip dim" data-v="__unknown">${esc(O.predUnknown)}</button></div><div id="sOwnBox"></div>`;
      bindHead(); $$("#sOpts [data-v]").forEach(b => b.onclick = () => answer("pred", b.dataset.v)); $("#sOwn").onclick = () => ownBox("pred", "чего ожидаешь, одной фразой"); return;
    }
    if (q.kind === "danger") { app.innerHTML = `<h1 class="q">${esc(B.danger.label)}</h1><p>${esc(B.danger.text)}</p><div class="row"><a class="btn block sos" href="#help">${esc(OB.buttons.sos.label)}</a></div><div class="row tight"><button class="btn ghost" id="sDBack">${esc(D.back)}</button></div>`; $("#sDBack").onclick = back; return; }
    if (q.kind === "noEvent" || q.kind === "unsupported") {
      const ne = q.kind === "noEvent";
      app.innerHTML = `${head("think")}<h1 class="q">${esc(ne ? D.noEvent : D.unsupported)}</h1><p>${esc(ne ? D.noEventText : D.unsupportedText)}</p>
        <div class="chips col">${ne ? `<button class="btn block secondary" id="sOther">${esc(D.otherType)}</button>` : ""}<button class="btn block secondary" id="sOwnN">${esc(O.miss2Own)}</button><button class="btn block secondary" id="sObs">${esc(O.observe)}</button></div>`;
      bindHead();
      const o = $("#sOther"); if (o) o.onclick = async () => { Object.keys(st.answers).filter(k => k === "group" || k.startsWith("e:") || k.startsWith("n:") || k === "miss2").forEach(k => { delete st.answers[k]; }); st.order = st.order.filter(k => st.answers[k]); await persistOnb(); sd(); };
      $("#sOwnN").onclick = async () => { const g = (st.answers.group || {}).v; if (!g || g === "unknown") { Object.keys(st.answers).forEach(k => delete st.answers[k]); st.order = []; R.dialogAnswer(st, "group", "__own"); } else R.dialogAnswer(st, "miss2", "own"); await persistOnb(); sd(); };
      $("#sObs").onclick = () => observeMode(); return;
    }
    /* шаг: первый эксперимент — правило, внутри, когда, с кем, снаружи, зачем, чего ожидаю, после отмечу */
    const a = f.action && B.actions[f.action.id] ? B.actions[f.action.id] : null, m = f.mirror;
    const why = a ? (m && m.text ? `Проверяем правило «${R.trimEnd(m.text)}»: ${lc1(a.why)}` : a.why) : f.action && f.action.id === "own" ? (m && m.text ? `Проверяем правило «${R.trimEnd(m.text)}» в своём действии.` : "Твоё действие — твоя проверка.") : "";
    const pl = (B.pathLinks || {})[`${pathNum()}|${f.group}`] || "";
    const obs = !f.action || f.action.id === "observe";
    app.innerHTML = `${head("support")}<h1 class="q">${esc(O.stepTitle)}</h1>
      <div class="card mark" id="sStep"><div class="plines">
        ${m && m.text ? `<div><span>${esc(O.stepRule)}:</span> «${esc(R.trimEnd(m.text))}»</div>` : `<div><span>${esc(O.sumBFields.mirror)}:</span> ${esc(O.noMirror)}</div>`}
        ${f.permission ? `<div><span>${esc(O.stepInside)}:</span> ${esc(uc1(R.trimEnd(f.permission.text)))}</div>` : f.goal && f.goal.text ? `<div><span>${esc(O.sumBFields.change)}:</span> ${esc(uc1(R.trimEnd(f.goal.text)))}</div>` : ""}
        ${a ? `<div><span>${esc(O.stepWhen)}:</span> ${esc(a.cueTemplate)}</div>` : ""}
        <div><span>${esc(O.stepWho)}:</span> ${esc(f.roleLabel || "")}</div>
        <div><span>${esc(O.stepOutside)}:</span> ${esc(obs ? O.observeAction : `«${R.trimEnd(f.action.phrase)}»`)}</div>
        ${why ? `<div><span>${esc(O.stepWhy)}:</span> ${esc(why)}</div>` : ""}
        ${!obs ? `<div><span>${esc(O.stepExpect)}:</span> ${esc(f.pred ? `«${R.trimEnd(f.pred)}»` : O.predUnknown)}</div>` : ""}
        ${a ? `<div><span>${esc(O.stepAfter)}:</span> ${esc(a.afterQuestion)}</div>` : f.action && f.action.id === "own" ? `<div><span>${esc(O.stepAfter)}:</span> ${esc(D.ownCheck)}</div>` : ""}
      </div></div><p class="small" id="sPath" style="margin:6px 0">${esc(pl || (pathNum() ? OB.pathV7.neutralLink.replace("{lesson}", lc1(R.trimEnd(f.permission ? f.permission.short : f.goal && f.goal.text ? f.goal.text : O.observe))) : ""))}</p>
      <div class="row"><button class="btn block" id="sOk">${esc(O.stepOk)}</button></div>
      <div class="row tight"><button class="btn ghost" id="sChange">${esc(O.stepChange)}</button><button class="btn ghost" id="sObs3">${esc(O.observe)}</button></div>`;
    bindHead();
    const handoff = async observe => {
      const obsW = observe || obs;
      const kind = KIND_OF[f.role] || "other", label = f.roleLabel || "учитель";
      const title = f.permission ? R.trimEnd(f.permission.short || f.permission.text) : f.goal && f.goal.text ? R.trimEnd(f.goal.text) : "";
      S.event = null; S.areaExplicit = true;
      const pk = a ? a.packId : null;
      S.own = { text: uc1(f.eventText), packId: pk, version: C.contentVersion, area: S.area, origin: f.own ? "user_written" : "story_scene" };
      S.teacher = { kind, label, ownName: f.role === "__own" ? label : "", area: S.area, origin: "story_selected", role: f.role };
      S.case = { text: uc1(f.eventText), when: f.whenCase, date: null, repeat: null, origin: f.own ? "user_written" : "story_selected" };
      S.sting = { meaningId: f.meaning.id, text: f.meaning.text || "", lessonId: null, observe: null, origin: f.meaning.origin, repeat: null, reaction: f.reaction || null };
      const L = obsW ? X.lessonObserve : {
        id: "st:" + (a ? a.id : "own") + ":" + (f.permission ? f.permission.id : f.goal ? f.goal.id : "x"), family: true, packId: pk || "fairness", title: lc1(title || (a ? a.label : "свой шаг")), homeTitle: null,
        inner: f.permission ? R.trimEnd(f.permission.text) : "", action: f.action.phrase, skillId: a ? a.skillId : "boundary", signal: a ? a.cueTemplate : "", hypothesisId: null,
        template: { id: "st:" + (a ? a.id : "own"), title: lc1(title || ""), lessonTitle: lc1(title || ""), lessonAction: f.action.phrase, cueTemplate: a ? a.cueTemplate : "Когда это повторится", actionTemplate: f.action.phrase,
          afterQuestion: a ? a.afterQuestion : D.ownCheck, purpose: why, effortLabel: a ? a.effortLabel : "Один небольшой поступок", limits: a ? a.limits : "", smallerVersion: "Сделать только первую часть.", setup: [], skillId: a ? a.skillId : "boundary", packId: pk || "fairness", adapted: true, family: true } };
      S.want = obsW ? { kind: "observe", text: OB.plan.observeGoal, origin: "user_selected", lessonId: null } : (f.permission && f.permission.origin === "user_selected") || (f.goal && f.goal.origin === "user_selected")
        ? { kind: "lesson", key: "L:" + L.id, lessonId: L.id, text: uc1(L.title), origin: "user_selected", ownAction: f.action.phrase }
        : { kind: "own", text: uc1(title), origin: "user_written", lessonId: null, ownAction: f.action.phrase };
      S.confirmed = true; S.lesson = null; S.rejected = [];
      S.storyResult = { bank: B.version, sphere: S.area, role: f.role, roleLabel: f.roleLabel, group: f.group, scene: f.scene || null, own: !!f.own, eventText: f.eventText, meaning: f.meaning, thought: f.thought || "", reaction: f.reaction, reactionOrigin: f.reactionOrigin, now: f.now, later: f.later,
        mirror: f.mirror, need: f.need || null, permission: f.permission || null, goal: f.goal || null, action: f.action, pred: f.pred || "", answers: JSON.parse(JSON.stringify(st.answers)), order: [...st.order], trace: res.trace, asked: res.asked, confirmedAt: nowTs(), misses: st.misses || 0 };
      await startLesson(S, L);
    };
    $("#sOk").onclick = () => handoff(false);
    $("#sObs3").onclick = () => handoff(true);
    $("#sChange").onclick = async () => { R.storyFix(st, "action"); st.status = "asking"; await persistOnb(); sd(); };
  }
  /* v7: «свой случай» — тот же единый маршрут: нужна сфера и учитель; дальше — свой текст сцены в том же процессе */
  function ownRoute() {
    const S = onb();
    if (S.area && SB().spheres[S.area] && S.role) { S.sd = S.sd && S.sd.sphere === S.area && S.sd.role === S.role ? S.sd : null; if (!S.sd) S.sd = { bank: SB().version, sphere: S.area, role: S.role, roleLabel: S.roleLabel || null, answers: {}, order: [], rejected: [], misses: 0, status: "asking", startedAt: nowTs() };
      const st = S.sd; st.status = "asking"; const g = (st.answers.group || {}).v; if (!g) R.dialogAnswer(st, "group", "__own"); else if (g !== "__own") R.dialogAnswer(st, "miss2", "own"); persistOnb(); return go("sd"); }
    S.ownFirst = true; S.areaExplicit = false; persistOnb(); go("area");
  }
  /* v6.7.1: из диалога руководителя уже известны сфера, контекст и учитель — не спрашиваем их заново */
  const fromBossDialog = S => !!(S.dialog && S.area === "work" && S.ctx === "boss");
  function ownScenario() {
    const S = onb(), fromD = fromBossDialog(S);
    flow({ id: "onb-own", scope: "onb", title: "Свой случай", cancelLabel: "Назад", onCancel: () => go(S.area && S.area !== "own" ? (S.area === "work" && !S.ctx ? "workctx" : "cards") : "area"),
      steps: [
        { k: "own", q: "Что произошло?", lead: (fromD ? OB.dialog.ownCarry + " " : "") + "Одно событие, как запись камеры: без оценок и выводов.", type: "text", ph: "Например: коллега попросил подменить в выходной", req: "Напиши пару слов: что именно произошло" },
        { k: "pack", q: OB.own.theme, lead: OB.own.themeLead, type: "choice", opts: [...C.packs.map(pk => [pk.id, pk.title]), ["__unclear", OB.own.unclear]] },
      ],
      onDone: async ans => {
        S.event = null; S.own = { text: ans.own, packId: ans.pack === "__unclear" ? null : ans.pack, version: C.contentVersion, area: S.area && S.area !== "own" ? S.area : null }; S.case = null; S.sting = null; S.want = null; S.confirmed = false; S.step = "teacher";
        dropDraft("onb-sting-own", "onb"); dropDraft("onb-case-own", "onb"); dropDraft("onb-want-own", "onb");
        if (fromD) { S.teacher = { kind: "boss", label: X.teacherLabels.boss, ownName: "", area: "work", origin: "dialog_context" }; S.step = "case"; await persistOnb(); return go("case"); }
        await persistOnb(); go("teacher");
      } });
  }
  const suggestTeacher = S => S.area === "work" && S.ctx ? (X.workTeacher || {})[S.ctx] || null : null;
  const focusArea = S => { const ev = S.event ? variantById(S.event) : null; return ev ? ev.area : (S.own && S.own.area) || null; };
  /* Учитель: варианты только выбранной сферы и свой. «Это про другую сферу» — явная смена ветки с подтверждением. */
  function teacher() {
    const S = onb(); if (!S.event && !S.own) return go("cards");
    const ev = S.event ? variantById(S.event) : null; if (S.event && !ev) { S.event = null; persistOnb(); return go("cards"); }
    const evText = ev ? ev.text : S.own.text, sug = suggestTeacher(S), fa = focusArea(S);
    const role = ev && ev.area === "work" && X.ctxRole ? X.ctxRole[S.ctx] : null;
    /* Учителя — роли из текста карточки; выбранный контекст работы (руководитель / коллеги / клиенты) сужает до своей роли. */
    const kinds = ev ? (role && ev.teachers.includes(role) ? [role, "situation"] : ev.teachers) : (fa ? (X.variants.find(v => v.area === fa) || {}).teachers : null);
    const opts = (kinds ? X.teachers.filter(t => kinds.includes(t[0])) : X.teachers);
    seedDraft("onb-teacher", S.teacher ? { who: S.teacher.ownName ? "__own" : S.teacher.kind, who_own: S.teacher.ownName || "" } : (sug ? { who: sug } : null));
    const steps = [
      { k: "who", q: OB.teacher.title, lead: `«${evText}». ${OB.teacher.text}`, type: "choice", opts: [...opts, ...(fa ? [["__area", OB.teacher.otherArea]] : [])], own: true, ownPh: "Кто это, своими словами (имя не нужно)" },
      { k: "sw", q: OB.teacher.switchQ, lead: OB.teacher.switchLead.replace("{area}", lc1(areaLabel(fa) || "")), type: "choice", opts: [["yes", OB.teacher.switchYes], ["back", OB.teacher.switchNo]], skip: a => a.who !== "__area" },
    ];
    flow({ id: "onb-teacher", scope: "onb", steps, title: pathNum() ? `Учитель · ${pathNum()} · ${X.pathProfiles[String(pathNum())].displayName}` : "Учитель", cancelLabel: "Назад", onCancel: () => go(S.own ? "own" : "cards"),
      onDone: async ans => {
        if (ans.who === "__area") {
          dropDraft("onb-teacher", "onb");
          if (ans.sw === "yes") { stashBranch(S); S.event = null; S.own = null; S.case = null; S.sting = null; S.want = null; S.confirmed = false; S.teacher = null; S.areaExplicit = false; S.recogDone = true; S.unclearView = false; S.step = "area"; await persistOnb(); return go("area"); }
          await persistOnb(); return setTimeout(teacher, 0);
        }
        const kind = ans.who === "__own" ? "other" : ans.who; const label = ans.who === "__own" ? ans.who_own : (X.teacherLabels[kind] || "");
        S.teacher = { kind, label, ownName: ans.who === "__own" ? ans.who_own : "", area: fa };
        S.step = "case"; await persistOnb(); go("case");
      } });
    { const rc = readingCard("karma-teacher"); if (rc && app.dataset.flow !== "plan") app.insertAdjacentHTML("beforeend", rc); }
  }
  const packIdOf = S => (S.event && variantById(S.event) ? variantById(S.event).packId : (S.own ? S.own.packId : null)) || null;
  /* Последний случай: одна фраза (можно взять текст выбранной карточки), когда было, повторяется ли. Примеры — только выбранного варианта. */
  function caseScreen() {
    const S = onb(); if (!S.event && !S.own) return go("cards"); if (!S.teacher) return go("teacher");
    const ev = S.event ? variantById(S.event) : null, own = !ev;
    const tags = ev ? [ev.text] : [];
    if (S.case) seedDraft("onb-case-" + (ev ? ev.id : "own"), { text: S.case.text, when: S.case.when, date: S.case.date || undefined, repeat: S.case.repeat || undefined });
    const steps = [
      { k: "text", q: OB.case.title, lead: OB.case.lead, type: "text", ph: ev ? "Например: " + lc1(ev.text) : "", tags, req: "Одна короткая фраза: что произошло", skip: () => own },
      { k: "when", q: OB.case.when, lead: own ? `«${S.own.text}»` : "", type: "choice", opts: X.lastTime },
      { k: "date", q: "Когда именно?", lead: a => a.when === "week" ? "Любой день этой недели. Если не помнишь — пропусти." : "Если помнишь дату — укажи, если нет — пропусти.", type: "date", optional: true, def: a => a.when === "week" ? today() : "", min: a => a.when === "week" ? R.addDays(today(), -6) : "1990-01-01", max: () => today(), skip: a => a.when !== "week" && a.when !== "earlier" },
      { k: "repeat", q: OB.case.repeat, type: "choice", opts: X.repeat },
    ];
    flow({ id: "onb-case-" + (ev ? ev.id : "own"), scope: "onb", steps, title: "Последний случай", cancelLabel: "К учителю", onCancel: () => go("teacher"),
      onDone: async ans => {
        S.case = { text: own ? S.own.text : ans.text, when: ans.when, date: ans.date || null, repeat: ans.repeat || null, origin: own || ans.text !== ev.text ? "user_written" : "user_selected" };
        S.step = "sting"; await persistOnb(); go("sting");
      } });
  }
  /* Что задело: варианты, проверенные для этой формулировки, свой ответ, «пока не понимаю», «было, но не задело». Один вариант не устанавливает причину. */
  function sting() {
    const S = onb(); const ev = S.event ? variantById(S.event) : null;
    if (!ev && !S.own) return go("cards"); if (!S.case) return go("case");
    const evText = S.case.text || (ev ? ev.text : S.own.text);
    /* свой случай после диалога: выбранное там «что задевает» предлагается первым (подтверждает человек) */
    const dm = !ev && fromBossDialog(S) && S.dialog.answers && S.dialog.answers.meaning ? S.dialog.answers.meaning : null;
    const dmText = dm ? (dm.v === "__own" ? dm.text : ((variantById((B0 => { const e = Object.keys(S.dialog.answers).find(k => k.startsWith("e:") && S.dialog.answers[k].v === "yes"); return e && B0 ? B0.events[e.slice(2)].variantId : null; })(dialogFor(S))) || { meanings: [] }).meanings.find(m => m.id === dm.v) || {}).text) : null;
    const meanings = ev ? ev.meanings : (dmText ? [{ id: "dlg", text: R.trimEnd(dmText) }, ...X.ownMeanings.filter(m => m.text !== dmText)] : X.ownMeanings);
    const sid = ev ? "onb-sting-" + ev.id : "onb-sting-own";
    if (S.sting) seedDraft(sid, { m: S.sting.meaningId === "own" ? "__own" : S.sting.meaningId === "other" ? "__other" : S.sting.meaningId === "unsure" ? "__unsure" : S.sting.meaningId, m_own: S.sting.meaningId === "own" ? S.sting.text : undefined });
    const steps = [{ k: "m", q: OSg.title, lead: `«${evText}»`, type: "choice", opts: [...meanings.map(m => [m.id, m.text]), ...X.meaningExtra], own: true, ownPh: "Своими словами" }];
    flow({ id: sid, scope: "onb", steps, title: "Что задело", cancelLabel: "К случаю", onCancel: () => go("case"),
      onDone: async ans => {
        if (ans.m === "__none") { /* не задело: событие остаётся отмеченным, но не становится триггером; ответы по колоде не теряются */
          if (ev) { const pk = (S.picks || []).find(x => x.id === ev.id); if (pk) pk.notStung = true; S.event = null; S.case = null; S.sting = null; S.want = null; S.confirmed = false; await persistOnb(); toast("Хорошо: было, но не задело. Посмотрим другие."); return go("cards"); }
          S.own = null; S.case = null; S.sting = null; S.want = null; await persistOnb(); return go("area");
        }
        const mm = meanings.find(m => m.id === ans.m);
        const kind = mm ? mm.id : ans.m === "__own" ? "own" : ans.m === "__unsure" ? "unsure" : "other";
        const prev = S.sting && S.sting.meaningId;
        S.sting = { meaningId: kind, text: mm ? mm.text : (ans.m === "__own" ? ans.m_own : ""), lessonId: mm ? (mm.lessonId || null) : null, observe: mm && mm.observe ? mm.observe : null, origin: mm ? "user_selected" : (ans.m === "__own" ? "user_written" : ans.m === "__unsure" ? "user_unsure" : null), repeat: S.case.repeat || null, reaction: null };
        if (prev !== kind) { S.want = null; dropDraft(ev ? "onb-want-" + ev.id : "onb-want-own", "onb"); }
        S.confirmed = false; S.step = "want"; await persistOnb(); go("want");
      } });
  }
  /* Направления для выбранного случая: урок выбранного «что задело» первым, затем другие проверенные направления этого же варианта. */
  function wantOptions(S) {
    const ev = S.event ? variantById(S.event) : null, st = S.sting || {}, out = [], seen = new Set();
    const add = id => { const l = id && lessonView(id, ev ? ev.variantId : null); if (l && !seen.has(l.id)) { seen.add(l.id); out.push(["L:" + l.id, OB.want.prefix + l.title]); } };
    add(st.lessonId);
    if (st.observe) out.push(["O:" + st.meaningId, "Сначала понаблюдать: " + st.observe.title]);
    if (ev) ev.meanings.forEach(m => add(m.lessonId));
    else { const pk = C.packs.find(x => x.id === packIdOf(S)); if (pk) pk.lessons.forEach(l => add(l.id)); }
    return out.slice(0, 5);
  }
  /* «Что хочу попробовать иначе»: явный выбор направления до предложения урока. Свободный текст не сопоставляется с причиной по ключевому слову. */
  function want() {
    const S = onb(); const ev = S.event ? variantById(S.event) : null;
    if (!ev && !S.own) return go("cards"); if (!S.sting) return go("sting");
    const W = OB.want, wid = ev ? "onb-want-" + ev.id : "onb-want-own", opts = wantOptions(S);
    if (S.want) seedDraft(wid, { w: S.want.kind === "own" ? "__own" : S.want.kind === "observe" && !S.want.meaningId ? "__observe" : S.want.key, w_own: S.want.kind === "own" ? S.want.text : undefined });
    const lead = `«${S.case.text || (ev ? ev.text : S.own.text)}»${S.sting.text ? ` · ${lc1(S.sting.text)}` : ""}. ${W.lead}`;
    flow({ id: wid, scope: "onb", title: "Направление", cancelLabel: "Назад", onCancel: () => go("sting"),
      steps: [{ k: "w", q: W.title, lead, type: "choice", opts: [...opts, ["__observe", W.observe]], own: true, ownPh: W.ownPh }],
      onDone: async ans => {
        const v = ans.w;
        if (v === "__own") S.want = { kind: "own", text: uc1(ans.w_own || ""), origin: "user_written", lessonId: null };
        else if (v === "__observe") S.want = { kind: "observe", text: OB.plan.observeGoal, origin: "user_selected", lessonId: null };
        else if (v.startsWith("L:")) { const l = lessonView(v.slice(2), S.event || null); S.want = { kind: "lesson", key: v, lessonId: l.id, text: uc1(l.title), origin: "user_selected" }; }
        else if (v.startsWith("O:")) S.want = { kind: "observe", key: v, meaningId: v.slice(2), text: uc1(S.sting.observe ? S.sting.observe.title : OB.plan.observeGoal), origin: "user_selected", lessonId: null };
        S.lesson = null; S.rejected = []; S.confirmed = false; S.step = "summary"; await persistOnb(); go("summary");
      } });
  }
  /* «Вот с чего начинаем»: сфера → с кем → что произошло → что задело → что хочу иначе. Всё — из ответов человека. */
  function summary() {
    const S = onb(); if (!S.teacher) return go("teacher"); if (!S.case) return go("case"); if (!S.sting) return go("sting"); if (!S.want) return go("want");
    const ev = S.event ? variantById(S.event) : null;
    const areaId = ev ? ev.area : (S.own && S.own.area) || null, areaTxt = !areaId ? "своя ситуация" : lc1(areaLabel(areaId));
    const ctxTxt = ev && ev.area === "work" && S.ctx && S.ctx !== "any" ? ` · ${lc1(ctxLabel(S.ctx))}` : "";
    const tl = S.teacher.ownName || S.teacher.label;
    const num = pathNum(), t = num ? X.paths[num] : null;
    const hint = t && ev && (ev.pathHint || []).includes(Number(num));
    const rep = S.case.repeat ? (OPth.repeat[S.case.repeat] || "") : "", OSm = OB.summary;
    app.innerHTML = `<h1>${esc(OSm.title)}</h1>
      <div class="card mark"><div class="plines" id="sumLines">
        <div><span>${esc(OSm.area)}:</span> ${esc(areaTxt)}${esc(ctxTxt)}</div>
        <div><span>${esc(OSm.teacher)}:</span> ${esc(tl)}</div>
        <div><span>${esc(OSm.scenario)}:</span> ${esc(S.case.text)}${rep ? ` <span class="muted small">(${esc(rep)})</span>` : ""}</div>
        <div><span>${esc(OSm.sting)}:</span> ${S.sting.text ? esc(lc1(S.sting.text)) : esc(OPth.stingUnknown)}</div>
        <div><span>${esc(OSm.want)}:</span> ${esc(lc1(S.want.text))}</div>
      </div></div>
      <div class="row"><button class="btn block" id="ok">${esc(OSm.ok)}</button></div>
      <div class="row tight"><button class="btn ghost" id="fix">${esc(OSm.fix)}</button></div><div id="fixbox"></div>
      ${t ? `<div class="card tight"><div class="k">${ic("star")}Тема твоего пути · ${num}</div><p style="margin:2px 0 4px"><b>${esc(t.title)}</b></p><p class="small" style="margin:0 0 4px">${esc(t.description)}</p><p class="small muted" style="margin:0">${esc(hint ? t.offer : OPth.other)}</p>
        <details class="plain"><summary>${esc(OPth.more)}</summary><p class="small">${esc(t.name)} · ${esc(t.theme)}. ${esc(t.question)}</p><p class="tiny">${esc(OPth.note)}</p></details></div>` : `<p class="tiny" style="margin-top:10px">${esc(OPth.other)} <a href="#birth">${esc(OPth.addDate)}</a></p>`}`;
    $("#ok").onclick = async () => { S.confirmed = true; S.lesson = null; S.rejected = S.rejected || []; S.pickAlt = false; S.step = "lesson"; await persistOnb(); go("lesson"); };
    $("#fix").onclick = () => { $("#fixbox").innerHTML = `<p class="small muted" style="margin:6px 0 4px">${esc(OSm.fixWhat)}</p><div class="chips"><a class="chip" href="#teacher">${esc(OSm.fixTeacher)}</a><a class="chip" href="#case">${esc(OSm.fixCase)}</a><a class="chip" href="#sting">${esc(OSm.fixSting)}</a><a class="chip" href="#want">${esc(OSm.fixWant)}</a></div>`; };
  }
  /* Режим наблюдения: сюжет без назначенного урока и без выдуманной даты старта. */
  async function observeMode(card) {
    const p = activePattern();
    if (!p) { const np = { id: R.uuid(), title: card ? card.text : "Наблюдаю", packId: card ? card.packId : null, contexts: [], status: "observe", startDate: null, practiceStartDate: null, createdAt: nowTs(), hypothesisVersionId: null, experimentId: null, queue: [], legacy: false }; await savePattern(np); }
    P.onb = null; P.seen.start = true; P.lastResult = { kind: "observe" }; await saveProfile(); go(P.seen.map ? "today" : "map");
  }
  /* Урок по значению: глобальный id (направление может быть из другого пакета). Наблюдение по значению — предметный шаг без причины. */
  const lessonByMeaning = S => { const st = S.sting || {}; if (st.lessonId) return lessonView(st.lessonId, S.event || null); if (st.observe) return Object.assign({}, X.lessonObserve, { id: "observe:" + (S.event || "own") + ":" + (st.meaningId || ""), title: st.observe.title, action: st.observe.action, signal: st.observe.signal, headline: "Первый шаг — " + st.observe.title }); return null; };
  /* Урок по выбранному направлению «что хочу иначе»; свои слова — урок по «что задело», если он есть, иначе наблюдение и выбор направления. */
  const lessonByWant = S => { const w = S.want; if (!w) return lessonByMeaning(S); if (w.kind === "lesson") return lessonView(w.lessonId, S.event || null); if (w.kind === "observe") return w.meaningId && S.sting && S.sting.observe ? lessonByMeaning(S) : null; if (w.kind === "own" && w.lessonId) return lessonView(w.lessonId, S.event || null); return lessonByMeaning(S); };
  function lessonsFor(S) {
    const vv = S.event ? variantById(S.event) : null;
    if (vv) { const seen = new Set(); return vv.meanings.filter(m => m.lessonId && !seen.has(m.lessonId) && seen.add(m.lessonId)).map(m => lessonView(m.lessonId, vv.variantId)); }
    const ids = new Set(), out = []; const add = pk => { if (!pk) return; pk.lessons.forEach(l => { if (!ids.has(l.id)) { ids.add(l.id); out.push(Object.assign({ packId: pk.id, packTitle: pk.title }, l)); } }); };
    const bm = lessonByWant(S) || lessonByMeaning(S); if (bm && bm.packId) add(C.packs.find(x => x.id === bm.packId));
    add(C.packs.find(x => x.id === packIdOf(S)));
    return out;
  }
  /* Предварительный урок — по ситуации и подтверждённому значению, не по числу. Причина не объявляется найденной: проверим в течение недели. */
  function lesson() {
    const S = onb(); if (!S.sting || !S.teacher) return go(S.sting ? "teacher" : "cards"); if (!S.want) return go("want"); if (!S.confirmed) return go("summary");
    const all = lessonsFor(S), rejected = S.rejected || [];
    const byMeaning = lessonByWant(S);
    const L = S.lesson || (byMeaning && !rejected.includes(byMeaning.id) ? byMeaning : null) || X.lessonObserve;
    const tl = S.teacher.ownName ? S.teacher.ownName : S.teacher.label;
    const ev = S.event ? eventById(S.event) : null, evText = (S.case && S.case.text) || (ev ? ev.text : (S.own ? S.own.text : ""));
    if (S.pickAlt) {
      const alts = all.filter(l => !rejected.includes(l.id) && l.id !== L.id);
      app.innerHTML = `<h1 class="q">${esc(all.length ? OB.lesson.alt : OB.own.theme)}</h1><p class="muted small">Учитель и ситуация сохранены. Урок предварительный — его можно уточнить позже.</p>
        <div class="chips col">${all.length ? alts.map(l => `<button class="chip" data-l="${l.id}">${esc(uc1(l.title))}</button>`).join("") : C.packs.map(pk => `<button class="chip" data-pk="${pk.id}">${esc(pk.title)}</button>`).join("")}<button class="chip dim" data-l="__observe">${esc(X.lessonObserve.headline)}</button></div>
        <div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
      $$("[data-l]").forEach(b => b.onclick = async () => { const id = b.dataset.l; S.lesson = id === "__observe" ? X.lessonObserve : all.find(l => l.id === id); S.pickAlt = false; await persistOnb(); lesson(); });
      $$("[data-pk]").forEach(b => b.onclick = async () => { S.own = Object.assign({}, S.own || { text: evText }, { packId: b.dataset.pk }); S.lesson = null; S.rejected = []; S.pickAlt = false; await persistOnb(); lesson(); });
      $("#bk").onclick = async () => { S.pickAlt = false; await persistOnb(); lesson(); };
      return;
    }
    const observe = L.id === X.lessonObserve.id || String(L.id).startsWith("observe:");
    /* Связь с темой пути — одним предложением и только при редакторской связке события с числом. */
    const pn = pathNum(), pathLink = pn && ev && (ev.pathHint || []).includes(Number(pn)) ? `<p class="tiny" style="margin:0 0 6px">В твоём пути «${esc(X.pathProfiles[String(pn)].displayName)}» это часть темы: ${esc(X.paths[String(pn)].theme)}.</p>` : "";
    app.innerHTML = `${pathLink}<p class="tiny" style="margin:0 0 4px">${esc(evText)}${S.sting.text ? ` · ${esc(lc1(S.sting.text))}` : ""}</p>
      <p class="muted small" style="margin:0 0 8px">${esc(OB.lesson.intro)}</p>
      <div class="card mark">
        <p style="margin:0 0 6px"><b>${esc(OB.lesson.teacherLead)} ${esc(tl)}.</b></p>
        ${observe ? `<p style="margin:0 0 8px"><b>${esc(L.headline || X.lessonObserve.headline)}</b></p><p class="small" style="margin:0 0 4px">${esc(uc1(L.action))}. ${esc(X.lessonObserve.note)}</p>` : `<p style="margin:0 0 10px"><b>${esc(OB.lesson.lessonLead)} ${esc(L.title)}.</b></p>
        <p class="small" style="margin:0"><b>${esc(OB.lesson.action)}</b> ${esc(lc1(L.action))}.</p>
        ${L.inner ? `<details class="plain"><summary>Возможное внутреннее разрешение — проверим позже</summary><p class="small" style="margin:0 0 4px"><b>${esc(OB.lesson.inner)}</b> ${esc(lc1(L.inner))}. Это кандидат из каталога, не вывод о тебе: подтвердишь или заменишь на шаге «Что я себе разрешаю».</p></details>` : ""}`}
      </div>
      <div class="row"><button class="btn block" id="go">${esc(observe ? "Начать с наблюдения" : "Настроить свой шаг")}</button></div>
      <div class="row tight"><button class="btn ghost" id="rej">${esc(observe ? "Выбрать направление" : OB.lesson.reject)}</button><a class="btn ghost" href="#summary">Назад</a></div>
      ${readingCard("karma-lesson")}`;
    $("#rej").onclick = async () => { if (!observe && !rejected.includes(L.id)) rejected.push(L.id); S.rejected = rejected; S.lesson = null; S.pickAlt = true; await persistOnb(); lesson(); };
    $("#go").onclick = () => startLesson(S, L);
  }
  /* Создание сюжета из входа. Происхождение каждой части резюме сохраняется; редакционная гипотеза не становится «подтверждённым» без явного ответа.
     Даты честные: дата случая (dateKey эпизода) отдельно от старта практики (practiceStartDate): день 1 — день, когда человек начал практику, вечером — завтра. */
  /* v6.7.2: единое правило смены сюжета для всех входов. Новый разбор можно пройти, не трогая текущую практику;
     принятие нового шага при действующем сюжете требует явного выбора: перейти (текущий — в историю, не прохождение и не флаг),
     оставить текущий и сохранить новый на потом, или вернуться к разбору. До выбора ничего не записывается. */
  async function startLesson(S, L) {
    const cur = anyPattern();
    if (!cur) return startLessonNow(S, L);
    const O = OB.conflict, cx = expOf(cur), cv = cx && cx.kind === "plan" ? R.planView(cx) : null;
    const newText = S.want && S.want.text ? S.want.text : uc1(L.title || "");
    app.innerHTML = `<h1 class="q">${esc(O.title)}</h1><p class="muted small">${esc(O.lead)}</p>
      <div class="card tight" id="cfCur"><div class="k">${esc(O.current)}</div><div class="small"><b>${esc(cur.title || "")}</b>${cv && cv.action ? `<br>${esc(cv.action)}` : ""}</div></div>
      <div class="card tight mark" id="cfNew"><div class="k">${esc(O.next)}</div><div class="small">${esc(newText)}</div></div>
      <div class="chips col"><button class="btn block" id="cfSwitch">${esc(O.switch)}</button><button class="btn block secondary" id="cfLater">${esc(O.later)}</button><button class="btn ghost" id="cfBack">${esc(O.back)}</button></div>
      <p class="tiny muted" style="margin:6px 0 0">${esc(O.note)}</p>`;
    $("#cfSwitch").onclick = async () => { const b = $("#cfSwitch"); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = O.switchSure; return; } archivePattern(cur, "new_story"); await savePattern(cur); return startLessonNow(S, L); };
    $("#cfLater").onclick = async () => {
      const snap = JSON.parse(JSON.stringify(S)); delete snap.dialog; delete snap.fdialog; delete snap.sd;
      P.savedScenarios = [...(P.savedScenarios || []), { id: "onb-" + R.uuid(), kind: "onb", onb: snap, lesson: JSON.parse(JSON.stringify(L)), text: newText, recognition: newText, version: C.contentVersion, routingVersion: X.routingVersion, savedAt: nowTs(), area: S.area || null }];
      P.onb = null; await saveProfile(true); toast(O.saved); go("today");
    };
    $("#cfBack").onclick = () => go(S.storyResult ? "sd" : S.familyResult ? "fdialog" : S.dialogResult ? "dialog" : "lesson");
  }
  async function startLessonNow(S, L) {
    const ts = nowTs(), k = today(), T = S.teacher, ev = S.event ? eventById(S.event) : null, cs = S.case || {};
    /* Пакет сюжета — по направлению (уроку), иначе по событию: практика следует за подтверждённым значением. */
    const packId = L.packId || packIdOf(S), pk = C.packs.find(x => x.id === packId);
    const evText = ev ? ev.text : S.own.text, caseText = cs.text || evText;
    const hasCase = !!cs.when && cs.when !== "none" && !(cs.when === "earlier" && !cs.date);
    const caseDate = cs.when === "today" ? k : (cs.date && R.isKey(cs.date) ? cs.date : k);
    const practiceStart = hasCase ? R.practiceStartFor({ todayKey: k, hour: hour(), times: P.times, actedToday: false }) : null;
    const tl = T.ownName || T.label, observe = L.id === X.lessonObserve.id || String(L.id).startsWith("observe:");
    const scenario = { origin: ev ? "event" : "own", eventId: ev ? ev.eventId : null, variantId: ev ? ev.variantId : null, routingVersion: X.routingVersion, areaExplicit: !!S.areaExplicit, wantText: S.want ? S.want.text : "", wantOrigin: S.want ? S.want.origin : null, wantKind: S.want ? S.want.kind : null, eventText: evText, eventOrigin: ev ? "user_selected" : "user_written", caseText, caseOrigin: cs.origin || (ev ? "user_selected" : "user_written"), meaningId: S.sting.meaningId, meaningText: S.sting.text || "", meaningOrigin: S.sting.origin, repeat: cs.repeat || S.sting.repeat || null, reaction: null, reactionOrigin: null, area: ev ? ev.area : (S.own && S.own.area) || null, ctx: ev && ev.area === "work" ? S.ctx || null : null, version: C.contentVersion, recognition: caseText, own: ev ? "" : evText, confirmed: S.confirmed ? "yes" : "no", habitualReaction: (S.sting && S.sting.reaction) || null, dialog: S.dialogResult || null };
    const p = { id: R.uuid(), title: pk ? pk.title : shortTitle(caseText), packId: packId || null, contexts: tl ? [tl] : [], status: hasCase ? "active" : "observe", startDate: practiceStart, practiceStartDate: practiceStart, practiceStartOrigin: "user", caseDate: hasCase ? caseDate : null, firstDay: { kind: phase(), date: k, at: ts, taken: false }, createdAt: ts, hypothesisVersionId: null, experimentId: null, queue: [], legacy: false,
      scenario, teacher: { kind: T.kind, label: tl, what: caseText },
      lesson: { id: L.id, title: L.title, homeTitle: L.homeTitle || null, inner: L.inner || "", action: L.action, skillId: L.skillId, hypothesisId: L.hypothesisId || null, signal: L.signal, status: "preliminary", chosenAt: ts, rejected: S.rejected || [], origin: "editorial_hypothesis", basis: { eventId: ev ? ev.eventId : null, variantId: ev ? ev.variantId : null, meaningId: S.sting.meaningId } },
      firstPlan: { id: L.id, text: uc1(L.action), skill: L.skillId, signal: L.signal, action: L.action }, skillId: L.skillId, habitualResponse: (S.sting && S.sting.reaction) ? uc1(R.trimEnd(S.sting.reaction)) : null, habitualResponseOrigin: (S.sting && S.sting.reaction) ? "dialog_user" : null };
    /* Разрешение из каталога — кандидат: хранится с происхождением, подтверждается человеком на шаге «Что я себе разрешаю». */
    if (L.inner) { p.permission = L.inner; p.permissionSource = { origin: "lesson", hypothesisVersionId: null, confirmed: false }; }
    /* v6.10: семейный разбор — зеркало хранится отдельно от учителя: значение, тип, статус и источник; разрешение выбрано человеком */
    if (S.familyResult) {
      const fr = S.familyResult; p.familyResult = fr; p.title = shortTitle(caseText); /* заголовок — сцена с учителем, не название пакета */ p.scenario.family = true; p.scenario.consequenceNow = fr.now || ""; p.scenario.consequenceLater = fr.later || "";
      if (fr.mirror && fr.mirror.text) p.mirror = { text: fr.mirror.text, type: fr.mirror.type, status: fr.mirror.status, origin: fr.mirror.origin, example: fr.mirror.example || "", prediction: fr.mirror.prediction || "", candidateId: fr.mirror.id || null, at: ts, history: [], evidence: [] };
      else p.mirror = { text: "", status: (fr.mirror && fr.mirror.status) || "unknown", origin: "none", at: ts, history: [], evidence: [] };
      if (fr.need) p.need = fr.need;
      if (fr.permission) { p.permission = fr.permission.text; p.permissionSource = { origin: fr.permission.origin === "user_written" ? "user" : "dialog_user", hypothesisVersionId: null, confirmed: true, at: ts }; }
      else if (!observe) { p.permission = ""; p.permissionSource = null; }
    }
    /* v7: единая модель сюжета — сфера, учитель, сцена, триггер, первая мысль, реакция, последствия, зеркало (статус, тип, версия, источник), потребность, цель, разрешение */
    if (S.storyResult) {
      const fr = S.storyResult; p.storyResult = fr; p.storyId = p.id; p.sphere = fr.sphere; p.title = shortTitle(caseText); p.scenario.story = true; p.scenario.consequenceNow = fr.now || ""; p.scenario.consequenceLater = fr.later || ""; p.scenario.trigger = fr.meaning && fr.meaning.text || "";
      if (fr.thought) { p.thought = fr.thought; p.thoughtOrigin = "story_user"; }
      p.habitualResponseOrigin = fr.reactionOrigin === "user_written" ? "user_written" : p.habitualResponseOrigin;
      const mt = fr.mirror && fr.mirror.text;
      p.mirror = mt ? { text: fr.mirror.text, type: fr.mirror.type, status: fr.mirror.status, origin: fr.mirror.origin, example: fr.mirror.example || "", prediction: fr.mirror.prediction || "", candidateId: fr.mirror.id || null, basis: fr.mirror.basis || [], at: ts, version: 1, versions: [{ version: 1, text: fr.mirror.text, at: ts, source: fr.mirror.origin }], history: [], evidence: [], altPending: true }
        : { text: "", status: "searching", origin: "none", at: ts, version: 0, versions: [], history: [], evidence: [] };
      if (fr.goal && fr.goal.id !== "observe" && fr.need) p.need = fr.need;
      if (fr.permission) { p.permission = fr.permission.text; p.permissionSource = { origin: fr.permission.origin === "user_written" ? "user" : "dialog_user", hypothesisVersionId: null, confirmed: true, at: ts }; }
      else { p.permission = ""; p.permissionSource = null; }
      if (fr.goal && fr.goal.text) p.goalText = fr.goal.text;
      p.lesson.status = "confirmed"; p.lesson.origin = "story_user"; /* урок выбран человеком в разборе (разрешение или цель), а не назначен каталогом */
    }
    /* Личный план — черновик из шаблона: активируется только после заполнения момента и действия словами человека. */
    const tpl = templateFor(L, S), basis = [ev ? ev.id : null, S.sting.meaningId ? "meaning:" + S.sting.meaningId : null].filter(Boolean);
    /* Цель подтверждена на шаге «что хочу иначе», если урок совпал с выбранным направлением; иначе — проверка цели на экране шага. */
    const W = S.want || {}, wantMatches = (W.kind === "lesson" && W.lessonId === L.id) || (W.kind === "observe" && observe) || (W.kind === "own" && !S.lesson);
    const desired = wantMatches ? (W.kind === "lesson" ? uc1(L.title) : W.text) : "";
    const x = Object.assign(R.planFromTemplate({ template: tpl.template, kind: tpl.kind, patternId: p.id, lessonId: L.id, skillId: L.skillId, basisIds: basis, painText: S.sting.text || "", desiredChange: desired, createdAt: ts, mode: tpl.mode, once: tpl.once }), { id: R.uuid(), hypothesisVersionId: null, lessonId: L.id }); x.lineageId = x.id;
    if (desired) { x.goalOrigin = W.kind === "own" ? "user_written" : W.kind === "observe" ? "observe" : "user_confirmed"; x.goalAt = ts; }
    /* v6.7.1: своё действие из диалога — слова человека, шаблон только задаёт рамку момента */
    if (W.ownAction && wantMatches) x.actionUser = uc1(W.ownAction);
    if (S.storyResult) { x.prediction = S.storyResult.pred || ""; x.predictionOrigin = S.storyResult.pred ? "story_user" : null; x.mirrorVersion = p.mirror ? p.mirror.version : 0; }
    p.experimentId = x.id; await saveExp(x); await savePattern(p);
    if (hasCase) {
      const e = { id: R.uuid(), patternId: p.id, linkStatus: "confirmed", occurredAt: ts, loggedAt: ts, dateKey: caseDate, dateApprox: cs.date || cs.when === "today" ? null : cs.when, tz: R.tz(), event: caseText, person: tl, emotion: null, intensity: null, response: null, verificationStatus: "onboarding", isRehearsal: false, legacy: false, meaning: S.sting.text || null };
      await saveEpisode(e);
      await saveResearch({ patternId: p.id, modules: { episode: { status: "done", dateKey: k, doneAt: ts, answers: { source: "onboarding", episodeId: e.id, response: null } } } });
    }
    /* Остальные события «цепляет» — на потом: сохранённые направления, не записи случаев. */
    const others = R.deckYes(S).filter(c => c.id !== (ev && ev.id) && !c.notStung);
    if (others.length) { const have = new Set((P.savedScenarios || []).map(x => x.id)); P.savedScenarios = [...(P.savedScenarios || []), ...others.filter(c => !have.has(c.id)).map(c => ({ id: c.id, kind: "event", packId: c.packId, text: c.text, recognition: c.text, version: C.contentVersion, routingVersion: X.routingVersion, savedAt: ts, area: c.area || (variantById(c.id) || {}).area || null }))]; }
    P.onb = null; P.seen.start = true; P.lastResult = { kind: "lesson", title: observe ? (L.headline || X.lessonObserve.headline) : L.title, plan: uc1(L.action), observe: !hasCase };
    ["onb-teacher", "onb-own", "onb-case-" + (ev ? ev.id : "own"), ev ? "onb-sting-" + ev.id : "onb-sting-own", ev ? "onb-want-" + ev.id : "onb-want-own"].forEach(id => dropDraft(id, "onb"));
    await saveProfile(); go("plan");
  }
  /* Шаблон для урока: карточка каталога по id урока; наблюдение — предметная карточка (деньги) или общий стартовый план; свои слова — стартовый план по навыку. */
  function templateFor(L, S) {
    const id = L && L.id || "";
    if (L && L.family && L.template) return { template: Object.assign({ catalogVersion: PR.catalogVersion }, L.template), kind: "card", mode: null, once: false };
    const ad = adaptedCard(id, (L && L.variantId) || (S && S.event) || null);
    if (ad) return { template: Object.assign({ catalogVersion: PR.catalogVersion }, ad), kind: "card", mode: PR.modes[id] || null, once: PR.once.includes(id) };
    if (PR.cards[id]) return { template: Object.assign({ catalogVersion: PR.catalogVersion }, PR.cards[id]), kind: "card", mode: PR.modes[id] || null, once: PR.once.includes(id) };
    const st = (S && S.sting) || {};
    if (String(id).startsWith("observe:") || id === X.lessonObserve.id) {
      const fam = S && S.event && variantById(S.event) ? variantById(S.event).eventId : null;
      const ob = PR.observations.find(o => fam && o.eventId === fam && o.meaningId === st.meaningId);
      if (ob) return { template: Object.assign({ catalogVersion: PR.catalogVersion }, ob, { countsAsBehaviorChange: false }), kind: "observation", mode: "observation", once: false };
      const f = PR.fallback.observe, obs = st.observe || null;
      return { template: Object.assign({ catalogVersion: PR.catalogVersion }, f, obs ? { cueTemplate: "Когда " + lc1(obs.signal), actionTemplate: uc1(obs.action) } : {}), kind: "fallback", mode: "observation", once: false };
    }
    const bySkill = { pause: "pause", need: "need" }[L && L.skillId] || "pause";
    return { template: Object.assign({ catalogVersion: PR.catalogVersion }, PR.fallback[bySkill], L && L.action ? { actionTemplate: uc1(L.action) } : {}), kind: "fallback", mode: "behavior", once: false };
  }
  /* Карта ближайшего дня: общая схема до обычной главной. Показывается один раз; повторно — в «Как пользоваться». */
  function mapScreen() {
    const M = OB.map, p = anyPattern(), icons = ["sunrise", "flame", "moon"];
    app.innerHTML = `<h1>${esc(M.title)}</h1>
      <div class="card">${M.lines.map((l, i) => `<div class="icline" style="margin:6px 0">${ic(icons[i] || "star")}<p style="margin:4px 0 0">${esc(l)}</p></div>`).join("")}</div>
      <p class="small muted">${esc(M.note)}</p>
      ${p && planText(p) ? `<div class="card mark tight"><p class="small" style="margin:0"><b>${esc(OB.firstDay.step)}</b> ${esc(lc1(planText(p)))}.</p></div>` : ""}
      <div class="row"><button class="btn block" id="go">${esc(M.cta)}</button></div>`;
    $("#go").onclick = async () => { P.seen.map = true; await saveProfile(true); go("today"); };
  }
  /* =================== ЛИЧНЫЙ ШАГ (v6.3) ===================
     Настройка (черновик плана): цель подтверждается человеком, условия заполняются его словами, «Попробую» — после готовности.
     Правка принятого плана — отдельный черновик P.planDraft {patternId, planId, baseVersion, w, show}: сохраняется по вводу и при уходе,
     восстанавливается после перезагрузки и помощи; действующий план меняется только по «Сохранить изменения»; «Отменить изменения» удаляет черновик. */
  let planFlush = null;
  const learningText = p => { const x = expOf(p); return x && x.goalConfirmed && x.desiredChange ? lc1(x.desiredChange) : (p && p.lesson ? lc1(p.lesson.title) : ""); };
  /* Сопровождение дня: одна мысль, сохраняется на день и сменяется вместе с планом; не создаёт действие и не даёт прогресса. */
  function companionFor(p) {
    if (!p || P.companionOff) return null;
    const x = expOf(p), k = today(), id = x ? x.id : null;
    if (P.companion && P.companion.date === k && P.companion.planId === id && P.companion.ver === (x && x.version)) return P.companion;
    const obsMode = !x || x.mode === "observation" || p.status === "observe";
    const pv = x && x.kind === "plan" ? R.planView(x) : null;
    const c = R.pickCompanion({ companions: X.pathCompanion, tips: X.lessonTips, observeTip: X.observeTip, pathNumber: pathNum(), lessonId: obsMode ? null : (x && (x.lessonId || (p.lesson && p.lesson.id))) || null, hasPlan: !obsMode && planReady(p).ready, ownAction: !!(pv && pv.own), ownText: OB.companion.own, tip: x && x.tip || "" });
    if (!c) return null;
    P.companion = Object.assign({ date: k, planId: id, ver: x && x.version }, c); saveProfile(true); return P.companion;
  }
  const companionHTML = p => { const c = companionFor(p); return c ? `<p class="small" style="margin:0 0 6px" id="companion"><b>${esc(OB.companion.title)}:</b> ${esc(c.text)}</p>` : ""; };
  /* Связь подтверждённой истории с темой пути — только редакторская пара «число × вариант карточки». */
  /* v7: связь с темой пути — только содержательная пара «число × вид ситуации»; иначе нейтрально «Сейчас на твоём пути — [урок]» */
  const pathLinkText = p => { const n = pathNum(); if (!n || !p) return ""; if (p.storyResult) { const t = (X.stories.pathLinks || {})[`${n}|${p.storyResult.group}`]; return t || (learningText(p) ? OB.pathV7.neutralLink.replace("{lesson}", learningText(p).replace(/\.$/, "")) : ""); } const vid = p.scenario && p.scenario.variantId; return vid && p.scenario.confirmed === "yes" ? (X.pathLinks || {})[`${n}|${vid}`] || "" : ""; };
  const pathLineHTML = () => { const n = pathNum(); return n ? `<a class="pathline" href="#symbol">${ic("star", "")}<span>${esc(OB.pathV7.homeLink.replace("{n}", n))} · ${esc(X.pathProfiles[String(n)].displayName)}</span></a>` : ""; };
  /* v7: статус зеркала — честно: пока ищем / узнано / есть пример / проверяем в практике / уточнено по опыту / не подходит */
  const mirrorStatusText = p => { const M = p && p.mirror; if (!M) return ""; const S = X.stories.mirrorStatus; if (!M.text) return S.searching; const x = expOf(p), acc = x && x.kind === "plan" && x.planStatus === "accepted"; if ((M.status === "recognized" || M.status === "example") && acc) return S.practice + (M.example ? ` · ${S.example}` : ""); return S[M.status] || M.status; };
  function planScreen(arg) {
    const p = anyPattern(); if (!p) return go("today");
    const x = expOf(p); if (!x) return go("today");
    const OPl = OB.plan, mode = arg || "";
    if (x.kind !== "plan") return legacyPlanUpgrade(p, x);
    if (mode === "adjust") return planAdjust(p, x);
    const setup = x.planStatus === "draft";
    if (!setup && !["moment", "simplify", "action", "edit", "params"].includes(mode)) return planScreen("edit");
    const editing = !setup;
    let w, show = { cue: false, act: false, params: false, goalEdit: false }, restored = false;
    if (editing) {
      const d = P.planDraft;
      if (d && d.patternId === p.id && d.planId !== x.id) return planStale(p, x, d, mode);
      if (d && d.patternId === p.id && d.planId === x.id) { w = d.w; show = Object.assign(show, d.show || {}); restored = true; }
      else w = JSON.parse(JSON.stringify(x));
    } else w = x;
    if (!restored) {
      if (mode === "moment") show.cue = true;
      if (mode === "action") { show.act = true; show.actT = w.simplified ? "small" : "full"; }
      if (mode === "params") show.params = true;
      if (mode === "simplify" && !w.simplified) w.simplified = true;
    }
    /* «С кем» — отдельная подпись: если учитель известен, он предложен готовым редактируемым ответом. */
    const TEACH_NOM = { boss: "руководитель", colleague: "коллега", client: "клиент", partner: "партнёр", parent: "родитель", child: "ребёнок", relative: "близкий человек", friend: "друг" };
    if (setup && (w.setup || []).some(sl => sl.label) && !(w.slots || {}).person && p.teacher) { const t = p.teacher.kind === "other" ? (p.teacher.label || "") : (TEACH_NOM[p.teacher.kind] || ""); if (t) { w.slots = Object.assign({}, w.slots, { person: t }); } }
    const saveDraft = () => { if (editing) { P.planDraft = { patternId: p.id, planId: x.id, baseVersion: x.version, mode, w, show, at: nowTs() }; return saveProfile(true); } return saveExp(x); };
    let timer = null; const later = () => { clearTimeout(timer); timer = setTimeout(saveDraft, 300); };
    let dirty = restored || (editing && mode === "simplify");
    const changed = () => { dirty = true; later(); };
    planFlush = () => { clearTimeout(timer); if (dirty && app.dataset.flow === "plan") saveDraft(); };
    if (restored) setTimeout(() => toast(OPl.restored), 50);
    if (editing && mode === "simplify" && !restored) saveDraft();
    const usedSlots = () => { const cueKeys = w.cueUser ? [] : R.templateSlots(w.cueTemplate), actKeys = w.actionUser ? [] : R.templateSlots(w.actionTemplate + " " + (w.simplified && !w.smallerUser && w.smallerVersion ? w.smallerVersion : "")); return (w.setup || []).filter(sl => sl.label || cueKeys.includes(sl.key) || actKeys.includes(sl.key)); };
    const hl = txt => esc(txt).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, k) => `<mark>${esc(((w.setup || []).find(s => s.key === k) || {}).question || k)}</mark>`);
    const toObserve = () => { const tpl = templateFor({ id: X.lessonObserve.id, skillId: "pause" }, null); const f = R.planFromTemplate({ template: tpl.template, kind: "fallback", patternId: p.id, lessonId: w.lessonId, skillId: "pause", basisIds: w.userBasisIds || [], painText: w.painText || "", mode: "observation" }); Object.assign(w, f, { id: w.id, version: w.version, createdAt: w.createdAt, planStatus: w.planStatus, lineageId: w.lineageId, goalConfirmed: true, goalOrigin: "observe", desiredChange: OPl.observeGoal, cueUser: "", actionUser: "", smallerUser: "" }); };
    let notFit = false, saving = false;
    /* Какую версию действия правит человек: при включённом упрощении — лёгкую (она действует), иначе полную. Переключение — явное. */
    const actT = () => show.actT || (w.simplified ? "small" : "full");
    const seedAct = t => { const v = R.planView(w); if (t === "small") { if (!w.smallerUser) w.smallerUser = v.small || ""; } else if (!w.actionUser) { if (w.simplified && !w.smallerUser) w.smallerUser = v.small || ""; w.actionUser = v.full; } };
    const actHint = () => { const t = actT(); return t === "small" ? `<p class="tiny acthint" id="actHint">${esc(OPl.edSmall)} <button class="linkbtn" id="actToFull">${esc(OPl.edToFull)}</button></p>` : w.simplified ? `<p class="tiny acthint" id="actHint">${esc(OPl.edFullWhileSmall)} <button class="linkbtn" id="actToSmall">${esc(OPl.edToSmall)}</button> · <button class="linkbtn" id="useFull">${esc(OPl.edUseFull)}</button></p>` : ""; };
    const openAct = () => { show.act = true; show.actT = w.simplified ? "small" : "full"; seedAct(show.actT); };
    const render = () => {
      app.dataset.flow = "plan";
      const v = R.planView(w), rd = R.planReady(w), slots = usedSlots();
      const lessonTitle = p.lesson ? lc1(p.lesson.title) : "";
      const goalOk = !!w.goalConfirmed || !w.lessonId;
      const obs = w.mode === "observation";
      const goalHtml = !w.lessonId ? "" : show.goalEdit
        ? `<div class="card tight"><label for="goalOwn">${esc(OPl.goalOwnLead)}</label><textarea id="goalOwn" placeholder="${esc(OPl.goalOwnPh)}">${esc(w.goalOrigin === "user_written" ? w.desiredChange : "")}</textarea><div class="row tight"><button class="btn secondary sm" id="goalSave">${esc(OPl.goalSave)}</button><button class="btn ghost sm" id="goalBack">Назад</button></div></div>`
        : !w.goalConfirmed
        ? `<div class="card tight" id="goalBox">${w.painText ? `<p class="small" style="margin:0 0 4px">${esc(OPl.goalPain)} ${esc(lc1(w.painText))}.</p>` : ""}<p style="margin:0 0 4px"><b>${esc(OPl.goalQ.replace("{lesson}", lessonTitle))}</b></p>${w.fitQuestion ? `<p class="tiny" style="margin:0 0 6px">${esc(OPl.goalFit)} ${esc(lc1(w.fitQuestion).replace(/\?$/, ""))}.</p>` : ""}<div class="chips col"><button class="chip" id="goalYes">${esc(OPl.goalYes)}</button><button class="chip" id="goalEdit">${esc(OPl.goalEdit)}</button><button class="chip dim" id="goalObs">${esc(OPl.goalObserve)}</button></div></div>`
        : `<p class="small" style="margin:0 0 8px"><b>${esc(OPl.learn)}:</b> ${esc(lc1(w.desiredChange || lessonTitle))}. <button class="linkbtn" id="goalChange">изменить</button></p>`;
      app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(editing ? OPl.editTitle : OPl.title)}${obs ? " · наблюдение" : w.mode === "experiment" ? " · проверка ожидания" : ""} · v${w.version || 1}</p>
        <h1 class="q">${esc(editing ? OPl.editTitle : OPl.title)}</h1>
        ${goalHtml}
        ${p.mirror && p.mirror.text && p.mirror.status !== "rejected" ? `<div class="card tight" id="planInside"><div class="k">${esc(OB.family.stepInside)}</div><p class="small" style="margin:2px 0 0">Проверяю правило: «${esc(R.trimEnd(p.mirror.text))}»${p.permission ? `. Разрешаю себе: ${esc(lc1(R.trimEnd(p.permission)))}` : ""}.</p></div>` : ""}
        <div class="card mark"><div class="plines">
          ${(w.setup || []).some(sl => sl.label) ? `<div><span>${esc(OPl.whoL)}:</span> <i id="whoTxt" style="font-style:normal">${esc((w.slots || {}).person || "—")}</i></div>` : ""}
          ${p.storyResult && p.teacher && !(w.setup || []).some(sl => sl.label) ? `<div id="planWho"><span>С кем:</span> ${esc(p.teacher.label)}</div>` : ""}
          <div><span>${esc(OPl.whenL)}:</span> ${show.cue ? `<textarea id="cueOwn" placeholder="свой момент, одной фразой">${esc(w.cueUser || "")}</textarea>` : `<i id="cueTxt" style="font-style:normal">${hl(uc1(v.cue))}</i>`}</div>
          <div><span>${esc(obs ? OPl.whatObs : OPl.whatL)}:</span> ${show.act ? `${actHint()}<textarea id="actOwn" data-target="${actT()}" placeholder="${esc(OPl.ownActionLead)}">${esc((actT() === "small" ? w.smallerUser : w.actionUser) || "")}</textarea>` : `<i id="actTxt" style="font-style:normal">${hl(uc1(v.action || "—"))}</i>`}${v.simplified ? ` <span class="tiny">· ${esc(OPl.simplified)}</span>` : ""}</div>
          ${v.needsSmall ? `<div><label for="smallOwn" style="margin-top:4px">${esc(OPl.smallQ)}</label><textarea id="smallOwn" placeholder="${esc(OPl.smallPh)}">${esc(w.smallerUser || "")}</textarea></div>` : ""}
          ${p.storyResult && v.purpose ? `<div id="planWhy"><span>Зачем:</span> ${esc(v.purpose)}</div>` : ""}
          ${p.storyResult ? `<div id="planExpect"><span>Чего ожидаю:</span> ${esc(w.prediction ? `«${R.trimEnd(w.prediction)}»` : "не знаю")} <button class="linkbtn tiny" id="predEdit">изменить</button></div>` : ""}
          ${v.after ? `<div><span>${esc(OPl.afterL)}:</span> ${esc(v.after)}</div>` : ""}
        </div><details class="plain"><summary>${esc(OPl.why)}</summary><p class="small" style="margin:0 0 4px">${esc(v.purpose)}</p>${v.effort ? `<p class="tiny" style="margin:0">${esc(OPl.effort)}: ${esc(v.effort)}</p>` : ""}${v.limits ? `<p class="tiny" style="margin:0">${esc(OPl.limits)}: ${esc(v.limits)}</p>` : ""}</details></div>
        ${slots.length && (setup || show.params || !rd.ready) ? `<p class="small muted" style="margin:8px 0 2px">${esc(OPl.fill)}</p>${slots.map(sl => `<label for="sl-${esc(sl.key)}">${esc(sl.question)}</label><input type="${/minutes/i.test(sl.key) ? "number" : "text"}" ${/minutes/i.test(sl.key) ? 'min="1" step="1" inputmode="numeric"' : ""} id="sl-${esc(sl.key)}" data-slot="${esc(sl.key)}" placeholder="${esc(OPl.example + sl.example)}" value="${esc((w.slots || {})[sl.key] || "")}">${rd.errors[sl.key] && (w.slots || {})[sl.key] ? `<p class="tiny slerr" style="margin:0 0 4px;color:#B3261E">${esc(rd.errors[sl.key])}</p>` : ""}`).join("")}` : ""}
        <p class="tiny" id="needFill" style="margin:6px 0 0;${rd.ready ? "display:none" : ""}">${esc(v.needsSmall ? OPl.smallNeed : OPl.needFill)}</p>
        ${editing ? `<div class="chips" style="margin-top:8px"><button class="chip" id="edMoment">${esc(OPl.edMoment)}</button><button class="chip" id="edAction">${esc(OPl.edAction)}</button>${(w.setup || []).length ? `<button class="chip" id="edParams">${esc(OPl.edParams)}</button>` : ""}${v.canSimplify || w.simplified ? `<button class="chip" id="simpler">${esc(w.simplified ? OPl.full : OPl.simpler)}</button>` : ""}</div>` : ""}
        <div class="row"><button class="btn block" id="ok" ${rd.ready && (goalOk || editing) ? "" : "disabled"}>${esc(editing ? OPl.save : OPl.tryIt)}</button></div>
        <div class="row tight">${!editing && (v.canSimplify || w.simplified) ? `<button class="btn ghost" id="simpler">${esc(w.simplified ? OPl.full : OPl.simpler)}</button>` : ""}${editing ? `<button class="btn ghost" id="cancelEdit">${esc(OPl.cancel)}</button>` : `<button class="btn ghost" id="notfit">${esc(OPl.notFit)}</button>`}</div>
        <div id="nf">${notFit ? `<div class="card tight"><p class="small muted" style="margin:0 0 6px">${esc(OPl.notFitWhat)}</p><div class="chips col"><button class="chip" id="nfGoal">${esc(OPl.notFitGoal)}</button><button class="chip" id="nfAction">${esc(OPl.notFitAction)}</button></div><div id="nfa"></div></div>` : ""}</div>`;
      /* Ввод обновляет момент и действие на месте, без перерисовки: фокус и набранный текст не теряются. */
      const refresh = () => { const wt = $("#whoTxt"); if (wt) wt.textContent = (w.slots || {}).person || "—"; const v2 = R.planView(w), ct = $("#cueTxt"), at = $("#actTxt"); if (ct) ct.innerHTML = hl(uc1(v2.cue)); if (at) at.innerHTML = hl(uc1(v2.action || "—")); const ready = R.planReady(w).ready && (!!w.goalConfirmed || !w.lessonId || editing); $("#ok").disabled = !ready; const nf = $("#needFill"); if (nf) nf.style.display = R.planReady(w).ready ? "none" : ""; };
      $$("[data-slot]").forEach(inp => inp.oninput = () => { w.slots = w.slots || {}; w.slots[inp.dataset.slot] = inp.value; changed(); refresh(); });
      $$("[data-slot]").forEach(inp => inp.onchange = () => { saveDraft(); const err = R.planReady(w).errors[inp.dataset.slot]; let el = inp.nextElementSibling; if (!(el && el.classList && el.classList.contains("slerr"))) { el = document.createElement("p"); el.className = "tiny slerr"; el.style.cssText = "margin:0 0 4px;color:#B3261E"; inp.insertAdjacentElement("afterend", el); } el.textContent = err && inp.value ? err : ""; });
      const co = $("#cueOwn"); if (co) co.oninput = () => { w.cueUser = co.value.trim(); changed(); refresh(); };
      const ao = $("#actOwn"); if (ao) ao.oninput = () => { if (actT() === "small") w.smallerUser = ao.value.trim(); else w.actionUser = ao.value.trim(); changed(); refresh(); };
      const atf = $("#actToFull"); if (atf) atf.onclick = () => { show.actT = "full"; seedAct("full"); changed(); render(); };
      const ats = $("#actToSmall"); if (ats) ats.onclick = () => { show.actT = "small"; seedAct("small"); changed(); render(); };
      const uf = $("#useFull"); if (uf) uf.onclick = () => { w.simplified = false; show.actT = "full"; changed(); saveDraft(); render(); };
      const so = $("#smallOwn"); if (so) so.oninput = () => { w.smallerUser = so.value.trim(); changed(); refresh(); };
      const em = $("#edMoment"); if (em) em.onclick = () => { show.cue = !show.cue; if (show.cue && !w.cueUser) w.cueUser = R.planView(w).cue; changed(); render(); const t = $("#cueOwn"); if (t) t.focus(); };
      const ea = $("#edAction"); if (ea) ea.onclick = () => { if (show.act) { show.act = false; show.actT = null; } else openAct(); changed(); render(); const t = $("#actOwn"); if (t) t.focus(); };
      const ep = $("#edParams"); if (ep) ep.onclick = () => { show.params = !show.params; render(); };
      const sm = $("#simpler"); if (sm) sm.onclick = () => { w.simplified = !w.simplified; if (show.act) { show.actT = w.simplified ? "small" : "full"; seedAct(show.actT); } changed(); saveDraft(); render(); };
      const gy = $("#goalYes"); if (gy) gy.onclick = () => { w.goalConfirmed = true; w.goalOrigin = "user_confirmed"; w.desiredChange = uc1(p.lesson ? p.lesson.title : ""); w.goalAt = nowTs(); changed(); saveDraft(); render(); };
      const ge = $("#goalEdit"); if (ge) ge.onclick = () => { show.goalEdit = true; render(); const t = $("#goalOwn"); if (t) t.focus(); };
      const gc = $("#goalChange"); if (gc) gc.onclick = () => { show.goalEdit = true; render(); };
      const pe = $("#predEdit"); if (pe) pe.onclick = () => { pe.insertAdjacentHTML("afterend", `<input id="predT" value="${esc(w.prediction || "")}" placeholder="чего ожидаешь, одной фразой или пусто — «не знаю»"><button class="btn secondary sm" id="predOk">Сохранить</button>`); pe.remove(); $("#predOk").onclick = () => { w.prediction = $("#predT").value.trim(); w.predictionOrigin = "user_edited"; changed(); render(); }; };
      const gb = $("#goalBack"); if (gb) gb.onclick = () => { show.goalEdit = false; render(); };
      const gs = $("#goalSave"); if (gs) gs.onclick = () => { const t = $("#goalOwn").value.trim(); if (!t) return toast("Напиши пару слов"); w.goalConfirmed = true; w.goalOrigin = "user_written"; w.desiredChange = uc1(t); w.goalAt = nowTs(); show.goalEdit = false; changed(); saveDraft(); render(); };
      const go2 = $("#goalObs"); if (go2) go2.onclick = () => { toObserve(); changed(); saveDraft(); render(); };
      const nf = $("#notfit"); if (nf) nf.onclick = () => { notFit = !notFit; render(); };
      const ng = $("#nfGoal"); if (ng) ng.onclick = () => { editField(p, "lesson"); };
      const na = $("#nfAction"); if (na) na.onclick = () => { $("#nfa").innerHTML = `<div class="chips col" style="margin-top:6px"><button class="chip" id="nfOwn">${esc(OPl.ownAction)}</button>${R.planView(w).canSimplify ? `<button class="chip" id="nfSmall">${esc(OPl.simpler)}</button>` : ""}<button class="chip dim" id="nfObs">${esc(OPl.observeInstead)}</button></div>`;
        $("#nfOwn").onclick = () => { openAct(); notFit = false; changed(); render(); const a = $("#actOwn"); if (a) a.focus(); };
        const ns = $("#nfSmall"); if (ns) ns.onclick = () => { w.simplified = true; notFit = false; changed(); saveDraft(); render(); };
        $("#nfObs").onclick = () => { toObserve(); notFit = false; changed(); saveDraft(); render(); }; };
      const ce = $("#cancelEdit"); if (ce) ce.onclick = async () => { clearTimeout(timer); dirty = false; planFlush = null; delete P.planDraft; await saveProfile(true); toast(OPl.dropped); go("today"); };
      $("#ok").onclick = async () => {
        if (saving) return;
        const rd2 = R.planReady(w); if (!rd2.ready) return toast(R.planView(w).needsSmall ? OPl.smallNeed : OPl.needFill);
        if (!editing && w.lessonId && !w.goalConfirmed) return toast(OPl.goalNeed);
        saving = true; clearTimeout(timer); dirty = false; planFlush = null;
        const v2 = R.planView(w);
        if (editing) {
          const patch = Object.assign({}, w, { planStatus: "accepted", acceptedAt: nowTs(), reason: mode, cue: v2.cue, action: v2.action, ifThen: { signal: v2.cue, action: v2.action } }); ["id", "version", "status", "results", "createdAt", "lineageId", "baseVersion"].forEach(k => delete patch[k]);
          delete P.planDraft; await newExperimentVersion(p, patch); await saveProfile(true); toast(OPl.accepted); return go("today");
        }
        Object.assign(x, w, { planStatus: "accepted", acceptedAt: nowTs(), cue: v2.cue, action: v2.action, ifThen: { signal: v2.cue, action: v2.action }, status: "active" });
        if (!x.lineageId) x.lineageId = x.id;
        await saveExp(x); if (x.skillId) p.skillId = x.skillId;
        /* Старт практики — момент принятия шага: если настройка закончилась уже в другой части суток или после полуночи, день 1 пересчитывается честно. */
        if (p.status === "active" && p.practiceStartOrigin === "user" && !D.episodes.some(e => e.patternId === p.id && e.newResponse)) { const ns = R.practiceStartFor({ todayKey: today(), hour: hour(), times: P.times, actedToday: false }); if (ns !== p.practiceStartDate) { p.practiceStartDate = ns; p.startDate = ns; } p.firstDay = Object.assign({}, p.firstDay, { kind: phase(), date: today(), at: nowTs() }); }
        if (p.lesson && p.lesson.status === "preliminary" && p.lesson.skillId === x.skillId) p.lesson.keptForExperimentId = x.id;
        await savePattern(p); toast(OPl.accepted); go(P.seen.map ? "today" : "map");
      };
    };
    render();
  }
  /* Правка прежней версии: действующий шаг уже другой — не перезаписываем молча. */
  function planStale(p, x, d, mode) {
    const OPl = OB.plan;
    app.innerHTML = `<h1 class="q">${esc(OPl.staleTitle)}</h1><p class="small muted">${esc(OPl.staleText)}</p><div class="row"><button class="btn block" id="stOpen">${esc(OPl.staleOpen)}</button></div><div class="row tight"><button class="btn ghost" id="stDrop">${esc(OPl.staleDrop)}</button></div>`;
    $("#stOpen").onclick = async () => { const w = JSON.parse(JSON.stringify(x)); ["cueUser", "actionUser", "smallerUser", "simplified", "slots", "desiredChange", "goalConfirmed", "goalOrigin"].forEach(k => { if (d.w && d.w[k] !== undefined) w[k] = d.w[k]; }); P.planDraft = { patternId: p.id, planId: x.id, baseVersion: x.version, mode, w, show: d.show || {}, at: nowTs(), reviewedStale: true }; await saveProfile(true); planScreen(mode || "edit"); };
    $("#stDrop").onclick = async () => { delete P.planDraft; await saveProfile(true); toast(OPl.dropped); planScreen(mode || "edit"); };
  }
  /* Сегодня не подходит: момент, меньшая версия или пауза на день. Смена момента не меняет навык и объяснение. */
  function planAdjust(p, x) {
    const OPl = OB.plan, k = today();
    app.innerHTML = `<h1 class="q">${esc(OPl.adjustTitle)}</h1>${stepHTML(p, { why: false })}
      <div class="chips col" style="margin-top:10px"><a class="chip" href="#plan/moment">${esc(OPl.adjustMoment)}</a>${x.smallerVersion && !x.simplified ? `<a class="chip" href="#plan/simplify">${esc(OPl.adjustSimpler)}</a>` : ""}<a class="chip" href="#plan/action">${esc(OPl.ownAction)}</a><button class="chip dim" id="pauseDay">${esc(OPl.adjustPause)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#today">Назад</a></div>`;
    $("#pauseDay").onclick = async () => { const c = checkin(k, p); c.patternId = p.id; c.day = Object.assign({}, c.day, { paused: true, at: nowTs() }); await saveCheckin(c); toast("На сегодня шаг отложен. Записи и помощь доступны."); go("today"); };
  }
  /* Прежний план (до v6): текст сохраняется как действие своими словами, недостающие условия человек заполняет сам. */
  function legacyPlanUpgrade(p, x) {
    const OPl = OB.plan, L = p.lesson || null;
    app.innerHTML = `<h1 class="q">${esc(OPl.refine)}</h1><p class="small muted">${esc(OPl.legacy)}</p>
      <div class="card"><div class="plines"><div><span>${esc(OPl.what)}:</span> ${esc(x.action || "")}</div>${x.ifThen && x.ifThen.signal ? `<div><span>${esc(OPl.when)}:</span> ${esc(x.ifThen.signal)}</div>` : ""}</div></div>
      <div class="row"><button class="btn block" id="up">${esc(OPl.refine)}</button></div><div class="row tight"><a class="btn ghost" href="#today">Позже</a></div>`;
    $("#up").onclick = async () => {
      const tpl = templateFor(L, null);
      const patch = Object.assign(R.planFromTemplate({ template: tpl.template, kind: tpl.kind, patternId: p.id, lessonId: L ? L.id : null, skillId: x.skillId || p.skillId, basisIds: [], desiredChange: "", mode: tpl.mode, once: tpl.once }), { planStatus: "draft", actionUser: x.action || "", cueUser: x.ifThen && x.ifThen.signal ? x.ifThen.signal : "", reason: "upgrade", prediction: x.prediction || "", criterion: x.criterion || "", permission: x.permission || "" });
      delete patch.id; delete patch.version; delete patch.status; delete patch.results; delete patch.createdAt; patch.kind = "plan";
      const nx = await newExperimentVersion(p, patch); nx.kind = "plan"; nx.planStatus = "draft"; await saveExp(nx); go("plan");
    };
  }
  /* «Как пользоваться»: все подсказки обучения доступны повторно. Открытие снимает подписи-обучение с кнопок. */
  function guide() {
    const G = OB.guide, B = OB.buttons, T = OB.trail, pol = policy();
    app.innerHTML = `<h1>${esc(G.title)}</h1>
      <div class="card"><div class="k">${ic("sunrise")}${esc(G.day)}</div>${OB.map.lines.map(l => `<p class="small" style="margin:4px 0">${esc(l)}</p>`).join("")}<p class="tiny" style="margin:4px 0 0">${esc(OB.map.note)}</p></div>
      <div class="card"><div class="k">${ic("star")}Три уровня пути</div><p class="small" style="margin:4px 0"><b>${esc(OB.levels.theme)}</b> — широкое направление по числу; тему для размышления задаёт дата рождения, урок она не назначает.</p><p class="small" style="margin:4px 0"><b>${esc(OB.levels.lesson)}</b> — конкретное умение для твоего подтверждённого сюжета; его можно уточнить или сменить.</p><p class="small" style="margin:4px 0"><b>${esc(OB.levels.step)}</b> — одна посильная попытка в выбранный момент: твой принятый шаг. Каждый шаг объясняет, что проверяем в уроке («Зачем этот шаг?»).</p></div>
      <div class="card"><div class="k">${ic("flame")}${esc(G.buttons)}</div>
        <p class="small" style="margin:4px 0"><b>${esc(B.event.label)}.</b> ${esc(B.event.caption)} ${esc(B.event.tip)}</p>
        <p class="small" style="margin:4px 0"><b>${esc(B.action.label)}.</b> ${esc(B.action.caption)} ${esc(B.action.tip)}</p>
        <p class="small" style="margin:4px 0"><b>${esc(B.sos.label)}.</b> ${esc(B.sos.caption)}</p></div>
      <div class="card"><div class="k">${ic("mountain")}${esc(G.trail)}</div>${T.tips.map(([h, t]) => `<p class="small" style="margin:4px 0"><b>${esc(h)}.</b> ${esc(t)}</p>`).join("")}<p class="small" style="margin:4px 0"><b>${esc(G.flag)}.</b> ${esc(G.flagText)}</p>
        <details class="plain"><summary>${esc(T.flagHow)}</summary><ul class="small"><li>Не раньше ${pol.minElapsedCalendarDays} дней практики.</li><li>Две недели подряд: минимум ${pol.minImpactRatingsPerWindow} вечерние оценки в каждой, все не выше ${pol.maxEachRecordedImpact}.</li><li>В каждой неделе реальный повод; за две недели минимум ${pol.minConfirmedActionsAcrossWindowsOnDistinctDays} подтверждённых применения в разные дни. Репетиции не считаются.</li><li>Три пункта подтверждаешь сам.</li></ul></details></div>
      <div class="row"><a class="btn block" href="#today">${esc(G.back)}</a></div><div class="row tight"><a class="btn ghost sm" href="#about">${esc(G.approach)}</a></div>`;
    if (!P.seen.buttons || P.guideOffer) { P.seen.buttons = true; P.guideOffer = false; saveProfile(true); }
  }

  /* =================== СЕГОДНЯ =================== */
  /* Состояния: наблюдение; подготовка первого вечера (практика с завтра); первый день (запущен сегодня утром/днём); обычный день. */
  function todayScreen() {
    const p = anyPattern(), k = today(), ph = phase(), c = checkin(k, p), FD = OB.firstDay;
    const ps = R.practiceStart(p), dps = ps ? R.diffDays(ps, k) : null;
    const prep = !!(p && p.status === "active" && ps && dps < 0);
    const fd = p && p.firstDay && p.firstDay.date === k && dps === 0 ? p.firstDay : null;
    const ownGoal = p && expOf(p) && expOf(p).goalOrigin === "user_written";
    const title = p ? (p.status === "observe" ? "Наблюдаю" : (p.lesson ? uc1(ownGoal && p.lesson.homeTitle ? p.lesson.homeTitle : p.lesson.title) : p.title)) : "Начало";
    const rd = p ? planReady(p) : { ready: false };
    let sub = "";
    if (p && ps && dps >= 0) { const d = dps + 1, w = R.weekIndex(ps, k) + 1; const h = hypOf(p); const elig = eligibility(p); sub = `день ${d} · неделя ${w} · ${R.workPhase({ hypothesis: h, experiment: expOf(p), confirmedActionDays: R.confirmedActionDays({ episodes: D.episodes, checkins: D.checkins, patternId: p.id, skillId: skillOfPattern(p), lineageId: lineageOf(p) }).size, eligible: elig.eligible })}`; }
    else if (prep) sub = `начало · практика с ${R.human(ps)}`;
    else if (p) sub = "режим наблюдения";
    hero.innerHTML = `<div class="hero"><div class="hl">${ic(phaseIc(), "")}${R.fmtTime(nowTs())} · ${PHASE_TXT[ph]}${p && p.lesson && p.status !== "observe" ? ` · ${esc(OB.levels.lessonLead)}` : ""}</div><div class="hd">${esc(title)}</div>${sub ? `<div class="hs">${esc(sub)}</div>` : ""}</div>`;
    let main = "", extra = "";
    const res = P.lastResult;
    if (res) { if (res.kind === "first") extra += `<div class="card mark"><div class="k">${ic("star")}Сегодня исследуем</div><p style="margin:2px 0 4px"><b>${esc(res.title)}</b></p><p class="small" style="margin:0">Первый шаг: ${esc(lc1(res.plan))}. Причину пока не назначаем — будем уточнять по одному вопросу в день.</p></div>`; if (res.kind === "lesson" && !prep && !fd) extra += `<div class="card tight"><p class="small" style="margin:0"><b>Урок начат.</b> Он предварительный — в течение недели проверим, подходит ли он.</p></div>`; if (res.kind === "observe") extra += `<div class="card mark"><div class="k">${ic("eye")}Наблюдение</div><p class="small" style="margin:2px 0 0">${esc(C.entryCopy.emptyMatch)} Когда случится ближайший случай, нажми «${esc(OB.buttons.event.label)}».</p></div>`; delete P.lastResult; saveProfile(); }
    /* Возвращение после пропуска: только по записям с начала практики; вспомненный случай пропуском не считается. */
    const lastAct = ps && dps > 0 ? [...Object.values(D.checkins).filter(c => !c.legacy && (c.evening || c.morning)).map(c => c.dateKey), ...D.episodes.filter(e => !e.legacy && e.dateKey && e.verificationStatus !== "onboarding" && R.diffDays(ps, e.dateKey) >= 0).map(e => e.dateKey)].sort().pop() : null;
    if (p && lastAct && R.diffDays(lastAct, k) >= 2 && P.backDismissed !== lastAct) { const long = R.diffDays(lastAct, k) >= 14; extra = `<div class="card tight"><div class="k">${ic("hourglass")}${esc(OB.back.title)}</div><p class="small" style="margin:2px 0 6px">${esc(OB.home.back)} Пропущенные дни остаются пропущенными — это не обнуляет путь.${long && p.teacher ? ` ${esc(OB.back.teacher)} Сейчас: ${esc(p.teacher.label)}.` : ""}</p><div class="row tight"><button class="btn secondary sm" id="backKeep" data-la="${esc(lastAct)}">${esc(OB.back.keep)}</button><a class="btn ghost sm" href="#plan/simplify">${esc(OB.back.smaller)}</a><a class="btn ghost sm" href="#story">${esc(OB.back.other)}</a></div></div>` + extra; }
    if (D.meta.migratedFromV9 && !P.legacyDecision) extra += legacyCard();
    /* Прежний план (до v6) продолжает работать; его предлагается уточнить — без принуждения и без нового входа. */
    { const xo = p && expOf(p); if (xo && xo.kind !== "plan" && p.status === "active" && rd.ready) extra += `<div class="card tight" id="refineLegacy"><p class="small" style="margin:0 0 6px">${esc(OB.plan.legacy)}</p><a class="btn secondary sm" href="#plan">${esc(OB.plan.refine)}</a></div>`; }
    if (P.guideOffer) extra += `<div class="card mark tight" id="guideOffer"><p class="small" style="margin:0 0 6px">${esc(OB.existing.text)}</p><div class="row tight"><a class="btn sm" href="#guide">${esc(OB.existing.cta)}</a><button class="btn ghost sm" id="offerLater">${esc(OB.existing.later)}</button></div></div>`;
    /* Опыт сегодняшнего дня: записи «зацепило» и попытки; вспомненный во входе случай опытом практики не считается. */
    const todays = p ? episodesOn(k, p).filter(e => e.verificationStatus !== "onboarding" || e.newResponse) : [], acted = todays.some(e => e.newResponse && !e.isRehearsal);
    if (p && p.status === "paused") {
      main = `<div class="card"><div class="k">${ic("hourglass")}Сюжет на паузе</div><p class="small" style="margin:2px 0 8px">«${esc(p.title)}». Записи и помощь доступны. Вернуться можно в любой момент.</p><div class="row tight"><a class="btn block secondary" href="#story">Открыть сюжет</a></div></div>`;
    } else if (!p || p.status === "observe") {
      main = `<div class="card mark"><div class="k">${ic("eye")}Следующий шаг</div><p style="margin:2px 0 8px">${p ? (p.lesson ? "Пока наблюдаем. Когда случится реальный случай с учителем — запиши его: с этого дня начнётся практика." : "Запиши ближайший реальный случай — с него начнётся практика.") : "Начни с одного случая или посмотри карточки."}</p><div class="row tight">${p ? `<a class="btn block" href="#new">Записать случай</a>` : `<a class="btn block" href="#start">Начать</a>`}</div></div>`;
    } else if (prep) {
      /* Первый вечер: ситуация и шаг выбраны, пробовать ещё нечего. Ничего не выполнено, вечерней оценки нет. */
      const taken = !!(p.firstDay && p.firstDay.taken);
      main = `<div class="card mark"><div class="k">${ic("sunrise")}${esc(FD.eveningTitle)}</div><p style="margin:2px 0 8px">${esc(FD.eveningText)}</p>
        <p style="margin:0 0 4px"><b>${esc(FD.step)}</b></p>${stepHTML(p)}
        <p class="small" style="margin:8px 0 10px"><b>${esc(FD.tomorrow)}</b> ${esc(humanWd(ps))} — ${esc(FD.tomorrowText)}</p>
        ${taken ? `<p class="small" style="margin:0"><b>${esc(FD.taken)}</b></p>` : `<button class="btn block" id="takeTomorrow">${esc(FD.take)}</button>`}
        <p class="tiny" style="margin:8px 0 0">${esc(FD.reminder)} <a href="#settings">Настройки</a>.</p></div>
        <div class="card tight"><p class="small" style="margin:0">${esc(FD.already)} <a href="#action">${esc(OB.buttons.action.label)}</a> — тогда этот день станет первым.</p></div>`;
    } else {
      const elig = eligibility(p), due = reviewDueOf(p, k);
      const cy = checkinOf(yesterday(), p);
      const yOpen = R.eveningCloseable(yesterday(), k) && cy && !cy.evening && R.diffDays(ps, yesterday()) >= 0;
      const yAny = R.diffDays(ps, yesterday()) >= 0 && !(cy && cy.evening);
      const stepCard = (title, text, cta) => `<div class="card mark"><div class="k">${ic("sunrise")}${esc(title)}</div>${text ? `<p class="small" style="margin:2px 0 6px">${esc(text)}</p>` : ""}${companionHTML(p)}${stepHTML(p)}<div class="row tight" style="margin-top:8px"><a class="btn block" href="#morning">${esc(cta)}</a></div><div class="row tight"><a class="btn ghost sm" href="#plan/adjust">${esc(OB.plan.notToday)}</a></div></div>`;
      const pausedToday = !!(c.day && c.day.paused);
      if (!rd.ready) main = `<div class="card mark"><div class="k">${ic("key")}${esc(OB.home.notReady)}</div><p class="small" style="margin:2px 0 8px">${esc(rd.legacy ? OB.plan.legacy : OB.home.notReadyText)}</p><a class="btn block" href="#plan">${esc(OB.home.refine)}</a></div>`;
      else if (elig.eligible && !hasFlag(p)) main = `<div class="card mark"><div class="k">${ic("flag")}Проверка навыка</div><p style="margin:2px 0 8px">Две недели подряд записи показывают устойчивый ответ. Проверим вместе, что это выбранный навык, а не терпение.</p><a class="btn block" href="#flag">Проверить</a></div>`;
      else if (due && (R.diffDays(due.end, k) > 0 || ph === "evening" || c.evening)) main = `<div class="card mark"><div class="k">${ic("hourglass")}Итог недели</div><p style="margin:2px 0 8px">Неделя ${due.idx + 1} закончилась ${esc(R.human(due.end))}. Посмотрим, что было, и решим, что дальше.</p><a class="btn block" href="#review">Подвести итог</a></div>`;
      else if (ph === "night") main = yAny ? `<div class="card mark"><div class="k">${ic("moon")}Вчерашний вечер</div><p style="margin:2px 0 8px">Итог за ${esc(R.human(yesterday()))} ещё открыт. Полминуты.</p><a class="btn block" href="#evening/${yesterday()}">Закрыть вчерашний вечер</a></div>` : `<div class="card"><div class="k">${ic("moon")}Ночь</div><p style="margin:2px 0 0" class="small">${dps === 0 ? "Сегодня первый день практики: утром здесь появится твой шаг." : "Утром здесь появится твой шаг."} Если заденет ночью — кнопки ниже работают всегда.</p></div>`;
      else if (ph !== "evening" && !c.morning && pausedToday) main = `<div class="card"><div class="k">${ic("hourglass")}Шаг отложен на сегодня</div><p class="small" style="margin:2px 0 0">Записи и помощь доступны. Завтра — тот же шаг.</p></div>`;
      else if (ph !== "evening" && !c.morning) main = fd ? (fd.kind === "day" ? stepCard(FD.dayTitle, FD.dayText, FD.takeToday) : stepCard(FD.morningTitle, FD.morningText, OB.plan.take)) : stepCard("Шаг на день", "", OB.plan.take);
      else if (ph === "evening" && !c.evening && fd && fd.kind !== "morning" && fd.kind !== "night" && !todays.length && !acted && !fd.closed) main = `<div class="card mark"><div class="k">${ic("moon")}${esc(FD.dayTitle)}</div><p style="margin:2px 0 8px">${esc(FD.noExperience)}</p><div class="row tight"><a class="btn block secondary" href="#evening">${esc(FD.noExperienceCta)}</a><button class="btn ghost" id="closeIntro">${esc(FD.close)}</button></div></div>`;
      else if (ph === "evening" && !c.evening && fd && fd.closed) main = `<div class="card"><div class="k">${ic("moon")}${esc(FD.dayTitle)}</div><p class="small" style="margin:2px 0 0">${esc(FD.closed)} <a href="#evening">${esc(FD.noExperienceCta)}</a></p></div>`;
      else if (ph === "evening" && !c.evening) main = `<div class="card mark"><div class="k">${ic("moon")}Вечерний итог</div><p style="margin:2px 0 8px">Был ли повод, что получилось, как сейчас. Около минуты.</p><a class="btn block" href="#evening">Подвести итог дня</a></div>`;
      else if (c.evening) main = `<div class="card"><div class="k">${ic("moon")}День закрыт · ${R.fmtTime(c.evening.at)}</div><p class="small" style="margin:2px 0 0">${c.evening.hadOpportunity === "yes" ? "Был повод потренироваться." : c.evening.hadOpportunity === "no" ? "Повода не было — это тоже запись." : "Повод не уверен — так и записано."} Завтра утром — тот же шаг.</p></div>`;
      else main = `<div class="card mark"><div class="k">${ic("star")}${fd ? esc(FD.dayTitle) : "Твой шаг сегодня"}</div>${fd ? `<p class="small" style="margin:2px 0 6px">${esc(FD.dayText)}</p>` : ""}${stepHTML(p)}<p class="tiny" style="margin:6px 0 0">Вечерний итог откроется после ${P.times.eveningStart}:00. ${yOpen ? `<a href="#evening/${yesterday()}">Закрыть вчерашний вечер</a>` : ""}</p></div>`;
      if (due && !/Итог недели/.test(main)) extra += `<div class="card tight"><p class="small" style="margin:0">Сегодня седьмой день недели. Итог откроется вечером, после короткого итога дня.</p></div>`;
      if (yAny && ph !== "night" && !/вчерашний/.test(main)) extra += `<div class="card tight"><p class="small" style="margin:0">Вечер за ${esc(R.human(yesterday()))} не закрыт. <a href="#evening/${yesterday()}">Закрыть сейчас</a> — можно до конца сегодняшнего дня.</p></div>`;
      const q = D.episodes.filter(e => e.linkStatus === "unconfirmed" && !e.legacy);
      if (q.length) extra += `<div class="card tight"><p class="small" style="margin:0">${q.length} ${R.plural(q.length, "запись ждёт", "записи ждут", "записей ждут")} уточнения: тот же сюжет или другой? <a href="#story">В «Мой сюжет»</a></p></div>`;
    }
    /* Смысл на сейчас: учитель, урок; шаг — если его не показывает основная карточка. Рядом — «Как пользоваться». */
    /* Три уровня: тема пути (число, компактно), текущий урок (подтверждённый), сегодняшний шаг (принятый план). Они не конкурируют. */
    const sym = pathOf(), pv = planView(p), showStep = pv && rd.ready && !/plines/.test(main);
    const pathCard = p && p.lesson ? `<div class="card"><div class="k">${ic("eye")}${esc(OB.home.title)}<a href="#guide" class="klink">${esc(OB.buttons.guide)}</a></div>${pathLineHTML()}<div class="plines"><div><span>${esc(OB.levels.lesson)}:</span> ${esc(learningText(p))}</div>${p.storyResult && p.permission ? `<div id="homeInside"><span>Внутри:</span> ${esc(lc1(R.trimEnd(p.permission)))}</div>` : ""}${p.storyResult ? `<div id="homeMirror"><span>Зеркало:</span> ${esc(p.mirror && p.mirror.text ? `«${R.trimEnd(p.mirror.text)}» · ${mirrorStatusText(p)}` : X.stories.mirrorStatus.searching)}</div>` : ""}<div><span>${esc(OB.levels.teacher)}:</span> ${esc(p.teacher ? p.teacher.label : (p.contexts || []).join(", ") || "—")}</div>${showStep ? `<div><span>${esc(OB.levels.step)}:</span> ${esc(lc1(pv.cue) || "")}${pv.cue ? " — " : ""}${esc(p.storyResult ? `«${R.trimEnd(pv.action)}»` : lc1(pv.action))}</div>` : ""}</div>${pathLinkText(p) ? `<p class="small" id="pathLink" style="margin:6px 0 0"><i>${esc(pathLinkText(p))}</i></p>` : ""}</div>` : (p ? `${pathLineHTML()}<p class="tiny" style="margin:0 0 6px;text-align:right"><a href="#guide">${esc(OB.buttons.guide)}</a></p>` : "");
    /* Кнопки дня: прямые названия; подписи-обучение до первого закрытого вечера или открытия «Как пользоваться». Нажатие само по себе успехом не считается. */
    const B = OB.buttons, learn = p && !P.seen.buttons;
    const tap = (href, icon, b) => `<a class="tap ${learn ? "learn" : ""}" href="${href}">${ic(icon, "")}<span>${esc(b.label)}</span>${learn ? `<em>${esc(b.caption)}</em>` : ""}</a>`;
    /* Пока тропа не объяснена, главное действие выше: сначала фокус и ближайший шаг, затем иллюстрация с обучением. */
    const trailBlock = trailHTML(p) + (p && !P.seen.trail ? trailTutorial() : "");
    app.innerHTML = `${p && !P.seen.trail ? pathCard + main + trailBlock : trailBlock + pathCard + main}
      <div class="taps">${tap("#event", "flame", B.event)}${tap("#action", "stone", B.action)}</div>
      ${learn ? `<p class="tiny" style="margin:4px 0 0"><b>${esc(B.sos.label)}</b> (вверху): ${esc(B.sos.caption)}</p>` : ""}
      ${extra}`;
    const tt = $("#takeTomorrow"); if (tt) tt.onclick = async () => { p.firstDay = Object.assign({}, p.firstDay, { taken: true, takenAt: nowTs() }); await savePattern(p); todayScreen(); };
    const ci = $("#closeIntro"); if (ci) ci.onclick = async () => { p.firstDay = Object.assign({}, p.firstDay, { closed: true, closedAt: nowTs() }); await savePattern(p); todayScreen(); };
    const bk = $("#backKeep"); if (bk) bk.onclick = async () => { P.backDismissed = bk.dataset.la; await saveProfile(true); todayScreen(); };
    const ol = $("#offerLater"); if (ol) ol.onclick = async () => { P.guideOffer = false; await saveProfile(true); todayScreen(); };
    const tn = $("#tipNext"); if (tn) tn.onclick = async () => { const i = P.trailTip || 0; if (i >= OB.trail.tips.length - 1) { P.seen.trail = true; delete P.trailTip; } else P.trailTip = i + 1; await saveProfile(true); todayScreen(); };
  }
  /* Обучение тропе: три подсказки по одной, «Дальше» и «Понятно». Этап сохраняется; повторно — в «Как пользоваться». */
  function trailTutorial() {
    const T = OB.trail, i = Math.min(P.trailTip || 0, T.tips.length - 1), tip = T.tips[i], last = i === T.tips.length - 1;
    return `<div class="card mark tight" id="trailTut"><div class="k">${ic(["backpack", "mountain", "star"][i] || "star")}${esc(tip[0])}</div><p class="small" style="margin:2px 0 8px">${esc(tip[1])}</p><div class="row tight" style="align-items:center;justify-content:space-between"><span class="tiny">${i + 1} из ${T.tips.length}</span><button class="btn sm" id="tipNext">${esc(last ? T.done : T.next)}</button></div></div>`;
  }
  function legacyCard() {
    const lp = D.patterns.filter(p => p.legacy), lf = D.flags.filter(f => f.legacy);
    return `<div class="card"><div class="k">${ic("hourglass")}Записи прошлой версии</div><p class="small" style="margin:2px 0 6px">Найдено: ${lp.map(p => `«${esc(p.title)}» (${p.legacyInfo ? p.legacyInfo.weeks : 0} ${R.plural(p.legacyInfo ? p.legacyInfo.weeks : 0, "неделя", "недели", "недель")})`).join(", ") || "записи"}${lf.length ? `, флагов по старым правилам: ${lf.length}` : ""}. Всё сохранено в истории и помечено как прошлая версия.</p>
      <div class="row tight">${lp.map(p => `<button class="btn secondary sm" data-cont="${p.id}">Продолжить «${esc(p.title)}»</button>`).join("")}<button class="btn ghost sm" id="fresh">Начать заново</button></div></div>`;
  }
  document.addEventListener("click", async e => {
    const b = e.target.closest("[data-cont]"); if (b) { const lp = D.patterns.find(p => p.id === b.dataset.cont); const np = { id: R.uuid(), title: lp.title, packId: null, contexts: lp.contexts || [], status: "observe", startDate: null, createdAt: nowTs(), hypothesisVersionId: null, experimentId: null, queue: [], legacy: false, legacyPatternId: lp.id }; await savePattern(np); P.legacyDecision = "continue"; await saveProfile(); toast("Сюжет продолжен. Запиши ближайший реальный случай."); go("today"); }
    if (e.target.id === "fresh") { P.legacyDecision = "fresh"; await saveProfile(); route(); }
  });

  /* =================== УТРО =================== */
  /* Утро: актуальный шаг с моментом, «Беру на сегодня». «Сегодня не подходит» — момент, меньшая версия или пауза; навык и объяснение не меняются. */
  function morning() {
    const p = activePattern(); if (!p || p.status !== "active") return go("today");
    const k = today(), c = checkin(k, p);
    if (c.morning) { app.innerHTML = `<h1>Шаг уже с тобой</h1>${stepHTML(p)}<div class="row"><a class="btn block" href="#today">На главную</a></div><div class="row tight"><a class="btn ghost" href="#plan/adjust">${esc(OB.plan.notToday)}</a></div>`; return; }
    const v = planView(p);
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">Утро · ${esc(R.human(k))}${learningText(p) ? ` · ${esc(OB.levels.lesson)}: ${esc(learningText(p))}` : ""}</p><h1 class="q">${esc(OB.levels.step)}</h1>
      <div class="card mark" id="mornCard">${companionHTML(p)}${p.mirror && p.mirror.text && p.mirror.status !== "rejected" ? `<p class="small" id="mornRule" style="margin:0 0 4px">${esc(OB.story.stepRule)}: «${esc(R.trimEnd(p.mirror.text))}»</p>` : ""}${permissionText(p) ? `<p class="quote" style="margin:0 0 6px">${esc(permissionText(p))}</p>` : ""}${stepHTML(p)}${(() => { const x = expOf(p); return x && x.prediction && p.storyResult ? `<p class="small" id="mornPred" style="margin:6px 0 0">${esc(OB.story.stepExpect)}: «${esc(R.trimEnd(x.prediction))}» <a href="#plan" class="tiny">поправить</a></p>` : ""; })()}</div>
      <label for="sc">Как сейчас? <span class="muted small">необязательно</span></label>
      <div class="range-val" id="scv">—</div><input type="range" id="sc" min="0" max="10" step="1" value="3" aria-label="Как сейчас, 0–10"><div class="range-hint"><span>0, спокойно</span><span>10, очень тяжело</span></div>
      <div class="row"><button class="btn block" id="take">${esc(OB.plan.take)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#plan/adjust">${esc(OB.plan.notToday)}</a><a class="btn ghost" href="#today">Позже</a></div>`;
    let rated = null; const sc = $("#sc"); sc.oninput = () => { rated = Number(sc.value); $("#scv").textContent = sc.value; };
    $("#take").onclick = async () => { const x = expOf(p); c.morning = { at: nowTs(), intensity: rated, tz: R.tz(), planId: x ? x.id : null, planVersion: x ? x.version : null, cue: v ? v.cue : "" }; c.patternId = p.id; await saveCheckin(c); go("today"); };
  }
  async function newExperimentVersion(p, patch) {
    const old = expOf(p); if (old) { old.status = "replaced"; old.planStatus = old.planStatus === "accepted" ? "superseded" : old.planStatus; await saveExp(old); }
    /* Личный план переносится целиком (шаблон, слоты, цель), затем применяется правка; история версий остаётся. */
    const base = old && old.kind === "plan" ? JSON.parse(JSON.stringify(old)) : {};
    delete base.id; delete base.results; delete base.keptFor;
    const x = Object.assign(base, { id: R.uuid(), patternId: p.id, hypothesisVersionId: p.hypothesisVersionId, version: (old ? old.version : 0) + 1, permission: old ? old.permission : "", prediction: old ? old.prediction : "", action: old ? old.action : "", skillId: old ? old.skillId : p.skillId, ifThen: old ? old.ifThen : null, criterion: old ? old.criterion : "", status: "active", results: [], createdAt: nowTs(), kind: old && old.kind === "plan" ? "plan" : "experiment" }, patch);
    if (x.kind === "plan") { if (patch.action && !patch.actionUser && !patch.actionTemplate) x.actionUser = patch.action; const v = R.planView(x); x.cue = v.cue; x.action = v.action; x.ifThen = { signal: v.cue, action: v.action }; if (!patch.planStatus) x.planStatus = old && old.planStatus ? old.planStatus : "accepted"; x.lineageId = R.planLineage(old, x); x.baseVersion = old ? old.version : null; }
    else if (x.ifThen && patch.action && !patch.ifThen) x.ifThen = { signal: x.ifThen.signal, action: patch.action };
    await saveExp(x); p.experimentId = x.id; if (x.skillId) p.skillId = x.skillId; await savePattern(p); return x;
  }

  /* =================== МЕНЯ ЗАЦЕПИЛО (v6) ===================
     Первый выбор: помощь сейчас / выбрать ответ / только сохранить. Анкета не блокирует поддержку.
     Текущий сюжет — личный шаг и своя фраза; другой — очередь или наблюдение без чужого плана. Просмотр подсказки попыткой не считается. */
  function event(arg) {
    const p = activePattern(), k = today(), E = OB.event2;
    const quickEp = (extra) => Object.assign({ id: R.uuid(), patternId: p ? p.id : null, linkStatus: p ? "unconfirmed" : "none", relation: p ? "unknown" : "none", occurredAt: nowTs(), loggedAt: nowTs(), dateKey: k, tz: R.tz(), event: "", emotion: null, intensity: null, verificationStatus: "quick", isRehearsal: false, legacy: false }, extra || {});
    if (arg === "save" || hasDraft("event", p ? p.id : null)) return eventSave();
    if (arg === "choose") return eventChoose();
    app.innerHTML = `<h1 class="q">${esc(E.title)}</h1><p class="muted small">${esc(E.sub)}</p>
      <div class="chips col">
        <button class="btn block sos" id="helpNow">${esc(E.help)}</button>
        ${p && p.status === "active" ? `<button class="btn block" id="choose">${esc(E.choose)}</button>` : ""}
        <button class="btn block secondary" id="save">${esc(E.save)}</button>
      </div>
      <div class="row tight"><a class="btn ghost" href="#today">Назад</a></div>`;
    $("#helpNow").onclick = async () => { const e = quickEp({ source: "event-help", linkStatus: p && p.status === "active" ? "unconfirmed" : (p ? "confirmed" : "none") }); await saveEpisode(e); P.lastEpisode = e.id; await saveProfile(true); go("help"); };
    const ch = $("#choose"); if (ch) ch.onclick = () => eventChoose();
    $("#save").onclick = () => eventSave();
    function eventChoose() {
      const v = planView(p), x = expOf(p);
      const ask = `<h1 class="q">${esc(E.same)}</h1><p class="muted small">${p.teacher ? `Сейчас в работе: «${esc(p.scenario && p.scenario.caseText ? p.scenario.caseText : p.title)}». Учитель: ${esc(p.teacher.label)}.` : `Сейчас в работе: «${esc(p.title)}».`}</p>
        <div class="chips col"><button class="chip" data-r="same">${esc(E.sameYes)}</button><button class="chip" data-r="other">${esc(E.sameOther)}</button><button class="chip dim" data-r="unsure">${esc(E.sameUnsure)}</button></div><div class="row tight"><a class="btn ghost" href="#event">Назад</a></div>`;
      app.innerHTML = ask;
      $$("[data-r]").forEach(b => b.onclick = async () => {
        const r = b.dataset.r;
        if (r === "other") { const e = quickEp({ relation: "other", linkStatus: "queued", patternId: null }); await saveEpisode(e); app.innerHTML = `<h1>Сохранено</h1><p class="small">${esc(E.otherSaved)}</p><div class="chips col"><a class="btn block secondary" href="#detail/${e.id}">Добавить детали</a><a class="btn block secondary" href="#help">${esc(E.help)}</a><a class="btn block" href="#today">На главную</a></div>`; return; }
        const e = quickEp({ relation: r, linkStatus: r === "same" ? "confirmed" : "unconfirmed", patternId: p.id, hintShown: true });
        await saveEpisode(e); P.lastEpisode = e.id; await saveProfile(true);
        const rd = planReady(p);
        app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(E.hint)}</p><h1 class="q">${esc(p.lesson ? uc1(p.lesson.title) : p.title)}</h1>
          ${rd.ready ? `<div class="card mark">${stepHTML(p)}${permissionText(p) ? `<p class="small muted" style="margin:6px 0 0">${esc(permissionText(p))}</p>` : ""}</div>` : `<div class="card"><p class="small" style="margin:0">${esc(OB.home.notReadyText)} <a href="#plan">${esc(OB.home.refine)}</a></p></div>`}
          <p class="tiny" style="margin:4px 0 8px">${esc(E.viewed)}</p>
          <div class="row"><button class="btn block" id="tryNow">${esc(E.tryNow)}</button></div>
          <div class="row tight"><button class="btn ghost" id="notNow">${esc(E.notNow)}</button><a class="btn ghost sos" href="#help">${esc(E.help)}</a></div><div id="alt"></div>`;
        $("#tryNow").onclick = async () => { e.intent = "try"; await saveEpisode(e); app.innerHTML = `<h1>Хорошо</h1><p>${esc(E.markLater)}</p><div class="row"><a class="btn block" href="#action">${esc(OB.buttons.action.label)}</a></div><div class="row tight"><a class="btn ghost" href="#today">На главную</a></div>`; };
        $("#notNow").onclick = () => { const sm = x && x.smallerVersion && !x.simplified ? x.smallerVersion : ""; $("#alt").innerHTML = `<div class="card tight">${sm ? `<p class="small" style="margin:0 0 6px"><b>${esc(E.smaller)}</b> ${esc(sm)}</p>` : ""}<div class="chips col"><button class="chip" id="justSave">${esc(E.quickSave)}</button><a class="chip" href="#detail/${e.id}">Добавить детали</a></div></div>`; $("#justSave").onclick = () => { toast("Сохранено"); go("today"); }; };
      });
    }
    function eventSave() {
      const steps = [
        ...(p && p.status === "active" ? [{ k: "relation", q: "Это тот же сюжет?", lead: p.teacher ? `Сейчас в работе: «${p.scenario && p.scenario.caseText ? p.scenario.caseText : p.title}». Учитель: ${p.teacher.label}.` : `Сейчас в работе: «${p.title}».`, type: "choice", opts: X.relations }] : []),
        { k: "emotion", q: "Что чувствуешь?", lead: C.emotions.instruction, type: "choice", opts: EMOTIONS.filter(e => e !== "Другое" && e !== "Не знаю"), own: true, unknown: true },
        { k: "intensity", q: C.daily.eventIntensityScale.label, type: "scale", lo: "0, совсем нет", hi: "10, очень", def: 5 },
      ];
      flow({ id: "event", scope: p ? p.id : null, steps, title: p && p.lesson ? OB.home.event : OB.buttons.event.label, onCancel: () => go("today"),
        onDone: async ans => {
          const ts = nowTs(); const rel = ans.relation || (p ? "unknown" : "none");
          const link = !p ? "none" : rel === "same" ? "confirmed" : rel === "other" ? "queued" : "unconfirmed";
          const e = { id: R.uuid(), patternId: p && link !== "queued" ? p.id : null, linkStatus: link, relation: rel, occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), event: "", emotion: val(ans, "emotion") || null, intensity: ans.intensity, verificationStatus: "quick", isRehearsal: false, legacy: false };
          if (p && p.status === "observe") { e.patternId = p.id; e.linkStatus = "confirmed"; }
          const ok = await saveEpisode(e);
          afterEvent(e, ok);
        } });
    }
  }
  function afterEvent(e, ok) {
    const high = e.intensity >= 7, p = activePattern(), rd = p ? planReady(p) : { ready: false };
    app.innerHTML = `<h1>${ok ? "Записано" : "Записано на экране"}</h1><p class="muted">${esc(e.emotion || "Чувство")} · ${e.intensity} из 10${!ok ? " · сохранить не удалось, см. сообщение сверху" : ""}</p>
      ${high ? `<div class="nudge">Задело сильно. Можно сначала помочь себе, а разбирать позже.</div>` : ""}
      ${p && e.linkStatus === "confirmed" && rd.ready ? `<div class="card tight"><div class="k">${ic("star")}${esc(OB.event2.hint)}</div>${stepHTML(p, { why: false })}<p class="tiny" style="margin:6px 0 0">${esc(OB.event2.markLater)}</p></div>` : ""}
      <div class="chips col">
        <a class="btn block ${high ? "" : "secondary"}" href="#help">${esc(X.afterEvent[0][1])}</a>
        ${!p || p.status === "observe" ? `<button class="btn block secondary" id="startWeek">Начать с этого случая неделю</button>` : ""}
        <a class="btn block ${high ? "secondary" : ""}" href="#today">${esc(X.afterEvent[1][1])}</a>
        <button class="btn block secondary" id="later">${esc(X.afterEvent[2][1])}</button>
      </div>
      <div class="row tight"><button class="btn ghost" id="detail">Добавить детали сейчас</button></div>
      ${e.relation === "similar" && p ? `<div class="card tight"><p class="small" style="margin:0 0 6px"><b>Похоже, но другой человек.</b> Обычно ты думаешь «${esc(p.thought || "…")}» и делаешь «${esc(lc1(p.habitualResponse) || "…")}». ${esc(X.linkQuestion.q)}</p><div class="sw3">${X.linkQuestion.opts.map(([v, l]) => `<button class="btn secondary sm" data-link="${v}">${l}</button>`).join("")}</div></div>` : ""}`;
    $("#detail").onclick = () => go("detail/" + e.id);
    $("#later").onclick = async () => { e.verificationStatus = "pending"; await saveEpisode(e); toast("Напомним в «Мой сюжет»"); go("today"); };
    const sw = $("#startWeek"); if (sw) sw.onclick = () => { P.drafts = P.drafts || {}; P.drafts.fromEpisode = e.id; saveProfile(); go("new"); };
    $$("[data-link]").forEach(b => b.onclick = async () => { const v = b.dataset.link; e.linkStatus = v === "yes" ? "confirmed" : v === "no" ? "queued" : "unconfirmed"; if (v === "no") e.patternId = null; if (v === "yes") { e.patternId = p.id; const h = hypOf(p); if (h) { h.supportingEpisodeIds = [...new Set([...(h.supportingEpisodeIds || []), e.id])]; await saveHyp(h); } } await saveEpisode(e); toast(v === "yes" ? "Привязано к текущему сюжету" : v === "no" ? "Ушло в очередь" : "Разберём на неделе"); afterEvent(e, true); });
  }
  function detail(id) {
    const e = D.episodes.find(x => x.id === id); if (!e) return go("today");
    const steps = [
      { k: "event", q: "Что именно произошло?", lead: "Как запись камеры: без оценок и выводов.", type: "text", ph: "Например: он сказал «сделай сам», и ушёл", tags: X.quickEvents, optional: true },
      { k: "thought", q: "Какая мысль была первой?", type: "choice", opts: X.firstThoughts, own: true, unknown: true, optional: true },
      { k: "body", q: "Как тело дало знать?", lead: C.bodyObservation.message, type: "multi", opts: C.bodyObservation.locations, optional: true },
      { k: "sensation", q: "Какое это ощущение?", type: "choice", opts: C.bodyObservation.sensations.filter(x => x !== "Другое" && x !== "Не знаю"), own: true, unknown: true, optional: true, skip: a => !(a.body || []).length || (a.body || []).some(x => /ничего|не хочу/i.test(x)) },
      { k: "response", q: "Что ты сделал?", type: "choice", opts: X.habitualResponses.filter(x => x !== "Другое" && x !== "Не знаю"), own: true, unknown: true, optional: true },
    ];
    flow({ id: "detail-" + id, scope: e.patternId, steps, title: "Детали случая", onCancel: () => go("today"),
      onDone: async ans => {
        if (ans.event) e.event = ans.event; if (val(ans, "thought")) e.thought = val(ans, "thought"); if ((ans.body || []).length) e.body = { locations: vals(ans, "body"), sensation: val(ans, "sensation") || null }; if (val(ans, "response")) e.response = val(ans, "response");
        e.verificationStatus = "detailed"; await saveEpisode(e); toast("Детали добавлены"); go("today");
      } });
  }
  /* v7: в просмотре события — вечерний опыт того дня и версия зеркала, к которой относится запись */
  function epMirrorRows(e, p) {
    const c = p ? Object.values(D.checkins).find(cc => cc.patternId === p.id && cc.dateKey === e.dateKey && cc.evening && cc.evening.experience) : null, ex = c ? c.evening.experience : null, rows = [];
    const ver = e.newResponse && e.newResponse.mirrorVersion != null ? e.newResponse.mirrorVersion : ex ? ex.mirrorVersion : null;
    const mt = p && p.mirror ? ((p.mirror.versions || []).find(z => z.version === ver) || (ver === (p.mirror.version || 1) && p.mirror.text ? { text: p.mirror.text } : null)) : null;
    if (mt) rows.push(["Зеркало этой записи", `«${R.trimEnd(mt.text)}» · версия ${ver}`]);
    if (ex) { const E7 = OB.exp; if (ex.rule) rows.push(["Правило включилось?", (ex.hadMirror ? (E7.rule.find(o => o[0] === ex.rule) || [])[1] : (E7.thought.find(o => o[0] === ex.rule) || [])[1]) + (ex.ruleText ? `: «${R.trimEnd(ex.ruleText)}»` : "")]); if (ex.outcome) rows.push(["Ожидал — получилось", (E7.exp.find(o => o[0] === ex.outcome) || [])[1] + (ex.fact ? `: ${ex.fact}` : "")]); if (ex.conclusion) rows.push(["Вывод", ex.conclusion === "__own" ? ex.conclusionText : (E7.concl.find(o => o[0] === ex.conclusion) || [])[1]]); }
    return rows;
  }
  function episodeView(id) {
    const e = D.episodes.find(x => x.id === id); if (!e) return go("history");
    const p = D.patterns.find(x => x.id === e.patternId);
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(R.human(e.dateKey))} · ${R.fmtTime(e.loggedAt)}${e.legacy ? ' · <span class="badge legacy">прошлая версия</span>' : ""}${e.isRehearsal ? ' · <span class="badge">репетиция</span>' : ""}</p>
      <h1 class="q">${esc(e.event || (e.newResponse ? `Попытка нового ответа${e.newResponse.status ? " · " + R.attemptStatusLabel(e.newResponse.status) : ""}` : "Случай без описания"))}</h1>
      <div class="card">${[["Сюжет", p ? p.title : e.linkStatus === "queued" ? "в очереди" : "не привязан"], ["Чувство", e.emotion], ["Сила", e.intensity != null ? e.intensity + " из 10" : null], ["Первая мысль", e.thought], ["Тело", e.body ? [...(e.body.locations || []), e.body.sensation].filter(Boolean).join(", ") : null], ["Что сделал", e.response], ["Новый ответ", e.newResponse ? actionLabel(e.newResponse) : null], ["Что получилось", e.newResponse && e.newResponse.afterAnswer ? e.newResponse.afterAnswer : null], ...epMirrorRows(e, p)].filter(x => x[1]).map(([k, v]) => `<div class="prow"><div class="k">${k}</div>${esc(v)}</div>`).join("")}</div>
      <div class="row tight">${!e.legacy ? `<a class="btn secondary" href="#detail/${e.id}">Дополнить</a>` : ""}<a class="btn ghost" href="#history">Назад</a></div>`;
  }
  const actionLabel = nr => { if (nr && nr.status) { const st = R.attemptStatusLabel(nr.status); const what = nr.status === "other" ? nr.otherAction : nr.action; return `${uc1(st)}${what ? ": " + what : ""}`; } const t = (X.actionTypes.find(a => a.id === nr.type) || {}).label || nr.type || "действие"; return `${t}${nr.type === "pause" ? (nr.chosen === "chosen" ? " (выбранная)" : nr.chosen === "scared" ? " (было страшно сказать)" : "") : ""}${nr.note ? ": " + nr.note : ""}`; };

  /* =================== ПОПРОБОВАЛ НОВЫЙ ОТВЕТ (v6) ===================
     Начинается с личного шага: Сделал / Частично / Попробовал другое / Только отрепетировал / Не было повода.
     Другое действие не получает навык плана автоматически. После — один вопрос из карточки; чужой ответ, выполнение и состояние — раздельно. */
  function action() {
    const p = activePattern(), k = today(), A = OB.attempt, x = expOf(p), v = planView(p), rd = p ? planReady(p) : { ready: false };
    const todays = p ? episodesOn(k, p).filter(e => !e.newResponse && e.verificationStatus !== "onboarding") : [];
    const stepLine = v && rd.ready ? `${uc1(v.cue)} — ${lc1(v.action)}` : "";
    const steps = [
      { k: "st", q: A.q, lead: stepLine ? `${A.step} ${stepLine}` : A.noPlan, type: "choice", opts: A.opts },
      { k: "other", q: A.otherQ, type: "text", ph: "одной строкой", skip: a => a.st !== "other" },
      { k: "tag", q: A.otherTag, type: "choice", opts: X.actionTypes.filter(t => t.id !== "other").map(t => [t.id, t.label]), optional: true, skip: a => a.st !== "other" },
      { k: "after", q: v && v.after ? v.after : "Что заметил после?", lead: "Можно коротко. «Пока не знаю» — тоже ответ.", type: "text", ph: "например: взял паузу, человек подождал; тревога осталась", optional: true, skip: a => a.st === "none" },
      ...(todays.length ? [{ k: "link", q: A.linkQ, type: "choice", opts: [...todays.map(e => [e.id, `${R.fmtTime(e.loggedAt)} · ${e.emotion || "случай"}${e.intensity != null ? ` · ${e.intensity}/10` : ""}${e.event ? " · " + e.event.slice(0, 40) : ""}`]), ["new", A.separate]], skip: a => a.st === "none" }] : []),
    ];
    flow({ id: "action", scope: p ? p.id : null, steps, title: A.title, onCancel: () => go("today"),
      onDone: async ans => {
        const ts = nowTs(), st = ans.st;
        if (st === "none") { if (p) { const c = checkin(k, p); c.patternId = p.id; c.day = Object.assign({}, c.day, { noOpportunity: true, at: ts }); await saveCheckin(c); } app.innerHTML = `<h1>Записано</h1><p>${esc(A.result.none)}</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
        const planAction = st === "done" || st === "partial" || st === "rehearsal";
        const nr = { status: st, opportunity: st === "rehearsal" ? "rehearsal" : "real", didPlanAction: st === "done", planId: x ? x.id : null, planVersion: x ? x.version : null, experimentId: x ? x.id : null, lineageId: planAction ? lineageOf(p) : null, patternId: p ? p.id : null, dateKey: k, skillId: planAction ? ((x && x.skillId) || (p && p.skillId) || null) : null, action: planAction && v ? v.action : "", otherAction: st === "other" ? (ans.other || "") : "", type: st === "other" ? (ans.tag || "other") : null, chosen: null, afterAnswer: ans.after || "", note: st === "other" ? (ans.other || "") : (ans.after || ""), storyId: p ? (p.storyId || p.id) : null, mirrorVersion: mirrorVer(p), at: ts };
        let e = ans.link && ans.link !== "new" ? D.episodes.find(q => q.id === ans.link) : null;
        if (!e) e = { id: R.uuid(), patternId: p ? p.id : null, linkStatus: p ? "confirmed" : "none", occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), event: "", emotion: null, intensity: null, verificationStatus: "quick", legacy: false };
        e.newResponse = nr; e.isRehearsal = st === "rehearsal";
        await saveEpisode(e);
        /* Реальная попытка до назначенного старта (первый вечер): практика началась сегодня. */
        if (p && !e.isRehearsal && st !== "rehearsal" && R.practiceStart(p) && R.diffDays(R.practiceStart(p), k) < 0) { p.practiceStartDate = k; p.startDate = k; p.firstDay = Object.assign({}, p.firstDay, { kind: "acted", actedAt: ts }); await savePattern(p); }
        const txt = A.result[st].replace("{action}", v ? lc1(v.action).replace(/[.!]+$/, "") : "свой шаг").replace("{other}", lc1(ans.other || ""));
        const confirmed = R.isConfirmedAction(e, nr.skillId);
        app.innerHTML = `<h1>${st === "done" ? "Отмечено" : "Записано"}</h1><p>${esc(txt)}</p><p class="small muted">${esc(A.resultNote)}${st === "partial" ? " Частичный результат хранится отдельно от «сделал»." : ""}${st === "other" ? " Навык плана этим не подтверждается — записано как своё действие." : ""}</p>
          ${confirmed ? `<div class="trail" style="height:110px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.25"></i><div class="pop">новый ответ</div></div>` : ""}
          <div class="row"><a class="btn block" href="#today">На главную</a></div>`;
      } });
  }

  /* =================== ВЕЧЕР (v6) =================== */
  /* Вечер переиспользует дневные записи: попытка дня подставляется для подтверждения, второе применение того же события не создаётся. */
  function evening(arg) {
    const p = activePattern(); if (!p || p.status !== "active") return go("today");
    const cy = checkinOf(yesterday(), p);
    const k = arg && R.isKey(arg) ? arg : (phase() === "night" && R.eveningCloseable(yesterday(), today()) && !(cy && cy.evening) ? yesterday() : today());
    if (!R.eveningCloseable(k, today())) { app.innerHTML = `<h1>Этот вечер уже закрыт для записи</h1><p class="muted">Вечер можно закрыть в тот же день или до конца следующего.</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const c = checkin(k, p), late = R.isLate(k, today());
    if (c.evening) { app.innerHTML = `<h1>Вечер ${esc(R.human(k))} закрыт</h1><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    if (R.practiceStart(p) && R.diffDays(R.practiceStart(p), k) < 0) { app.innerHTML = `<h1>${esc(OB.firstDay.prepTitle)}</h1><p>${esc(OB.firstDay.prepText)}</p><div class="row"><a class="btn block" href="#today">На главную</a></div><div class="row tight"><a class="btn ghost" href="#action">${esc(OB.buttons.action.label)}</a></div>`; return; }
    const x = expOf(p), F = R.eveningFacts({ episodes: D.episodes, dateKey: k, patternId: p.id, planId: x ? x.id : null, lineageId: lineageOf(p) }), eps = F.episodes, v = planView(p), rs = R.researchState(researchOf(p), today(), deepToday);
    const best = F.best, noOpp = !!(c.day && c.day.noOpportunity);
    const attemptTxt = best ? `${R.attemptStatusLabel(best.status)}${best.status === "other" && best.otherAction ? `: ${best.otherAction}` : ""}` : "";
    /* Попытка прежнего шага — факт дня, не выполнение нового. О новом шаге — отдельный вопрос. */
    const otherTxt = F.otherBest ? OB.eveningOut.already.replace("{action}", lc1(F.otherBest.status === "other" ? F.otherBest.otherAction || "другое действие" : F.otherBest.action || R.attemptStatusLabel(F.otherBest.status)).replace(/[.!]+$/, "")) : "";
    const changedOnly = !!F.otherBest && !best;
    const dayHint = (eps.length || noOpp ? `Сегодня записано: ${F.opportunities ? `${F.opportunities} ${R.plural(F.opportunities, "повод", "повода", "поводов")}` : noOpp ? "повода не было" : "репетиция"}${best ? `; попытка — ${attemptTxt}` : ""}. Подтверди или поправь.` : "") + (otherTxt ? " " + otherTxt : "");
    const titleTxt = `${late ? "Поздний вечер" : "Вечер"} · ${R.human(k)}`;
    const derived = best && best.status !== "rehearsal" ? { done: "done", partial: "partial", other: "other" }[best.status] : null;
    P.drafts = P.drafts || {};
    const seed = (id) => { const key = draftKey(id, p.id); if (!P.drafts[key] && (eps.length || noOpp) && !changedOnly) P.drafts[key] = { i: 0, ans: { opp: noOpp && !F.opportunities ? "no" : (F.opportunities ? "yes" : undefined), oa: derived ? derived : (noOpp ? "none" : undefined) }, at: nowTs() }; };
    const stepsFull = [
      { k: "opp", q: changedOnly ? OB.eveningOut.afterChange : "Был сегодня повод потренироваться?", lead: late ? `Вечер за ${R.human(k)} — запись помечена как поздняя.` : dayHint, type: "choice", opts: [["yes", C.daily.opportunity[0]], ["no", C.daily.opportunity[1]], ["unsure", C.daily.opportunity[2]]] },
      { k: "act", q: "Выбранное действие получилось?", lead: v ? `Твой шаг: ${lc1(v.action)}.` : "", type: "choice", opts: [["done", C.daily.actionResult[0]], ["partial", C.daily.actionResult[1]], ["not", C.daily.actionResult[2]], ["other", C.daily.actionResult[3]]], skip: a => a.opp !== "yes" || !!derived },
      { k: "mirror", q: OB.family.eveMirrorQ, lead: () => p.mirror ? `«${R.trimEnd(p.mirror.text)}»` : "", type: "choice", opts: OB.family.eveMirror, optional: true, skip: a => !(p.mirror && p.mirror.text && p.mirror.status !== "rejected") || a.opp !== "yes" },
      { k: "outcome", q: "Что случилось на самом деле?", lead: a => `Ты ожидал: «${x.prediction}».`, type: "choice", opts: [["confirmed", "Ожидание подтвердилось"], ["partial", "Отчасти"], ["not", "Не подтвердилось"], ["insufficient", "Данных мало"]], skip: a => a.opp !== "yes" || !(x && x.prediction) || a.act === "not" },
      { k: "fit", q: "Объяснение подходило к сегодняшнему случаю?", lead: a => { const h = hypOf(p); return h ? `«${h.text}»` : ""; }, type: "choice", opts: [["yes", "Да, узнаю"], ["no", "Нет, здесь было другое"], ["unknown", "Не знаю"]], optional: true, skip: a => a.opp !== "yes" || !hypOf(p) || hypOf(p).branch === "unknown" },
      { k: "impact", q: C.daily.eveningImpactScale.label, lead: "Это отдельная шкала: не сила эмоции, а насколько она мешает сейчас.", type: "scale", lo: "0, легко", hi: "10, очень трудно", def: 3 },
      { k: "change", q: "Что заметил за день?", type: "choice", opts: [["better", C.daily.changeObservation[0]], ["same", C.daily.changeObservation[1]], ["worse", C.daily.changeObservation[2]], ["unknown", C.daily.changeObservation[3]]], optional: true },
    ];
    /* v7: при поводе — одна компактная карточка опыта, связанная с текущим зеркалом; ожидание и дневная запись подставлены */
    const M7 = p.mirror, hasM = !!(M7 && M7.text && M7.status !== "rejected"), mx = !!(p.storyResult || hasM), E7 = OB.exp;
    const prevExp = Object.values(D.checkins).filter(cc => cc.patternId === p.id && cc.evening && cc.evening.experience && cc.dateKey !== k).length;
    const outcomesN = x && x.results ? x.results.filter(r => r.planVersion == null || r.planVersion === x.version).length : 0;
    const expStep = { k: "exp", q: E7.title, lead: E7.lead, type: "card", optional: true, skip: a => a.opp !== "yes", groups: a => [
      hasM ? { k: "rule", lead: `«${R.trimEnd(M7.text)}»`, label: E7.ruleQ, opts: E7.rule, ownOn: ["no"], ph: E7.ruleOtherPh } : { k: "rule", label: E7.thoughtQ, opts: E7.thought, ownOn: ["yes"], ph: E7.thoughtPh, needOwn: ["yes"] },
      { k: "outcome", lead: [x && x.prediction ? E7.expected.replace("{pred}", R.trimEnd(x.prediction)) : "", best && best.afterAnswer ? E7.noted.replace("{text}", R.trimEnd(best.afterAnswer)) : ""].filter(Boolean).join(" "), label: E7.expQ, opts: E7.exp, ownOn: E7.exp.map(o => o[0]), ph: E7.factPh, skip: a2 => !(x && x.prediction) || a2.act === "not" || (prevExp > 0 && outcomesN >= 3) },
      { k: "concl", label: E7.conclQ, opts: E7.concl.filter(([v]) => v !== "notfit" || hasM), ownOn: ["__own"], ph: "Свой вывод" },
    ] };
    const tmrStep = { k: "tmr", q: E7.tmrQ, type: "choice", opts: E7.tmr, optional: true };
    if (mx) { stepsFull.splice(stepsFull.findIndex(s => s.k === "mirror"), 3, expStep); stepsFull.push(tmrStep); }
    const stepsQuick = [
      { k: "oa", q: changedOnly ? OB.eveningOut.afterChange : "Был повод и что получилось?", lead: dayHint || (v ? `Твой шаг: ${lc1(v.action)}.` : ""), type: "choice", opts: R.QUICK_EVENING.map(([vv, l]) => [vv, l]) },
      { k: "impact", q: C.daily.eveningImpactScale.label, lead: "Не сила эмоции, а насколько она мешает сейчас.", type: "scale", lo: "0, легко", hi: "10, очень трудно", def: 3 },
    ];
    const run = quick => { seed((quick ? "evening-quick-" : "evening-") + k); flow({ id: (quick ? "evening-quick-" : "evening-") + k, scope: p.id, steps: quick ? stepsQuick : stepsFull, title: titleTxt, onCancel: () => go("today"),
      onDone: async ans => {
        const q = quick ? R.quickEvening(ans.oa) : { hadOpportunity: ans.opp || null, actionStatus: ans.act || (ans.opp === "yes" ? derived : null) };
        if (quick && derived && q.hadOpportunity === "yes" && !ans.oa) q.actionStatus = derived;
        /* Производный статус наследует принадлежность исходной попытки (план, версия, навык, линия), а не текущего плана. */
        const useBest = !!(derived && best && q.actionStatus === derived);
        const prov = useBest ? { skillId: best.skillId || null, experimentId: best.experimentId || best.planId || null, planId: best.planId || null, planVersion: best.planVersion || null, lineageId: best.lineageId || null } : evidenceTag(p);
        c.patternId = p.id; c.evening = Object.assign({ at: nowTs(), late, quick, hadOpportunity: q.hadOpportunity, actionStatus: q.actionStatus, currentImpact: ans.impact, change: ans.change || null, tz: R.tz(), enteredDate: today(), fromEpisodeId: useBest ? best.episodeId : null, otherAttemptIds: F.other.map(a => a.episodeId), provenanceChecked: true }, prov);
        if (ans.fit && ans.fit !== "unknown") { const h = hypOf(p); const ep = eps[eps.length - 1]; if (h) { const key = ans.fit === "yes" ? "supportingEpisodeIds" : "contradictingEpisodeIds"; h[key] = [...new Set([...(h[key] || []), ep ? ep.id : "day-" + k])]; await saveHyp(h); } }
        if (ans.mirror && p.mirror && p.mirror.text) { c.evening.mirrorSeen = ans.mirror; p.mirror.evidence = [...(p.mirror.evidence || []).filter(e => e.dateKey !== k), { dateKey: k, seen: ans.mirror, at: nowTs() }]; await savePattern(p); }
        if (ans.outcome && x) { x.results = x.results || []; const ep = eps.filter(e => e.newResponse)[0] || eps[eps.length - 1]; x.results.push({ episodeId: ep ? ep.id : null, dateKey: k, outcome: ans.outcome, at: nowTs() }); await saveExp(x); }
        if (mx && !quick) {
          const ex = { rule: ans.rule || null, ruleText: ans.rule_own || "", outcome: ans.outcome || null, fact: ans.outcome ? (ans.outcome_own || "") : "", conclusion: ans.concl || null, conclusionText: ans.concl === "__own" ? (ans.concl_own || "") : "", tomorrow: ans.tmr || null, hadMirror: hasM, mirrorVersion: mirrorVer(p), storyId: p.storyId || p.id };
          c.evening.experience = ex; c.evening.tomorrow = ans.tmr || null; c.evening.storyId = ex.storyId; c.evening.mirrorVersion = ex.mirrorVersion;
          if (hasM && ex.rule) c.evening.mirrorSeen = { yes: "yes", partly: "partly", no: "no", unnoticed: "unknown" }[ex.rule];
          if (p.mirror && (ex.rule || ex.conclusion)) {
            const Mm = p.mirror, ts = nowTs();
            if (ex.rule) Mm.evidence = [...(Mm.evidence || []).filter(e => e.dateKey !== k), { dateKey: k, seen: hasM ? ({ unnoticed: "unknown" }[ex.rule] || ex.rule) : "thought", text: ex.ruleText, conclusion: ex.conclusion, version: mirrorVer(p), at: ts }];
            if (ex.ruleText && (!hasM || ex.rule === "no")) Mm.otherThoughts = [...(Mm.otherThoughts || []).filter(t => t.dateKey !== k), { dateKey: k, text: R.trimEnd(ex.ruleText), version: mirrorVer(p), at: ts, status: "pending" }];
            if (ex.conclusion === "notfit") Mm.contradict = [...new Set([...(Mm.contradict || []), k])];
            await savePattern(p);
          }
          if (ex.outcome && x) { x.results = x.results || []; const ep = eps.filter(e => e.newResponse)[0] || eps[eps.length - 1]; x.results = x.results.filter(r => r.dateKey !== k || r.source !== "evening_v7"); x.results.push({ episodeId: ep ? ep.id : null, dateKey: k, outcome: ex.outcome, fact: ex.fact, planVersion: x.version, mirrorVersion: ex.mirrorVersion, source: "evening_v7", at: nowTs() }); await saveExp(x); }
        }
        await saveCheckin(c);
        eveningDone(p, c, rs, F);
      } }); };
    if (hasDraft("evening-" + k, p.id)) return run(false);
    if (hasDraft("evening-quick-" + k, p.id)) return run(true);
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(titleTxt)}</p><h1>Короткий итог дня</h1><p class="muted">Около минуты. Нет повода — тоже честный ответ.${dayHint ? ` ${esc(dayHint)}` : ""}</p>
      <div class="row"><button class="btn block" id="full">Начать</button></div><div class="row tight"><button class="btn ghost" id="quick">Короткий вечер · два вопроса</button><a class="btn ghost" href="#today">Позже</a></div>`;
    $("#full").onclick = () => run(false); $("#quick").onclick = () => run(true);
  }
  /* Итог вечера: только факты дня, связь с уроком через конкретную попытку, следующий шаг. Нет попытки — нет выдуманного продвижения. */
  /* v7: итог дня — что попробовал → что заметил → что возьмёшь завтра; только из ответов человека */
  function eveningStoryDone(p, c, F) {
    const E7 = OB.exp, ev = c.evening, ex = ev.experience || {}, v = planView(p), best = F && F.best;
    if (!P.seen.buttons) { P.seen.buttons = true; saveProfile(true); }
    const st = best ? best.status : ({ done: "done", partial: "partial", other: "other" })[ev.actionStatus] || (ev.actionStatus === "not" ? "not" : null);
    const act = best ? (best.status === "other" ? best.otherAction : best.action) : (v ? v.action : "");
    const tried = ev.hadOpportunity !== "yes" ? E7.noOpp : st && st !== "not" ? `${R.attemptStatusLabel(st)}${act ? `: «${R.trimEnd(act)}»` : ""}.` : st === "not" ? "Повод был, выбранный шаг не получился — это наблюдение, не провал." : E7.triedNone;
    const noticed = [];
    if (best && best.afterAnswer) noticed.push(`«${R.trimEnd(best.afterAnswer)}»`);
    if (ex.rule) noticed.push(ex.hadMirror ? ({ yes: E7.ruleOn, partly: E7.rulePartly, no: ex.ruleText ? E7.ruleOff.replace("{text}", R.trimEnd(ex.ruleText)) : E7.ruleOffNoText, unnoticed: E7.ruleUnnoticed })[ex.rule] : (ex.ruleText ? `первая мысль: «${R.trimEnd(ex.ruleText)}»` : E7.ruleUnnoticed));
    if (ex.outcome) noticed.push(({ confirmed: E7.asExpected, not: E7.differently, insufficient: E7.unclear })[ex.outcome] + (ex.fact ? `, ${E7.fact.replace("{text}", R.trimEnd(ex.fact))}` : ""));
    if (ex.conclusion) noticed.push(ex.conclusion === "__own" ? `«${R.trimEnd(ex.conclusionText)}»` : E7["concl" + ex.conclusion[0].toUpperCase() + ex.conclusion.slice(1)]);
    if (ev.quick) noticed.push(E7.quickNote);
    const tm = ex.tomorrow || ev.tomorrow || (ex.conclusion === "smaller" ? "smaller" : "same");
    const tomorrow = ({ same: v ? E7.tmrSame.replace("{action}", `«${R.trimEnd(v.action)}»`) : E7.tmrObserve, smaller: E7.tmrSmaller, moment: E7.tmrMoment, observe: E7.tmrObserve })[tm];
    const notes = [ex.ruleText && (!ex.hadMirror || ex.rule === "no") ? E7.otherSaved : "", ex.conclusion === "notfit" ? E7.notfitSaved : ""].filter(Boolean);
    const line = (t, x2) => `<div class="dsum"><span>${esc(t)}</span> ${esc(uc1(x2))}</div>`;
    app.innerHTML = `<h1>${esc(E7.sumTitle)}</h1><div class="trail" style="height:110px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.25"></i><div class="pop">+1 шаг</div></div>
      <div class="card" id="daySum"><div class="k">${ic("moon")}${esc(OB.eveningOut.facts)}</div>${line(E7.tried, tried)}<div class="dsum"><span>${esc(E7.noticed)}</span>${noticed.length ? noticed.map(n => `<div>${esc(uc1(n))}</div>`).join("") : "Ничего не отмечено."}</div>${line(E7.tomorrow, tomorrow + ".")}${notes.map(n => `<p class="tiny" style="margin:6px 0 0">${esc(n)}</p>`).join("")}</div>
      <div class="row tight">${tm === "smaller" || tm === "moment" ? `<a class="btn sm" href="#plan/${tm === "smaller" ? (v && v.canSimplify && !v.simplified ? "simplify" : "action") : "moment"}">${esc(tm === "smaller" ? OB.eveningOut.simpler : OB.eveningOut.moment)}</a>` : `<a class="btn secondary sm" href="#today">${esc(OB.eveningOut.keep)}</a>`}</div>
      <div class="row"><a class="btn block" href="#today">На главную</a></div>`;
  }
  function eveningDone(p, c, rs, F) {
    if (c.evening && (c.evening.experience || (p.storyResult && c.evening.quick))) return eveningStoryDone(p, c, F);
    const E = OB.eveningOut, ev = c.evening, v = planView(p), best = F && F.best, lessonT = p.lesson ? lc1(p.lesson.title) : "";
    if (!P.seen.buttons) { P.seen.buttons = true; saveProfile(true); }
    const lines = [];
    if (ev.hadOpportunity === "yes") lines.push(E.opp.replace("{n}", Math.max(1, F ? F.opportunities : 1)));
    else if (ev.hadOpportunity === "no") lines.push(E.noOpp); else lines.push("Повод не уверен — так и записано.");
    const st = best ? best.status : (ev.actionStatus === "done" ? "done" : ev.actionStatus === "partial" ? "partial" : ev.actionStatus === "not" ? "not" : null);
    if (st && st !== "not") lines.push(E.attempt.replace("{label}", R.attemptStatusLabel(st) + (st === "other" && best && best.otherAction ? `: ${best.otherAction}` : "")));
    if (st === "not") lines.push("Повод был, выбранный шаг не получился — это наблюдение, не провал.");
    if (best && best.afterAnswer) lines.push(E.noted.replace("{text}", best.afterAnswer));
    if (F && F.otherBest) lines.push(E.already.replace("{action}", lc1(F.otherBest.status === "other" ? F.otherBest.otherAction || "другое действие" : F.otherBest.action || R.attemptStatusLabel(F.otherBest.status)).replace(/[.!]+$/, "")));
    const triedAction = best && best.action ? best.action : (v ? v.action : "");
    const bridge = (st === "done" || st === "partial") && p.lesson && triedAction ? E.bridge.replace("{lesson}", lessonT || "твой урок").replace("{action}", lc1(triedAction).replace(/[.!]+$/, "")) : (ev.hadOpportunity === "yes" && !st ? E.noAttempt : "");
    const tool = R.nextTool({ pattern: p, plan: expOf(p), hypothesis: hypOf(p), research: researchOf(p), episodes: D.episodes, runsToday: toolRunsOn(today()).length + (rs.doneToday ? 1 : 0) });
    const toolHtml = tool && !c.evening.quick ? toolOfferHTML(tool) : "";
    app.innerHTML = `<h1>${esc(E.title)}</h1><div class="trail" style="height:110px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.25"></i><div class="pop">+1 шаг</div></div>
      <div class="card"><div class="k">${ic("moon")}${esc(E.facts)}</div><p class="small" style="margin:2px 0 4px">${lines.map(esc).join("<br>")}</p>${bridge ? `<p class="small" style="margin:0"><b>${esc(bridge)}</b></p>` : ""}${v ? `<p class="small muted" style="margin:6px 0 0">${esc(E.tomorrow.replace("{cue}", lc1(v.cue)).replace("{action}", lc1(v.action).replace(/[.!]+$/, "")))}</p>` : ""}</div>
      <div class="row tight"><a class="btn secondary sm" href="#today">${esc(E.keep)}</a>${v && v.canSimplify && !v.simplified ? `<a class="btn ghost sm" href="#plan/simplify">${esc(E.simpler)}</a>` : ""}<a class="btn ghost sm" href="#plan/moment">${esc(E.moment)}</a></div>
      ${toolHtml}${!toolHtml ? `<div class="row"><a class="btn block" href="#today">На главную</a></div>` : ""}`;
  }
  const TOOL_ROUTE = { need_module: "module/need", rule_permission: "module/rule", behavior_experiment: "module/experiment" };
  const toolTitle = id => id === "need_module" ? (C.firstWeekModules.find(m => m.id === "need") || {}).title : (PR.tools[id] || {}).title || id;
  function toolOfferHTML(tool) {
    const href = TOOL_ROUTE[tool.id] ? "#" + TOOL_ROUTE[tool.id] : "#tool/" + tool.id;
    return `<div class="card mark"><div class="k">${ic("mirror")}${esc(OB.tools.offer)} · 1–2 минуты</div><p style="margin:2px 0 8px"><b>${esc(toolTitle(tool.id))}.</b> ${esc(tool.why)}</p><div class="row tight"><a class="btn block" href="${href}">Сделать</a><a class="btn ghost" href="#today">Не сегодня</a></div></div>`;
  }

  /* =================== ИНСТРУМЕНТЫ (v6) ===================
     Контракт: зачем → подходит? → 1–4 коротких шага → мой результат → пригодность → что меняется в плане.
     Прохождение сохраняется (ToolRun); просмотр без ответа выводом не считается. Правило и проверка ожидания идут через модули исследования с тем же контрактом. */
  function toolScreen(id) {
    const p = activePattern(); if (!p) return go("today");
    if (TOOL_ROUTE[id]) return go(TOOL_ROUTE[id]);
    if (id === "grounding") return go("help");
    const T = PR.tools[id], S = X.toolSteps[id]; if (!T || !S) return go("story");
    const OT = OB.tools, k = today();
    const run = { id: R.uuid(), toolId: id, toolVersion: PR.catalogVersion, patternId: p.id, basisEpisodeId: (episodesOf(p).slice(-1)[0] || {}).id || null, dateKey: k, startedAt: nowTs(), endedAt: null, exited: false, answers: {}, result: "", fit: null, planChange: null };
    const steps = S.steps.map(st => {
      const o = Object.assign({}, st);
      if (st.tagsFrom === "firstThoughts") o.tags = X.firstThoughts; if (st.tagsFrom === "needs") o.tags = X.needs.filter(x => x !== "Другое" && x !== "Не знаю");
      if (st.type === "text" && st.optional) o.hint = OT.noResult;
      return o;
    });
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(OT.offer)}</p><h1 class="q">${esc(T.title)}</h1><p>${esc(T.purpose)}</p><p class="small muted">${esc(T.actionTemplate)}</p>
      <div class="card tight"><p class="small" style="margin:0 0 6px"><b>${esc(OT.fit)}</b> ${esc(T.fitQuestion)}</p><div class="row tight"><button class="btn sm" id="fitYes">${esc(OT.fitYes)}</button><a class="btn ghost sm" href="#today">${esc(OT.fitNo)}</a></div></div>`;
    $("#fitYes").onclick = () => flow({ id: "tool-" + id, scope: p.id, steps, title: T.title, cancelLabel: OT.stop, onCancel: async () => { run.exited = true; run.endedAt = nowTs(); await saveTool(run); go("today"); },
      onDone: async ans => {
        run.answers = ans; run.result = (ans[S.result] || "").trim(); run.endedAt = nowTs();
        const unknown = !run.result || /пока не знаю|не знаю/i.test(run.result);
        await saveTool(run);
        const v = planView(p), x = expOf(p);
        const applyLabel = S.change === "cue" ? "Поставить этот момент и действие в план" : S.change === "action" ? "Сделать это действием плана" : X.toolNext[S.change];
        app.innerHTML = `<h1>${esc(OT.result)}</h1><p class="small muted">${esc(T.afterQuestion)}</p>
          <div class="card mark"><p style="margin:0">${unknown ? "Пока не знаю — это тоже результат. Вывод не придумываем." : esc(run.result)}</p>${S.change === "cue" && ans.action ? `<p class="small" style="margin:6px 0 0">Если ${esc(lc1(ans.cue || ""))}, то ${esc(lc1(ans.action))}.</p>` : ""}</div>
          <p class="small" style="margin:8px 0 4px"><b>${esc(OT.howWas)}</b></p><div class="chips" id="fit">${X.toolFit.map(([vv, l]) => `<button class="chip" data-v="${vv}">${esc(l)}</button>`).join("")}</div>
          ${!unknown ? `<p class="small" style="margin:10px 0 4px"><b>${esc(OT.next)}</b></p><div class="row tight"><button class="btn secondary sm" id="apply">${esc(applyLabel)}</button><button class="btn ghost sm" id="skipApply">${esc(OT.skipApply)}</button></div>` : ""}
          <div class="row"><a class="btn block" href="#today">На главную</a></div>`;
        $$("#fit .chip").forEach(b => b.onclick = async () => { run.fit = b.dataset.v; $$("#fit .chip").forEach(q => q.classList.toggle("on", q === b)); await saveTool(run); });
        const ap = $("#apply"); if (ap) ap.onclick = async () => {
          if (S.change === "thought") { p.thought = run.result; p.thoughtKind = "version"; if (ans.for || ans.against) p.check = { facts: `за: ${ans.for || "—"} / против: ${ans.against || "—"}`, alt: run.result }; await savePattern(p); run.planChange = { field: "thought" }; }
          else if (S.change === "cue") { await newExperimentVersion(p, { cueUser: ans.cue, actionUser: ans.action, reason: "tool:" + id, planStatus: "accepted", acceptedAt: nowTs() }); run.planChange = { field: "cue", cue: ans.cue, action: ans.action }; }
          else if (S.change === "action") {
            const phrase = id === "assertive_no" ? `Сказать: «${run.result}»` : id === "assertive_request" ? `Сказать: «${ans.fact ? ans.fact + ". " : ""}${ans.need ? "Мне нужно " + lc1(ans.need) + ". " : ""}${run.result}»` : id === "boundary" ? `Если повторится — ${lc1(run.result)}` : id === "resource_step" ? `${({ less: "Уменьшить", move: "Перенести", split: "Разделить", ask: "Попросить помощи с" })[ans.how] || "Изменить"}: ${lc1(run.result)}` : run.result;
            p.phrases = Object.assign({}, p.phrases, { [id === "assertive_no" ? "refuse" : id === "assertive_request" ? "request" : id]: run.result });
            if (id === "boundary") p.boundary = { unacceptable: ans.unacceptable || "", myStep: run.result };
            if (id === "resource_step") p.resource = Object.assign({}, p.resource, { lack: val(ans, "lack") || (p.resource && p.resource.lack) || "", step: run.result });
            await savePattern(p);
            await newExperimentVersion(p, { actionUser: phrase, reason: "tool:" + id, planStatus: "accepted", acceptedAt: nowTs() }); run.planChange = { field: "action", action: phrase };
          }
          await saveTool(run); toast("Применено к плану"); go("today");
        };
        const sk = $("#skipApply"); if (sk) sk.onclick = async () => { run.planChange = { field: null, skipped: true }; await saveTool(run); go("today"); };
      } });
  }

  /* =================== МОДУЛИ ИССЛЕДОВАНИЯ =================== */
  function moduleScreen(id) {
    const p = activePattern(); if (!p) return go("today");
    const rs = R.researchState(researchOf(p), today(), deepToday), M = C.firstWeekModules.find(m => m.id === id);
    if (!M || id === "review") return go("review");
    const mods = researchOf(p).modules;
    if (mods[id] && mods[id].status === "done" && !hasDraft("mod-" + id, p.id)) { if (!confirmRedo) return go("story"); }
    if (rs.lockedToday && rs.next === id) {
      app.innerHTML = `<h1 class="q">Сегодня шаг исследования уже был</h1><p class="muted">По умолчанию — один новый шаг в день: так понимание ложится спокойнее. Следующий откроется завтра.</p>
        <div class="row"><button class="btn block secondary" id="deep">Разобрать сейчас — углублённо</button></div><div class="row tight"><a class="btn ghost" href="#story">Вернуться</a></div>`;
      $("#deep").onclick = () => { deepToday = true; moduleScreen(id); }; return;
    }
    if (rs.next !== id && !(mods[id] && mods[id].status === "done")) { const idx = R.MODULE_ORDER.indexOf(id); if (idx > R.MODULE_ORDER.indexOf(rs.next)) return go("module/" + rs.next); }
    const done = async (answers, apply) => { await apply(); const r = researchOf(p); r.modules[id] = { status: "done", dateKey: today(), doneAt: nowTs(), answers }; await saveResearch(r); P.lastModule = id; await saveProfile();
      /* Модуль — тоже прохождение инструмента: результат и изменение плана сохраняются с датой и привязкой к сюжету. */
      const TOOL_OF = { meaning: "thought_check", rule: "rule_permission", experiment: "behavior_experiment", need: "need_module" };
      if (TOOL_OF[id]) await saveTool({ id: R.uuid(), toolId: TOOL_OF[id], toolVersion: PR.catalogVersion, patternId: p.id, dateKey: today(), startedAt: nowTs(), endedAt: nowTs(), exited: false, answers, result: id === "meaning" ? (p.thought || "") : id === "rule" ? (p.permission || "") : id === "experiment" ? (expOf(p) ? expOf(p).action : "") : (p.need || ""), fit: null, planChange: id === "experiment" ? { field: "action" } : null, viaModule: id });
      go("story"); };
    const title = `Исследование · ${M.title}`;
    if (id === "meaning") {
      flow({ id: "mod-meaning", scope: p.id, title, onCancel: () => go("story"), steps: [
        { k: "thought", q: "В тот момент мне показалось…", lead: `Случай: «${lastEvent(p)}»`, type: "choice", opts: X.firstThoughts, own: true, unknown: true },
        { k: "kind", q: "Это наблюдение или моя версия?", lead: a => `«${val(a, "thought") === "unknown" ? "…" : val(a, "thought")}»`, type: "choice", opts: X.observationOrVersion, skip: a => a.thought === "unknown" },
      ], onDone: ans => done(ans, async () => { p.thought = val(ans, "thought") === "unknown" ? "" : val(ans, "thought"); p.thoughtKind = ans.kind || null; await savePattern(p); P.lastResult2 = M.resultCopy; }) });
    } else if (id === "need") {
      const packs = C.packs;
      flow({ id: "mod-need", scope: p.id, title, onCancel: () => go("story"), steps: [
        { k: "need", q: M.lead, lead: "Чего мне не хватило?", type: "choice", opts: X.needs.filter(x => x !== "Другое" && x !== "Не знаю"), own: true, unknown: true },
        { k: "pack", q: "На что это больше похоже?", lead: "Чтобы подобрать возможные объяснения.", type: "choice", opts: packs.map(pk => [pk.id, pk.title]), skip: () => !!p.packId },
        { k: "cands", q: "Какие объяснения похожи на правду?", lead: "Можно отметить до двух. Это версии, не диагноз.", type: "multi", opts: a => (packs.find(pk => pk.id === (p.packId || a.pack)) || packs[0]).hypotheses.filter(h => h.branch !== "unknown").map(h => [h.id, h.text]), validate: a => (a.cands || []).length > 2 ? "Оставь не больше двух — остальные проверим позже." : "", optional: true },
        { k: "sel", q: "Какое проверим первым?", type: "choice", opts: a => { const pk = packs.find(x => x.id === (p.packId || a.pack)) || packs[0]; return [...(a.cands || []).map(id => [id, pk.hypotheses.find(h => h.id === id).text]), ["__none", "Ни одно пока не подходит — буду наблюдать"]]; }, skip: a => !(a.cands || []).length },
      ], onDone: ans => done(ans, async () => {
        p.need = val(ans, "need") === "unknown" ? "" : val(ans, "need"); if (!p.packId && ans.pack) p.packId = ans.pack;
        const pk = packOf(p) || packs[0]; const ts = nowTs();
        const old = hypOf(p); if (old && (old.status === "selected" || old.status === "supported_by_user")) { old.status = "revised"; await saveHyp(old); }
        for (const cid of (ans.cands || [])) { const src = pk.hypotheses.find(h => h.id === cid); const hv = { id: R.uuid(), patternId: p.id, branch: src.branch, text: src.text, packHypothesisId: src.id, status: ans.sel === cid ? "selected" : "candidate", supportingEpisodeIds: ans.sel === cid ? episodesOf(p).filter(e => e.linkStatus === "confirmed").slice(-1).map(e => e.id) : [], contradictingEpisodeIds: [], createdAt: ts, version: D.hypotheses.filter(h => h.patternId === p.id).length + 1 }; await saveHyp(hv); if (ans.sel === cid) { p.hypothesisVersionId = hv.id; setPermissionFromPack(p, src.innerPermission, hv.id); } }
        if (!(ans.cands || []).length || ans.sel === "__none") { const src = pk.hypotheses.find(h => h.branch === "unknown"); const hv = { id: R.uuid(), patternId: p.id, branch: "unknown", text: src.text, packHypothesisId: src.id, status: "selected", supportingEpisodeIds: [], contradictingEpisodeIds: [], createdAt: ts, version: D.hypotheses.filter(h => h.patternId === p.id).length + 1 }; await saveHyp(hv); p.hypothesisVersionId = hv.id; setPermissionFromPack(p, src.innerPermission, hv.id); }
        await savePattern(p); P.lastResult2 = M.resultCopy;
      }) });
    } else if (id === "rule") {
      const h = hypOf(p), br = h ? h.branch : "unknown"; const src = h && packOf(p) ? packOf(p).hypotheses.find(x => x.id === h.packHypothesisId) : null;
      const ALT = [["rule", "Это моё внутреннее правило"], ["boundary", "Это про границу: другой нарушает договорённость"], ["expectation", "Это моя интерпретация: вывод, который стоит проверить"], ["resource", "Это про нехватку сил"], ["own_behavior", "Похоже, я тоже так иногда поступаю"], ["unknown", "Пока не знаю"]];
      const alts = [...ALT.filter(a => a[0] === br), ...ALT.filter(a => a[0] !== br)];
      const steps = [
        { k: "alt", q: "Куда это ближе?", lead: h ? `Проверяемое объяснение: «${h.text}». Все варианты равноправны.` : "Объяснение ещё не выбрано. Все варианты равноправны.", type: "choice", opts: alts },
        { k: "allow", q: "Если я позволю себе…", type: "text", ph: "например: отказать в необязательной просьбе", tags: src ? [src.innerPermission] : [], skip: a => a.alt !== "rule" },
        { k: "fear", q: "…то боюсь, что…", type: "choice", opts: X.fears.filter(x => x !== "Другое" && x !== "Не знаю"), own: true, unknown: true, skip: a => a.alt !== "rule" },
        { k: "perm", q: "Более гибкое разрешение", lead: "С уважением к другим. Не оправдание вреда или нарушения договорённостей.", type: "text", ph: "например: мои потребности тоже имеют значение", tags: src ? [src.innerPermission] : ["Мои потребности тоже имеют значение", "Я могу отказать и выдержать чужое недовольство"], skip: a => a.alt !== "rule" },
        { k: "bnd", q: "Что конкретно для меня неприемлемо?", lead: "Наблюдаемое действие, без оценки личности. Искать то же качество в себе здесь не нужно.", type: "text", ph: "например: обещал и не сделал", skip: a => a.alt !== "boundary" },
        { k: "bnd2", q: "Что я сделаю сам, если это продолжится?", lead: "Не угроза и не способ заставить другого измениться.", type: "text", ph: "например: перенесу разговор; ограничу свой вклад", tags: ["Перенесу разговор", "Ограничу свой вклад", "Назову условие и срок"], skip: a => a.alt !== "boundary" },
        { k: "fact", q: "Какой факт поддерживает мой вывод, а какой нет?", lead: a => `Вывод: «${p.thought || (h ? h.text : "")}»`, type: "text", ph: "за: … / против: …", skip: a => a.alt !== "expectation" },
        { k: "alt2", q: "Есть более точная версия, которая учитывает оба?", lead: "«Пока не знаю» допустимо. Обязательного позитивного вывода нет.", type: "text", ph: "например: он спешил, а не отмахнулся от меня", optional: true, skip: a => a.alt !== "expectation" },
        { k: "res", q: "Чего сейчас не хватает?", type: "choice", opts: ["Отдыха", "Времени", "Помощи", "Ясности"], own: true, unknown: true, skip: a => a.alt !== "resource" },
        { k: "res2", q: "Что можно уменьшить, перенести или разделить?", type: "text", ph: "один пункт", skip: a => a.alt !== "resource" },
        { k: "own", q: "Бывает ли, что я тоже так поступаю?", lead: "Добровольный вопрос. Ответ «нет» — тоже ответ.", type: "choice", opts: [["yes", "Да"], ["sometimes", "Иногда"], ["no", "Нет"], ["unknown", "Не знаю"]], skip: a => a.alt !== "own_behavior" },
        { k: "own2", q: "Есть конкретный случай?", type: "text", ph: "когда, с кем", optional: true, skip: a => a.alt !== "own_behavior" || a.own === "no" || a.own === "unknown" },
        { k: "obs", q: "Что можно просто заметить в следующем случае?", type: "text", ph: "например: что я чувствую в первую секунду", optional: true, skip: a => a.alt !== "unknown" },
      ];
      flow({ id: "mod-rule", scope: p.id, title, onCancel: () => go("story"), steps, onDone: ans => done(ans, async () => {
        const PERM = { boundary: "Я могу назвать нарушение и ограничить свой вклад", expectation: "Я могу проверить смысл, прежде чем делать вывод о себе", resource: "Я могу соотносить обязательства со своими силами", own_behavior: "Я могу менять свою часть, не оправдывая чужую", unknown: "Мне можно пока не знать" };
        if (ans.alt === "rule") p.rule = { ifAllow: ans.allow, fear: val(ans, "fear") };
        if (ans.alt === "boundary") p.boundary = { unacceptable: ans.bnd, myStep: ans.bnd2 };
        if (ans.alt === "expectation") p.check = { facts: ans.fact, alt: ans.alt2 || "" };
        if (ans.alt === "resource") p.resource = { lack: val(ans, "res"), step: ans.res2 };
        if (ans.alt === "own_behavior") p.ownBehavior = { answer: ans.own, example: ans.own2 || "" };
        /* Любая смена направления — новая версия объяснения; прежняя помечается пересмотренной. «Пока не знаю» тоже версия: неопределённость видна. */
        if (!h || ans.alt !== br) {
          if (h && h.status !== "rejected") { h.status = "revised"; await saveHyp(h); }
          const pk = packOf(p); const src2 = pk ? pk.hypotheses.find(x => x.branch === ans.alt) : null;
          const TXT = { boundary: "Другой нарушает договорённость", resource: "Я беру на себя больше, чем сейчас могу", expectation: "Мой вывод о ситуации стоит проверить", rule: h ? h.text : "Моё внутреннее правило мешает выбрать ответ", own_behavior: "Похоже, я тоже иногда так поступаю", unknown: "Пока ни одно объяснение не подходит" };
          const hv = { id: R.uuid(), patternId: p.id, branch: ans.alt, text: src2 ? src2.text : TXT[ans.alt], packHypothesisId: src2 ? src2.id : null, status: "selected", supportingEpisodeIds: h ? (h.supportingEpisodeIds || []) : [], contradictingEpisodeIds: [], createdAt: nowTs(), version: D.hypotheses.filter(v => v.patternId === p.id).length + 1, note: "уточнено на шаге «Что я себе разрешаю»" };
          await saveHyp(hv); p.hypothesisVersionId = hv.id;
        }
        if (ans.alt === "rule") setPermissionByUser(p, ans.perm); else setPermissionFromPack(p, PERM[ans.alt], p.hypothesisVersionId);
        if (p.permissionSource) p.permissionSource.confirmed = true;
        await savePattern(p); P.lastResult2 = M.resultCopy;
      }) });
    } else if (id === "experiment") {
      const h = hypOf(p), src = h && packOf(p) ? packOf(p).hypotheses.find(x => x.id === h.packHypothesisId) : null, ex = src ? C.exercises.find(e => e.id === src.exerciseId) : null;
      const defSkill = src ? X.exerciseSkill[src.exerciseId] : (p.skillId || "pause");
      flow({ id: "mod-experiment", scope: p.id, title, onCancel: () => go("story"), steps: [
        { k: "action", q: "Маленький выполнимый шаг", lead: ex ? `${ex.title}: ${ex.steps[0]}` : "Что ты попробуешь, когда будет повод?", type: "text", ph: "одно действие", tags: [src ? src.outerActionExample : planText(p), "Сказать: «Сегодня не могу»", "Спросить, что именно нужно", "Взять паузу и ответить позже"].filter(Boolean) },
        { k: "prediction", q: "Что я предсказываю?", lead: "Что случится, если сделаю иначе.", type: "choice", opts: ["Человек обидится", "Будет неловко, но ничего страшного", "Откажут или надавят", "Станет спокойнее", "Ничего не изменится"], own: true, unknown: true },
        { k: "criterion", q: "По чему пойму результат?", type: "choice", opts: ["По ответу человека", "По своему состоянию после", "По тому, сделал ли я это", "По тому, что случилось дальше"], own: true },
        { k: "skill", q: "Какой навык тренируем?", type: "choice", opts: SKILLS.map(s => [s.id, s.label]), lead: `Предложено: ${skillLabel(defSkill)}` },
        { k: "signal", q: "Если …", lead: "Узнаваемый внешний или телесный сигнал.", type: "choice", opts: [...(bodySignal(p) ? [`замечаю ${bodySignal(p)}`] : []), "заденет", "меня перебьют", "меня попросят", "мне откажут", "захочется объяснять"], own: true },
      ], onDone: ans => done(ans, async () => {
        const skill = ans.skill || defSkill, old = expOf(p);
        /* Личный план сохраняет контракт: шаг и момент человека становятся его словами в новой версии плана, ожидание — предсказанием для проверки. */
        const nx = await newExperimentVersion(p, old && old.kind === "plan"
          ? { actionUser: ans.action, cueUser: val(ans, "signal"), prediction: val(ans, "prediction") === "unknown" ? "" : val(ans, "prediction"), criterion: val(ans, "criterion"), skillId: skill, permission: p.permission || "", hypothesisVersionId: p.hypothesisVersionId, mode: "experiment", planStatus: "accepted", acceptedAt: nowTs(), reason: "experiment-module" }
          : { action: ans.action, prediction: val(ans, "prediction") === "unknown" ? "" : val(ans, "prediction"), criterion: val(ans, "criterion"), skillId: skill, ifThen: { signal: val(ans, "signal"), action: ans.action }, permission: p.permission || "", hypothesisVersionId: p.hypothesisVersionId, kind: "experiment" });
        /* Урок подтверждается практикой, если навык совпал; иначе «Мой путь» предложит уточнить название. */
        if (p.lesson && p.lesson.skillId === skill && p.lesson.status === "preliminary") { p.lesson.status = "confirmed"; p.lesson.keptForExperimentId = nx.id; await savePattern(p); }
        P.lastResult2 = M.resultCopy;
      }) });
    } else if (id === "transfer") {
      const unc = D.episodes.filter(e => e.linkStatus === "unconfirmed" && !e.legacy);
      flow({ id: "mod-transfer", scope: p.id, title, onCancel: () => go("story"), steps: [
        { k: "had", q: "Был новый реальный случай на этой неделе?", type: "choice", opts: [["yes", "Да, был"], ["no", "Не было"]] },
        { k: "same", q: "Там та же мысль или правило — или просто похожее чувство?", lead: `Обычно ты думаешь «${p.thought || "…"}» и делаешь «${lc1(p.habitualResponse) || "…"}».`, type: "choice", opts: [["yes", "Та же мысль или правило"], ["no", "Просто похожее чувство"], ["unknown", "Не знаю"]], skip: a => a.had !== "yes" },
        ...(unc.length ? [{ k: "links", q: "Эти записи — тот же сюжет?", lead: "Отметь те, что про то же самое. Остальные уйдут в очередь.", type: "multi", opts: unc.map(e => [e.id, `${R.human(e.dateKey)} · ${e.emotion || "случай"} · ${e.intensity}/10${e.event ? " · " + e.event.slice(0, 40) : ""}`]), optional: true }] : []),
      ], onDone: ans => done(ans, async () => {
        const h = hypOf(p);
        for (const e of unc) { const yes = (ans.links || []).includes(e.id); e.linkStatus = yes ? "confirmed" : "queued"; if (!yes) e.patternId = null; else { e.patternId = p.id; if (h) h.supportingEpisodeIds = [...new Set([...(h.supportingEpisodeIds || []), e.id])]; } await saveEpisode(e); }
        if (h) await saveHyp(h);
        p.transfer = ans.had === "yes" ? ans.same : "none"; await savePattern(p); P.lastResult2 = M.resultCopy;
      }) });
    } else go("story");
  }
  let confirmRedo = true;
  const lastEvent = p => { const e = episodesOf(p).filter(x => x.event).slice(-1)[0]; return e ? e.event : (p.title || ""); };
  const bodySignal = p => { const e = episodesOf(p).filter(x => x.body && (x.body.locations || []).some(l => !/ничего|не хочу/i.test(l))).slice(-1)[0]; return e ? lc1((e.body.locations.find(l => !/ничего|не хочу/i.test(l)) || "") + (e.body.sensation ? ` (${lc1(e.body.sensation)})` : "")) : (p.bodySignal || ""); };

  /* =================== МОЙ СЮЖЕТ =================== */
  /* v6.7: принятый шаг автоматически не переписывается. Если формулировка шаблона обновлена, предлагаем отдельную новую версию
     (те же ответы человека, «С кем» — отдельной строкой). История и линия подтверждений сохраняются: это правка слов, не новое действие. */
  function planUpdateFor(p) {
    const x = expOf(p); if (!x || x.kind !== "plan" || x.planStatus !== "accepted" || !x.templateId || x.templateUpdateDismissed === C.contentVersion) return null;
    const card = PR.cards[x.templateId] || (PR.adapted || {})[x.templateId]; if (!card) return null;
    const same = card.cueTemplate === x.cueTemplate && card.actionTemplate === x.actionTemplate && (card.smallerVersion || "") === (x.smallerVersion || "");
    if (same) return null;
    const nx = Object.assign(JSON.parse(JSON.stringify(x)), { cueTemplate: card.cueTemplate, actionTemplate: card.actionTemplate, smallerVersion: card.smallerVersion || "", afterQuestion: card.afterQuestion || x.afterQuestion,
      setup: (card.setup || []).map(sl => Object.assign({ key: sl.key, question: sl.question, example: sl.example || "" }, sl.label ? { label: true } : {})) });
    const ov = R.planView(x), nv = R.planView(nx);
    if (!R.planReady(nx).ready || (ov.cue === nv.cue && ov.action === nv.action)) return null;
    return { x, nx, ov, nv };
  }
  function planUpdateHTML(p) {
    const u = planUpdateFor(p); if (!u) return ""; const U = OB.planUpdate;
    return `<div class="card tight" id="planUpd"><div class="k">${ic("key")}${esc(U.title)}</div><p class="small" style="margin:2px 0 6px">${esc(U.text)}</p>
      <p class="small" style="margin:0 0 4px"><b>${esc(U.was)}:</b> ${esc(uc1(u.ov.cue))} — ${esc(lc1(u.ov.action))}</p>
      <p class="small" style="margin:0 0 6px"><b>${esc(U.will)}:</b> ${u.nv.who ? `${esc(OB.plan.whoL)}: ${esc(u.nv.who)}. ` : ""}${esc(uc1(u.nv.cue))} — ${esc(lc1(u.nv.action))}</p>
      <div class="row tight"><button class="btn secondary sm" id="updOk">${esc(U.ok)}</button><button class="btn ghost sm" id="updKeep">${esc(U.keep)}</button></div></div>`;
  }
  function bindPlanUpdate(p, again) {
    const ok = $("#updOk"); if (ok) ok.onclick = async () => { const u = planUpdateFor(p); if (!u) return again(); const lin = u.x.lineageId;
      const patch = { cueTemplate: u.nx.cueTemplate, actionTemplate: u.nx.actionTemplate, smallerVersion: u.nx.smallerVersion, afterQuestion: u.nx.afterQuestion, setup: u.nx.setup, planStatus: "accepted", reason: "wording", acceptedAt: nowTs() };
      const nxp = await newExperimentVersion(p, patch); nxp.lineageId = lin; nxp.wordingUpdatedFrom = u.x.id; await saveExp(nxp); toast(OB.planUpdate.done); again(); };
    const kp = $("#updKeep"); if (kp) kp.onclick = async () => { const x = expOf(p); x.templateUpdateDismissed = C.contentVersion; await saveExp(x); again(); };
  }
  /* v6.10: зеркало — проверяемая гипотеза: значение, статус и источник; можно поправить или снять, история сохраняется */
  /* v7: правка зеркала — новая версия рабочей гипотезы; прежние эпизоды и вечера сохраняют свою версию */
  async function mirrorNewVersion(p, text, source, status, type) {
    const M = p.mirror = p.mirror || { text: "", status: "searching", history: [], evidence: [], versions: [] }, ts = nowTs();
    M.versions = M.versions || (M.text ? [{ version: M.version || 1, text: M.text, at: M.at || ts, source: M.origin }] : []);
    M.history = M.history || [];
    if (M.text) M.history.push({ text: M.text, status: M.status, version: M.version || 1, at: ts, change: "new_version" });
    const v = Math.max(0, M.version || 0, ...M.versions.map(z => z.version || 0)) + 1;
    M.version = v; M.text = R.trimEnd(text); M.origin = source; M.status = status; if (type) M.type = type; M.at = ts; M.versions.push({ version: v, text: M.text, at: ts, source });
    await savePattern(p);
  }
  function mirrorCard(p) {
    const M = p && p.mirror, F = OB.family, MP = OB.mirrorPath; if (!M) return "";
    const ev = M.evidence || [], y = ev.filter(e => e.seen === "yes" || e.seen === "partly").length, n = ev.filter(e => e.seen === "no").length;
    const thoughts = (M.otherThoughts || []);
    const th = thoughts.length ? `<div class="tiny" id="mirrorThoughts">${esc(MP.otherThoughts)}: ${thoughts.map(t => `«${esc(t.text)}» (${esc(R.humanShort(t.dateKey))})`).join(", ")}</div>` : "";
    if (!M.text) {
      if (!p.storyResult) return "";
      return `<div class="prow" id="mirrorRow"><div class="k"><span>${esc(MP.title)}</span></div><span id="mirrorStatus">${esc(X.stories.mirrorStatus.searching)}</span><div class="tiny">${esc(MP.searching)}</div>${th}<div class="row tight"><button class="btn ghost sm" data-mir="search">${esc(MP.continue)}</button><button class="btn ghost sm" data-mir="own">${esc(MP.own)}</button></div></div>`;
    }
    const v7 = !!p.storyResult, st = v7 ? mirrorStatusText(p) : (F.mirrorStatus[M.status] || "");
    const old = (M.versions || []).filter(z => z.version !== M.version);
    return `<div class="prow" id="mirrorRow"><div class="k"><span>${esc(v7 ? MP.title : F.storyMirror)}</span>${M.status !== "rejected" ? `<button data-mir="edit">${esc(F.storyMirrorEdit)}</button> <button data-mir="reject">${esc(F.storyMirrorReject)}</button>` : ""}</div>«${esc(R.trimEnd(M.text))}» <span class="tiny" id="mirrorStatus">· ${esc(st)}${v7 && M.version ? ` · ${esc(MP.version.replace("{v}", M.version))}` : ""}</span>${M.example ? `<div class="tiny">Пример: «${esc(R.trimEnd(M.example))}»</div>` : ""}${ev.length ? `<div class="tiny" id="mirrorEv">${esc(F.storyMirrorEvidence.replace("{y}", y).replace("{n}", n))}</div>` : ""}${th}${old.length ? `<details class="plain"><summary class="tiny">${esc(MP.versions)} · ${old.length}</summary>${old.map(z => `<div class="tiny">${esc(MP.version.replace("{v}", z.version))}: «${esc(z.text)}»</div>`).join("")}</details>` : ""}</div>`;
  }
  function bindMirrorCard(p) {
    const F = OB.family, MP = OB.mirrorPath, v7 = !!p.storyResult;
    $$("[data-mir]").forEach(b => b.onclick = async () => {
      const M = p.mirror; M.history = M.history || []; const row = $("#mirrorRow"), kind = b.dataset.mir;
      if (kind === "reject") { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Снять гипотезу? Нажми ещё раз"; return; } M.history.push({ text: M.text, status: M.status, version: M.version || null, at: nowTs(), change: "rejected" }); M.status = "rejected"; await savePattern(p); toast(v7 ? MP.rejected : F.storyMirrorRejected); return story(); }
      if (kind === "search") {
        const sr = p.storyResult, A = sr.answers || {}, cands = R.storyCandidates(X.stories, sr).filter(c => !(A["mir:" + c.id] && A["mir:" + c.id].v === "no") && c.text !== M.text && !(M.history || []).some(h => h.text === c.text && h.change === "rejected"));
        $("#mirSearch") && $("#mirSearch").remove();
        row.insertAdjacentHTML("beforeend", `<div id="mirSearch">${cands.length ? `<p class="tiny" style="margin:6px 0 4px">${esc(MP.candidates)}</p>${cands.map(c => `<div class="card tight"><p class="small" style="margin:0 0 6px">«${esc(c.text)}»</p><button class="btn secondary sm" data-cand="${esc(c.id)}">${esc(MP.recog)}</button></div>`).join("")}` : `<p class="tiny" style="margin:6px 0">${esc(MP.noCand)}</p>`}</div>`);
        $$("[data-cand]").forEach(cb => cb.onclick = async () => { const c = cands.find(z => z.id === cb.dataset.cand); M.candidateId = c.id; M.check = c.check; await mirrorNewVersion(p, c.text, "candidate_recognized_later", "recognized", c.type); toast("Записали"); story(); });
        return;
      }
      $("#mirEdit") && $("#mirEdit").remove();
      row.insertAdjacentHTML("beforeend", `<div id="mirEdit"><textarea id="mirT" placeholder="${esc(MP.ownPh)}">${esc(kind === "edit" ? M.text : "")}</textarea><div class="row tight"><button class="btn secondary sm" id="mirOk">Сохранить</button></div></div>`);
      $("#mirT").focus();
      $("#mirOk").onclick = async () => {
        const t = $("#mirT").value.trim(); if (!t) return toast("Напиши пару слов");
        if (kind === "own") { await mirrorNewVersion(p, t, "user_written", "recognized", "own"); return story(); }
        if (t === M.text) return story();
        if (v7) await mirrorNewVersion(p, t, "user_edited", (M.evidence || []).length ? "refined" : M.status);
        else { M.history.push({ text: M.text, status: M.status, at: nowTs(), change: "edited" }); M.text = t; M.origin = "user_edited"; M.status = M.status === "to_check" ? "to_check" : "partial"; await savePattern(p); }
        story();
      };
    });
  }
  function story() {
    const p = anyPattern();
    if (!p) { app.innerHTML = `<h1>Сюжета пока нет</h1><p class="muted">Начни с одного случая или посмотри карточки.</p><div class="row"><a class="btn block" href="#entry">Начать</a></div>`; return; }
    const h = hypOf(p), x = expOf(p), rs = R.researchState(researchOf(p), today(), deepToday), rec = R.hypothesisRecognition(h, D.episodes), elig = p.startDate ? eligibility(p) : null;
    const M = C.firstWeekModules;
    const contra = h && (h.contradictingEpisodeIds || []).length ? `<div class="nudge">Есть ${h.contradictingEpisodeIds.length} ${R.plural(h.contradictingEpisodeIds.length, "случай", "случая", "случаев")}, где объяснение не подошло. Это не отменяет работу — можно <a href="#module/need">уточнить версию</a> или понаблюдать дальше.</div>` : "";
    /* Объяснение сменилось или отвергнуто: подобранные под него разрешение и шаг ждут решения, а не действуют молча. */
    const dep = R.dependencyReview({ pattern: p, experiment: x });
    /* Урок и практика разошлись по навыку: подпись урока ждёт решения, текст человека не перезаписывается. */
    const drift = R.lessonDrift({ pattern: p, experiment: x });
    const driftHtml = drift.drift ? `<div class="card mark"><div class="k">${ic("mirror")}${esc(OB.drift.title)}</div><p class="small" style="margin:2px 0 8px">${esc(OB.drift.text.replace("{lesson}", p.lesson.title).replace("{old}", skillLabel(drift.oldSkill)).replace("{new}", skillLabel(drift.newSkill)))}</p><div class="row tight"><button class="btn secondary sm" id="keepLesson">${esc(OB.drift.keep)}</button><button class="btn sm" id="refineLesson">${esc(OB.drift.refine)}</button></div></div>` : "";
    const migrated = dep.permission && dep.permissionOrigin === "migrated";
    const depHtml = dep.any ? `<div class="card mark"><div class="k">${ic("mirror")}Объяснение изменилось</div><p class="small" style="margin:2px 0 8px">${[dep.permission ? `разрешение «${esc(p.permission)}»` : "", dep.plan ? `шаг «${esc(x.action)}»` : ""].filter(Boolean).join(" и ")} ${migrated ? (dep.plan ? "появились при прежнем объяснении (происхождение разрешения не записано)" : "появилось при прежнем объяснении, его происхождение не записано") : `${dep.permission && dep.plan ? "были подобраны" : dep.permission ? "было подобрано" : "был подобран"} под прежнее объяснение`}. Оставить или выбрать другое?</p><div class="row tight"><button class="btn secondary sm" id="keepDep">Оставить</button><button class="btn sm" id="redoDep">Выбрать другое</button></div></div>` : "";
    const note = (P.lastResult2 ? `<div class="card mark tight"><p class="small" style="margin:0">${esc(P.lastResult2)}</p></div>` : "") + depHtml + driftHtml + contra; if (P.lastResult2) { delete P.lastResult2; saveProfile(); }
    const saved = (P.savedScenarios || []);
    const savedHtml = saved.length ? `<div class="card tight"><div class="k">${ic("hourglass")}${esc(OB.saved.title)} · ${saved.length}</div><p class="tiny" style="margin:2px 0 6px">${esc(OB.saved.lead)}</p><ul class="list">${saved.map((sc, i) => `<li><div class="small">${esc(sc.recognition || sc.text)}</div><div class="row tight" style="margin-top:4px"><button class="btn secondary sm" data-saved="${i}">${esc(OB.saved.start)}</button><button class="btn ghost sm" data-unsave="${i}">${esc(OB.saved.remove)}</button></div></li>`).join("")}</ul></div>` : "";
    const field = (k, v, edit, ph) => `<div class="prow"><div class="k"><span>${k}</span>${edit ? `<button data-edit="${edit}" data-ph="${esc(ph || "")}">изменить</button>` : ""}</div>${v ? esc(v) : `<span class="muted">${esc(ph || "пока пусто")}</span>`}</div>`;
    const flags = flagsReal().filter(f => f.patternId === p.id);
    const sup = h ? (h.supportingEpisodeIds || []).length : 0;
    hero.innerHTML = `<div class="hero"><div class="hl">${ic("eye", "")}Мой путь</div><div class="hd">${esc(p.title)}</div><div class="hs">${p.status === "observe" ? "наблюдение" : p.status === "paused" ? "пауза" : (h ? rec.label : (p.lesson ? "урок предварительный, объяснение уточним" : "объяснение ещё не выбрано"))}</div></div>`;
    const sym = pathOf();
    app.innerHTML = `${planUpdateHTML(p)}${note}
      <div class="card">
        ${pathNum() ? `<div class="prow"><div class="k"><span>${esc(OB.levels.theme)}</span><a href="#symbol">открыть</a></div>${pathNum()} · ${esc(X.pathProfiles[String(pathNum())].displayName)}<div class="tiny">${esc(X.pathProfiles[String(pathNum())].shortIntro)}</div></div>` : ""}
        ${learningText(p) ? `<div class="prow"><div class="k"><span>${esc(OB.levels.lesson)}</span></div>${esc(uc1(learningText(p)))}${expOf(p) && expOf(p).goalConfirmed ? "" : ` <span class="tiny">· цель не подтверждена — уточни в шаге</span>`}</div>` : ""}
        ${mirrorCard(p)}
        ${p.scenario ? field("Знакомый сценарий", (p.scenario.own || p.scenario.recognition) + (p.scenario.meaningText ? ` — задевает: ${lc1(p.scenario.meaningText)}` : "") + (p.scenario.repeat === "repeat" ? " (повторяется)" : p.scenario.repeat === "once" ? " (пока один случай)" : ""), "scenario", "что повторяется") : field("Сюжет", p.title, "title", "как назвать")}
        ${p.teacher ? field("Учитель", `${p.teacher.label}${p.teacher.what ? ` — ${lc1(p.teacher.what)}` : ""}`, "teacher", "кто или что возвращает в сюжет") : field("Кто или что", (p.contexts || []).join(", "), "contexts", "коллега, партнёр, ситуация")}
        ${p.lesson ? field("Урок", uc1(p.lesson.title) + (p.lesson.status === "preliminary" ? " (предварительный)" : ""), "lesson", "направление урока") : ""}
        ${R.practiceStart(p) ? `<div class="prow"><div class="k"><span>Практика</span></div>${R.diffDays(R.practiceStart(p), today()) < 0 ? `начнётся ${esc(R.human(R.practiceStart(p)))}` : `с ${esc(R.human(R.practiceStart(p)))} · день ${R.daysSince(R.practiceStart(p), today()) + 1}`}${p.caseDate && p.caseDate !== R.practiceStart(p) ? ` <span class="muted small">· случай был ${esc(R.human(p.caseDate))}</span>` : ""}</div>` : ""}
        ${field("Последний случай", lastEvent(p), null, `запиши через «${OB.buttons.event.label}»`)}
        ${field("Обычно думаю", p.thought ? `«${p.thought}»${p.thoughtKind === "version" ? " — моя версия" : p.thoughtKind === "observation" ? " — наблюдение" : ""}` : "", "thought", p.storyResult ? OB.mirrorPath.empty.thought : "первая мысль в момент")}
        ${field("Обычно делаю", p.habitualResponse, "habitualResponse", "привычный ответ")}
        ${field("Мне было важно", p.need, "need", p.storyResult ? OB.mirrorPath.empty.need : "потребность")}
        ${p.storyResult ? "" : `<div class="prow"><div class="k"><span>Проверяю объяснение</span>${h ? `<button data-edit="hyp">отвергнуть</button>` : ""}</div>${h ? `${esc(h.text)} <span class="badge">${esc(branchLabel(h.branch))}</span><div class="tiny" style="margin-top:3px">${esc(rec.label)}${sup ? ` · примеров: ${sup}` : ""}${h.status === "revised" ? " · пересмотрено" : ""}</div>` : `<span class="muted">появится на шаге «Чего мне не хватило»</span>`}</div>`}
        ${field("Разрешаю себе", p.permission ? p.permission + (permissionConfirmed(p) ? "" : " (кандидат из каталога, не подтверждено)") : "", "permission", p.storyResult ? OB.mirrorPath.empty.permission : "внутреннее разрешение")}
        <div class="prow"><div class="k"><span>${esc(OB.plan.title)}${x && x.kind === "plan" ? ` · v${x.version}${x.planStatus === "draft" ? " · черновик" : x.planStatus === "legacy" ? " · прежняя версия" : ""}` : ""}</span><button data-edit="plan">изменить</button></div>${planView(p) ? (planReady(p).ready ? stepHTML(p) : `<span class="muted">${esc(OB.home.notReadyText)}</span>`) : `<span class="muted">появится после выбора урока</span>`}</div>
        ${x && x.prediction ? field("Предсказание", x.prediction) : ""}
        ${x && (x.results || []).length ? `<div class="prow"><div class="k">Результаты</div>${x.results.slice(-5).map(r => `${esc(R.human(r.dateKey || today()))}: ${esc(outcomeLabel(r.outcome))}${r.fact ? ` — «${esc(R.trimEnd(r.fact))}»` : ""}${r.mirrorVersion ? ` <span class="tiny">· зеркало v${r.mirrorVersion}</span>` : ""}`).join("<br>")}</div>` : ""}
        ${field("Навык", skillLabel(skillOfPattern(p)), "skill", "выберем на шаге «Проверить действием»")}
        ${field("Тело даёт знать", bodySignal(p), "bodySignal", "необязательно: плечи, челюсть, живот…")}
      </div>
      ${p.storyResult && p.startDate ? `<div class="card tight" id="weekCard"><div class="k">${ic("hourglass")}Итог недели</div><p class="small" style="margin:2px 0 6px">${(() => { const cw = R.currentWindow(R.practiceStart(p), today()); return cw ? esc(OB.weekV7.period.replace("{start}", R.human(cw.start)).replace("{end}", R.human(cw.end))) : "Неделя начнётся с первого дня практики."; })()}</p><div class="row tight"><a class="btn secondary sm" href="#review">Открыть итог</a></div></div>` : ""}
      ${p.storyResult ? "" : `<div class="card tight"><div class="k">${ic("mirror")}Исследование · ${rs.doneCount} из ${rs.total}</div>
        <div class="dots" aria-label="Пройдено модулей: ${rs.doneCount} из ${rs.total}">${R.MODULE_ORDER.map(id => `<i class="${(researchOf(p).modules[id] || {}).status === "done" ? "on" : ""}" title="${esc((M.find(m => m.id === id) || {}).title || id)}"></i>`).join("")}</div>
        ${rs.next ? `<p class="small" style="margin:4px 0 8px">Следующий шаг: <b>${esc((M.find(m => m.id === rs.next) || {}).title)}</b> — ${esc((M.find(m => m.id === rs.next) || {}).lead)}</p><div class="row tight"><a class="btn block ${rs.lockedToday ? "secondary" : ""}" href="#module/${rs.next}">${rs.lockedToday ? "Уточнить (сегодня уже был шаг)" : "Уточнить · 1–2 минуты"}</a></div>` : `<p class="small" style="margin:4px 0 0">Все шаги первой недели пройдены. Дальше — практика и итоги недель.</p>`}
        <details class="plain"><summary>Пройти шаг заново</summary><div class="chips">${R.MODULE_ORDER.filter(id => id !== "episode").map(id => `<a class="chip" href="#module/${id}">${esc((M.find(m => m.id === id) || {}).title)}</a>`).join("")}</div></details>
      </div>`}
      ${p.startDate ? `<div class="card tight"><div class="k">${ic("flag")}Навык и флаг</div><p class="small" style="margin:2px 0 6px">${elig.eligible ? "Условия проверки выполнены." : esc(elig.reasons[0] || "")}${elig.reasons.length > 1 ? ` <span class="tiny">и ещё ${elig.reasons.length - 1}</span>` : ""}</p>${flags.length ? `<p class="small" style="margin:0">Освоено: ${flags.map(f => esc(skillLabel(f.skillId))).join(", ")}</p>` : ""}<div class="row tight"><a class="btn secondary sm" href="#flag">${elig.eligible && !hasFlag(p) ? "Проверить навык" : "Как считается флаг"}</a></div></div>` : ""}
      ${(() => { const t = R.nextTool({ pattern: p, plan: x, hypothesis: h, research: researchOf(p), episodes: D.episodes, runsToday: toolRunsOn(today()).length + (rs.doneToday ? 1 : 0) }); return t && p.status === "active" ? toolOfferHTML(t) : ""; })()}
      ${(() => { const runs = (D.tools || []).filter(t => t.patternId === p.id && t.endedAt && !t.exited); return runs.length ? `<details class="plain"><summary>Разборы и инструменты · ${runs.length}</summary><ul class="list">${runs.slice(-8).reverse().map(t => `<li class="small"><div class="date">${esc(R.human(t.dateKey))} · ${esc(toolTitle(t.toolId))}${t.fit ? ` · ${esc((X.toolFit.find(f => f[0] === t.fit) || [])[1] || t.fit)}` : ""}</div>${esc(t.result || "без вывода")}${t.planChange && t.planChange.field ? ` <span class="badge">в плане</span>` : ""}</li>`).join("")}</ul></details>` : ""; })()}
      <div class="card tight"><div class="k">${ic("star")}${esc(OB.signs.title)}</div><p class="tiny" style="margin:2px 0 6px">${esc(OB.signs.lead)}</p>${(p.signs || []).length ? `<ul class="list">${p.signs.slice(-6).reverse().map(sg => `<li class="small"><div class="date">${esc(R.human(R.dateKey(sg.at)))}</div>${esc(sg.text)}</li>`).join("")}</ul>` : ""}<div class="row tight"><input type="text" id="signTxt" placeholder="${esc(OB.signs.ph)}"><button class="btn secondary sm" id="signAdd">${esc(OB.signs.add)}</button></div></div>
      ${queueCard()}
      ${savedHtml}
      <div class="card tight"><div class="k">${ic("star")}Мой путь</div>${pathNum() ? `<p class="small" style="margin:2px 0 4px"><b>${pathNum()} · ${esc(X.pathProfiles[String(pathNum())].displayName)}</b></p><p class="small muted" style="margin:0 0 4px">${esc(X.pathProfiles[String(pathNum())].theme)}</p><p class="small" style="margin:0 0 4px">${esc(X.pathProfiles[String(pathNum())].revealParagraphs[0])}</p>${pathLinkText(p) ? `<p class="small" style="margin:0 0 4px"><i>${esc(pathLinkText(p))}</i></p>` : ""}${foundationHTML()}` : `<p class="small" style="margin:2px 0 4px">По желанию: число пути по дате рождения.</p>`}<div class="row tight"><a class="btn ghost sm" href="#symbol">${pathNum() ? "Подробнее о пути" : "Добавить"}</a><button class="btn ghost sm" id="compToggle">${esc(P.companionOff ? OB.companion.show : OB.companion.hide)}</button></div></div>
      ${(() => { const arch = D.patterns.filter(q => !q.legacy && q.id !== p.id && (q.status === "archived" || q.status === "done")); return `<details class="plain" id="archiveList"><summary>${esc(OB.archive.title)} · ${arch.length}</summary>${arch.length ? `<ul class="list">${arch.map(q => `<li class="small"><b>${esc(uc1(q.lesson ? q.lesson.title : q.title))}</b> · ${esc(R.isCompleted(q) ? OB.archive.done : OB.archive.archived)}${q.archivedAt ? ` · ${esc(R.human(R.dateKey(q.archivedAt)))}` : ""}</li>`).join("")}</ul>` : `<p class="tiny">${esc(OB.archive.none)}</p>`}</details>`; })()}
      ${(() => { const done = D.patterns.filter(q => R.isCompleted(q) && q.lesson && !q.legacy); return `<details class="plain"><summary>${esc(OB.completed.title)} · ${done.length}</summary>${done.length ? `<ul class="list">${done.map(q => { const fl = flagsReal().filter(f => f.patternId === q.id); const n = D.episodes.filter(e => e.patternId === q.id && R.isConfirmedAction(e)).length; return `<li class="small"><b>${esc(uc1(q.lesson.title))}</b>${fl.length ? ` · ${esc(OB.archive.basis)}: флаг «${fl.map(f => esc(skillLabel(f.skillId))).join(", ")}»` : ""}${q.completedBasis && q.completedBasis.at ? ` · ${esc(R.human(R.dateKey(q.completedBasis.at)))}` : ""} · применений: ${n}</li>`; }).join("")}</ul>` : `<p class="tiny">${esc(OB.completed.none)}</p>`}</details>`; })()}
      <details class="plain"><summary>Версии гипотез и экспериментов</summary><ul class="list">${D.hypotheses.filter(v => v.patternId === p.id).map(v => `<li><div class="date">гипотеза v${v.version || 1} · ${esc(statusLabel(v.status))} · ${esc(R.human(R.dateKey(v.createdAt)))}</div>${esc(v.text)}</li>`).join("")}${D.experiments.filter(v => v.patternId === p.id).map(v => `<li><div class="date">шаг v${v.version} · ${v.status === "active" ? "действует" : "заменён"} · ${esc(R.human(R.dateKey(v.createdAt)))}</div>${esc(v.action)}${v.prediction ? ` — ожидание: ${esc(v.prediction)}` : ""}</li>`).join("") || "<li class='muted'>пока пусто</li>"}</ul></details>
      <div class="row tight">${p.status === "paused" ? `<button class="btn secondary" id="resume">Вернуться к сюжету</button>` : `<button class="btn ghost" id="pauseP">Пауза по сюжету</button>`}<button class="btn ghost" id="newP">Другой сюжет</button></div>`;
    bindMirrorCard(p);
    $$("[data-edit]").forEach(b => b.onclick = () => b.dataset.edit === "plan" ? go(x && x.kind === "plan" && x.planStatus !== "draft" ? "plan/edit" : "plan") : editField(p, b.dataset.edit, b.dataset.ph));
    const ct = $("#compToggle"); if (ct) ct.onclick = async () => { P.companionOff = !P.companionOff; await saveProfile(true); story(); };
    bindPlanUpdate(p, story);
    const sa = $("#signAdd"); if (sa) sa.onclick = async () => { const v = $("#signTxt").value.trim(); if (!v) return toast("Напиши наблюдение"); p.signs = [...(p.signs || []), { at: nowTs(), text: v }]; await savePattern(p); story(); };
    const kl = $("#keepLesson"); if (kl) kl.onclick = async () => { p.lesson.keptForExperimentId = x.id; p.lesson.status = "confirmed"; await savePattern(p); toast("Формулировка сохранена"); story(); };
    const rl = $("#refineLesson"); if (rl) rl.onclick = () => editField(p, "lesson");
    $$("[data-unsave]").forEach(b => b.onclick = async () => { P.savedScenarios.splice(Number(b.dataset.unsave), 1); await saveProfile(); story(); });
    $$("[data-saved]").forEach(b => b.onclick = async () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Текущий сюжет уйдёт в историю. Нажми ещё раз"; return; } const sc = P.savedScenarios[Number(b.dataset.saved)]; P.savedScenarios.splice(Number(b.dataset.saved), 1); archivePattern(p, "saved_scenario"); await savePattern(p); if (sc.kind === "onb" && sc.onb && sc.lesson) { P.onb = sc.onb; await saveProfile(true); return startLessonNow(P.onb, sc.lesson); } const sv = sc.kind === "event" ? (variantById(sc.id) || (sc.area ? variantById(`${sc.id}@${sc.area}`) : null)) : null; P.onb = sv ? { step: "teacher", event: sv.variantId, picks: [{ id: sv.variantId, variantId: sv.variantId, area: sv.area, packId: sv.packId, text: sv.text, r: "yes" }], shown: [sv.variantId], area: sv.area, ctx: sv.area === "work" ? "any" : null, areaExplicit: true, routingVersion: X.routingVersion } : { step: "teacher", own: { text: sc.recognition || sc.text, packId: sc.packId || null, version: C.contentVersion, area: sc.area || null }, picks: [], routingVersion: X.routingVersion }; ["onb-teacher", "onb-case-" + (sv ? sv.variantId : "own"), "onb-sting-" + (sv ? sv.variantId : "own"), "onb-want-" + (sv ? sv.variantId : "own")].forEach(id => dropDraft(id, "onb")); await saveProfile(true); go("teacher"); });
    const kd = $("#keepDep"); if (kd) kd.onclick = async () => { const cur = p.hypothesisVersionId || null; if (dep.permission) { p.permissionSource = Object.assign({}, p.permissionSource, { keptFor: cur }); await savePattern(p); } if (dep.plan) { x.keptFor = cur; await saveExp(x); } toast("Оставлено осознанно"); story(); };
    const rd = $("#redoDep"); if (rd) rd.onclick = async () => { if (dep.permission) { p.permissionSource = null; await savePattern(p); } deepToday = true; go(dep.permission ? "module/rule" : "module/experiment"); };
    const rp = $("#resume"); if (rp) rp.onclick = async () => { p.status = "active"; await savePattern(p); story(); };
    const pp = $("#pauseP"); if (pp) pp.onclick = async () => { if (!pp.dataset.sure) { pp.dataset.sure = 1; pp.textContent = "Точно поставить на паузу? Нажми ещё раз"; return; } p.status = "paused"; await savePattern(p); go("today"); };
    $("#newP").onclick = async () => { const b = $("#newP"); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Текущий уйдёт в историю. Нажми ещё раз"; return; } archivePattern(p, "new_story"); await savePattern(p); P.onb = { step: "area" }; await saveProfile(true); go("area"); };
  }
  const branchLabel = b => ({ rule: "внутреннее правило", boundary: "граница", expectation: "интерпретация", resource: "ресурс", own_behavior: "своё поведение", unknown: "пока неясно" })[b] || b;
  const statusLabel = s => ({ candidate: "версия", selected: "проверяется", supported_by_user: "подтверждена мной", rejected: "отвергнута", revised: "пересмотрена" })[s] || s;
  const outcomeLabel = o => ({ confirmed: "ожидание подтвердилось", partial: "отчасти", not: "не подтвердилось", insufficient: "данных мало" })[o] || o;
  function queueCard() {
    const q = D.episodes.filter(e => e.linkStatus === "queued" && !e.legacy), u = D.episodes.filter(e => e.linkStatus === "unconfirmed" && !e.legacy), pend = D.episodes.filter(e => e.verificationStatus === "pending" && !e.legacy);
    const pendHtml = pend.length ? `<div class="card tight"><div class="k">${ic("flame")}Ждут разбора · ${pend.length}</div><ul class="list">${pend.slice(-5).map(e => `<li class="small">${esc(R.human(e.dateKey))} · ${esc(e.emotion || "случай")} ${e.intensity}/10 — <a href="#detail/${e.id}">разобрать</a></li>`).join("")}</ul></div>` : "";
    if (!q.length && !u.length) return pendHtml;
    return pendHtml + `<div class="card tight"><div class="k">${ic("hourglass")}Очередь · ${q.length}${u.length ? ` · ждут уточнения: ${u.length}` : ""}</div><ul class="list">${[...u, ...q].slice(-6).map(e => `<li><div class="date">${esc(R.human(e.dateKey))} · ${e.linkStatus === "unconfirmed" ? "не уточнено" : "в очереди"}</div><a href="#episode/${e.id}">${esc(e.event || e.emotion || "случай")}</a>${e.linkStatus === "unconfirmed" ? ` <button class="btn ghost sm" data-lk="${e.id}" data-v="yes">тот же</button><button class="btn ghost sm" data-lk="${e.id}" data-v="no">другой</button>` : ""}</li>`).join("")}</ul><p class="tiny" style="margin:4px 0 0">Если по другой ситуации нужно срочно обозначить границу или попросить помощь — это не ждёт очереди.</p></div>`;
  }
  document.addEventListener("click", async e => { const b = e.target.closest("[data-lk]"); if (!b) return; const ep = D.episodes.find(x => x.id === b.dataset.lk); const p = activePattern(); if (!ep) return; if (b.dataset.v === "yes") { ep.linkStatus = "confirmed"; ep.patternId = p ? p.id : null; } else { ep.linkStatus = "queued"; ep.patternId = null; } await saveEpisode(ep); story(); });
  function editField(p, k, ph) {
    if (k === "hyp") { const h = hypOf(p); if (!h) return; app.innerHTML = `<h1 class="q">Отвергнуть это объяснение?</h1><p class="muted">«${esc(h.text)}»</p><p class="small">Отказ от неверной версии — тоже результат. Путь продолжается: выберешь другое объяснение или просто понаблюдаешь.</p><div class="row"><button class="btn block" id="rej">Да, не подходит</button></div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`; $("#rej").onclick = async () => { h.status = "rejected"; await saveHyp(h); p.hypothesisVersionId = null; await savePattern(p); const r = researchOf(p); if (r.modules.need) { delete r.modules.need; await saveResearch(r); } toast("Объяснение отвергнуто"); go("module/need"); }; $("#bk").onclick = story; return; }
    /* Смена навыка — новая версия плана. Прежние записи остаются с прежним навыком: история задним числом не переименовывается. */
    if (k === "skill") { app.innerHTML = `<h1 class="q">Какой навык тренируем?</h1><p class="small muted">Прошлые применения останутся за прежним навыком. Для флага по новому навыку нужны свои подтверждения.</p><div class="chips col">${SKILLS.map(s => `<button class="chip ${skillOfPattern(p) === s.id ? "on" : ""}" data-v="${s.id}">${s.label}</button>`).join("")}</div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`; $$(".chip").forEach(b => b.onclick = async () => { const v = b.dataset.v; if (v === skillOfPattern(p)) return story(); if (expOf(p)) await newExperimentVersion(p, { skillId: v, reason: "skill-changed" }); else { p.skillId = v; await savePattern(p); } story(); }); $("#bk").onclick = story; return; }
    if (k === "lesson") {
      const x = expOf(p), drift = R.lessonDrift({ pattern: p, experiment: x }), curSkill = skillOfPattern(p);
      const all = C.packs.flatMap(pk => pk.lessons.map(l => Object.assign({ packId: pk.id, packTitle: pk.title }, l)));
      /* v6.5: для сюжета из карточки — только проверенные направления этого варианта события (со своими сценами). */
      const vv = p.scenario && p.scenario.variantId ? variantById(p.scenario.variantId) : null;
      const vlist = vv ? [...new Set(vv.meanings.map(m => m.lessonId).filter(Boolean))].map(id => Object.assign({ packTitle: "" }, lessonView(id, vv.variantId))) : null;
      if (vlist) vlist.forEach(l => { const i = all.findIndex(a => a.id === l.id); if (i >= 0) all[i] = Object.assign({}, all[i], l); });
      /* При расхождении показываем уроки под текущий навык: подпись подгоняется под практику, а не практика под подпись. */
      const list = drift.drift ? all.filter(l => l.skillId === curSkill) : vlist || all.filter(l => l.packId === (p.packId || l.packId));
      const curId = p.lesson ? p.lesson.id : null;
      app.innerHTML = `<h1 class="q">${esc(drift.drift ? "Как назвать урок?" : OB.lesson.alt)}</h1><p class="small muted">${drift.drift ? `Сейчас тренируем: ${esc(skillLabel(curSkill))}. Название урока подстроим под практику; план и записи не меняются.` : "Смена урока создаёт новую версию шага и навыка. Записи и история остаются."}</p>
        <div class="chips col">${list.map(l => `<button class="chip ${l.id === curId ? "on" : ""}" data-l="${l.id}">${esc(uc1(l.title))}${drift.drift && l.packId !== p.packId ? ` <span class="tiny">· ${esc(l.packTitle)}</span>` : ""}</button>`).join("")}${drift.drift ? "" : `<button class="chip dim ${curId === X.lessonObserve.id ? "on" : ""}" data-l="__observe">${esc(X.lessonObserve.headline)}</button>`}</div>
        <label for="a">Своими словами</label><textarea id="a" placeholder="например: учитывать свою нагрузку, прежде чем соглашаться">${esc(p.lesson && p.lesson.origin === "user" ? p.lesson.title : "")}</textarea><div class="row tight"><button class="btn secondary sm" id="own">Сохранить свою формулировку</button></div>
        <div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
      const prevRejected = () => [...((p.lesson && p.lesson.rejected) || []), ...(p.lesson ? [p.lesson.id] : [])];
      $$("[data-l]").forEach(b => b.onclick = async () => {
        const id = b.dataset.l; const L = id === "__observe" ? X.lessonObserve : id === "__unknown" ? X.lessonUnknown : all.find(l => l.id === id); if (!L || L.id === curId) return story();
        if (drift.drift) { p.lesson = { id: L.id, title: L.title, inner: L.inner, action: p.lesson.action, skillId: curSkill, hypothesisId: L.hypothesisId || null, signal: L.signal, status: "confirmed", chosenAt: nowTs(), rejected: prevRejected(), keptForExperimentId: x ? x.id : null, origin: "pack" }; await savePattern(p); toast("Урок уточнён"); return story(); }
        p.lesson = { id: L.id, title: L.title, inner: L.inner, action: L.action, skillId: L.skillId, hypothesisId: L.hypothesisId || null, signal: L.signal, status: "preliminary", chosenAt: nowTs(), rejected: prevRejected(), origin: "pack" };
        /* Новый урок — новый черновик личного плана из шаблона каталога; прежняя версия и записи остаются. */
        const tpl = templateFor(L, null), patch = Object.assign(R.planFromTemplate({ template: tpl.template, kind: tpl.kind, patternId: p.id, lessonId: L.id, skillId: L.skillId, basisIds: [], painText: p.scenario ? p.scenario.meaningText || "" : "", mode: tpl.mode, once: tpl.once }), { planStatus: "draft", reason: "lesson-changed", lessonId: L.id, permission: L.inner || "" });
        delete patch.id; delete patch.version; delete patch.status; delete patch.results; delete patch.createdAt; patch.kind = "plan"; patch.actionUser = ""; patch.cueUser = "";
        await newExperimentVersion(p, patch); setPermissionFromPack(p, L.inner, p.hypothesisVersionId); await savePattern(p); toast("Урок изменён — настрой шаг"); go("plan");
      });
      $("#own").onclick = async () => { const v = $("#a").value.trim(); if (!v) return toast("Напиши формулировку"); p.lesson = Object.assign({}, p.lesson || {}, { id: "lesson-own", title: lc1(v), skillId: curSkill, status: "confirmed", chosenAt: nowTs(), keptForExperimentId: x ? x.id : null, origin: "user", rejected: prevRejected() }); await savePattern(p); toast("Урок записан твоими словами"); story(); };
      $("#bk").onclick = story; return;
    }
    if (k === "teacher") {
      const T = p.teacher || {};
      app.innerHTML = `<h1 class="q">${esc(OB.teacher.title)}</h1><div class="chips" id="tg">${X.teachers.map(([v, l]) => `<button class="chip ${T.kind === v ? "on" : ""}" data-v="${v}">${esc(l)}</button>`).join("")}</div><label for="a">Своими словами</label><textarea id="a" placeholder="кто или что, имя не нужно">${esc(T.label || "")}</textarea><label for="w">Что происходит снова и снова</label><textarea id="w" placeholder="коротко">${esc(T.what || "")}</textarea><div class="row"><button class="btn block" id="ok">Сохранить</button></div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
      let kind = T.kind || "other"; $$("#tg .chip").forEach(b => b.onclick = () => { kind = b.dataset.v; $$("#tg .chip").forEach(x => x.classList.toggle("on", x === b)); $("#a").value = X.teacherLabels[kind] || ""; });
      $("#ok").onclick = async () => { const label = $("#a").value.trim() || X.teacherLabels[kind] || ""; p.teacher = { kind, label, what: $("#w").value.trim() }; p.contexts = label ? [label] : []; await savePattern(p); story(); };
      $("#bk").onclick = story; return;
    }
    const cur = k === "scenario" ? ((p.scenario && (p.scenario.own || p.scenario.recognition)) || "") : k === "contexts" ? (p.contexts || []).join(", ") : (p[k] || "");
    app.innerHTML = `<h1 class="q">${esc({ title: "Как назвать сюжет?", contexts: "Кто или что", thought: "Что я обычно думаю в этот момент?", habitualResponse: "Что я обычно делаю?", need: "Что мне было важно?", permission: "Что я себе разрешаю?", bodySignal: "Как тело даёт знать?", scenario: "Что повторяется, твоими словами?" }[k] || "Изменить")}</h1>
      ${k === "thought" ? `<div class="chips" id="tg">${X.firstThoughts.map(t => `<button class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}${k === "bodySignal" ? `<div class="chips" id="tg">${C.bodyObservation.locations.slice(0, 7).map(t => `<button class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div><p class="tiny">${esc(C.bodyObservation.message)}</p>` : ""}
      <textarea id="a" placeholder="${esc(ph || "")}">${esc(cur)}</textarea><div class="row"><button class="btn block" id="ok">Сохранить</button></div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
    $$("#tg .chip").forEach(b => b.onclick = () => { $("#a").value = b.dataset.v; });
    $("#ok").onclick = async () => { const v = $("#a").value.trim(); if (k === "contexts") p.contexts = v ? v.split(/\s*,\s*/) : []; else if (k === "scenario") { p.scenario = Object.assign({}, p.scenario, { own: v, confirmed: "refine" }); } else if (k === "permission") { setPermissionByUser(p, v); const x = expOf(p); if (x) { x.permission = v; await saveExp(x); } } else p[k] = v; await savePattern(p); story(); };
    $("#bk").onclick = story;
  }

  /* =================== ИТОГ НЕДЕЛИ (v6) ===================
     Факты: поводы и даты, попытки шага по статусам, ожидание и факт, трудность с пропусками. «Раньше» — только при явной исходной записи.
     Один выбор: оставить план / изменить момент / упростить то же действие / проверить другое объяснение / наблюдать / пауза — прямой переход в редактор. */
  function review(arg) {
    const p = activePattern(); if (!p || !p.startDate) return go("today");
    const due = reviewDueOf(p, today());
    const mx = !!(p.storyResult || (p.mirror && p.mirror.text));
    if (mx && (arg === "interim" || !due)) { const cw = R.currentWindow(R.practiceStart(p), today()); if (arg === "interim" && cw) return reviewV7(p, cw, true); if (!due) { const last = D.reviews.filter(r => r.patternId === p.id).slice(-1)[0], nextEnd = cw ? R.addDays(cw.end, 1) : null; app.innerHTML = `<h1>Итог недели</h1><p class="muted">${last ? `Последний итог: ${esc(R.human(last.windowStart))} — ${esc(R.human(last.windowEnd))}.` : ""} ${cw ? esc(OB.weekV7.interimNote.replace("{date}", R.human(cw.end))) : ""}</p>${cw ? `<div class="row"><a class="btn block" id="interimBtn" href="#review/interim">${esc(OB.weekV7.interimBtn)}</a></div>` : ""}<div class="row tight"><a class="btn ghost" href="#today">На главную</a></div>`; return; } }
    if (mx) return reviewV7(p, due, false);
    if (!due) { const last = D.reviews.filter(r => r.patternId === p.id).slice(-1)[0]; app.innerHTML = `<h1>Итог недели</h1><p class="muted">${last ? `Последний итог: ${esc(R.human(last.windowStart))} — ${esc(R.human(last.windowEnd))}, решение: ${esc((X.reviewDecisions.find(d => d.id === last.decision) || {}).label || last.decision)}.` : "Первый итог откроется на 7-й день недели."}</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const x = expOf(p), h = hypOf(p), W = OB.week, s = R.windowSummary({ checkins: D.checkins, episodes: D.episodes, window: due, patternId: p.id, skillId: skillOfPattern(p), experiment: x, lineageId: lineageOf(p) });
    const little = s.eveningCount < 3 || (s.opportunities + s.realEpisodes) === 0;
    const prevR = D.reviews.filter(r => r.patternId === p.id && !r.legacy).slice(-1)[0], prevBad = !!(prevR && prevR.decision !== "continue" && prevR.decision !== "observe");
    const resStr = s.results.length ? s.results.map(r => outcomeLabel(r.outcome)).join(", ") : "результатов не записано";
    const nar = R.weekNarrative({ pattern: p, summary: s, episodes: D.episodes }), a = s.attempts || {};
    const gaps = s.totalDays - s.eveningCount;
    const sup = h ? (h.supportingEpisodeIds || []).length : 0, con = h ? (h.contradictingEpisodeIds || []).length : 0;
    const exs = D.episodes.filter(e => e.patternId === p.id && !e.legacy && e.dateKey && R.inWindow(e.dateKey, due) && e.newResponse && e.newResponse.status && e.newResponse.status !== "rehearsal" && (e.newResponse.afterAnswer || e.newResponse.action || e.newResponse.otherAction)).slice(-3);
    const learnHtml = `${pathLineHTML()}${learningText(p) ? `<p class="small" style="margin:0 0 4px"><b>${esc(W.learning.replace("{lesson}", learningText(p)).replace(/\.$/, ""))}.</b></p>` : ""}${exs.length ? `<p class="small" style="margin:0 0 2px">${esc(W.examples)}</p><ul class="list">${exs.map(e => `<li class="small"><div class="date">${esc(R.humanShort(e.dateKey))} · ${esc(R.attemptStatusLabel(e.newResponse.status))}</div>${esc(e.newResponse.status === "other" ? e.newResponse.otherAction : e.newResponse.action)}${e.newResponse.afterAnswer ? ` — ${esc(e.newResponse.afterAnswer)}` : ""}</li>`).join("")}</ul>` : ""}${((s.attempts || {}).done || 0) + ((s.attempts || {}).partial || 0) < 2 ? `<p class="tiny" style="margin:0 0 6px">${esc(W.few)}</p>` : ""}`;
    const factsHtml = learnHtml + `<div class="stats"><div><b>${s.opportunities}</b><span>${esc(W.opps)}</span></div><div><b>${a.done || 0}${a.partial ? `<span style="font-size:14px">+${a.partial}</span>` : ""}</b><span>${esc(W.attempts)}${a.partial ? ` (${a.partial} ${esc(W.partial)})` : ""}</span></div><div><b>${s.impactRatings.length}<span style="font-size:14px">/${s.totalDays}</span></b><span>${esc(W.ratings)}</span></div></div>
      <p class="small">Вечерних записей: ${s.eveningCount} из ${s.totalDays}. ${s.episodeDates.length ? `Поводы: ${s.episodeDates.map(d => R.humanShort(d)).join(", ")}. ` : ""}${a.other ? `${a.other} — ${esc(W.other)}. ` : ""}${a.rehearsal ? `${a.rehearsal} ${R.plural(a.rehearsal, "репетиция", "репетиции", "репетиций")} (поводом не считается). ` : ""}Трудность по вечерам: ${s.impactRatings.length ? s.impactRatings.map(r => r.value).join(", ") : "оценок нет"}; ${gaps} ${esc(W.gaps)}.${s.notSure ? ` Не уверен: ${s.notSure}.` : ""}</p>
      ${nar.before ? `<p class="small" style="margin:0 0 4px">${esc(W.before.replace("{reaction}", lc1(nar.before)))}</p>` : ""}${nar.now.length ? `<p class="small" style="margin:0 0 4px"><b>${esc(W.now.replace("{facts}", nar.now.join(", ")))}</b></p>` : `<p class="small muted" style="margin:0 0 4px">${esc(W.noData)}</p>`}
      ${x && x.prediction ? `<div class="card tight"><div class="k">Ожидание и факт</div><p class="small" style="margin:2px 0 0">Ожидал: «${esc(x.prediction)}». На деле: ${esc(resStr)}.</p></div>` : ""}
      ${h && (sup || con) ? `<p class="tiny" style="margin:4px 0 0">Объяснение «${esc(h.text)}»: подходило в ${sup} ${R.plural(sup, "случае", "случаях", "случаях")}, не подходило в ${con}.</p>` : ""}
      ${little ? `<div class="nudge">Сейчас мало случаев для выводов. Это не провал — просто данных пока немного.</div>` : ""}
      ${readingCard("karma-change")}`;
    const steps = [
      { k: "look", q: W.title.replace("{n}", due.idx + 1), type: "info", nextLabel: "Дальше", html: factsHtml },
      { k: "learn", q: W.ask, type: "text", ph: "коротко; «пока не знаю» — тоже ответ", optional: true, skip: () => !nar.now.length },
      { k: "tired", q: "Пользы пока не видно", type: "info", nextLabel: "Понимаю", html: `<p>Второй итог подряд без улучшения. Одинаковые недели повторять не обязательно: можно изменить один элемент, взять паузу или поискать другую поддержку — у близких или у специалиста.</p>`, skip: () => !(prevBad && s.change.worse >= s.change.better && s.actionDays.length === 0) },
      { k: "verdict", q: "Объяснение подходит?", lead: h ? `«${h.text}»` : "Объяснение ещё не выбрано.", type: "choice", opts: X.hypothesisVerdict, skip: () => !h },
      { k: "decision", q: W.decision, type: "choice", opts: X.reviewDecisions.filter(d => d.id !== "simplify" || (x && x.smallerVersion && !x.simplified) || !x || x.kind !== "plan").map(d => [d.id, `${d.label} — ${d.desc}`]) },
      { k: "why", q: "Что мешало?", lead: "Отсутствие повода, неясный шаг и пропуски — разные причины. Причину не додумываем.", type: "choice", opts: X.notHelpedReasons.filter(r => r !== "Не знаю"), own: true, unknown: true, skip: a => a.decision === "continue" },
      { k: "note", q: "Что помогло, а что не подтвердилось?", type: "text", ph: "коротко, своими словами", optional: true },
    ];
    flow({ id: "review-" + due.start, scope: p.id, steps, title: `Итог · ${R.human(due.start)} — ${R.human(due.end)}`, onCancel: () => go("today"),
      onDone: async ans => {
        if (h && ans.verdict) { const map = { supported: "supported_by_user", partial: "selected", rejected: "rejected", unknown: "selected" }; if (R.canTransition(h.status, map[ans.verdict]) || h.status === map[ans.verdict]) h.status = map[ans.verdict]; await saveHyp(h); }
        const r = { id: R.uuid(), patternId: p.id, windowStart: due.start, windowEnd: due.end, snapshot: s, narrative: nar, learned: ans.learn || "", hypothesisVersionId: h ? h.id : null, experimentId: x ? x.id : null, planVersion: x ? x.version : null, verdict: ans.verdict || null, decision: ans.decision, why: val(ans, "why") || null, conclusion: ans.note || "", createdAt: nowTs() };
        await saveReview(r);
        if (ans.decision === "pause") { p.status = "paused"; await savePattern(p); return go("today"); }
        if (ans.decision === "observe") { p.status = "observe"; await savePattern(p); return go("today"); }
        if (ans.decision === "rehypo") { if (h) { h.status = "rejected"; await saveHyp(h); } p.hypothesisVersionId = null; const rr = researchOf(p); delete rr.modules.need; delete rr.modules.rule; delete rr.modules.experiment; await saveResearch(rr); await savePattern(p); deepToday = true; return go("module/need"); }
        if (ans.decision === "simplify") return go("plan/simplify");
        if (ans.decision === "moment") return go("plan/moment");
        go("today");
      } });
  }

  /* v7: неделя завершена, когда прошёл её последний день или закрыт его вечер; до этого — только промежуточный обзор */
  function reviewDueOf(p, k) {
    const due = R.reviewDue(R.practiceStart(p), k, D.reviews.filter(r => r.patternId === p.id));
    if (!due || !(p.storyResult || (p.mirror && p.mirror.text))) return due;
    if (due.end === k) { const c = D.checkins[R.checkinId(k, p.id)]; if (!(c && c.evening)) return null; }
    return due;
  }
  /* v7: недельный итог по текущему сюжету и версии зеркала — 7 календарных дней от начала практики */
  function reviewV7(p, due, interim) {
    const x = expOf(p), W = OB.week, W7 = OB.weekV7, E7 = OB.exp;
    const s = R.windowSummary({ checkins: D.checkins, episodes: D.episodes, window: due, patternId: p.id, skillId: skillOfPattern(p), experiment: x, lineageId: lineageOf(p) });
    const mw = R.mirrorWeek({ checkins: D.checkins, pattern: p, window: due }), M = p.mirror || {}, hasM = !!(M.text && M.status !== "rejected"), a = s.attempts || {};
    const real = (a.done || 0) + (a.partial || 0) + (a.other || 0), endShown = R.diffDays(due.end, today()) < 0 ? today() : due.end;
    const prevR = D.reviews.filter(r => r.patternId === p.id && r.ruleScore != null).slice(-1)[0];
    const exs = D.episodes.filter(e => e.patternId === p.id && !e.legacy && e.dateKey && R.inWindow(e.dateKey, due) && e.newResponse && e.newResponse.status && e.newResponse.status !== "rehearsal").slice(-3);
    const gaps = s.totalDays - s.eveningCount;
    const resLbl = { confirmed: E7.asExpected, not: E7.differently, insufficient: E7.unclear };
    const facts = `<p class="small" id="wkPeriod" style="margin:0 0 6px"><b>${esc(W7.period.replace("{start}", R.human(due.start)).replace("{end}", R.human(endShown)))}</b></p>${pathLineHTML()}${learningText(p) ? `<p class="small" style="margin:0 0 4px"><b>${esc(W.learning.replace("{lesson}", learningText(p)).replace(/\.$/, ""))}.</b></p>` : ""}
      <div class="stats" id="wkStats"><div><b>${s.opportunities}</b><span>${esc(W.opps)}</span></div><div><b>${real}</b><span>${esc(W7.attemptsReal)}</span></div><div><b>${a.rehearsal || 0}</b><span>${esc(W7.rehearsalsSep)}</span></div></div>
      ${exs.length ? `<ul class="list">${exs.map(e => `<li class="small"><div class="date">${esc(R.humanShort(e.dateKey))} · ${esc(R.attemptStatusLabel(e.newResponse.status))}</div>${esc(e.newResponse.status === "other" ? e.newResponse.otherAction : e.newResponse.action)}${e.newResponse.afterAnswer ? ` — ${esc(e.newResponse.afterAnswer)}` : ""}</li>`).join("")}</ul>` : ""}
      <p class="small">Трудность по вечерам: ${s.impactRatings.length ? s.impactRatings.map(r => `${R.humanShort(r.dateKey)} — ${r.value}`).join(", ") : "оценок нет"}; ${gaps} ${esc(W.gaps)} (пропуски — не нули).</p>
      <div class="card tight" id="wkMirror"><div class="k">${ic("mirror")}${esc(W7.mirrorH)}</div>${hasM ? `<p class="small" style="margin:2px 0 4px">${esc(W7.mirrorLine.replace("{text}", R.trimEnd(M.text)).replace("{v}", M.version || 1))}</p><p class="small" style="margin:0 0 4px">${esc(mw.ruleOn.length ? W7.ruleOnDays.replace("{list}", mw.ruleOn.map(r => R.humanShort(r.dateKey) + (r.rule === "partly" ? " (частично)" : "")).join(", ")) : W7.ruleOnNone)}</p>` : `<p class="small" style="margin:2px 0 4px">${esc(W7.searching)}</p>`}
        ${mw.otherThoughts.length ? `<p class="small" style="margin:0 0 2px">${esc(W7.otherThoughts)}</p><ul class="list">${mw.otherThoughts.map(t => `<li class="small"><div class="date">${esc(R.humanShort(t.dateKey))}</div>«${esc(t.text)}»</li>`).join("")}</ul>` : ""}</div>
      <div class="card tight" id="wkExp"><div class="k">${esc(W7.expFact)}</div>${x && x.prediction ? `<p class="small" style="margin:2px 0 4px">${esc(E7.expected.replace("{pred}", R.trimEnd(x.prediction)))}</p>` : ""}${mw.expected.length ? mw.expected.map(e => `<p class="small" style="margin:0 0 2px">${esc(W7.expLine.replace("{date}", R.humanShort(e.dateKey)).replace("{res}", resLbl[e.outcome] || e.outcome).replace("{fact}", e.fact ? ` — «${R.trimEnd(e.fact)}»` : ""))}</p>`).join("") : `<p class="small muted" style="margin:0">${esc(W7.noExp)}</p>`}</div>
      ${s.opportunities + s.realEpisodes === 0 ? `<div class="nudge" id="wkLittle">${esc(W7.littleTeacher)}</div>` : ""}`;
    if (interim) { app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(W7.interimTitle)}</p><h1>${esc(W.title.replace("{n}", due.idx + 1))}</h1><div class="nudge" id="interimNote">${esc(W7.interimNote.replace("{date}", R.human(due.end)))}</div>${facts}<div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const thoughtOpts = mw.allOtherThoughts.map((t, i) => ["t" + i, `«${t.text}»`]);
    const steps = [
      { k: "look", q: W.title.replace("{n}", due.idx + 1), type: "info", nextLabel: "Дальше", html: facts },
      { k: "rule", q: W7.ruleQ, lead: hasM ? `«${R.trimEnd(M.text)}»` : "", type: "choice", opts: W7.rule, skip: () => !hasM },
      { k: "refine", q: W7.refineQ, lead: W7.refineLead, type: "text", def: hasM ? M.text : "", skip: a2 => a2.rule !== "refine" },
      { k: "other", q: W7.otherQ, lead: W7.otherLead, type: "choice", opts: thoughtOpts, own: true, ownPh: "Своими словами", skip: a2 => a2.rule !== "other" },
      { k: "found", q: W7.foundQ, lead: W7.foundLead, type: "choice", opts: [...thoughtOpts, ["none", W7.foundNone]], skip: () => hasM || !thoughtOpts.length },
      { k: "self", q: W7.selfQ, type: "multi", opts: W7.self, own: true, optional: true },
      { k: "score", q: W7.scoreQ, lead: W7.scoreLead + (prevR ? " " + W7.scorePrev.replace("{v}", prevR.ruleScore) : ""), type: "scale", lo: W7.scoreLo, hi: W7.scoreHi, optional: true, def: prevR ? prevR.ruleScore : 5, skip: () => !hasM },
      { k: "next", q: W7.nextQ, type: "choice", opts: W7.next },
    ];
    flow({ id: "review-" + due.start, scope: p.id, steps, title: `Итог · ${R.human(due.start)} — ${R.human(due.end)}`, onCancel: () => go("today"),
      onDone: async ans => {
        const vBefore = mirrorVer(p); let mirrorDecision = ans.rule || null;
        const thoughtOf = v => { const i = Number(String(v).slice(1)); return mw.allOtherThoughts[i]; };
        if (ans.rule === "refine" && ans.refine && ans.refine !== M.text) await mirrorNewVersion(p, ans.refine, "weekly_refined", "refined");
        if (ans.rule === "other") { const t = ans.other === "__own" ? { text: ans.other_own } : thoughtOf(ans.other); if (t && t.text) { if (t.dateKey) t.status = "used"; await mirrorNewVersion(p, t.text, ans.other === "__own" ? "weekly_user_written" : "evening_thought", "recognized", "own"); } }
        if (!hasM && ans.found && ans.found !== "none") { const t = thoughtOf(ans.found); if (t) { t.status = "used"; mirrorDecision = "found"; await mirrorNewVersion(p, t.text, "evening_thought", "recognized", "own"); } }
        const decision = ({ repeat: "continue", smaller: "simplify", harder: "continue", change: "moment", observe: "observe", pause: "pause" })[ans.next] || "continue";
        const r = { id: R.uuid(), patternId: p.id, storyId: p.storyId || p.id, windowStart: due.start, windowEnd: due.end, snapshot: s, mirrorWeek: mw, experimentId: x ? x.id : null, planVersion: x ? x.version : null,
          mirrorDecision, mirrorVersionBefore: vBefore, mirrorVersionAfter: mirrorVer(p), selfChange: vals(ans, "self"), ruleScore: ans.score != null && hasM ? ans.score : null, ruleScorePrev: prevR ? prevR.ruleScore : null, nextExperiment: ans.next, decision, conclusion: "", createdAt: nowTs(), v7: true };
        await saveReview(r);
        if (ans.next === "pause") { p.status = "paused"; await savePattern(p); return go("today"); }
        if (ans.next === "observe") { p.status = "observe"; await savePattern(p); return go("today"); }
        const v = planView(p);
        if (ans.next === "smaller") { if (v && v.canSimplify && !v.simplified) return go("plan/simplify"); toast(W7.smallerOwn); return go("plan/action"); }
        if (ans.next === "harder") { toast(W7.harderOwn); return go("plan/action"); }
        if (ans.next === "change") { toast(W7.changeOwn); return go("plan/action"); }
        go("today");
      } });
  }

  /* =================== ФЛАГ =================== */
  function flagScreen() {
    const p = activePattern(); if (!p || !p.startDate) return go("today");
    const el = eligibility(p), pol = policy();
    const rulesHtml = `<details class="plain"><summary>Как считается флаг</summary><ul class="small"><li>Не раньше ${pol.minElapsedCalendarDays} календарных дней с начала практики (не с даты вспомненного случая).</li><li>Две последние недели подряд: в каждой минимум ${pol.minImpactRatingsPerWindow} вечерние оценки трудности, и все не выше ${pol.maxEachRecordedImpact}. Пропуски остаются пропусками.</li><li>В каждой неделе минимум один реальный повод; за две недели минимум ${pol.minConfirmedActionsAcrossWindowsOnDistinctDays} подтверждённых применения в разные дни. Репетиции не считаются.</li><li>Ты сам подтверждаешь три пункта ниже.</li></ul><p class="tiny">Это ориентир пилота, не медицинский критерий. Флаг значит «я освоил этот ответ в наблюдавшихся ситуациях», а не «проблема исчезла навсегда».</p></details>`;
    if (!el.eligible || hasFlag(p)) {
      app.innerHTML = `<h1>${hasFlag(p) ? "Навык уже отмечен" : "Сейчас мало случаев для проверки"}</h1>${hasFlag(p) ? `<p>По этому сюжету флаг «${esc(skillLabel(skillOfPattern(p)))}» уже есть. Новые случаи его не стирают: можно освежить навык практикой.</p>` : `<ul class="small">${el.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul><p class="small muted">Можно продолжать, наблюдать или взять паузу — без флага это тоже нормально.</p>`}${rulesHtml}<div class="row"><a class="btn block" href="#story">Назад</a></div>`; return;
    }
    const skill = skillOfPattern(p), v7 = !!p.storyResult, DV = OB.doneV7, mKnown = !!(p.mirror && p.mirror.text && p.mirror.status !== "rejected");
    const checkList = v7 ? (mKnown ? DV.self : [DV.self[0], DV.selfMirrorUnknown, DV.self[2]]) : C.progressPolicy.flagChecks;
    app.innerHTML = `<h1>Проверка навыка</h1><p class="small muted">Две недели: оценки трудности ${el.windows.map(w => w.impactRatings.map(r => r.value).join("·")).join(" | ")}; применений в разные дни: ${el.actionDays.length}.</p>
      ${!skill ? `<label>Какой навык отмечаем?</label><div class="chips col" id="sk">${SKILLS.map(s => `<button class="chip" data-v="${s.id}">${s.label}</button>`).join("")}</div>` : `<p><b>Навык:</b> ${esc(skillLabel(skill))}</p>`}
      ${v7 ? `<p class="small" style="margin:8px 0 4px"><b>${esc(DV.selfH)}</b></p>` : ""}<div class="chips col" id="cf">${checkList.map((t, i) => `<button class="chip" data-i="${i}">${esc(t)}</button>`).join("")}</div>
      <div class="row"><button class="btn block" id="ok" disabled>Отметить флаг</button></div><div class="row tight">${v7 ? `<button class="btn ghost" id="notReady">${esc(DV.notReady)}</button>` : `<a class="btn ghost" href="#story">Не сейчас</a>`}</div>${rulesHtml}`;
    const nr = $("#notReady"); if (nr) nr.onclick = async () => { p.completionChecks = [...(p.completionChecks || []), { at: nowTs(), result: "not_ready" }]; await savePattern(p); toast(DV.notReadyToast); go("story"); };
    const checks = new Set(); let sk = skill;
    const upd = () => { $("#ok").disabled = !(checks.size === 3 && sk); };
    $$("#cf .chip").forEach(b => b.onclick = () => { const i = b.dataset.i; if (checks.has(i)) checks.delete(i); else checks.add(i); b.classList.toggle("on"); upd(); });
    $$("#sk .chip").forEach(b => b.onclick = () => { sk = b.dataset.v; $$("#sk .chip").forEach(x => x.classList.toggle("on", x === b)); upd(); });
    $("#ok").onclick = async () => {
      const f = { id: R.uuid(), skillId: sk, patternId: p.id, awardedAt: nowTs(), windowStart: el.windows[0].window.start, windowEnd: el.windows[1].window.end, evidenceDays: el.actionDays, evidenceIds: D.episodes.filter(e => e.patternId === p.id && R.isConfirmedAction(e, sk, lineageOf(p))).map(e => e.id), legacy: false };
      await saveFlag(f); if (!p.skillId) { p.skillId = sk; await savePattern(p); }
      if (v7) { p.completion = { at: nowTs(), flagId: f.id, kind: mKnown ? "mirror_and_skill" : "skill_only", mirrorStatus: p.mirror ? p.mirror.status : "searching", mirrorVersion: mirrorVer(p), checks: checkList }; await savePattern(p); return completionV7(p, f, el); }
      const cl = R.clarity(D.flags, TOTAL_SKILLS), cols = ["#FBE7A8", "#E2B65A", "#B9822A", "#C9BFFF", "#8C84C8", "#F2C4B0"];
      app.innerHTML = `${reduce() ? "" : `<div class="confetti" aria-hidden="true">${Array.from({ length: 50 }, (_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % 6]};animation-delay:${(k % 12) * 0.12}s"></i>`).join("")}</div>`}
        <p class="fanfare">Флаг твой</p><div class="trail" style="height:130px"><img src="${IMG("traveler")}" alt=""><i class="glow"></i></div>
        <h2>${esc(p.lesson && p.lesson.skillId === sk ? OB.complete.title.replace("{lesson}", lc1(p.lesson.title)) : `Ты научился отвечать иначе: ${lc1(skillLabel(sk))}`)}</h2>
        ${(() => { const cases = D.episodes.filter(e => e.patternId === p.id && !e.legacy && R.isConfirmedAction(e, sk, lineageOf(p))).slice(-5); return `<p class="small" style="margin:0 0 4px"><b>${esc(cases.length ? OB.complete.cases : OB.complete.noCases)}</b></p>${cases.length ? `<ul class="list">${cases.map(e => `<li class="small"><div class="date">${esc(R.human(e.dateKey))}</div>${esc(e.newResponse.action || e.newResponse.note || actionLabel(e.newResponse))}${e.newResponse.afterAnswer ? ` — ${esc(e.newResponse.afterAnswer)}` : ""}</li>`).join("")}</ul>` : ""}`; })()}
        <p class="small">${(() => { const w = el.windows; const opp = w.reduce((a, s) => a + s.opportunities, 0); const ratings = w.map(s => s.impactRatings.map(r => r.value).join("·")).join(" | "); return `За две недели: реальных поводов ${opp}, применений в разные дни ${el.actionDays.length}, оценки трудности ${esc(ratings)}.`; })()}</p>
        <p class="small" style="margin:8px 0 4px"><b>${esc(OB.complete.continue)}</b></p><div class="chips col" id="cont">${OB.complete.opts.map(([v, l]) => `<button class="chip" data-c="${v}">${esc(l)}</button>`).join("")}</div><div id="contOwn"></div>
        <p class="small muted">${esc(OB.complete.note)} Небо: освоено ${cl.count} из ${cl.total} навыков.</p>
        <div class="row"><a class="btn block" href="#today">Продолжить закрепление</a></div>`;
      $$("[data-c]").forEach(b => b.onclick = async () => {
        const v = b.dataset.c;
        if (v === "next") { const fl = flagsReal().filter(f => f.patternId === p.id); p.status = "done"; p.completedBasis = { kind: "flag", flagIds: fl.map(f => f.id), skillIds: fl.map(f => f.skillId), at: nowTs() }; p.continueChoice = "next"; await savePattern(p); P.onb = { step: "area" }; await saveProfile(true); return go("area"); }
        if (v === "keep") { p.continueChoice = "keep"; await savePattern(p); toast("Продолжаем закреплять этот ответ"); return go("today"); }
        $("#contOwn").innerHTML = `<textarea id="cown" placeholder="${esc(OB.complete.ownPh)}"></textarea><div class="row tight"><button class="btn secondary sm" id="cownOk">Сохранить</button></div>`;
        $("#cownOk").onclick = async () => { const t = $("#cown").value.trim(); if (!t) return toast("Напиши пару слов"); p.continueChoice = "own"; p.continueNote = t; p.signs = [...(p.signs || []), { at: nowTs(), text: "Продолжу: " + t }]; await savePattern(p); toast("Записано"); go("today"); };
      });
    };
  }

  /* v7: завершение — сравнение «раньше / сейчас» на данных человека; зеркало не объявляется проработанным само */
  function completionV7(p, f, el) {
    const DV = OB.doneV7, x = expOf(p), mKnown = p.completion.kind === "mirror_and_skill", sk = f.skillId;
    const cases = D.episodes.filter(e => e.patternId === p.id && !e.legacy && R.isConfirmedAction(e, sk, lineageOf(p))).slice(-5);
    const revs = D.reviews.filter(r => r.patternId === p.id && r.v7), scores = revs.filter(r => r.ruleScore != null).map(r => r.ruleScore);
    const selfCh = [...new Set(revs.flatMap(r => r.selfChange || []))];
    const concl = Object.values(D.checkins).filter(c => c.patternId === p.id && c.evening && c.evening.experience && c.evening.experience.conclusion).sort((a, b) => a.dateKey < b.dateKey ? -1 : 1).map(c => c.evening.experience.conclusion === "__own" ? c.evening.experience.conclusionText : OB.exp["concl" + c.evening.experience.conclusion[0].toUpperCase() + c.evening.experience.conclusion.slice(1)]).filter(Boolean);
    const acts = [...new Set(cases.map(e => R.trimEnd(e.newResponse.action || e.newResponse.otherAction || "")).filter(Boolean))];
    const before = [p.habitualResponse ? `обычно: ${lc1(R.trimEnd(p.habitualResponse))}` : "", p.mirror && p.mirror.versions && p.mirror.versions[0] ? `правило: «${p.mirror.versions[0].text}»` : ""].filter(Boolean);
    const now = [acts.length ? `пробую: ${lc1(acts[acts.length - 1])}` : "", mKnown ? `правило сейчас: «${R.trimEnd(p.mirror.text)}» (${mirrorStatusText(p)})` : `зеркало: ${X.stories.mirrorStatus.searching}`].filter(Boolean);
    const w = el.windows, ratings = w.map(s => s.impactRatings.map(r => r.value).join("·")).join(" | ");
    const cl = R.clarity(D.flags, TOTAL_SKILLS), cols = ["#FBE7A8", "#E2B65A", "#B9822A", "#C9BFFF", "#8C84C8", "#F2C4B0"], v = planView(p);
    app.innerHTML = `${reduce() ? "" : `<div class="confetti" aria-hidden="true">${Array.from({ length: 50 }, (_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % 6]};animation-delay:${(k % 12) * 0.12}s"></i>`).join("")}</div>`}
      <p class="fanfare">Флаг твой</p><div class="trail" style="height:130px"><img src="${IMG("traveler")}" alt=""><i class="glow"></i></div>
      <h2 id="doneTitle">${esc(mKnown && p.lesson ? OB.complete.title.replace("{lesson}", lc1(p.lesson.title)) : DV.titleSkill)}</h2>
      <p class="small"><i>${esc(DV.less)}</i></p>
      <div class="card tight" id="beforeNow"><div class="k">${esc(DV.beforeNow)}</div><div class="dsum"><span>${esc(DV.before)}</span>${esc(uc1(before.join("; ") || "—"))}</div><div class="dsum"><span>${esc(DV.now)}</span>${esc(uc1(now.join("; ")))}</div>${scores.length >= 2 ? `<p class="small" style="margin:4px 0 0">${esc(DV.ruleScore.replace("{a}", scores[0]).replace("{b}", scores[scores.length - 1]))}</p>` : ""}<p class="tiny" style="margin:4px 0 0">За две недели: реальных поводов ${w.reduce((a, s) => a + s.opportunities, 0)}, применений в разные дни ${el.actionDays.length}, оценки трудности ${esc(ratings)}.</p></div>
      ${concl.length || selfCh.length ? `<div class="card tight"><div class="k">${esc(DV.conclusion)}</div><p class="small" style="margin:2px 0 0">${esc([...new Set([...selfCh, ...concl.slice(-3)])].join("; "))}.</p></div>` : ""}
      ${acts.length ? `<div class="card tight" id="doneActs"><div class="k">${esc(DV.actions)}</div><ul class="list">${acts.map(t => { const es = cases.filter(e => R.trimEnd(e.newResponse.action || e.newResponse.otherAction || "") === t), last = es.filter(e => e.newResponse.afterAnswer).slice(-1)[0]; return `<li class="small"><div class="date">${esc(es.map(e => R.humanShort(e.dateKey)).join(", "))}</div>${esc(t)}${last ? ` — ${esc(last.newResponse.afterAnswer)}` : ""}</li>`; }).join("")}</ul></div>` : ""}
      <div class="card tight"><div class="k">${esc(DV.return)}</div><p class="small" style="margin:2px 0 0">${esc(DV.returnText.replace("{action}", v ? lc1(R.trimEnd(v.action)) : "свой шаг"))}</p></div>
      <p class="small" style="margin:8px 0 4px"><b>${esc(OB.complete.continue)}</b></p><div class="chips col" id="cont">${OB.complete.opts.map(([vv, l]) => `<button class="chip" data-c="${vv}">${esc(l)}</button>`).join("")}</div><div id="contOwn"></div>
      <p class="small muted">${esc(OB.complete.note)} Небо: освоено ${cl.count} из ${cl.total} навыков.</p>
      <div class="row"><a class="btn block" href="#today">Продолжить закрепление</a></div>`;
    $$("[data-c]").forEach(b => b.onclick = async () => {
      const vv = b.dataset.c;
      if (vv === "next") { const fl = flagsReal().filter(ff => ff.patternId === p.id); p.status = "done"; p.completedBasis = { kind: "flag", flagIds: fl.map(ff => ff.id), skillIds: fl.map(ff => ff.skillId), at: nowTs() }; p.continueChoice = "next"; await savePattern(p); P.onb = { step: "area" }; await saveProfile(true); return go("area"); }
      if (vv === "keep") { p.continueChoice = "keep"; await savePattern(p); toast("Продолжаем закреплять этот ответ"); return go("today"); }
      $("#contOwn").innerHTML = `<textarea id="cown" placeholder="${esc(OB.complete.ownPh)}"></textarea><div class="row tight"><button class="btn secondary sm" id="cownOk">Сохранить</button></div>`;
      $("#cownOk").onclick = async () => { const t = $("#cown").value.trim(); if (!t) return toast("Напиши пару слов"); p.continueChoice = "own"; p.continueNote = t; await savePattern(p); toast("Записано"); go("today"); };
    });
  }

  /* =================== ИСТОРИЯ =================== */
  const histExp = ex => { const E7 = OB.exp; return [ex.rule ? `правило: ${lc1((ex.hadMirror ? E7.rule : E7.thought).find(o => o[0] === ex.rule)[1])}${ex.ruleText ? ` («${R.trimEnd(ex.ruleText)}»)` : ""}` : "", ex.outcome ? `${lc1(E7.exp.find(o => o[0] === ex.outcome)[1])}${ex.fact ? ` — ${ex.fact}` : ""}` : "", ex.conclusion ? `вывод: ${lc1(ex.conclusion === "__own" ? ex.conclusionText : E7.concl.find(o => o[0] === ex.conclusion)[1])}` : ""].filter(Boolean).join(" · "); };
  function history() {
    const eps = D.episodes.slice().sort((a, b) => b.loggedAt - a.loggedAt), ev = Object.values(D.checkins).filter(c => c.evening || c.morning).sort((a, b) => a.dateKey < b.dateKey ? 1 : -1), rv = D.reviews.slice().reverse(), fl = D.flags.slice().reverse();
    const n = { ep: eps.filter(e => !e.legacy).length, ev: ev.filter(c => c.evening && !c.legacy).length, rv: rv.filter(r => !r.legacy).length, fl: fl.filter(f => !f.legacy).length };
    const legacyN = eps.filter(e => e.legacy).length + ev.filter(c => c.legacy).length + rv.filter(r => r.legacy).length + fl.filter(f => f.legacy).length;
    const last14 = Array.from({ length: 14 }, (_, i) => R.addDays(today(), i - 13)), ap = anyPattern();
    const imp = last14.map(k => { const recs = R.checkinsOn(D.checkins, k).filter(c => c.evening && !c.legacy && c.evening.currentImpact != null); const c = recs.find(r => ap && r.patternId === ap.id) || recs[0]; return c ? c.evening.currentImpact : null; });
    const co = R.bodyCooccurrence(D.episodes.filter(e => !e.legacy));
    hero.innerHTML = `<div class="hero"><div class="hl">${ic("hourglass", "")}История</div><div class="hd">${n.ep} ${R.plural(n.ep, "случай", "случая", "случаев")}</div><div class="hs">${n.ev} ${R.plural(n.ev, "вечер", "вечера", "вечеров")} · ${n.rv} ${R.plural(n.rv, "итог", "итога", "итогов")} · ${n.fl} ${R.plural(n.fl, "флаг", "флага", "флагов")}</div></div>`;
    const lines = [];
    const byDate = {};
    eps.forEach(e => (byDate[e.dateKey] = byDate[e.dateKey] || []).push({ t: "ep", e }));
    ev.forEach(c => (byDate[c.dateKey] = byDate[c.dateKey] || []).push({ t: "cv", c }));
    rv.forEach(r => { const k = R.dateKey(r.createdAt); (byDate[k] = byDate[k] || []).push({ t: "rv", r }); });
    fl.forEach(f => { const k = R.dateKey(f.awardedAt); (byDate[k] = byDate[k] || []).push({ t: "fl", f }); });
    const keys = Object.keys(byDate).sort().reverse().slice(0, 60);
    keys.forEach(k => {
      const items = byDate[k].map(it => {
        if (it.t === "ep") { const e = it.e; return `<div class="small"><a href="#episode/${e.id}">${R.fmtTime(e.loggedAt)} · ${esc(e.emotion || "случай")}${e.intensity != null ? ` ${e.intensity}/10` : ""}${e.event ? " · " + esc(e.event.slice(0, 50)) : ""}</a>${e.newResponse ? ` <span class="badge">${esc(actionLabel(e.newResponse).split(":")[0])}</span>` : ""}${e.newResponse && e.newResponse.afterAnswer ? `<div class="tiny">— ${esc(e.newResponse.afterAnswer.slice(0, 90))}</div>` : ""}${e.isRehearsal ? ` <span class="badge">репетиция</span>` : ""}${e.linkStatus === "queued" ? ` <span class="badge">очередь</span>` : ""}${e.legacy ? ` <span class="badge legacy">прошлая версия</span>` : ""}</div>`; }
        if (it.t === "cv") { const c = it.c; return `<div class="small">${c.morning ? `утро${c.morning.intensity != null ? ` ${c.morning.intensity}/10` : ""}${c.evening ? " · " : ""}` : ""}${c.evening ? `вечер: трудность ${c.evening.currentImpact != null ? c.evening.currentImpact : "—"}${c.evening.hadOpportunity ? ` · повод: ${({ yes: "да", no: "нет", unsure: "не уверен" })[c.evening.hadOpportunity]}` : ""}${c.evening.actionStatus ? ` · ${({ done: "получилось", partial: "частично", not: "не получилось", other: "другое" })[c.evening.actionStatus]}` : ""}${c.evening.late ? ` <span class="badge">поздняя запись</span>` : ""}${c.evening.experience ? `<div class="tiny">${esc(histExp(c.evening.experience))}</div>` : ""}` : ""}${c.legacy ? ` <span class="badge legacy">прошлая версия</span>` : ""}</div>`; }
        if (it.t === "rv") { const r = it.r; return `<div class="small"><b>Итог недели</b> ${esc(R.human(r.windowStart || k))}${r.windowEnd ? ` — ${esc(R.human(r.windowEnd))}` : ""}: ${esc(r.legacy ? (r.decision === "legacy-passed" ? "урок пройден по старым правилам" : "продолжение") : (X.reviewDecisions.find(d => d.id === r.decision) || {}).label || r.decision)}${r.conclusion ? ` · ${esc(r.conclusion.slice(0, 80))}` : ""}${r.legacy ? ` <span class="badge legacy">прошлая версия</span>` : ""}</div>`; }
        if (it.t === "fl") { const f = it.f; return `<div class="small icline" style="align-items:center">${ic("flag", "")}<span><b>${esc(f.legacy ? "Флаг прошлой версии" : skillLabel(f.skillId))}</b>${f.legacy ? ` <span class="badge legacy">старые правила, в ясность не входит</span>` : ""}</span></div>`; }
        return "";
      }).join("");
      lines.push(`<li><div class="date">${esc(R.human(k))}</div>${items}</li>`);
    });
    app.innerHTML = `<p class="small muted">Сначала наблюдение с числами, графики — по раскрытию. ${legacyN ? `Записей прошлой версии: ${legacyN}.` : ""}</p>
      <details class="fold card"><summary><span class="k">${ic("backpack")}Трудность по вечерам · 14 дней</span><i class="chev"></i></summary><div class="bars">${imp.map(v => v == null ? `<div class="bar empty"></div>` : `<div class="bar ${v >= 6 ? "hot" : v <= 2 ? "cool" : ""}" style="height:${Math.max(5, v * 10)}%"></div>`).join("")}</div><div class="barlabels">${last14.map(k => `<span>${esc(R.humanShort(k).slice(0, 2))}</span>`).join("")}</div><p class="tiny">Пустые столбики — пропуски, не нули.</p></details>
      ${co.length ? `<details class="fold card"><summary><span class="k">${ic("eye")}Тело и чувства</span><i class="chev"></i></summary>${co.slice(0, 4).map(c => `<p class="small" style="margin:4px 0">${esc(C.bodyObservation.correlationCopy.replace("{a}", c.a.toLowerCase()).replace("{b}", c.b.toLowerCase()).replace("{n}", c.n))}</p>`).join("")}<p class="tiny">${esc(C.bodyObservation.medicalCopy)}</p></details>` : ""}
      ${D.meta.legacySigns && D.meta.legacySigns.length ? `<details class="fold card"><summary><span class="k">${ic("star")}Знаки перемен прошлой версии · ${D.meta.legacySigns.length}</span><i class="chev"></i></summary><ul class="list">${D.meta.legacySigns.slice().reverse().map(s => `<li class="small">${esc(R.human(R.dateKey(s.at)))}: ${esc(s.text)}</li>`).join("")}</ul></details>` : ""}
      <ul class="list">${lines.join("") || "<li class='muted'>Записей пока нет.</li>"}</ul>`;
  }

  /* =================== СЕЙЧАС ТЯЖЕЛО =================== */
  function help() {
    const H = X.help; let stage = "safety", method = "grounding", raf = 0;
    const log = (r) => { const c = checkin(today(), null); c.help = c.help || []; c.help.push({ at: nowTs(), method, result: r }); saveCheckin(c); };
    const render = () => {
      cancelAnimationFrame(raf);
      if (stage === "safety") {
        app.innerHTML = `<h1 class="q">${esc(H.safety.q)}</h1><div class="chips col">${H.safety.opts.map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join("")}</div><div class="row tight"><a class="btn ghost" href="#today">Назад</a></div>`;
        $$(".chip").forEach(b => b.onclick = () => { const v = b.dataset.v; if (v === "yes") { stage = "method"; render(); } else if (v === "no") { stage = "unsafe"; render(); } else { stage = "harm"; render(); } });
      } else if (stage === "unsafe" || stage === "harm") {
        const list = stage === "unsafe" ? H.unsafe : H.harm;
        app.innerHTML = `<h1>${stage === "unsafe" ? "Сначала безопасность" : "Сначала живая помощь"}</h1><ul>${list.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="small muted">Приложение не отслеживает опасность и не распознаёт кризис по тексту. Здесь нет заданий для такого состояния.</p>
          <div class="row">${stage === "unsafe" ? `<button class="btn block secondary" id="cont">Я в безопасности, продолжить</button>` : ""}</div><div class="row tight"><a class="btn ghost" href="#today">На главную</a></div>`;
        const c = $("#cont"); if (c) c.onclick = () => { stage = "method"; render(); };
      } else if (stage === "method") {
        const favs = P.favTools || [], ms = [...H.methods.filter(m => favs.includes(m[0])), ...H.methods.filter(m => !favs.includes(m[0]))];
        app.innerHTML = `<h1 class="q">Что поможет сейчас?</h1><p class="muted small">Можно держать глаза открытыми и закончить в любой момент.</p><p class="tiny">${esc(H.medical)}</p><div class="chips col">${ms.map(([v, l, d]) => `<button class="chip ${v === ms[0][0] ? "on" : ""}" data-v="${v}">${l}${favs.includes(v) ? ` <span class="tiny">· ${esc(OB.tools.fav)}</span>` : ""}<br><span class="tiny">${d}</span></button>`).join("")}</div>`;
        $$(".chip").forEach(b => b.onclick = () => { method = b.dataset.v; stage = "do"; render(); });
      } else if (stage === "do") {
        if (method === "grounding") { const ex = C.exercises.find(e => e.id === "grounding"); let i = 0; const st = () => { app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(ex.title)} · шаг ${i + 1} из ${ex.steps.length}</p><h1 class="q">${esc(ex.steps[i])}</h1><div class="row"><button class="btn block" id="n">${i < ex.steps.length - 1 ? "Дальше" : "Готово"}</button></div><div class="row tight"><button class="btn ghost" id="stop">Закончить</button></div>`; $("#n").onclick = () => { if (i < ex.steps.length - 1) { i++; st(); } else { stage = "after"; render(); } }; $("#stop").onclick = () => { stage = "after"; render(); }; }; st(); }
        else if (method === "breath") { app.innerHTML = `<h1 class="q">Спокойное дыхание</h1><p class="small muted">${esc(H.breathSteps[0])} ${esc(H.breathSteps[1])}</p><div class="breath" id="br"></div><div class="boxlabel" id="bl">вдох</div><p class="tiny" style="text-align:center">${esc(H.breathSteps[2])}</p><div class="row"><button class="btn block secondary" id="n">Достаточно</button></div>`; let inh = false; const br = $("#br"), bl = $("#bl"); const tick = () => { inh = !inh; br.classList.toggle("in", inh); bl.textContent = inh ? "вдох" : "выдох"; }; tick(); const iv = setInterval(tick, 4000); $("#n").onclick = () => { clearInterval(iv); stage = "after"; render(); }; }
        else { app.innerHTML = `<h1 class="q">Дыхание по квадрату</h1><p class="small muted">Следи за точкой. Если неприятно — прекрати и выбери другой способ.</p>
          <svg class="box" viewBox="0 0 220 220" role="img" aria-label="Дыхание по квадрату"><rect x="30" y="30" width="160" height="160" rx="10" fill="none" stroke="var(--rule)" stroke-width="6"/><text x="110" y="22" text-anchor="middle" font-size="12" fill="var(--ink-2)">вдох</text><text x="204" y="114" text-anchor="middle" font-size="12" fill="var(--ink-2)" transform="rotate(90 204 114)">задержка</text><text x="110" y="208" text-anchor="middle" font-size="12" fill="var(--ink-2)">выдох</text><text x="16" y="114" text-anchor="middle" font-size="12" fill="var(--ink-2)" transform="rotate(-90 16 114)">задержка</text><circle id="dot" cx="30" cy="30" r="11" fill="#E2B65A"/></svg>
          <div class="boxlabel" id="bl">вдох</div><div class="boxcount" id="bc"></div><div class="row"><button class="btn block secondary" id="n">Достаточно</button></div>`;
          if (!reduce()) { const dot = $("#dot"), bl = $("#bl"), bc = $("#bc"), t0 = performance.now(), L = ["вдох", "задержка", "выдох", "задержка"]; const tick = now => { const t = (now - t0) / 1000; if (t >= 64) { bl.textContent = "Хорошо"; bc.textContent = ""; return; } const side = Math.floor((t % 16) / 4), kk = (t % 4) / 4, a = 30, b = 190; const [x, y] = side === 0 ? [a + (b - a) * kk, a] : side === 1 ? [b, a + (b - a) * kk] : side === 2 ? [b - (b - a) * kk, b] : [a, b - (b - a) * kk]; dot.setAttribute("cx", x); dot.setAttribute("cy", y); bl.textContent = L[side]; bc.textContent = `${4 - Math.floor(t % 4)} · круг ${Math.floor(t / 16) + 1} из 4`; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
          $("#n").onclick = () => { cancelAnimationFrame(raf); stage = "after"; render(); }; }
      } else if (stage === "after") {
        const fav = (P.favTools || []).includes(method);
        app.innerHTML = `<h1 class="q">Как сейчас?</h1><div class="chips col">${H.after.map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join("")}</div>
          <p class="tiny" style="margin:8px 0 4px">${esc(H.fitLead || "")}</p><div class="row tight"><button class="btn ghost sm" id="fav">${esc(fav ? OB.tools.favOn : OB.tools.fav)}</button></div>`;
        $("#fav").onclick = async () => { P.favTools = P.favTools || []; if (!P.favTools.includes(method)) P.favTools.push(method); await saveProfile(true); $("#fav").textContent = OB.tools.favOn; };
        $$(".chip").forEach(b => b.onclick = async () => { const v = b.dataset.v; log(v); const p = activePattern(); await saveTool({ id: R.uuid(), toolId: method === "grounding" ? "grounding" : "breath:" + method, toolVersion: PR.catalogVersion, patternId: p ? p.id : null, basisEpisodeId: P.lastEpisode || null, dateKey: today(), startedAt: nowTs(), endedAt: nowTs(), exited: false, answers: {}, result: v, fit: v === "worse" ? "bad" : v === "better" ? "fit" : v === "same" ? "partly" : null, planChange: null }); if (v === "worse") { stage = "worse"; } else stage = "power"; render(); });
      } else if (stage === "worse") {
        app.innerHTML = `<h1 class="q">Стало тяжелее</h1><p>Повторять то же упражнение не будем. Можно попробовать другой способ, выйти из ситуации или связаться с человеком, которому доверяешь.</p><div class="chips col">${H.methods.filter(m => m[0] !== method).map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join("")}<a class="chip" href="#today">На главную</a></div>`;
        $$(".chip[data-v]").forEach(b => b.onclick = () => { method = b.dataset.v; stage = "do"; render(); });
      } else if (stage === "power") {
        app.innerHTML = `<h1 class="q">Что сейчас в моей власти?</h1><p class="muted small">По желанию.</p><div class="chips col">${H.power.map(x => `<button class="chip" data-v="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="row tight"><a class="btn ghost" href="#event">Записать как случай</a><a class="btn ghost" href="#today">На главную</a></div>`;
        $$(".chip").forEach(b => b.onclick = () => { toast("Хорошо. Один посильный шаг."); go("today"); });
      }
    };
    render();
  }

  /* =================== СИМВОЛИЧЕСКАЯ ТЕМА =================== */
  /* Шаг 3 входа. Открытие числа: астролябия, золотая цифра, название пути. Анимацию можно пропустить; при reduced motion — статично. */
  /* Экран числа v6.3: число и название пути, краткий смысл, переходный вопрос, «Найти свой первый урок». Расчёт и подробности — по раскрытию. */
  /* v6.6: раскрытие пути — два содержательных абзаца сразу, глубина по желанию. Тема числа — направление, не вывод о человеке. */
  const PS = () => X.pathShared;
  const paras = (arr, cls) => (arr || []).map(t => `<p class="${cls || "small"}" style="margin:0 0 6px">${esc(t)}</p>`).join("");
  const foundationHTML = () => `<details class="plain" id="foundation"><summary>${esc(PS().foundation.title)}</summary>${paras(PS().foundation.paragraphs)}</details>`;
  const readingCard = id => { const c = (PS().readingCards || []).find(r => r.id === id); return c ? `<details class="plain reading" data-reading="${id}"><summary>${esc(c.title)}</summary><p class="small" style="margin:0 0 6px">${esc(c.text)}</p></details>` : ""; };
  /* v7: раскрываемые разделы пути — сильные стороны и темы уроков (навигация для размышления, не назначенные упражнения) */
  const pathProfileHTML = (n, open) => { const pr = X.pathProfiles[String(n)], V7 = OB.pathV7; return `<details class="plain" id="strengths"${open ? " open" : ""}><summary>${esc(V7.strengths)}</summary><p class="small" style="margin:0 0 6px">${esc(uc1(pr.strengths))}.</p></details>
    <details class="plain" id="themes"${open ? " open" : ""}><summary>${esc(V7.themes)}</summary><ul class="small" style="margin:0 0 6px">${(pr.lessonThemes || []).map(t => `<li>${esc(uc1(t))}</li>`).join("")}</ul><p class="tiny">${esc(OPth.note)}</p></details>`; };
  function reveal(n) {
    const S = P.symbolic, pr = X.pathProfiles[String(n)], R2 = OB.reveal2, r = R.calcNum(S.birth) || { digits: [], chain: [n] }, red = reduce() || !!(P.onb && P.onb.revealed);
    app.innerHTML = `<div class="astro compact"><img src="${IMG("astrolabe")}" alt=""><div class="orb ${red ? "shown" : "calc"}" id="orb"><div class="core"><i class="fl"></i><img class="num" src="${IMG("num-" + n)}" alt="Число ${n}"></div></div></div>
      ${red ? "" : `<div class="row tight" id="skipRow" style="justify-content:flex-end;margin:0"><button class="btn ghost sm" id="skipAnim">Пропустить</button></div>`}
      <p class="tiny eyebrow" style="margin:4px 0 0">${esc(R2.eyebrow)} · ${n}</p>
      <h1 style="margin-top:2px">${esc(pr.displayName)}</h1>
      <div id="revealText">${paras(pr.revealParagraphs, "")}</div>
      <p class="small" id="revCaption" style="margin:8px 0 4px"><b>${esc(OB.pathV7.recogCaption)}</b></p>
      <div class="chips col recog" id="revRecog">${pr.recognitionItems.map(i => `<button class="chip ${(onb().recogSel || []).includes(i.id) ? "on" : ""}" data-rg="${i.id}" aria-pressed="${(onb().recogSel || []).includes(i.id)}">${esc(i.text)}</button>`).join("")}<button class="chip dim" id="revOther">${esc(OB.pathV7.otherStory)}</button></div>
      ${pathProfileHTML(n, false)}
      ${foundationHTML()}
      <div class="row"><button class="btn block" id="go">${esc(R2.cta)}</button></div>
      <details class="plain"><summary>${esc(R2.calc)}</summary><p class="small">${esc(r.digits.join(" + "))}${r.chain.length ? " = " + esc(r.chain.join(" → ")) : ""}</p></details>
      <div class="row tight"><a class="btn ghost sm" href="#birth">${esc(R2.date)}</a></div>`;
    let stopped = false;
    const finish = () => { stopped = true; const orb = $("#orb"); if (orb) { orb.classList.remove("calc", "reveal"); orb.classList.add("shown"); } const sr = $("#skipRow"); if (sr) sr.remove(); if (P.onb) { P.onb.revealed = true; saveProfile(true); } };
    if (red) finish(); else { const orb = $("#orb"); setTimeout(() => { if (orb.isConnected && !stopped) { orb.classList.remove("calc"); orb.classList.add("shown", "reveal"); setTimeout(() => { if (orb.isConnected && !stopped) { const sr = $("#skipRow"); if (sr) sr.remove(); stopped = true; if (P.onb) { P.onb.revealed = true; saveProfile(true); } } }, 1100); } }, 500); $("#skipAnim").onclick = finish; }
    /* v7: примеры узнавания прямо на экране числа; выбор ведёт в те же сферы, «другой сюжет» — без подбора по числу */
    $$("#revRecog [data-rg]").forEach(b => b.onclick = () => { const S2 = onb(), id = b.dataset.rg, sel = S2.recogSel || []; S2.recogSel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; b.classList.toggle("on"); b.setAttribute("aria-pressed", S2.recogSel.includes(id)); saveProfile(true); });
    $("#revOther").onclick = async () => { finish(); const S2 = onb(); S2.otherStory = true; S2.preferTopics = []; S2.recogMain = null; S2.recogSel = []; S2.step = "area"; await saveProfile(true); go("area"); };
    $("#go").onclick = async () => {
      finish(); const S2 = onb(), sel = S2.recogSel || []; S2.step = "area";
      if (sel.length) { P.pathRecognition = [...(P.pathRecognition || []), ...sel.map(id => ({ itemId: id, answer: "familiar", date: today(), pathNumber: n, contentVersion: C.contentVersion }))]; if (sel.length === 1) recogStart(S2, pr.recognitionItems.find(i => i.id === sel[0])); else S2.recogPickOne = true; }
      else { S2.otherStory = true; S2.recogMain = null; }
      await saveProfile(true); go("area");
    };
  }
  function symbol() {
    const S = P.symbolic || {};
    if (S.num) {
      const n = S.chosen || S.num, pr = X.pathProfiles[String(n)];
      if (P.onb && !anyPattern()) return reveal(n);
      const recog = (P.pathRecognition || []).filter(r => pr.recognitionItems.some(i => i.id === r.itemId));
      app.innerHTML = `<div class="astro compact"><img src="${IMG("astrolabe")}" alt=""><div class="orb shown"><div class="core"><i class="fl"></i><img class="num" src="${IMG("num-" + n)}" alt="Число ${n}"></div></div></div>
        <p class="tiny eyebrow" style="margin:4px 0 0">${esc(OB.reveal2.eyebrow)} · ${n}</p><h1 style="margin-top:2px">${esc(pr.displayName)}</h1><p class="small muted" style="margin:0 0 6px">${esc(pr.theme)}</p>${paras(pr.revealParagraphs, "")}
        ${recog.length ? `<p class="small muted" style="margin:0 0 6px">Ты отмечал знакомым: ${recog.map(r => esc(lc1((pr.recognitionItems.find(i => i.id === r.itemId) || {}).text || ""))).join("; ")}.</p>` : ""}
        ${pathProfileHTML(n, false)}
        ${foundationHTML()}
        <details class="plain"><summary>Выбрать другую тему</summary><div class="chips">${Object.keys(X.paths).map(k => `<button class="chip ${String(n) === k ? "on" : ""}" data-t="${k}">${k} · ${esc(X.pathProfiles[k].displayName)}</button>`).join("")}</div></details>
        <div class="row tight"><button class="btn ghost" id="rm">Убрать число</button><a class="btn ghost" href="#story">Назад</a></div>`;
      $$("[data-t]").forEach(b => b.onclick = async () => { P.symbolic.chosen = Number(b.dataset.t); P.companion = null; await saveProfile(); symbol(); });
      $("#rm").onclick = async () => { P.symbolic = null; P.companion = null; await saveProfile(); go("story"); };
      return;
    }
    app.innerHTML = `<h1>Число пути</h1><p class="small muted">По желанию. Сумма цифр даты рождения даёт число 1–9 и тему твоего пути. Подробнее — в «О подходе».</p>
      <label for="b">Дата рождения</label><input type="date" id="b" min="1920-01-01" max="${today()}"><div class="row"><button class="btn block" id="go">Посчитать</button></div><div class="row tight"><a class="btn ghost" href="#story">Не нужно</a></div>`;
    $("#go").onclick = async () => { const v = $("#b").value; const r = R.calcNum(v); if (!r) return toast("Укажи дату"); P.symbolic = { birth: v, num: r.num, chosen: null }; P.companion = null; await saveProfile(); symbol(); };
  }

  /* =================== О МЕТОДЕ =================== */
  function about() {
    const A = X.about;
    app.innerHTML = `<h1>Как это работает</h1><p>${esc(C.entryCopy.promise)} Цикл: случай → моя реакция → возможное объяснение → маленький шаг → что вышло на самом деле → уточнение.</p>
      <div class="card mark"><div class="k">${ic("star")}${esc(OB.approach.title)}</div><p class="small" style="margin:2px 0 4px">${esc(OB.approach.text)}</p>${P.consent ? `<p class="tiny" style="margin:0">Ты отметил(а), что прочитал(а) это: ${esc(R.human(R.dateKey(P.consent.at)))} (версия текста ${esc(P.consent.version)}).</p>` : ""}</div>
      <h2>Образы и пределы</h2><p>${esc(A.frame)}</p>
      <h2>Что под шагами</h2><p>${esc(A.method)}</p>
      <div class="card"><div class="k">${ic("mirror")}Источники</div><ul class="src">${C.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="w">основа метода; адаптированные упражнения не проверены как этот продукт</span></li>`).join("")}<li><a href="https://pubmed.ncbi.nlm.nih.gov/9150580/" target="_blank" rel="noopener">Newman, Duff &amp; Baumeister, 1997</a><br><span class="w">проекция при подавлении мыслей; не основание трактовать любое раздражение как зеркало</span></li></ul></div>
      <div class="card"><div class="k">${ic("key")}Пределы выводов</div><ul class="small">${A.limits.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>
      <details class="plain"><summary>Откуда шаблоны шагов и инструментов</summary><p class="tiny">${esc(PR.note)} Каталог ${esc(PR.catalogVersion)}.</p><ul class="src">${Object.entries(PR.sources).map(([k, v]) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(k)}</a> <span class="w">(${esc(v.kind)}) — ${esc(v.use)}</span></li>`).join("")}</ul></details>
      <p class="small muted">${esc(A.extra)}</p>
      <div class="row"><a class="btn block" href="${anyPattern() ? "#today" : "#start"}">Назад</a></div>${anyPattern() ? `<div class="row tight"><a class="btn ghost sm" href="#guide">${esc(OB.buttons.guide)}</a></div>` : ""}`;
  }

  /* =================== НАСТРОЙКИ =================== */
  function settings() {
    const rem = P.reminders;
    app.innerHTML = `<h1>Настройки</h1>
      <div class="card"><div class="k">${ic("sunrise")}Оформление</div><p class="small muted" style="margin:2px 0 4px">Тема «Звёздный вечер».</p>
        <div class="switch"><span>Крупный текст</span><input type="checkbox" id="big" ${P.bigText ? "checked" : ""}></div></div>
      <div class="card"><div class="k">${ic("hourglass")}Напоминания</div><p class="small muted" style="margin:2px 0 4px">По умолчанию одно вечернее. Утро и день — по желанию. Приложение само уведомления не присылает: напоминания живут в календаре телефона.</p>
        ${[["evening", "Вечер"], ["morning", "Утро"], ["day", "День"]].map(([k, l]) => `<div class="switch"><label style="margin:0;display:flex;align-items:center;gap:8px"><input type="checkbox" data-rk="${k}" ${rem[k].on ? "checked" : ""}>${l}</label><input type="time" data-rt="${k}" value="${esc(rem[k].time)}" aria-label="Время: ${l}"></div>`).join("")}
        <div class="row tight"><button class="btn secondary sm" id="ics">Скачать файл календаря</button></div>
        <p class="tiny">Файл .ics нужно открыть и добавить в календарь вручную. Повторный импорт того же набора может создать дубли в некоторых календарях; изменения времени в приложении в календарь не синхронизируются.</p><div id="icsout"></div></div>
      <div class="card"><div class="k">${ic("moon")}Время дня</div><div class="grid2"><label>Утро с<input type="time" id="tm" value="${R.pad(P.times.morningStart)}:00"></label><label>Вечер с<input type="time" id="te" value="${R.pad(P.times.eveningStart)}:00"></label></div><p class="tiny">Окна меняют только подсказку на главной. Записи и помощь доступны всегда.</p></div>
      <div class="card"><div class="k">${ic("key")}Данные</div><p class="small muted" style="margin:2px 0 6px">Хранилище: ${ST.mode === "idb" ? "на устройстве (IndexedDB)" : ST.mode === "ls" ? "на устройстве (запасной режим)" : "недоступно"}. Шифрования нет.</p>
        <div class="row tight"><button class="btn secondary sm" id="exp">Экспорт JSON</button><button class="btn secondary sm" id="imp">Импорт JSON</button></div><div id="dataout"></div>
        ${(P.recovered || []).length ? `<details class="plain"><summary>Незаконченные записи прошлой сборки · ${P.recovered.length}</summary><p class="tiny">Эти ответы были набраны до обновления, и к какому сюжету они относятся, определить нельзя. Текст сохранён, его можно взять в новую запись.</p><ul class="list">${P.recovered.map((r, i) => `<li class="small"><div class="date">${esc(({ new: "Случай", event: "Зацепило", action: "Сделал по-новому" })[r.id] || r.id)}${r.at ? ` · ${esc(R.human(R.dateKey(r.at)))}` : ""}</div>${esc(Object.values(r.ans || {}).filter(v => typeof v === "string" && v.trim()).join(" · "))} <button class="btn ghost sm" data-rec="${i}">убрать</button></li>`).join("")}</ul></details>` : ""}
        <div class="row tight"><button class="btn ghost sm" id="reset">Стереть всё</button></div></div>
      <div class="card tight"><div class="row tight"><a class="btn ghost sm" href="#guide">${esc(OB.buttons.guide)}</a><a class="btn ghost sm" href="#about">${esc(OB.approach.title)} и источники</a><a class="btn ghost sm" href="#symbol">Число пути</a><a class="btn ghost sm" href="#entry">Другой сюжет</a></div></div>
      <details class="plain"><summary>Для разработчика</summary><div class="card tight"><div class="switch"><span>Режим разработки</span><input type="checkbox" id="dev" ${P.devMode ? "checked" : ""}></div>
        ${P.devMode ? `<p class="small muted">Тестовые часы: ${esc(R.human(today()))}, ${R.fmtTime(nowTs())}, сдвиг +${P.offsetH || 0} ч.</p><div class="row tight"><button class="btn secondary sm" data-o="6">+6 ч</button><button class="btn secondary sm" data-o="24">+1 день</button><button class="btn secondary sm" data-o="168">+7 дней</button><button class="btn secondary sm" data-o="0">Сброс</button></div>` : ""}
        <p class="tiny">Версия ${esc(window.KARMA_VERSION || "v2")} · контент ${esc(C.contentVersion)}</p></div></details>`;
    $("#big").onchange = async e => { P.bigText = e.target.checked; await saveProfile(); applyTheme(); };
    $$("[data-rk]").forEach(i => i.onchange = async () => { rem[i.dataset.rk].on = i.checked; await saveProfile(); });
    $$("[data-rt]").forEach(i => i.onchange = async () => { rem[i.dataset.rt].time = i.value; await saveProfile(); });
    $("#ics").onclick = () => { const t = R.icsText({ reminders: rem, installId: P.installId, url: /^https?:/.test(location.href) ? location.href.split("#")[0] : "", nowTs: nowTs() }); if (!t) return toast("Включи хотя бы одно напоминание"); download("put-karmy-napominaniya.ics", t, "text/calendar", $("#icsout")); };
    $("#tm").onchange = async e => { P.times.morningStart = Number(e.target.value.split(":")[0]); await saveProfile(); };
    $("#te").onchange = async e => { P.times.eveningStart = Number(e.target.value.split(":")[0]); await saveProfile(); };
    $("#exp").onclick = () => download(`put-karmy-${today()}.json`, ST.exportJSON(nowTs()), "application/json", $("#dataout"));
    $$("[data-rec]").forEach(b => b.onclick = async () => { P.recovered.splice(Number(b.dataset.rec), 1); await saveProfile(); settings(); });
    $("#imp").onclick = () => importUI($("#dataout"));
    $("#reset").onclick = async e => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Точно? Нажми ещё раз — всё удалится без возврата"; return; } const keep = { theme: P.theme, installId: P.installId }; await ST.clearAll(); D = ST.data; P = defaultProfile(keep); D.meta = { schemaVersion: R.SCHEMA_VERSION, createdAt: nowTs() }; await saveProfile(); await saveMeta(); go("start"); };
    $("#dev").onchange = async e => { P.devMode = e.target.checked; if (!P.devMode) P.offsetH = 0; await saveProfile(); settings(); };
    $$("[data-o]").forEach(b => b.onclick = async () => { const o = Number(b.dataset.o); P.offsetH = o ? (P.offsetH || 0) + o : 0; await saveProfile(); lastKey = today(); settings(); });
  }
  function download(name, text, type, out) {
    try { const b = new Blob([text], { type }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
    catch (e) {}
    if (out) out.innerHTML = `<p class="tiny">Если файл не скачался (так бывает во встроенных просмотрщиках), скопируй текст:</p><textarea readonly style="min-height:70px;font-size:11px">${esc(text)}</textarea>`;
  }
  function importUI(out) {
    out.innerHTML = `<p class="small">Выбери файл экспорта или вставь его текст. Перед объединением покажем, что внутри.</p><input type="file" id="f" accept=".json,application/json"><textarea id="t" placeholder="или вставь JSON сюда" style="min-height:60px;margin-top:6px"></textarea><div class="row tight"><button class="btn secondary sm" id="prev">Проверить</button></div><div id="pv"></div>`;
    /* Любая ошибка разбора или структуры показывается причиной; до записи базы дело не доходит. */
    const handle = txt => { try {
      let obj; try { obj = JSON.parse(txt); } catch (e) { return $("#pv").innerHTML = `<div class="warn">Не удалось прочитать JSON: ${esc(e.message)}</div>`; }
      const v = R.validateImport(obj); if (!v.ok) return $("#pv").innerHTML = `<div class="warn">Файл не подходит:<br>${v.errors.map(esc).join("<br>")}</div>`;
      let inc = obj; if (v.legacy) { const m = R.migrateV9(obj, nowTs()); inc = { patterns: m.patterns, episodes: m.episodes, hypotheses: [], experiments: [], reviews: m.reviews, flags: m.flags, checkins: m.checkins, research: {} }; }
      const pv = R.importPreview(inc);
      $("#pv").innerHTML = `<div class="card tight"><p class="small" style="margin:0 0 6px">${v.legacy ? "Старый формат: будет импортирован как записи прошлой версии. " : v.schemaVersion < R.SCHEMA_VERSION ? `Файл схемы ${v.schemaVersion}: будет приведён к текущей. ` : ""}Сюжетов: ${pv.patterns}, случаев: ${pv.episodes}, гипотез: ${pv.hypotheses}, шагов: ${pv.experiments}, итогов: ${pv.reviews}, флагов: ${pv.flags}, дней: ${pv.checkins}. Совпадающие записи не дублируются.</p><div class="row tight"><button class="btn sm" id="merge">Объединить с моими данными</button></div></div>`;
      $("#merge").onclick = async () => { try { const { data, stats } = R.mergeImport(D, inc, v.legacy ? R.SCHEMA_VERSION : v.schemaVersion); data.profile = D.profile; data.meta = D.meta || {}; await ST.replaceAll(data); D = ST.data; toast(`Добавлено ${stats.added}, обновлено ${stats.updated}`); go("history"); } catch (e) { saveError(e); } };
    } catch (e) { $("#pv").innerHTML = `<div class="warn">Файл не удалось обработать: ${esc(e && e.message ? e.message : e)}</div>`; } };
    $("#f").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => handle(r.result); r.readAsText(f); };
    $("#prev").onclick = () => handle($("#t").value);
  }

  /* =================== ПРОШЛАЯ ВЕРСИЯ =================== */
  function legacy() { go("history"); }

  /* =================== СТАРТ ПРИЛОЖЕНИЯ =================== */
  function defaultProfile(keep) {
    return Object.assign({ theme: "dark", bigText: false, reminders: { evening: { on: true, time: "20:30" }, morning: { on: false, time: "08:30" }, day: { on: false, time: "13:00" } }, times: { morningStart: 5, dayStart: 12, eveningStart: 17 }, devMode: false, offsetH: 0, installId: R.uuid().slice(0, 8), seen: {}, drafts: {}, symbolic: null, legacyDecision: null }, keep || {});
  }
  async function boot() {
    D = await ST.load(); D.tools = D.tools || [];
    if (ST.mode === "none") banner("Хранилище недоступно: записи не сохранятся после закрытия. Проверь режим браузера или место на устройстве.");
    P = Object.assign(defaultProfile(), D.profile || {}); P.reminders = Object.assign(defaultProfile().reminders, P.reminders || {}); P.times = Object.assign({}, R.DEFAULT_TIMES, P.times || {}); P.seen = P.seen || {}; P.drafts = P.drafts || {};
    D.meta = D.meta || { schemaVersion: R.SCHEMA_VERSION, createdAt: Date.now() };
    if (!D.meta.migratedFromV9 && ST.hasLegacy()) {
      const m = R.migrateV9(ST.readLegacy(), Date.now());
      m.patterns.forEach(p => upsert(D.patterns, p)); m.episodes.forEach(e => upsert(D.episodes, e)); m.reviews.forEach(r => upsert(D.reviews, r)); m.flags.forEach(f => upsert(D.flags, f));
      Object.values(m.checkins).forEach(c => { if (!D.checkins[c.id]) D.checkins[c.id] = c; });
      Object.assign(D.meta, m.meta); if (!D.profile) { Object.assign(P, m.profile); if (m.profile.symbolic) P.symbolic = m.profile.symbolic; }
      P.seen.start = true;
      try { await ST.replaceAll(Object.assign(D, { profile: P })); } catch (e) { saveError(e); }
    }
    /* Схема 2 → 3: записи дня по ключу «дата|сюжет» (уже приведены хранилищем); действия получают навык из плана, действовавшего в момент записи (помечены backfilled, в флаг не входят);
       черновики прежней сборки переносятся в новую схему, неоднозначные сохраняются как восстановимые записи (Настройки → Данные). Схема 4: у старых разрешений появляется происхождение migrated. */
    const sv = D.meta.schemaVersion || 0;
    if (sv < R.SCHEMA_VERSION) {
      if (sv < 3) {
        D.checkins = R.normalizeCheckins(D.checkins); R.backfillEvidence(D);
        const m = R.migrateDrafts(P.drafts, { patterns: D.patterns, episodes: D.episodes }, DRAFT_V);
        P.drafts = m.drafts; if (m.recovered.length) P.recovered = [...(P.recovered || []), ...m.recovered];
      }
      if (sv < 4) R.markMigratedPermissions(D.patterns);
      /* Схема 5: старт практики = прежний startDate (история и флаги не переписываются); обучение считается пройденным,
         а объяснение практики предлагается отдельной карточкой. Незаконченный вход прежней версии начинается с выбора сферы. */
      if (sv < 5) {
        R.migrateV5(D.patterns);
        const hasData = D.patterns.length > 0 || !!D.meta.migratedFromV9 || Object.keys(D.checkins).length > 0;
        if (hasData) { P.seen.map = true; P.seen.trail = true; P.seen.buttons = true; P.guideOffer = true; }
        if (P.onb && P.onb.step && !["start", "birth", "symbol"].includes(P.onb.step)) P.onb = { step: "area" };
      }
      /* Схема 6: прежние планы помечаются legacy и предлагаются к уточнению; выдуманные условия не добавляются. */
      if (sv < 6) R.migrateV6(D);
      /* Схема 7: цель отделена от жалобы, линии планов, проверка принадлежности вечеров. Повторный запуск безопасен. */
      if (sv < 7) R.migrateV63(D);
      /* Схема 8: архивированные сюжеты не считаются пройденными уроками. */
      if (sv < 8) R.migrateV66(D);
      D.meta.schemaVersion = R.SCHEMA_VERSION; D.meta.upgradedAt = Date.now();
      try { await ST.replaceAll(Object.assign(D, { profile: P })); } catch (e) { saveError(e); }
    }
    /* v6.10: сохранённый выбор «по времени суток / рассвет» приводится к единственной вечерней теме; остальные настройки не трогаем */
    if (P.theme !== "dark") { P.themeLegacy = P.theme || null; P.theme = "dark"; await saveProfile(true); applyTheme(); }
    /* v6.7.2: если прежняя сборка оставила два действующих сюжета — остаётся один (с принятым шагом), другой уходит в историю */
    /* v7: миграция v6.10 без сброса — зеркалу семейного разбора присваивается версия 1, сюжету — storyId; формулировки не меняются */
    for (const q of R.migrateMirrorV7(D.patterns)) await savePattern(q);
    { const dup = R.resolveDuplicateCurrent(D, Date.now()); if (dup.length) { for (const q of dup) await savePattern(q); P.lastResult2 = OB.conflict.repaired; await saveProfile(true); } }
    /* v6.4: незавершённый вход переводится на ветки по сфере; автоматическая сфера из отклика пути не считается выбором. */
    if (P.onb && R.migrateOnbV64(P.onb, { variants: X.variants, routingVersion: X.routingVersion, recognitionTopics: Object.fromEntries(Object.values(X.pathProfiles).flatMap(pr => pr.recognitionItems.map(i => [i.id, i.preferSubtypes]))) })) await saveProfile(true);
    if (!D.profile) await saveProfile();
    lastKey = today(); lastPhase = phase();
    route();
    registerSW();
  }
  function registerSW() {
    if (!("serviceWorker" in navigator) || !/^https?:/.test(location.protocol)) return;
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const nw = reg.installing; if (!nw) return; nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) banner(`Есть обновление приложения. <button id="upd">Обновить</button>`, "info"); const b = document.getElementById("upd"); if (b) b.onclick = () => { nw.postMessage({ type: "SKIP_WAITING" }); }; }); });
      if (reg.waiting && navigator.serviceWorker.controller) { banner(`Есть обновление приложения. <button id="upd">Обновить</button>`, "info"); const b = document.getElementById("upd"); if (b) b.onclick = () => reg.waiting.postMessage({ type: "SKIP_WAITING" }); }
    }).catch(() => {});
    let reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloaded) return; reloaded = true; location.reload(); });
  }
  window.KARMA_APP = { get data() { return D; }, get profile() { return P; }, go, nowTs, today, route, saveProfile };
  boot();
})();
