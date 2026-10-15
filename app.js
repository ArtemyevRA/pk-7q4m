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
  function eligibility(p) { return R.flagEligibility({ pattern: p, checkins: D.checkins, episodes: D.episodes, todayKey: today(), policy: policy(), experiment: expOf(p), skillId: skillOfPattern(p) }); }
  /* Метка доказательства: навык и версия плана в момент записи. Смена навыка потом не переименовывает историю. */
  function evidenceTag(p) { const x = expOf(p); return { skillId: (x && x.skillId) || (p && p.skillId) || null, experimentId: x ? x.id : null, planVersion: x ? x.version : null }; }
  /* Разрешение из пакета не затирает формулировку пользователя; источник запоминается для пересмотра при смене объяснения. */
  function setPermissionFromPack(p, text, hypId) { const ps = p.permissionSource; if (!text) return; if (!p.permission || !ps || ps.origin !== "user") { p.permission = text; p.permissionSource = { origin: "pack", hypothesisVersionId: hypId || null }; } }
  function setPermissionByUser(p, text) { p.permission = text; p.permissionSource = { origin: "user", hypothesisVersionId: p.hypothesisVersionId || null }; }
  function hasFlag(p) { return flagsReal().some(f => f.patternId === p.id && f.skillId === skillOfPattern(p)); }
  function planText(p) { const x = expOf(p); return x ? (x.action || "") : (p && p.firstPlan ? p.firstPlan.text : ""); }
  function ifThen(p) { const x = expOf(p); const it = (x && x.ifThen) || (p && p.firstPlan ? { signal: p.firstPlan.signal, action: p.firstPlan.action } : null); return it ? `Если ${lc1(it.signal)}, то ${lc1(it.action)}.` : ""; }
  function permissionText(p) { return (p && p.permission) || ""; }

  /* ---------- тема и фон ---------- */
  function applyTheme() {
    const ph = phase(), mode = P.theme === "auto" ? (ph === "evening" || ph === "night" ? "dark" : "light") : P.theme;
    const r = document.documentElement; r.setAttribute("data-theme", mode); r.setAttribute("data-big", P.bigText ? "1" : "0");
    const im = $("#bgimg"), src = IMG(mode === "dark" ? "bg-evening" : "bg-morning"); if (im.getAttribute("src") !== src) im.setAttribute("src", src);
  }

  /* ---------- тропа ---------- */
  function trailHTML(p) {
    const steps = R.practiceDays(D.checkins).length;
    const cl = R.clarity(D.flags, TOTAL_SKILLS), rating = R.lastRating({ checkins: D.checkins, episodes: D.episodes });
    const elig = p && p.startDate ? eligibility(p) : null;
    const wk = p && p.startDate ? Math.min(1, (R.daysSince(p.startDate, today()) + 1) / 21) : 0;
    const prog = p && p.startDate ? Math.min(0.92, 0.06 + wk * 0.86) : 0.06;
    const veil = Math.max(0, 0.55 - cl.pct / 100 * 0.55);
    const st = rating ? `${rating.value} ${R.stonesWord(rating.value)}` : "оценки нет";
    return `<div class="trail" role="img" aria-label="Тропа. Состояние: ${esc(st)}. Шагов: ${steps}. Ясность: ${cl.pct}%.">
      <img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:${veil.toFixed(2)}"></i>${elig && elig.eligible ? `<i class="glow"></i>` : ""}
      <span class="tb l">${ic("backpack", "")}${esc(st)}</span><span class="tb c">${ic("mountain", "")}${steps} ${R.plural(steps, "шаг", "шага", "шагов")}</span><span class="tb r">${ic("star", "")}${cl.pct}%</span>
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
  document.addEventListener("visibilitychange", () => { if (document.hidden && flowFlush) flowFlush(); });
  window.addEventListener("pagehide", () => { if (flowFlush) flowFlush(); });
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
        body = `${s.tags ? `<div class="chips" id="tg">${(typeof s.tags === "function" ? s.tags(ans) : s.tags).map(t => `<button class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>` : ""}<textarea id="a" placeholder="${esc(s.ph || "")}">${esc(cur || "")}</textarea>`;
      } else if (s.type === "scale") {
        const v = cur != null ? cur : (s.def != null ? s.def : 5);
        body = `<div class="range-val" id="scv">${cur == null && s.optional ? "—" : v}</div><input type="range" id="sc" min="0" max="10" step="1" value="${v}" aria-label="${esc(q)}"><div class="range-hint"><span>${esc(s.lo || "0")}</span><span>${esc(s.hi || "10")}</span></div>`;
      } else if (s.type === "date") {
        const min = typeof s.min === "function" ? s.min(ans) : s.min, max = typeof s.max === "function" ? s.max(ans) : s.max;
        const def = typeof s.def === "function" ? s.def(ans) : s.def;
        body = `<input type="date" id="dt" value="${esc(cur || def || "")}"${min ? ` min="${esc(min)}"` : ""}${max ? ` max="${esc(max)}"` : ""} aria-label="${esc(q)}">`;
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
      $$("#tg .chip").forEach(b => b.onclick = () => { if (a) { a.value = a.value.trim() ? a.value.trim() + ". " + b.dataset.v : b.dataset.v; a.focus(); later(); } });
      const sc = $("#sc"); if (sc) sc.oninput = () => { $("#scv").textContent = sc.value; ans[s.k] = Number(sc.value); later(); };
      const advance = () => {
        if (s.type === "choice") { if (!ans[s.k] && !s.optional) return toast("Выбери вариант"); if (ans[s.k] === "__own") { const v = own.value.trim(); if (!v) return toast("Напиши своё"); ans[s.k + "_own"] = v; } }
        if (s.type === "multi") { const arr = ans[s.k] || []; if (arr.includes("__own")) { const v = own.value.trim(); if (!v) return toast("Напиши своё"); ans[s.k + "_own"] = v; } if (!arr.length && !s.optional) return toast("Отметь хотя бы одно"); }
        if (s.type === "text") { const v = a.value.trim(); if (!v && !s.optional) return toast(s.req || "Напиши хотя бы пару слов"); ans[s.k] = v; }
        if (s.type === "scale") { if (ans[s.k] == null) ans[s.k] = Number($("#sc").value); }
        if (s.type === "date") { const v = $("#dt").value; if (!v && !s.optional) return toast("Укажи дату"); if (v && !R.isKey(v)) return toast("Укажи дату"); if (v) ans[s.k] = v; else delete ans[s.k]; }
        if (s.validate) { const m = s.validate(ans); if (m) { $("#flag").innerHTML = `<div class="nudge">${esc(m)}</div>`; return; } }
        if (i >= visible().length - 1) { clearTimeout(timer); finish(); } else { i++; saveDraft(); render(); window.scrollTo(0, 0); }
      };
      $("#next").onclick = advance;
      const sk = $("#skipq"); if (sk) sk.onclick = () => { delete ans[s.k]; if (i >= visible().length - 1) { clearTimeout(timer); finish(); } else { i++; saveDraft(); render(); } };
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
    if (flowFlush) { flowFlush(); flowFlush = null; } app.dataset.flow = "";
    applyTheme();
    let [h, arg] = (location.hash || "#today").slice(1).split("/");
    const p = anyPattern();
    /* Новому человеку — вход (проблема → дата → число → сценарии → учитель → урок). Действующий сюжет или записи прошлой версии — сразу свой путь. */
    const ONB = ["start", "birth", "symbol", "cards", "teacher", "lesson", "new", "entry", "help", "about", "settings"];
    const needStart = !p && !D.meta.migratedFromV9 && !(P.seen.start && !P.onb);
    if (needStart && !ONB.includes(h)) h = (P.onb && P.onb.step && ONB.includes(P.onb.step)) ? P.onb.step : "start";
    if (needStart && ["start", "birth", "symbol", "cards", "teacher", "lesson"].includes(h)) { P.onb = P.onb || {}; if (P.onb.step !== h) { P.onb.step = h; saveProfile(true); } }
    const live = !!p || !!D.meta.migratedFromV9 || (P.seen.start && !P.onb);
    document.body.classList.toggle("live", live && !["start", "entry", "birth"].includes(h));
    hero.innerHTML = ""; $("#stagebar").innerHTML = "";
    nav.innerHTML = `<a class="pill sos" href="#help" aria-label="Сейчас тяжело">${ic("flame", "")}<span>Сейчас тяжело</span></a><a class="pill ${h === "settings" ? "on" : ""}" href="#settings" aria-label="Настройки">${ic("key", "")}</a>`;
    tabs.innerHTML = [["today", "Сегодня", phaseIc()], ["story", "Мой путь", "eye"], ["history", "История", "hourglass"]].map(([k, l, i]) => `<a href="#${k}" class="${h === k ? "on" : ""}">${ic(i, "")}${l}</a>`).join("");
    $("#testbar").innerHTML = P.devMode && P.offsetH ? `<div class="testbar">Тестовое время: ${R.human(today())}, ${R.fmtTime(nowTs())} (сдвиг ${P.offsetH > 0 ? "+" : ""}${P.offsetH} ч) — <a href="#settings">сбросить</a></div>` : "";
    const V = { start, birth, entry, new: newEpisode, cards, teacher, lesson, help, today: todayScreen, story, history, settings, morning, event, action, evening, module: moduleScreen, review, flag: flagScreen, about, symbol, detail, legacy, episode: episodeView };
    (V[h] || V.today)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  let lastKey = null, lastPhase = null;
  setInterval(() => { if (!P) return; if (today() !== lastKey || phase() !== lastPhase) { lastKey = today(); lastPhase = phase(); if (/^#?(today)?$/.test(location.hash)) route(); else applyTheme(); } }, 30e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && P && (today() !== lastKey || phase() !== lastPhase)) { lastKey = today(); lastPhase = phase(); route(); } });

  /* =================== ВХОД: число пути → знакомый сценарий → учитель → урок → новый ответ =================== */
  const OB = X.onboarding;
  const onb = () => { P.onb = P.onb || {}; return P.onb; };
  const pathOf = () => (P.symbolic && P.symbolic.num) ? X.paths[P.symbolic.chosen || P.symbolic.num] : null;
  /* Шаг 1. Узнавание проблемы. */
  function start() {
    document.body.classList.remove("live");
    app.innerHTML = `
      <h1>${esc(OB.problem.title)}</h1>
      <p>${esc(OB.problem.text)}</p>
      <p class="quote">${esc(OB.problem.hint)}</p>
      <div class="trail" style="height:120px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.3"></i></div>
      <div class="row"><button class="btn block" id="go">${esc(OB.problem.cta)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#help">Сейчас тяжело</a><a class="btn ghost" href="#about">Как это работает</a></div>
      <p class="tiny" style="margin-top:8px">Записи хранятся только на этом устройстве. Это не психологическая помощь и не диагностика.</p>`;
    $("#go").onclick = async () => { P.seen.start = true; onb().step = "birth"; await saveProfile(true); go("birth"); };
  }
  /* Шаг 2. Дата рождения — по желанию. Без даты путь тот же, только подборка общая. */
  function birth() {
    document.body.classList.remove("live");
    const S = P.symbolic || {};
    app.innerHTML = `<h1>${esc(OB.birth.title)}</h1><p>${esc(OB.birth.text)}</p>
      <label for="b">Дата рождения</label><input type="date" id="b" min="1920-01-01" max="${today()}" value="${esc(S.birth || "")}">
      <p class="tiny" style="margin:4px 0 10px">${esc(OB.birth.note)}</p>
      <div class="row"><button class="btn block" id="go">${esc(OB.birth.cta)}</button></div>
      <div class="row tight"><a class="btn ghost" href="#cards" id="skip">${esc(OB.birth.skip)}</a><a class="btn ghost" href="#help">Сейчас тяжело</a></div>`;
    $("#go").onclick = async () => {
      const v = $("#b").value; const r = R.calcNum(v); if (!r || !R.isKey(v)) return toast("Укажи дату");
      P.symbolic = Object.assign({}, S, { birth: v, num: r.num, chosen: S.birth === v ? S.chosen : null }); onb().step = "symbol"; onb().deck = null; await saveProfile(true); go("symbol");
    };
    $("#skip").onclick = async e => { e.preventDefault(); onb().step = "cards"; onb().deck = null; await saveProfile(true); go("cards"); };
  }
  function entry() {
    document.body.classList.remove("live");
    app.innerHTML = `<h1>С чем начнём?</h1><p class="muted">Один вопрос за раз. Можно уйти в любой момент — всё сохранится.</p>
      <div class="chips col">
        <a class="btn block" href="#cards">Узнать свои сюжеты</a>
        <a class="btn block secondary" href="#new">${esc(C.entryCopy.choices[0])}</a>
        <a class="btn block sos" href="#help">${esc(C.entryCopy.choices[2])}</a>
      </div>
      ${anyPattern() ? `<div class="row tight"><a class="btn ghost" href="#today">На главную</a></div>` : ""}`;
  }
  const EMOTIONS = C.emotions.primary;
  /* Эпизод и первый план. Создаёт сюжет, если его нет. */
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
          p = { id: R.uuid(), title: shortTitle(ans.event, fromCard), packId: fromCard ? fromCard.packId : null, contexts: val(ans, "who") ? [val(ans, "who")] : [], status: "active", startDate: k, createdAt: ts, hypothesisVersionId: null, experimentId: null, queue: [], firstPlan: plan, skillId: plan.skill || null, habitualResponse: val(ans, "response") || null, legacy: false };
          const x = { id: R.uuid(), patternId: p.id, hypothesisVersionId: null, version: 1, permission: "", prediction: "", action: plan.text, skillId: plan.skill || null, ifThen: { signal: plan.signal, action: plan.action }, criterion: "", status: "active", results: [], createdAt: ts, kind: "first-plan" };
          p.experimentId = x.id; await saveExp(x); await savePattern(p);
          const r = { patternId: p.id, modules: { episode: { status: "done", dateKey: k, doneAt: ts, answers: { response: val(ans, "response") } } } }; await saveResearch(r);
        } else if (p.status === "observe") { p.status = "active"; p.startDate = p.startDate || k; if (!p.habitualResponse && val(ans, "response")) p.habitualResponse = val(ans, "response"); await savePattern(p); const r = researchOf(p); r.modules.episode = r.modules.episode || { status: "done", dateKey: k, doneAt: ts }; await saveResearch(r); }
        const fromId = P.drafts && P.drafts.fromEpisode, prev = fromId ? D.episodes.find(x => x.id === fromId) : null;
        const e = prev || { id: R.uuid(), occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), isRehearsal: false, legacy: false };
        Object.assign(e, { patternId: p.id, linkStatus: "confirmed", event: ans.event, person: val(ans, "who") || e.person || "", emotion: val(ans, "emotion") || e.emotion || null, intensity: ans.intensity, response: val(ans, "response") || null, verificationStatus: "detailed" });
        if (prev && prev.dateKey && R.diffDays(prev.dateKey, p.startDate) > 0) { p.startDate = prev.dateKey; await savePattern(p); }
        await saveEpisode(e);
        if (P.drafts) { delete P.drafts.cardPick; delete P.drafts.fromEpisode; }
        P.onb = null; P.seen.start = true; P.lastResult = { kind: "first", title: p.title, plan: planText(p) }; await saveProfile();
        go("today");
      } });
  }
  function shortTitle(event, card) {
    const src = card ? card.text : String(event || "").trim();
    let t = src.split(/[,.;:!?]|\s[—–-]\s|\sи\s|\sа\s|\sно\s/)[0].trim();
    const w = t.split(/\s+/); if (w.length > 6) t = w.slice(0, 6).join(" ");
    if (t.length > 44) t = t.slice(0, 42).trim() + "…";
    return uc1(t) || "Мой сюжет";
  }

  /* Шаг 4. Знакомый сценарий: карточки «ситуация → привычная реакция → знакомый результат». Узнавание, не тест и не диагноз. */
  const CI = C.cardInteraction, OC = OB.cards;
  function newDeck(S) {
    const path = pathOf(), seed = (P.installId || "").charCodeAt(0) || 0;
    const shown = (S.shown || []);
    let deck = R.buildDeck({ packs: C.packs, pathPacks: path ? path.packs : null, pathCards: CI.pathCards, otherCards: CI.otherCards, seed, exclude: shown });
    if (!deck.length) { S.shown = []; deck = R.buildDeck({ packs: C.packs, pathPacks: path ? path.packs : null, pathCards: CI.pathCards, otherCards: CI.otherCards, seed }); }
    S.deck = deck; S.idx = 0; S.picks = S.picks || []; S.undo = null; S.choose = false; S.shown = [...shown, ...deck.map(c => c.id)];
  }
  function cards() {
    const S = onb(); if (!S.deck) newDeck(S);
    const deck = S.deck; let busy = false;
    const persist = () => saveProfile(true);
    const render = () => {
      if (S.choose) return choose();
      if (S.idx >= deck.length) return R.deckYes(S).length ? choose() : nothingFits();
      const c = deck[S.idx], yes = R.deckYes(S), tut = !P.seen.swipe, red = reduce();
      app.innerHTML = `<p class="tiny" style="margin:0 0 4px">Карточка ${S.idx + 1} из ${deck.length}${pathOf() ? ` · ${esc(pathOf().name)}` : ""}</p>
        <h1 class="q">${esc(tut ? OC.tutorialTitle : OC.title)}</h1><p class="muted small" style="margin:0 0 6px">${tut ? `${esc(OC.tutorial[0])} ${esc(OC.tutorial[1])}` : esc(OC.sub)}</p>
        <div class="swwrap"><div class="swcard ${tut && !red ? "demo" : ""}" id="swc" tabindex="0" role="group" aria-label="${esc(c.text)}"><div class="pk">${esc(c.packTitle)}</div>${esc(c.text)}<span class="swlab l" id="labL" aria-hidden="true">${esc(OC.no)}</span><span class="swlab r" id="labR" aria-hidden="true">${esc(OC.yes)}</span></div></div>
        <div class="swhint"><span>${esc(OC.hintLeft)}</span><span>${esc(OC.hintRight)}</span></div>
        <div class="sw2"><button class="btn secondary" id="no">${esc(OC.no)}</button><button class="btn" id="yes">${esc(OC.yes)}</button></div>
        <div class="row tight"><button class="btn ghost sm" id="unsure">${esc(OC.unsure)}</button>${S.undo ? `<button class="btn ghost sm" id="undo">${esc(OC.undo)}</button>` : ""}</div>
        ${yes.length >= CI.offerSelectionAfterPositiveCards ? `<div class="row tight"><button class="btn secondary block sm" id="pick">Выбрать сюжет из отмеченных (${yes.length})</button></div>` : ""}
        <div class="row tight"><a class="btn ghost sm" href="#new">${esc(OC.own)}</a></div>`;
      const sw = $("#swc"), labL = $("#labL"), labR = $("#labR");
      /* Один обработчик для свайпа, кнопок и клавиатуры: один ввод — один ответ; во время анимации ввод заблокирован. */
      const answer = (r) => {
        if (busy) return; busy = true;
        if (!R.deckAnswer(S, r)) { busy = false; return; }
        if (tut) P.seen.swipe = true;
        sw.classList.remove("demo"); sw.style.transform = ""; sw.classList.add(r === "yes" ? "out-r" : r === "no" ? "out-l" : "out-d");
        persist(); setTimeout(() => { busy = false; render(); }, red ? 0 : 220);
      };
      $("#yes").onclick = () => answer("yes"); $("#no").onclick = () => answer("no"); $("#unsure").onclick = () => answer("unsure");
      const un = $("#undo"); if (un) un.onclick = () => { if (busy) return; if (R.deckUndo(S)) { persist(); render(); } };
      const pk = $("#pick"); if (pk) pk.onclick = () => { S.choose = true; persist(); choose(); };
      sw.onkeydown = e => { if (e.key === "ArrowRight") { e.preventDefault(); answer("yes"); } if (e.key === "ArrowLeft") { e.preventDefault(); answer("no"); } if (e.key === "ArrowDown") { e.preventDefault(); answer("unsure"); } };
      /* Перетаскивание: pointer events для пальца и мыши; вертикальное движение отдаётся прокрутке и ответом не считается. */
      let sx = null, sy = null, mode = null, dx = 0;
      const reset = () => { sw.style.transform = ""; sw.classList.remove("drag"); labL.style.opacity = 0; labR.style.opacity = 0; sx = sy = null; mode = null; dx = 0; };
      sw.onpointerdown = e => { if (busy || e.button) return; sx = e.clientX; sy = e.clientY; mode = null; dx = 0; try { sw.setPointerCapture(e.pointerId); } catch (_) {} };
      sw.onpointermove = e => {
        if (sx == null) return; dx = e.clientX - sx; const dy = e.clientY - sy;
        if (!mode) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { mode = "v"; reset(); return; } if (Math.abs(dx) > 10) { mode = "h"; sw.classList.add("drag"); } else return; }
        if (mode !== "h") return;
        e.preventDefault(); sw.style.transform = red ? `translateX(${dx}px)` : `translateX(${dx}px) rotate(${dx / 30}deg)`;
        const k = Math.min(1, Math.abs(dx) / 70); labR.style.opacity = dx > 0 ? k : 0; labL.style.opacity = dx < 0 ? k : 0;
      };
      const up = e => { if (sx == null) return; const d = dx, m = mode; reset(); try { sw.releasePointerCapture(e.pointerId); } catch (_) {} if (m === "h") { if (d > 70) answer("yes"); else if (d < -70) answer("no"); } };
      sw.onpointerup = up; sw.onpointercancel = () => reset(); sw.onlostpointercapture = () => { if (mode !== "h") reset(); };
    };
    /* Ничего не подошло: без тупика и без вывода о человеке. */
    const nothingFits = () => {
      app.innerHTML = `<h1 class="q">Не узнал ни одного</h1><p>${esc(OC.none)}</p>
        <div class="chips col"><button class="btn block" id="more">${esc(OC.more)}</button><a class="btn block secondary" href="#new">${esc(OC.own)}</a><button class="btn block secondary" id="observe">${esc(OC.observe)}</button></div>
        <div class="row tight"><button class="btn ghost sm" id="undo">${esc(OC.undo)}</button></div>`;
      $("#more").onclick = () => { newDeck(S); persist(); render(); };
      $("#observe").onclick = () => observeMode();
      $("#undo").onclick = () => { if (R.deckUndo(S)) { persist(); render(); } };
    };
    const choose = () => {
      const ys = R.deckYes(S);
      if (!ys.length) { S.choose = false; return nothingFits(); }
      app.innerHTML = `<h1 class="q">Какой сюжет разберём первым?</h1><p class="muted small">Остальные никуда не денутся — к ним можно вернуться.</p>
        <div class="chips col">${ys.map((x, i) => `<button class="chip" data-i="${i}">${esc(x.text)}</button>`).join("")}</div>
        <div class="row tight">${S.idx < deck.length ? `<button class="btn ghost sm" id="back">Досмотреть карточки</button>` : `<button class="btn ghost sm" id="more">${esc(OC.more)}</button>`}<a class="btn ghost sm" href="#new">${esc(OC.own)}</a></div>`;
      $$(".chip[data-i]").forEach(b => b.onclick = () => recognized(ys[Number(b.dataset.i)]));
      const bk = $("#back"); if (bk) bk.onclick = () => { S.choose = false; persist(); render(); };
      const m = $("#more"); if (m) m.onclick = () => { newDeck(S); persist(); render(); };
    };
    /* Краткое резюме: узнавание, не доказанная причина. */
    const recognized = (card) => {
      const pk = C.packs.find(x => x.id === card.packId);
      app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(pk ? pk.title : "")}</p><h1 class="q">${esc(OC.recognized)}</h1>
        <div class="card mark"><p class="quote" style="margin:0">${esc(card.recognition || card.text)}</p></div>
        <div class="row"><button class="btn block" id="ok">${esc(OC.confirm)}</button></div>
        <div class="row tight"><button class="btn ghost" id="refine">${esc(OC.refine)}</button><button class="btn ghost" id="other">${esc(OC.another)}</button></div>`;
      const pick = async (confirmed, ownText) => { S.pick = { cardId: card.id, packId: card.packId, text: card.text, recognition: card.recognition || card.text, own: ownText || "", confirmed, version: C.contentVersion }; S.step = "teacher"; dropDraft("onb-teacher", "onb"); await saveProfile(true); go("teacher"); };
      $("#ok").onclick = () => pick("yes");
      $("#other").onclick = () => { S.choose = true; persist(); choose(); };
      $("#refine").onclick = () => {
        app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(card.recognition || card.text)}</p><h1 class="q">Как это звучит твоими словами?</h1><p class="muted small">Что повторяется: ситуация, твоя реакция, знакомый результат.</p>
          <textarea id="a" placeholder="Например: соглашаюсь, чтобы не спорить, потом злюсь на себя">${esc((S.pick && S.pick.own) || "")}</textarea>
          <div class="row"><button class="btn block" id="ok2">Дальше</button></div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
        $("#ok2").onclick = () => { const v = $("#a").value.trim(); if (!v) return toast("Напиши пару слов"); pick("refine", v); };
        $("#bk").onclick = () => recognized(card);
      };
    };
    render();
  }
  /* Режим наблюдения: сюжет без назначенного урока и без выдуманной даты старта. */
  async function observeMode(card) {
    const p = activePattern();
    if (!p) { const np = { id: R.uuid(), title: card ? card.text : "Наблюдаю", packId: card ? card.packId : null, contexts: [], status: "observe", startDate: null, createdAt: nowTs(), hypothesisVersionId: null, experimentId: null, queue: [], legacy: false }; await savePattern(np); }
    P.onb = null; P.seen.start = true; P.lastResult = { kind: "observe" }; await saveProfile(); go("today");
  }

  /* Шаг 5. Распознать учителя: кто, что повторяется, когда в последний раз. Один учитель; без реального случая — наблюдение. */
  function teacher() {
    const S = onb(); if (!S.pick) return go("cards");
    const pk = C.packs.find(x => x.id === S.pick.packId);
    const steps = [
      { k: "who", q: OB.teacher.title, lead: OB.teacher.text, type: "choice", opts: X.teachers, own: true, ownPh: "Кто это, своими словами (имя не нужно)" },
      { k: "what", q: OB.teacher.what, lead: a => `Сюжет: «${S.pick.own || S.pick.recognition}»`, type: "choice", opts: (pk ? pk.teacherExamples : []), own: true, ownPh: "Что происходит снова и снова" },
      { k: "when", q: OB.teacher.when, type: "choice", opts: X.lastTime },
      { k: "date", q: "Когда именно?", lead: a => a.when === "week" ? "Любой день этой недели." : "Если помнишь дату — укажи, если нет — пропусти.", type: "date", optional: true, def: a => a.when === "week" ? today() : "", min: a => a.when === "week" ? R.addDays(today(), -6) : "1990-01-01", max: () => today(), skip: a => a.when !== "week" && a.when !== "earlier" },
    ];
    flow({ id: "onb-teacher", scope: "onb", steps, title: "Учитель", cancelLabel: "Назад к сценариям", onCancel: () => { S.choose = true; saveProfile(true); go("cards"); },
      onDone: async ans => {
        const kind = ans.who === "__own" ? "other" : ans.who; const label = ans.who === "__own" ? ans.who_own : (X.teacherLabels[kind] || "");
        S.teacher = { kind, label, ownName: ans.who === "__own" ? ans.who_own : "", what: val(ans, "what") || "", when: ans.when, date: ans.date || null };
        S.lesson = null; S.rejected = []; S.step = "lesson"; await saveProfile(true); go("lesson");
      } });
  }
  function lessonsFor(S) {
    const pk = C.packs.find(x => x.id === (S.pick && S.pick.packId)); return pk ? pk.lessons : [];
  }
  /* Шаг 6. Предварительный урок и первый шаг. Урок уточняется позже без потери записей. */
  function lesson() {
    const S = onb(); if (!S.pick || !S.teacher) return go(S.pick ? "teacher" : "cards");
    const all = lessonsFor(S), rejected = S.rejected || [];
    const L = S.lesson || all.find(l => !rejected.includes(l.id)) || X.lessonUnknown;
    const tl = S.teacher.ownName ? S.teacher.ownName : S.teacher.label;
    if (S.pickAlt) {
      const alts = all.filter(l => !rejected.includes(l.id));
      app.innerHTML = `<h1 class="q">${esc(OB.lesson.alt)}</h1><p class="muted small">Учитель и сценарий сохранены. Урок предварительный — его можно уточнить позже.</p>
        <div class="chips col">${alts.map(l => `<button class="chip" data-l="${l.id}">${esc(uc1(l.title))}</button>`).join("")}<button class="chip dim" data-l="__unknown">${esc(OB.lesson.unknown)}</button></div>
        <div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
      $$("[data-l]").forEach(b => b.onclick = async () => { const id = b.dataset.l; S.lesson = id === "__unknown" ? X.lessonUnknown : all.find(l => l.id === id); S.pickAlt = false; await saveProfile(true); lesson(); });
      $("#bk").onclick = async () => { S.pickAlt = false; await saveProfile(true); lesson(); };
      return;
    }
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(S.pick.own || S.pick.recognition)}</p>
      <div class="card mark">
        <p style="margin:0 0 6px"><b>${esc(OB.lesson.teacherLead)} ${esc(tl)}.</b></p>
        <p style="margin:0 0 10px"><b>${esc(OB.lesson.lessonLead)} ${esc(L.title)}.</b></p>
        <p class="small" style="margin:0 0 4px"><b>${esc(OB.lesson.inner)}</b> ${esc(lc1(L.inner))}.</p>
        <p class="small" style="margin:0 0 8px"><b>${esc(OB.lesson.action)}</b> ${esc(lc1(L.action))}.</p>
        <p class="small muted" style="margin:0">${esc(OB.lesson.text)}</p>
      </div>
      <div class="row"><button class="btn block" id="go">${esc(OB.lesson.start)}</button></div>
      <div class="row tight"><button class="btn ghost" id="rej">${esc(OB.lesson.reject)}</button><a class="btn ghost" href="#teacher">Назад</a></div>`;
    $("#rej").onclick = async () => { if (L.id !== X.lessonUnknown.id && !rejected.includes(L.id)) rejected.push(L.id); S.rejected = rejected; S.lesson = null; S.pickAlt = true; await saveProfile(true); lesson(); };
    $("#go").onclick = () => startLesson(S, L);
  }
  /* Создание сюжета из входа: сценарий, учитель, урок, первый план с навыком, разрешение с происхождением «lesson». */
  async function startLesson(S, L) {
    const ts = nowTs(), k = today(), pk = C.packs.find(x => x.id === S.pick.packId), T = S.teacher;
    const hasCase = T.when && T.when !== "none" && !(T.when === "earlier" && !T.date);
    const caseDate = T.when === "today" ? k : (T.date && R.isKey(T.date) ? T.date : k);
    const startDate = hasCase ? (R.diffDays(caseDate, k) <= 6 ? caseDate : k) : null;
    const tl = T.ownName || T.label;
    const p = { id: R.uuid(), title: pk ? pk.title : shortTitle(S.pick.text), packId: S.pick.packId, contexts: tl ? [tl] : [], status: hasCase ? "active" : "observe", startDate, createdAt: ts, hypothesisVersionId: null, experimentId: null, queue: [], legacy: false,
      scenario: { cardId: S.pick.cardId, text: S.pick.text, recognition: S.pick.recognition, own: S.pick.own || "", confirmed: S.pick.confirmed, version: S.pick.version },
      teacher: { kind: T.kind, label: tl, what: T.what || "" },
      lesson: { id: L.id, title: L.title, inner: L.inner, action: L.action, skillId: L.skillId, hypothesisId: L.hypothesisId || null, signal: L.signal, status: "preliminary", chosenAt: ts, rejected: S.rejected || [] },
      firstPlan: { id: L.id, text: uc1(L.action), skill: L.skillId, signal: L.signal, action: L.action }, skillId: L.skillId, habitualResponse: null, permission: L.inner, permissionSource: { origin: "lesson", hypothesisVersionId: null } };
    const x = { id: R.uuid(), patternId: p.id, hypothesisVersionId: null, version: 1, permission: L.inner, prediction: "", action: uc1(L.action), skillId: L.skillId, ifThen: { signal: L.signal, action: L.action }, criterion: "", status: "active", results: [], createdAt: ts, kind: "first-plan", lessonId: L.id };
    p.experimentId = x.id; await saveExp(x); await savePattern(p);
    if (hasCase) {
      const e = { id: R.uuid(), patternId: p.id, linkStatus: "confirmed", occurredAt: ts, loggedAt: ts, dateKey: caseDate, tz: R.tz(), event: T.what || S.pick.text, person: tl, emotion: null, intensity: null, response: null, verificationStatus: "onboarding", isRehearsal: false, legacy: false };
      await saveEpisode(e);
      await saveResearch({ patternId: p.id, modules: { episode: { status: "done", dateKey: k, doneAt: ts, answers: { source: "onboarding", episodeId: e.id } } } });
    }
    P.onb = null; P.seen.start = true; P.lastResult = { kind: "lesson", title: L.title, plan: uc1(L.action), observe: !hasCase };
    dropDraft("onb-teacher", "onb"); await saveProfile(); go("today");
  }

  /* =================== СЕГОДНЯ =================== */
  function todayScreen() {
    const p = anyPattern(), k = today(), ph = phase(), c = checkin(k, p);
    const title = p ? (p.status === "observe" ? "Наблюдаю" : p.title) : "Начало";
    let sub = "";
    if (p && p.startDate) { const d = R.daysSince(p.startDate, k) + 1, w = R.weekIndex(p.startDate, k) + 1; const h = hypOf(p); const elig = eligibility(p); sub = `день ${d} · неделя ${w} · ${R.workPhase({ hypothesis: h, experiment: expOf(p), confirmedActionDays: R.confirmedActionDays({ episodes: D.episodes, checkins: D.checkins, patternId: p.id, skillId: skillOfPattern(p) }).size, eligible: elig.eligible })}`; }
    else if (p) sub = "режим наблюдения";
    hero.innerHTML = `<div class="hero"><div class="hl">${ic(phaseIc(), "")}${R.fmtTime(nowTs())} · ${PHASE_TXT[ph]}</div><div class="hd">${esc(title)}</div>${sub ? `<div class="hs">${esc(sub)}</div>` : ""}</div>`;
    let main = "", extra = "";
    const res = P.lastResult;
    if (res) { if (res.kind === "first") extra += `<div class="card mark"><div class="k">${ic("star")}Сегодня исследуем</div><p style="margin:2px 0 4px"><b>${esc(res.title)}</b></p><p class="small" style="margin:0">Первый шаг: ${esc(lc1(res.plan))}. Причину пока не назначаем — будем уточнять по одному вопросу в день.</p></div>`; if (res.kind === "lesson") extra += `<div class="card mark"><div class="k">${ic("star")}Урок начат</div><p style="margin:2px 0 4px"><b>${esc(uc1(res.title))}</b></p><p class="small" style="margin:0">${res.observe ? "Реального случая пока нет: запиши ближайший — с него начнётся неделя." : `Первый шаг: ${esc(lc1(res.plan))}.`} Урок предварительный — уточним его по одному вопросу в день.</p></div>`; if (res.kind === "observe") extra += `<div class="card mark"><div class="k">${ic("eye")}Наблюдение</div><p class="small" style="margin:2px 0 0">${esc(C.entryCopy.emptyMatch)} Когда случится ближайший случай, нажми «${esc(OB.home.event)}».</p></div>`; delete P.lastResult; saveProfile(); }
    /* Возвращение после пропуска: продолжаем с того места, ничего не заполняем задним числом. */
    const lastAct = [...Object.values(D.checkins).filter(c => !c.legacy && (c.evening || c.morning)).map(c => c.dateKey), ...D.episodes.filter(e => !e.legacy && e.dateKey).map(e => e.dateKey)].sort().pop();
    if (p && lastAct && R.diffDays(lastAct, k) >= 2 && P.backSeen !== k) { extra = `<div class="card tight"><p class="small" style="margin:0">${esc(OB.home.back)} Пропущенные дни остаются пропущенными — это не обнуляет путь.</p></div>` + extra; P.backSeen = k; saveProfile(true); }
    if (D.meta.migratedFromV9 && !P.legacyDecision) extra += legacyCard();
    if (p && p.status === "paused") {
      main = `<div class="card"><div class="k">${ic("hourglass")}Сюжет на паузе</div><p class="small" style="margin:2px 0 8px">«${esc(p.title)}». Записи и помощь доступны. Вернуться можно в любой момент.</p><div class="row tight"><a class="btn block secondary" href="#story">Открыть сюжет</a></div></div>`;
    } else if (!p || p.status === "observe") {
      main = `<div class="card mark"><div class="k">${ic("eye")}Следующий шаг</div><p style="margin:2px 0 8px">${p ? (p.lesson ? `Пока наблюдаем. Когда случится реальный случай с учителем — запиши его: с этого дня начнётся неделя. Шаг уже есть: ${esc(lc1(planText(p)))}.` : "Запиши ближайший реальный случай — с него начнётся неделя.") : "Начни с одного случая или посмотри карточки."}</p><div class="row tight">${p ? `<a class="btn block" href="#new">Записать случай</a>` : `<a class="btn block" href="#start">Начать</a>`}</div></div>`;
    } else {
      const elig = eligibility(p), due = R.reviewDue(p.startDate, k, D.reviews.filter(r => r.patternId === p.id));
      const cy = checkinOf(yesterday(), p);
      const yOpen = R.eveningCloseable(yesterday(), k) && cy && !cy.evening && (p.startDate && R.diffDays(p.startDate, yesterday()) >= 0);
      const yAny = p.startDate && R.diffDays(p.startDate, yesterday()) >= 0 && !(cy && cy.evening);
      if (elig.eligible && !hasFlag(p)) main = `<div class="card mark"><div class="k">${ic("flag")}Проверка навыка</div><p style="margin:2px 0 8px">Две недели подряд записи показывают устойчивый ответ. Проверим вместе, что это выбранный навык, а не терпение.</p><a class="btn block" href="#flag">Проверить</a></div>`;
      else if (due && (R.diffDays(due.end, k) > 0 || ph === "evening" || c.evening)) main = `<div class="card mark"><div class="k">${ic("hourglass")}Итог недели</div><p style="margin:2px 0 8px">Неделя ${due.idx + 1} закончилась ${esc(R.human(due.end))}. Посмотрим, что было, и решим, что дальше.</p><a class="btn block" href="#review">Подвести итог</a></div>`;
      else if (ph === "night") main = yAny ? `<div class="card mark"><div class="k">${ic("moon")}Вчерашний вечер</div><p style="margin:2px 0 8px">Итог за ${esc(R.human(yesterday()))} ещё открыт. Полминуты.</p><a class="btn block" href="#evening/${yesterday()}">Закрыть вчерашний вечер</a></div>` : `<div class="card"><div class="k">${ic("moon")}Ночь</div><p style="margin:2px 0 0" class="small">Утром здесь появится твой шаг. Если заденет ночью — кнопки ниже работают всегда.</p></div>`;
      else if (ph !== "evening" && !c.morning) main = `<div class="card mark"><div class="k">${ic("sunrise")}Шаг на день</div><p class="quote" style="margin:2px 0 6px">${esc(planText(p))}</p>${ifThen(p) ? `<p class="small" style="margin:0 0 8px">${esc(ifThen(p))}</p>` : ""}<a class="btn block" href="#morning">Взять с собой · полминуты</a></div>`;
      else if (ph === "evening" && !c.evening) main = `<div class="card mark"><div class="k">${ic("moon")}Вечерний итог</div><p style="margin:2px 0 8px">Был ли повод, что получилось, как сейчас. Около минуты.</p><a class="btn block" href="#evening">Подвести итог дня</a></div>`;
      else if (c.evening) main = `<div class="card"><div class="k">${ic("moon")}День закрыт · ${R.fmtTime(c.evening.at)}</div><p class="small" style="margin:2px 0 0">${c.evening.hadOpportunity === "yes" ? "Был повод потренироваться." : c.evening.hadOpportunity === "no" ? "Повода не было — это тоже запись." : "Повод не уверен — так и записано."} Завтра утром — тот же шаг.</p></div>`;
      else main = `<div class="card mark"><div class="k">${ic("star")}Твой шаг сегодня</div><p class="quote" style="margin:2px 0 6px">${esc(planText(p))}</p>${ifThen(p) ? `<p class="small" style="margin:0">${esc(ifThen(p))}</p>` : ""}<p class="tiny" style="margin:6px 0 0">Вечерний итог откроется после ${P.times.eveningStart}:00. ${yOpen ? `<a href="#evening/${yesterday()}">Закрыть вчерашний вечер</a>` : ""}</p></div>`;
      if (due && !/Итог недели/.test(main)) extra += `<div class="card tight"><p class="small" style="margin:0">Сегодня седьмой день недели. Итог откроется вечером, после короткого итога дня.</p></div>`;
      if (yAny && ph !== "night" && !/вчерашний/.test(main)) extra += `<div class="card tight"><p class="small" style="margin:0">Вечер за ${esc(R.human(yesterday()))} не закрыт. <a href="#evening/${yesterday()}">Закрыть сейчас</a> — можно до конца сегодняшнего дня.</p></div>`;
      const q = D.episodes.filter(e => e.linkStatus === "unconfirmed" && !e.legacy);
      if (q.length) extra += `<div class="card tight"><p class="small" style="margin:0">${q.length} ${R.plural(q.length, "запись ждёт", "записи ждут", "записей ждут")} уточнения: тот же сюжет или другой? <a href="#story">В «Мой сюжет»</a></p></div>`;
    }
    /* Смысл на сейчас: учитель, урок; шаг — если его не показывает основная карточка. */
    const pathCard = p && p.lesson ? `<div class="card"><div class="k">${ic("eye")}${esc(OB.home.title)}</div><div class="plines"><div><span>${esc(OB.home.teacher)}:</span> ${esc(p.teacher ? p.teacher.label : (p.contexts || []).join(", ") || "—")}</div><div><span>${esc(OB.home.lesson)}:</span> ${esc(p.lesson.title)}</div>${/class="quote"/.test(main) ? "" : `<div><span>${esc(OB.home.step)}:</span> ${esc(lc1(planText(p)))}</div>`}</div></div>` : "";
    app.innerHTML = `${trailHTML(p)}${pathCard}${main}
      <div class="taps"><a class="tap" href="#event">${ic("flame", "")}<span>${esc(p && p.lesson ? OB.home.event : "Зацепило")}</span></a><a class="tap" href="#action">${ic("stone", "")}<span>${esc(p && p.lesson ? OB.home.action : "Сделал по-новому")}</span></a></div>
      ${extra}`;
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
  function morning() {
    const p = activePattern(); if (!p || p.status !== "active") return go("today");
    const k = today(), c = checkin(k, p), x = expOf(p);
    if (c.morning) { app.innerHTML = `<h1>Шаг уже с тобой</h1><p class="quote">${esc(planText(p))}</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">Утро · ${esc(R.human(k))}</p><h1 class="q">Сегодня даю себе право…</h1>
      <div class="card mark"><p class="quote" style="margin:0 0 6px">${esc(permissionText(p) || "замечать момент и выбирать ответ")}</p>${ifThen(p) ? `<p style="margin:0"><b>${esc(ifThen(p))}</b></p>` : `<p style="margin:0"><b>${esc(planText(p))}</b></p>`}</div>
      <label for="sc">Как сейчас? <span class="muted small">необязательно</span></label>
      <div class="range-val" id="scv">—</div><input type="range" id="sc" min="0" max="10" step="1" value="3" aria-label="Как сейчас, 0–10"><div class="range-hint"><span>0, спокойно</span><span>10, очень тяжело</span></div>
      <div class="row"><button class="btn block" id="take">Возьму с собой</button></div>
      <div class="row tight"><button class="btn ghost" id="simpl">Упростить шаг</button><a class="btn ghost" href="#today">Позже</a></div>`;
    let rated = null; const sc = $("#sc"); sc.oninput = () => { rated = Number(sc.value); $("#scv").textContent = sc.value; };
    const finish = async () => { c.morning = { at: nowTs(), intensity: rated, tz: R.tz() }; c.patternId = p.id; await saveCheckin(c); go("today"); };
    $("#take").onclick = finish;
    $("#simpl").onclick = () => {
      app.innerHTML = `<h1 class="q">Какой шаг поменьше?</h1><p class="muted small">Сегодняшний: «${esc(planText(p))}». Меньший шаг — тоже шаг.</p>
        <div class="chips" id="tg">${["Только заметить момент и выдохнуть", "Сказать одну фразу вместо разговора", "Отложить ответ на час", "Сделать половину от задуманного"].map(t => `<button class="chip" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>
        <textarea id="a" placeholder="Своими словами"></textarea><div class="row"><button class="btn block" id="ok">Беру этот шаг</button></div><div class="row tight"><button class="btn ghost" id="back">Назад</button></div>`;
      $$("#tg .chip").forEach(b => b.onclick = () => { $("#a").value = b.dataset.v; });
      $("#ok").onclick = async () => { const v = $("#a").value.trim(); if (!v) return toast("Напиши шаг"); await newExperimentVersion(p, { action: v, reason: "simplified" }); await finish(); };
      $("#back").onclick = morning;
    };
  }
  async function newExperimentVersion(p, patch) {
    const old = expOf(p); if (old) { old.status = "replaced"; await saveExp(old); }
    const x = Object.assign({ id: R.uuid(), patternId: p.id, hypothesisVersionId: p.hypothesisVersionId, version: (old ? old.version : 0) + 1, permission: old ? old.permission : "", prediction: old ? old.prediction : "", action: old ? old.action : "", skillId: old ? old.skillId : p.skillId, ifThen: old ? old.ifThen : null, criterion: old ? old.criterion : "", status: "active", results: [], createdAt: nowTs(), kind: "experiment" }, patch);
    if (x.ifThen && patch.action && !patch.ifThen) x.ifThen = { signal: x.ifThen.signal, action: patch.action };
    await saveExp(x); p.experimentId = x.id; if (x.skillId) p.skillId = x.skillId; await savePattern(p); return x;
  }

  /* =================== ЗАЦЕПИЛО =================== */
  function event() {
    const p = activePattern(), k = today();
    const steps = [
      ...(p && p.status === "active" ? [{ k: "relation", q: "Это тот же сюжет?", lead: p.teacher ? `Сейчас в работе: «${p.scenario && (p.scenario.own || p.scenario.recognition) ? (p.scenario.own || p.scenario.recognition) : p.title}». Учитель: ${p.teacher.label}.` : `Сейчас в работе: «${p.title}».`, type: "choice", opts: X.relations }] : []),
      { k: "emotion", q: "Что чувствуешь?", lead: C.emotions.instruction, type: "choice", opts: EMOTIONS.filter(e => e !== "Другое" && e !== "Не знаю"), own: true, unknown: true },
      { k: "intensity", q: C.daily.eventIntensityScale.label, type: "scale", lo: "0, совсем нет", hi: "10, очень", def: 5 },
    ];
    flow({ id: "event", scope: p ? p.id : null, steps, title: "Зацепило", onCancel: () => go("today"),
      onDone: async ans => {
        const ts = nowTs(); const rel = ans.relation || (p ? "unknown" : "none");
        const link = !p ? "none" : rel === "same" ? "confirmed" : rel === "other" ? "queued" : "unconfirmed";
        const e = { id: R.uuid(), patternId: p && link !== "queued" ? p.id : null, linkStatus: link, relation: rel, occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), event: "", emotion: val(ans, "emotion") || null, intensity: ans.intensity, verificationStatus: "quick", isRehearsal: false, legacy: false };
        if (p && p.status === "observe") { e.patternId = p.id; e.linkStatus = "confirmed"; }
        const ok = await saveEpisode(e);
        afterEvent(e, ok);
      } });
  }
  function afterEvent(e, ok) {
    const high = e.intensity >= 7, p = activePattern();
    app.innerHTML = `<h1>${ok ? "Записано" : "Записано на экране"}</h1><p class="muted">${esc(e.emotion || "Чувство")} · ${e.intensity} из 10${!ok ? " · сохранить не удалось, см. сообщение сверху" : ""}</p>
      ${high ? `<div class="nudge">Задело сильно. Можно сначала помочь себе, а разбирать позже.</div>` : ""}
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
  function episodeView(id) {
    const e = D.episodes.find(x => x.id === id); if (!e) return go("history");
    const p = D.patterns.find(x => x.id === e.patternId);
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(R.human(e.dateKey))} · ${R.fmtTime(e.loggedAt)}${e.legacy ? ' · <span class="badge legacy">прошлая версия</span>' : ""}${e.isRehearsal ? ' · <span class="badge">репетиция</span>' : ""}</p>
      <h1 class="q">${esc(e.event || "Случай без описания")}</h1>
      <div class="card">${[["Сюжет", p ? p.title : e.linkStatus === "queued" ? "в очереди" : "не привязан"], ["Чувство", e.emotion], ["Сила", e.intensity != null ? e.intensity + " из 10" : null], ["Первая мысль", e.thought], ["Тело", e.body ? [...(e.body.locations || []), e.body.sensation].filter(Boolean).join(", ") : null], ["Что сделал", e.response], ["Новый ответ", e.newResponse ? actionLabel(e.newResponse) : null]].filter(x => x[1]).map(([k, v]) => `<div class="prow"><div class="k">${k}</div>${esc(v)}</div>`).join("")}</div>
      <div class="row tight">${!e.legacy ? `<a class="btn secondary" href="#detail/${e.id}">Дополнить</a>` : ""}<a class="btn ghost" href="#history">Назад</a></div>`;
  }
  const actionLabel = nr => { const t = (X.actionTypes.find(a => a.id === nr.type) || {}).label || nr.type; return `${t}${nr.type === "pause" ? (nr.chosen === "chosen" ? " (выбранная)" : nr.chosen === "scared" ? " (было страшно сказать)" : "") : ""}${nr.note ? ": " + nr.note : ""}`; };

  /* =================== СДЕЛАЛ ПО-НОВОМУ =================== */
  function action() {
    const p = activePattern(), k = today(), todays = episodesOn(k, p).filter(e => !e.newResponse);
    const steps = [
      { k: "type", q: "Что получилось?", type: "choice", opts: X.actionTypes.map(a => [a.id, a.label]) },
      { k: "chosen", q: X.pauseCheck.q, type: "choice", opts: X.pauseCheck.opts, skip: a => a.type !== "pause" },
      { k: "note", q: "Одной строкой: что ты сделал?", type: "text", ph: "Например: сказал «сегодня не могу» и не стал объяснять", optional: true },
      ...(todays.length ? [{ k: "link", q: "К какому случаю это относится?", type: "choice", opts: [...todays.map(e => [e.id, `${R.fmtTime(e.loggedAt)} · ${e.emotion || "случай"} · ${e.intensity}/10${e.event ? " · " + e.event.slice(0, 40) : ""}`]), ["new", "Отдельная запись"]] }] : []),
      { k: "rehearsal", q: "Это был реальный повод или репетиция?", lead: "Репетиция полезна, но реальным контактом не считается.", type: "choice", opts: [["real", "Реальный повод"], ["rehearsal", "Репетиция"]] },
    ];
    flow({ id: "action", scope: p ? p.id : null, steps, title: "Сделал по-новому", onCancel: () => go("today"),
      onDone: async ans => {
        const ts = nowTs(); const nr = Object.assign({ type: ans.type, chosen: ans.type === "pause" ? ans.chosen : null, note: ans.note || "", at: ts }, evidenceTag(p));
        let e = ans.link && ans.link !== "new" ? D.episodes.find(x => x.id === ans.link) : null;
        if (!e) e = { id: R.uuid(), patternId: p ? p.id : null, linkStatus: p ? "confirmed" : "none", occurredAt: ts, loggedAt: ts, dateKey: k, tz: R.tz(), event: "", emotion: null, intensity: null, verificationStatus: "quick", legacy: false };
        e.newResponse = nr; e.isRehearsal = ans.rehearsal === "rehearsal";
        await saveEpisode(e);
        const ok = R.isConfirmedAction(e, nr.skillId);
        app.innerHTML = `<h1>${ok ? "Отмечено" : "Записано"}</h1><p>${ok ? "Ты выбрал ответ. Оценка состояния не меняется сама — вечером спросим, как сейчас." : nr.chosen === "scared" ? "Честная запись. Страх сказать — не провал, а то, с чем работаем." : "Репетиция записана отдельно от реальных случаев."}</p>
          ${ok ? `<div class="trail" style="height:110px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.25"></i><div class="pop">освободил место</div></div>` : ""}
          <div class="row"><a class="btn block" href="#today">На главную</a></div>`;
      } });
  }

  /* =================== ВЕЧЕР =================== */
  function evening(arg) {
    const p = activePattern(); if (!p || p.status !== "active") return go("today");
    const cy = checkinOf(yesterday(), p);
    const k = arg && R.isKey(arg) ? arg : (phase() === "night" && R.eveningCloseable(yesterday(), today()) && !(cy && cy.evening) ? yesterday() : today());
    if (!R.eveningCloseable(k, today())) { app.innerHTML = `<h1>Этот вечер уже закрыт для записи</h1><p class="muted">Вечер можно закрыть в тот же день или до конца следующего.</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const c = checkin(k, p), late = R.isLate(k, today());
    if (c.evening) { app.innerHTML = `<h1>Вечер ${esc(R.human(k))} закрыт</h1><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const eps = episodesOn(k, p), acts = eps.filter(e => e.newResponse), real = acts.filter(e => !e.isRehearsal), reh = acts.filter(e => e.isRehearsal), x = expOf(p), rs = R.researchState(researchOf(p), today(), deepToday);
    const actLbl = real.length ? actionLabel(real[real.length - 1].newResponse) : "";
    const dayHint = acts.length ? `Сегодня записано: ${real.length ? `${real.length} ${R.plural(real.length, "реальный случай", "реальных случая", "реальных случаев")}` : "реальных случаев нет"}${reh.length ? `, ${reh.length} ${R.plural(reh.length, "репетиция", "репетиции", "репетиций")} (репетиция поводом не считается)` : ""}.` : "";
    const titleTxt = `${late ? "Поздний вечер" : "Вечер"} · ${R.human(k)}`;
    const stepsFull = [
      { k: "opp", q: "Был сегодня повод потренироваться?", lead: late ? `Вечер за ${R.human(k)} — запись помечена как поздняя.` : (dayHint || (eps.length ? `Записано случаев: ${eps.length}.` : "")), type: "choice", opts: [["yes", C.daily.opportunity[0]], ["no", C.daily.opportunity[1]], ["unsure", C.daily.opportunity[2]]] },
      { k: "act", q: "Выбранное действие получилось?", lead: real.length ? `Уже записано: ${actLbl}. Подтверди одним касанием.` : `Твой шаг: «${planText(p)}».`, type: "choice", opts: [["done", C.daily.actionResult[0]], ["partial", C.daily.actionResult[1]], ["not", C.daily.actionResult[2]], ["other", C.daily.actionResult[3]]], skip: a => a.opp !== "yes" },
      { k: "outcome", q: "Что случилось на самом деле?", lead: a => `Ты ожидал: «${x.prediction}».`, type: "choice", opts: [["confirmed", "Ожидание подтвердилось"], ["partial", "Отчасти"], ["not", "Не подтвердилось"], ["insufficient", "Данных мало"]], skip: a => a.opp !== "yes" || !(x && x.prediction) || a.act === "not" },
      { k: "fit", q: "Объяснение подходило к сегодняшнему случаю?", lead: a => { const h = hypOf(p); return h ? `«${h.text}»` : ""; }, type: "choice", opts: [["yes", "Да, узнаю"], ["no", "Нет, здесь было другое"], ["unknown", "Не знаю"]], optional: true, skip: a => a.opp !== "yes" || !hypOf(p) || hypOf(p).branch === "unknown" },
      { k: "impact", q: C.daily.eveningImpactScale.label, lead: "Это отдельная шкала: не сила эмоции, а насколько она мешает сейчас.", type: "scale", lo: "0, легко", hi: "10, очень трудно", def: 3 },
      { k: "change", q: "Что заметил за день?", type: "choice", opts: [["better", C.daily.changeObservation[0]], ["same", C.daily.changeObservation[1]], ["worse", C.daily.changeObservation[2]], ["unknown", C.daily.changeObservation[3]]], optional: true },
    ];
    /* Короткий вечер: два вопроса. Первый фиксирует и повод, и действие; повод из дневных записей не выводится. */
    const stepsQuick = [
      { k: "oa", q: "Был повод и что получилось?", lead: dayHint || `Твой шаг: «${planText(p)}».`, type: "choice", opts: R.QUICK_EVENING.map(([v, l]) => [v, l]) },
      { k: "impact", q: C.daily.eveningImpactScale.label, lead: "Не сила эмоции, а насколько она мешает сейчас.", type: "scale", lo: "0, легко", hi: "10, очень трудно", def: 3 },
    ];
    const run = quick => flow({ id: (quick ? "evening-quick-" : "evening-") + k, scope: p.id, steps: quick ? stepsQuick : stepsFull, title: titleTxt, onCancel: () => go("today"),
      onDone: async ans => {
        const q = quick ? R.quickEvening(ans.oa) : { hadOpportunity: ans.opp || null, actionStatus: ans.act || null };
        c.patternId = p.id; c.evening = Object.assign({ at: nowTs(), late, quick, hadOpportunity: q.hadOpportunity, actionStatus: q.actionStatus, currentImpact: ans.impact, change: ans.change || null, tz: R.tz(), enteredDate: today() }, evidenceTag(p));
        if (ans.fit && ans.fit !== "unknown") { const h = hypOf(p); const ep = eps[eps.length - 1]; if (h) { const key = ans.fit === "yes" ? "supportingEpisodeIds" : "contradictingEpisodeIds"; h[key] = [...new Set([...(h[key] || []), ep ? ep.id : "day-" + k])]; await saveHyp(h); } }
        if (ans.outcome && x) { x.results = x.results || []; const ep = real[real.length - 1] || eps[eps.length - 1]; x.results.push({ episodeId: ep ? ep.id : null, dateKey: k, outcome: ans.outcome, at: nowTs() }); await saveExp(x); }
        await saveCheckin(c);
        eveningDone(p, c, rs);
      } });
    if (hasDraft("evening-" + k, p.id)) return run(false);
    if (hasDraft("evening-quick-" + k, p.id)) return run(true);
    app.innerHTML = `<p class="tiny" style="margin:0 0 4px">${esc(titleTxt)}</p><h1>Короткий итог дня</h1><p class="muted">Около минуты. Нет повода — тоже честный ответ.</p>
      <div class="row"><button class="btn block" id="full">Начать</button></div><div class="row tight"><button class="btn ghost" id="quick">Короткий вечер · два вопроса</button><a class="btn ghost" href="#today">Позже</a></div>`;
    $("#full").onclick = () => run(false); $("#quick").onclick = () => run(true);
  }
  function eveningDone(p, c, rs) {
    const canModule = rs.next && !rs.lockedToday && !c.evening.quick;
    app.innerHTML = `<h1>День закрыт</h1><div class="trail" style="height:110px"><img src="${IMG("traveler")}" alt=""><i class="veil" style="opacity:.25"></i><div class="pop">+1 шаг</div></div>
      <p>${c.evening.hadOpportunity === "yes" ? (c.evening.actionStatus === "done" ? "Повод был, и ты выбрал свой ответ." : c.evening.actionStatus === "not" ? "Повод был, не получилось — это наблюдение, не провал." : "Повод был. Записано как есть.") : c.evening.hadOpportunity === "no" ? "Повода не было. Ноль триггеров мы не выдумываем — просто день без повода." : "Записано."}</p>
      ${canModule ? `<div class="card mark"><div class="k">${ic("mirror")}Один шаг исследования · 1–2 минуты</div><p style="margin:2px 0 8px">${esc((C.firstWeekModules.find(m => m.id === rs.next) || {}).title || "")}: ${esc((C.firstWeekModules.find(m => m.id === rs.next) || {}).lead || "")}</p><div class="row tight"><a class="btn block" href="#module/${rs.next}">Сделать</a><a class="btn ghost" href="#today">Не сегодня</a></div></div>` : `<div class="row"><a class="btn block" href="#today">На главную</a></div>`}`;
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
    const done = async (answers, apply) => { await apply(); const r = researchOf(p); r.modules[id] = { status: "done", dateKey: today(), doneAt: nowTs(), answers }; await saveResearch(r); P.lastModule = id; await saveProfile(); go("story"); };
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
        const skill = ans.skill || defSkill;
        await newExperimentVersion(p, { action: ans.action, prediction: val(ans, "prediction") === "unknown" ? "" : val(ans, "prediction"), criterion: val(ans, "criterion"), skillId: skill, ifThen: { signal: val(ans, "signal"), action: ans.action }, permission: p.permission || "", hypothesisVersionId: p.hypothesisVersionId, kind: "experiment" });
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
  function story() {
    const p = anyPattern();
    if (!p) { app.innerHTML = `<h1>Сюжета пока нет</h1><p class="muted">Начни с одного случая или посмотри карточки.</p><div class="row"><a class="btn block" href="#entry">Начать</a></div>`; return; }
    const h = hypOf(p), x = expOf(p), rs = R.researchState(researchOf(p), today(), deepToday), rec = R.hypothesisRecognition(h, D.episodes), elig = p.startDate ? eligibility(p) : null;
    const M = C.firstWeekModules;
    const contra = h && (h.contradictingEpisodeIds || []).length ? `<div class="nudge">Есть ${h.contradictingEpisodeIds.length} ${R.plural(h.contradictingEpisodeIds.length, "случай", "случая", "случаев")}, где объяснение не подошло. Это не отменяет работу — можно <a href="#module/need">уточнить версию</a> или понаблюдать дальше.</div>` : "";
    /* Объяснение сменилось или отвергнуто: подобранные под него разрешение и шаг ждут решения, а не действуют молча. */
    const dep = R.dependencyReview({ pattern: p, experiment: x });
    const migrated = dep.permission && dep.permissionOrigin === "migrated";
    const depHtml = dep.any ? `<div class="card mark"><div class="k">${ic("mirror")}Объяснение изменилось</div><p class="small" style="margin:2px 0 8px">${[dep.permission ? `разрешение «${esc(p.permission)}»` : "", dep.plan ? `шаг «${esc(x.action)}»` : ""].filter(Boolean).join(" и ")} ${migrated ? (dep.plan ? "появились при прежнем объяснении (происхождение разрешения не записано)" : "появилось при прежнем объяснении, его происхождение не записано") : `${dep.permission && dep.plan ? "были подобраны" : dep.permission ? "было подобрано" : "был подобран"} под прежнее объяснение`}. Оставить или выбрать другое?</p><div class="row tight"><button class="btn secondary sm" id="keepDep">Оставить</button><button class="btn sm" id="redoDep">Выбрать другое</button></div></div>` : "";
    const note = (P.lastResult2 ? `<div class="card mark tight"><p class="small" style="margin:0">${esc(P.lastResult2)}</p></div>` : "") + depHtml + contra; if (P.lastResult2) { delete P.lastResult2; saveProfile(); }
    const field = (k, v, edit, ph) => `<div class="prow"><div class="k"><span>${k}</span>${edit ? `<button data-edit="${edit}" data-ph="${esc(ph || "")}">изменить</button>` : ""}</div>${v ? esc(v) : `<span class="muted">${esc(ph || "пока пусто")}</span>`}</div>`;
    const flags = flagsReal().filter(f => f.patternId === p.id);
    const sup = h ? (h.supportingEpisodeIds || []).length : 0;
    hero.innerHTML = `<div class="hero"><div class="hl">${ic("eye", "")}Мой путь</div><div class="hd">${esc(p.title)}</div><div class="hs">${p.status === "observe" ? "наблюдение" : p.status === "paused" ? "пауза" : (h ? rec.label : (p.lesson ? "урок предварительный, объяснение уточним" : "объяснение ещё не выбрано"))}</div></div>`;
    const sym = pathOf();
    app.innerHTML = `${note}
      <div class="card">
        ${sym ? `<div class="prow"><div class="k"><span>Символический путь</span><a href="#symbol">открыть</a></div>${esc(sym.name)} <span class="muted small">· ${esc(sym.theme)}</span></div>` : ""}
        ${p.scenario ? field("Знакомый сценарий", p.scenario.own || p.scenario.recognition, "scenario", "что повторяется") : field("Сюжет", p.title, "title", "как назвать")}
        ${p.teacher ? field("Учитель", `${p.teacher.label}${p.teacher.what ? ` — ${lc1(p.teacher.what)}` : ""}`, "teacher", "кто или что возвращает в сюжет") : field("Кто или что", (p.contexts || []).join(", "), "contexts", "коллега, партнёр, ситуация")}
        ${p.lesson ? field("Урок", uc1(p.lesson.title) + (p.lesson.status === "preliminary" ? " (предварительный)" : ""), "lesson", "направление урока") : ""}
        ${field("Последний случай", lastEvent(p), null, `запиши через «${OB.home.event}»`)}
        ${field("Обычно думаю", p.thought ? `«${p.thought}»${p.thoughtKind === "version" ? " — моя версия" : p.thoughtKind === "observation" ? " — наблюдение" : ""}` : "", "thought", "первая мысль в момент")}
        ${field("Обычно делаю", p.habitualResponse, "habitualResponse", "привычный ответ")}
        ${field("Мне было важно", p.need, "need", "потребность")}
        <div class="prow"><div class="k"><span>Проверяю объяснение</span>${h ? `<button data-edit="hyp">отвергнуть</button>` : ""}</div>${h ? `${esc(h.text)} <span class="badge">${esc(branchLabel(h.branch))}</span><div class="tiny" style="margin-top:3px">${esc(rec.label)}${sup ? ` · примеров: ${sup}` : ""}${h.status === "revised" ? " · пересмотрено" : ""}</div>` : `<span class="muted">появится на шаге «Чего мне не хватило»</span>`}</div>
        ${field("Разрешаю себе", p.permission, "permission", "внутреннее разрешение")}
        ${field("План «если — то»", ifThen(p) || planText(p), null, "появится на шаге «Проверить действием»")}
        ${x && x.prediction ? field("Предсказание", x.prediction) : ""}
        ${x && (x.results || []).length ? `<div class="prow"><div class="k">Результаты</div>${x.results.slice(-5).map(r => `${esc(R.human(r.dateKey || today()))}: ${esc(outcomeLabel(r.outcome))}`).join("<br>")}</div>` : ""}
        ${field("Навык", skillLabel(skillOfPattern(p)), "skill", "выберем на шаге «Проверить действием»")}
        ${field("Тело даёт знать", bodySignal(p), "bodySignal", "необязательно: плечи, челюсть, живот…")}
      </div>
      <div class="card tight"><div class="k">${ic("mirror")}Исследование · ${rs.doneCount} из ${rs.total}</div>
        <div class="dots" aria-label="Пройдено модулей: ${rs.doneCount} из ${rs.total}">${R.MODULE_ORDER.map(id => `<i class="${(researchOf(p).modules[id] || {}).status === "done" ? "on" : ""}" title="${esc((M.find(m => m.id === id) || {}).title || id)}"></i>`).join("")}</div>
        ${rs.next ? `<p class="small" style="margin:4px 0 8px">Следующий шаг: <b>${esc((M.find(m => m.id === rs.next) || {}).title)}</b> — ${esc((M.find(m => m.id === rs.next) || {}).lead)}</p><div class="row tight"><a class="btn block ${rs.lockedToday ? "secondary" : ""}" href="#module/${rs.next}">${rs.lockedToday ? "Уточнить (сегодня уже был шаг)" : "Уточнить · 1–2 минуты"}</a></div>` : `<p class="small" style="margin:4px 0 0">Все шаги первой недели пройдены. Дальше — практика и итоги недель.</p>`}
        <details class="plain"><summary>Пройти шаг заново</summary><div class="chips">${R.MODULE_ORDER.filter(id => id !== "episode").map(id => `<a class="chip" href="#module/${id}">${esc((M.find(m => m.id === id) || {}).title)}</a>`).join("")}</div></details>
      </div>
      ${p.startDate ? `<div class="card tight"><div class="k">${ic("flag")}Навык и флаг</div><p class="small" style="margin:2px 0 6px">${elig.eligible ? "Условия проверки выполнены." : esc(elig.reasons[0] || "")}${elig.reasons.length > 1 ? ` <span class="tiny">и ещё ${elig.reasons.length - 1}</span>` : ""}</p>${flags.length ? `<p class="small" style="margin:0">Освоено: ${flags.map(f => esc(skillLabel(f.skillId))).join(", ")}</p>` : ""}<div class="row tight"><a class="btn secondary sm" href="#flag">${elig.eligible && !hasFlag(p) ? "Проверить навык" : "Как считается флаг"}</a></div></div>` : ""}
      ${queueCard()}
      <div class="card tight"><div class="k">${ic("star")}Символическая тема</div>${P.symbolic && P.symbolic.num ? `<p class="small" style="margin:2px 0 4px"><b>${esc(X.paths[P.symbolic.chosen || P.symbolic.num].name)}</b> · ${esc(X.paths[P.symbolic.chosen || P.symbolic.num].prompt)}</p>` : `<p class="small" style="margin:2px 0 4px">По желанию: число по дате рождения как тема для размышления. На выводы и упражнения не влияет.</p>`}<div class="row tight"><a class="btn ghost sm" href="#symbol">${P.symbolic && P.symbolic.num ? "Открыть астролябию" : "Добавить"}</a></div></div>
      <details class="plain"><summary>Версии гипотез и экспериментов</summary><ul class="list">${D.hypotheses.filter(v => v.patternId === p.id).map(v => `<li><div class="date">гипотеза v${v.version || 1} · ${esc(statusLabel(v.status))} · ${esc(R.human(R.dateKey(v.createdAt)))}</div>${esc(v.text)}</li>`).join("")}${D.experiments.filter(v => v.patternId === p.id).map(v => `<li><div class="date">шаг v${v.version} · ${v.status === "active" ? "действует" : "заменён"} · ${esc(R.human(R.dateKey(v.createdAt)))}</div>${esc(v.action)}${v.prediction ? ` — ожидание: ${esc(v.prediction)}` : ""}</li>`).join("") || "<li class='muted'>пока пусто</li>"}</ul></details>
      <div class="row tight">${p.status === "paused" ? `<button class="btn secondary" id="resume">Вернуться к сюжету</button>` : `<button class="btn ghost" id="pauseP">Пауза по сюжету</button>`}<button class="btn ghost" id="newP">Другой сюжет</button></div>`;
    $$("[data-edit]").forEach(b => b.onclick = () => editField(p, b.dataset.edit, b.dataset.ph));
    const kd = $("#keepDep"); if (kd) kd.onclick = async () => { const cur = p.hypothesisVersionId || null; if (dep.permission) { p.permissionSource = Object.assign({}, p.permissionSource, { keptFor: cur }); await savePattern(p); } if (dep.plan) { x.keptFor = cur; await saveExp(x); } toast("Оставлено осознанно"); story(); };
    const rd = $("#redoDep"); if (rd) rd.onclick = async () => { if (dep.permission) { p.permissionSource = null; await savePattern(p); } deepToday = true; go(dep.permission ? "module/rule" : "module/experiment"); };
    const rp = $("#resume"); if (rp) rp.onclick = async () => { p.status = "active"; await savePattern(p); story(); };
    const pp = $("#pauseP"); if (pp) pp.onclick = async () => { if (!pp.dataset.sure) { pp.dataset.sure = 1; pp.textContent = "Точно поставить на паузу? Нажми ещё раз"; return; } p.status = "paused"; await savePattern(p); go("today"); };
    $("#newP").onclick = async () => { const b = $("#newP"); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Текущий уйдёт в историю. Нажми ещё раз"; return; } p.status = "done"; await savePattern(p); P.onb = { step: "cards" }; await saveProfile(true); go("cards"); };
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
      const pk = packOf(p), all = pk ? pk.lessons : [], curId = p.lesson ? p.lesson.id : null;
      app.innerHTML = `<h1 class="q">${esc(OB.lesson.alt)}</h1><p class="small muted">Смена урока создаёт новую версию шага и навыка. Записи и история остаются.</p><div class="chips col">${all.map(l => `<button class="chip ${l.id === curId ? "on" : ""}" data-l="${l.id}">${esc(uc1(l.title))}</button>`).join("")}<button class="chip dim ${curId === X.lessonUnknown.id ? "on" : ""}" data-l="__unknown">${esc(OB.lesson.unknown)}</button></div><div class="row tight"><button class="btn ghost" id="bk">Назад</button></div>`;
      $$("[data-l]").forEach(b => b.onclick = async () => { const id = b.dataset.l; const L = id === "__unknown" ? X.lessonUnknown : all.find(l => l.id === id); if (!L || L.id === curId) return story(); const prev = p.lesson; p.lesson = { id: L.id, title: L.title, inner: L.inner, action: L.action, skillId: L.skillId, hypothesisId: L.hypothesisId || null, signal: L.signal, status: "preliminary", chosenAt: nowTs(), rejected: [...((prev && prev.rejected) || []), ...(prev ? [prev.id] : [])] }; await newExperimentVersion(p, { action: uc1(L.action), skillId: L.skillId, ifThen: { signal: L.signal, action: L.action }, permission: L.inner, reason: "lesson-changed", lessonId: L.id }); setPermissionFromPack(p, L.inner, p.hypothesisVersionId); await savePattern(p); toast("Урок изменён"); story(); });
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

  /* =================== ИТОГ НЕДЕЛИ =================== */
  function review() {
    const p = activePattern(); if (!p || !p.startDate) return go("today");
    const due = R.reviewDue(p.startDate, today(), D.reviews.filter(r => r.patternId === p.id));
    if (!due) { const last = D.reviews.filter(r => r.patternId === p.id).slice(-1)[0]; app.innerHTML = `<h1>Итог недели</h1><p class="muted">${last ? `Последний итог: ${esc(R.human(last.windowStart))} — ${esc(R.human(last.windowEnd))}, решение: ${esc((X.reviewDecisions.find(d => d.id === last.decision) || {}).label || last.decision)}.` : "Первый итог откроется на 7-й день недели."}</p><div class="row"><a class="btn block" href="#today">На главную</a></div>`; return; }
    const x = expOf(p), h = hypOf(p), s = R.windowSummary({ checkins: D.checkins, episodes: D.episodes, window: due, patternId: p.id, skillId: skillOfPattern(p), experiment: x });
    const little = s.eveningCount < 3 || (s.opportunities + s.realEpisodes) === 0;
    const prevR = D.reviews.filter(r => r.patternId === p.id && !r.legacy).slice(-1)[0], prevBad = !!(prevR && prevR.decision !== "continue" && prevR.decision !== "observe");
    const resStr = s.results.length ? s.results.map(r => outcomeLabel(r.outcome)).join(", ") : "результатов не записано";
    const steps = [
      { k: "look", q: `Неделя ${due.idx + 1}: что было`, type: "info", nextLabel: "Дальше", html: `<div class="stats"><div><b>${s.eveningCount}<span style="font-size:14px">/${s.totalDays}</span></b><span>вечерних записей</span></div><div><b>${s.opportunities}</b><span>${R.plural(s.opportunities, "повод", "повода", "поводов")}</span></div><div><b>${s.actionDays.length}</b><span>получилось</span></div></div>
        <p class="small">Эпизодов: ${s.realEpisodes}${s.rehearsals ? `, репетиций: ${s.rehearsals}` : ""}. Оценки трудности: ${s.impactRatings.length ? s.impactRatings.map(r => r.value).join(", ") : "нет"}.${s.notSure ? ` Не уверен: ${s.notSure}.` : ""}</p>
        ${x && x.prediction ? `<div class="card tight"><div class="k">Ожидание и факт</div><p class="small" style="margin:2px 0 0">Ожидал: «${esc(x.prediction)}». На деле: ${esc(resStr)}.</p></div>` : ""}
        ${little ? `<div class="nudge">Сейчас мало случаев для выводов. Это не провал — просто данных пока немного.</div>` : ""}` },
      { k: "tired", q: "Пользы пока не видно", type: "info", nextLabel: "Понимаю", html: `<p>Второй итог подряд без улучшения. Одинаковые недели повторять не обязательно: можно изменить один элемент, взять паузу или поискать другую поддержку — у близких или у специалиста.</p>`, skip: () => !(prevBad && s.change.worse >= s.change.better && s.actionDays.length === 0) },
      { k: "verdict", q: "Объяснение подходит?", lead: h ? `«${h.text}»` : "Объяснение ещё не выбрано.", type: "choice", opts: X.hypothesisVerdict, skip: () => !h },
      { k: "decision", q: "Что дальше?", type: "choice", opts: X.reviewDecisions.map(d => [d.id, `${d.label} — ${d.desc}`]) },
      { k: "why", q: "Что мешало?", type: "choice", opts: X.notHelpedReasons.filter(r => r !== "Не знаю"), own: true, unknown: true, skip: a => a.decision === "continue" },
      { k: "note", q: "Что помогло, а что не подтвердилось?", type: "text", ph: "коротко, своими словами", optional: true },
    ];
    flow({ id: "review-" + due.start, scope: p.id, steps, title: `Итог · ${R.human(due.start)} — ${R.human(due.end)}`, onCancel: () => go("today"),
      onDone: async ans => {
        if (h && ans.verdict) { const map = { supported: "supported_by_user", partial: "selected", rejected: "rejected", unknown: "selected" }; if (R.canTransition(h.status, map[ans.verdict]) || h.status === map[ans.verdict]) h.status = map[ans.verdict]; await saveHyp(h); }
        const r = { id: R.uuid(), patternId: p.id, windowStart: due.start, windowEnd: due.end, snapshot: s, hypothesisVersionId: h ? h.id : null, experimentId: x ? x.id : null, verdict: ans.verdict || null, decision: ans.decision, why: val(ans, "why") || null, conclusion: ans.note || "", createdAt: nowTs() };
        await saveReview(r);
        if (ans.decision === "pause") { p.status = "paused"; await savePattern(p); return go("today"); }
        if (ans.decision === "observe") { p.status = "observe"; await savePattern(p); return go("today"); }
        if (ans.decision === "rehypo") { if (h) { h.status = "rejected"; await saveHyp(h); } p.hypothesisVersionId = null; const rr = researchOf(p); delete rr.modules.need; delete rr.modules.rule; delete rr.modules.experiment; await saveResearch(rr); await savePattern(p); deepToday = true; return go("module/need"); }
        if (ans.decision === "simplify") { P.drafts = P.drafts || {}; return go("morning"); }
        go("today");
      } });
  }

  /* =================== ФЛАГ =================== */
  function flagScreen() {
    const p = activePattern(); if (!p || !p.startDate) return go("today");
    const el = eligibility(p), pol = policy();
    const rulesHtml = `<details class="plain"><summary>Как считается флаг</summary><ul class="small"><li>Не раньше ${pol.minElapsedCalendarDays} календарных дней после первого реального эпизода.</li><li>Две последние недели подряд: в каждой минимум ${pol.minImpactRatingsPerWindow} вечерние оценки трудности, и все не выше ${pol.maxEachRecordedImpact}. Пропуски остаются пропусками.</li><li>В каждой неделе минимум один реальный повод; за две недели минимум ${pol.minConfirmedActionsAcrossWindowsOnDistinctDays} подтверждённых применения в разные дни. Репетиции не считаются.</li><li>Ты сам подтверждаешь три пункта ниже.</li></ul><p class="tiny">Это ориентир пилота, не медицинский критерий. Флаг значит «я освоил этот ответ в наблюдавшихся ситуациях», а не «проблема исчезла навсегда».</p></details>`;
    if (!el.eligible || hasFlag(p)) {
      app.innerHTML = `<h1>${hasFlag(p) ? "Навык уже отмечен" : "Сейчас мало случаев для проверки"}</h1>${hasFlag(p) ? `<p>По этому сюжету флаг «${esc(skillLabel(skillOfPattern(p)))}» уже есть. Новые случаи его не стирают: можно освежить навык практикой.</p>` : `<ul class="small">${el.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul><p class="small muted">Можно продолжать, наблюдать или взять паузу — без флага это тоже нормально.</p>`}${rulesHtml}<div class="row"><a class="btn block" href="#story">Назад</a></div>`; return;
    }
    const skill = skillOfPattern(p);
    app.innerHTML = `<h1>Проверка навыка</h1><p class="small muted">Две недели: оценки трудности ${el.windows.map(w => w.impactRatings.map(r => r.value).join("·")).join(" | ")}; применений в разные дни: ${el.actionDays.length}.</p>
      ${!skill ? `<label>Какой навык отмечаем?</label><div class="chips col" id="sk">${SKILLS.map(s => `<button class="chip" data-v="${s.id}">${s.label}</button>`).join("")}</div>` : `<p><b>Навык:</b> ${esc(skillLabel(skill))}</p>`}
      <div class="chips col" id="cf">${C.progressPolicy.flagChecks.map((t, i) => `<button class="chip" data-i="${i}">${esc(t)}</button>`).join("")}</div>
      <div class="row"><button class="btn block" id="ok" disabled>Отметить флаг</button></div><div class="row tight"><a class="btn ghost" href="#story">Не сейчас</a></div>${rulesHtml}`;
    const checks = new Set(); let sk = skill;
    const upd = () => { $("#ok").disabled = !(checks.size === 3 && sk); };
    $$("#cf .chip").forEach(b => b.onclick = () => { const i = b.dataset.i; if (checks.has(i)) checks.delete(i); else checks.add(i); b.classList.toggle("on"); upd(); });
    $$("#sk .chip").forEach(b => b.onclick = () => { sk = b.dataset.v; $$("#sk .chip").forEach(x => x.classList.toggle("on", x === b)); upd(); });
    $("#ok").onclick = async () => {
      const f = { id: R.uuid(), skillId: sk, patternId: p.id, awardedAt: nowTs(), windowStart: el.windows[0].window.start, windowEnd: el.windows[1].window.end, evidenceDays: el.actionDays, evidenceIds: D.episodes.filter(e => e.patternId === p.id && R.isConfirmedAction(e, sk)).map(e => e.id), legacy: false };
      await saveFlag(f); if (!p.skillId) { p.skillId = sk; await savePattern(p); }
      const cl = R.clarity(D.flags, TOTAL_SKILLS), cols = ["#FBE7A8", "#E2B65A", "#B9822A", "#C9BFFF", "#8C84C8", "#F2C4B0"];
      app.innerHTML = `${reduce() ? "" : `<div class="confetti" aria-hidden="true">${Array.from({ length: 50 }, (_, k) => `<i style="left:${(k * 37) % 100}%;background:${cols[k % 6]};animation-delay:${(k % 12) * 0.12}s"></i>`).join("")}</div>`}
        <p class="fanfare">Флаг твой</p><div class="trail" style="height:130px"><img src="${IMG("traveler")}" alt=""><i class="glow"></i></div>
        <h2>Ты научился отвечать иначе</h2><p>В этом уроке ты практиковал: <b>${esc(skillLabel(sk))}</b>${p.lesson ? ` — ${esc(p.lesson.title)}` : ""}.</p>
        <p class="small">${(() => { const w = el.windows; const eps = D.episodes.filter(e => e.patternId === p.id && !e.legacy && !e.isRehearsal).length; const opp = w.reduce((a, s) => a + s.opportunities, 0); const ratings = w.map(s => s.impactRatings.map(r => r.value).join("·")).join(" | "); return `За две недели: реальных поводов ${opp}, применений в разные дни ${el.actionDays.length}, оценки трудности ${esc(ratings)}. Всего записано случаев по сюжету: ${eps}.`; })()}</p>
        <p class="small muted">Небо над тропой: ${cl.pct}% — ${cl.count} из ${cl.total} навыков. Неприятные чувства могут оставаться — это не отменяет навык. Тема жизни не закрыта навсегда: это освоенный ответ в наблюдавшихся ситуациях.</p>
        <div class="row"><a class="btn block" href="#today">Продолжить закрепление</a></div><div class="row tight"><button class="btn ghost" id="nextScenario">Выбрать следующий сюжет</button></div>`;
      $("#nextScenario").onclick = async () => { p.status = "done"; await savePattern(p); P.onb = { step: "cards" }; await saveProfile(true); go("cards"); };
    };
  }

  /* =================== ИСТОРИЯ =================== */
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
        if (it.t === "ep") { const e = it.e; return `<div class="small"><a href="#episode/${e.id}">${R.fmtTime(e.loggedAt)} · ${esc(e.emotion || "случай")}${e.intensity != null ? ` ${e.intensity}/10` : ""}${e.event ? " · " + esc(e.event.slice(0, 50)) : ""}</a>${e.newResponse ? ` <span class="badge">${esc(actionLabel(e.newResponse).split(":")[0])}</span>` : ""}${e.isRehearsal ? ` <span class="badge">репетиция</span>` : ""}${e.linkStatus === "queued" ? ` <span class="badge">очередь</span>` : ""}${e.legacy ? ` <span class="badge legacy">прошлая версия</span>` : ""}</div>`; }
        if (it.t === "cv") { const c = it.c; return `<div class="small">${c.morning ? `утро${c.morning.intensity != null ? ` ${c.morning.intensity}/10` : ""}${c.evening ? " · " : ""}` : ""}${c.evening ? `вечер: трудность ${c.evening.currentImpact != null ? c.evening.currentImpact : "—"}${c.evening.hadOpportunity ? ` · повод: ${({ yes: "да", no: "нет", unsure: "не уверен" })[c.evening.hadOpportunity]}` : ""}${c.evening.actionStatus ? ` · ${({ done: "получилось", partial: "частично", not: "не получилось", other: "другое" })[c.evening.actionStatus]}` : ""}${c.evening.late ? ` <span class="badge">поздняя запись</span>` : ""}` : ""}${c.legacy ? ` <span class="badge legacy">прошлая версия</span>` : ""}</div>`; }
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
        app.innerHTML = `<h1 class="q">Что поможет сейчас?</h1><p class="muted small">Можно держать глаза открытыми и закончить в любой момент.</p><p class="tiny">${esc(H.medical)}</p><div class="chips col">${H.methods.map(([v, l, d]) => `<button class="chip ${v === "grounding" ? "on" : ""}" data-v="${v}">${l}<br><span class="tiny">${d}</span></button>`).join("")}</div>`;
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
        app.innerHTML = `<h1 class="q">Как сейчас?</h1><div class="chips col">${H.after.map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join("")}</div>`;
        $$(".chip").forEach(b => b.onclick = () => { const v = b.dataset.v; log(v); if (v === "worse") { stage = "worse"; } else stage = "power"; render(); });
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
  function reveal(n) {
    const S = P.symbolic, t = X.paths[n], r = R.calcNum(S.birth) || { digits: [], chain: [n] }, red = reduce() || !!(P.onb && P.onb.revealed);
    const finalHtml = () => `<h1 style="margin-top:6px">${esc(OB.reveal.lead)} ${esc(t.name)}</h1><p>Его тема — ${esc(t.theme)}.</p><p class="muted">${esc(t.intro || "")}</p>
      <div class="row"><button class="btn block" id="go">${esc(OB.reveal.cta)}</button></div>
      <p class="tiny" style="margin-top:8px">${esc(OB.reveal.note)}</p><div class="row tight"><a class="btn ghost sm" href="#birth">Другая дата</a></div>`;
    app.innerHTML = `<div class="astro"><img src="${IMG("astrolabe")}" alt=""><div class="orb ${red ? "shown" : "calc"}" id="orb"><div class="core"><i class="fl"></i><img class="num" src="${IMG("num-" + n)}" alt="Число ${n}"></div></div></div>
      <div class="digits" id="digits">${r.digits.map(d => `<span class="d">${d}</span>`).join("<span class='d'> + </span>")}<span class="sum d" id="sum"></span></div>
      <div id="after">${red ? "" : `<div class="row tight"><button class="btn ghost sm" id="skipAnim">Пропустить</button></div>`}</div>`;
    const done = () => { if (P.onb) { P.onb.revealed = true; saveProfile(true); } $("#after").innerHTML = finalHtml(); $("#go").onclick = async () => { onb().step = "cards"; onb().deck = null; await saveProfile(true); go("cards"); }; };
    const spans = $$("#digits .d"); let i = 0, stopped = false;
    const finishNow = () => { stopped = true; spans.forEach(x => x.style.opacity = 1); $("#sum").textContent = r.chain.length ? "= " + r.chain.join(" → ") : ""; $("#sum").style.opacity = 1; const orb = $("#orb"); orb.classList.remove("calc"); orb.classList.add("shown"); done(); };
    if (red) return finishNow();
    const tick = () => { if (stopped) return; if (i < spans.length - 1) { spans[i++].style.opacity = 1; setTimeout(tick, 90); return; } $("#sum").textContent = "= " + r.chain.join(" → "); $("#sum").style.opacity = 1; const orb = $("#orb"); orb.classList.remove("calc"); orb.classList.add("shown", "reveal"); setTimeout(() => { if (!stopped) done(); }, 900); };
    spans.forEach(x => x.style.opacity = 0); tick();
    const sk = $("#skipAnim"); if (sk) sk.onclick = finishNow;
  }
  function symbol() {
    const S = P.symbolic || {};
    const topicHtml = n => { const t = X.paths[n]; return `<div class="card mark"><div class="k">${ic("star")}${esc(t.name)}</div><p class="small" style="margin:2px 0 4px">${esc(t.theme)}</p><p class="quote" style="margin:0">${esc(t.prompt)}</p></div><p class="tiny">${esc(C.entryCopy.symbolicNote)}</p>`; };
    if (S.num) {
      const n = S.chosen || S.num;
      if (P.onb && !anyPattern()) return reveal(n);
      app.innerHTML = `<div class="astro"><img src="${IMG("astrolabe")}" alt=""><div class="orb shown"><div class="core"><i class="fl"></i><img class="num" src="${IMG("num-" + n)}" alt="Число ${n}"></div></div></div>
        ${topicHtml(n)}
        <p class="small muted">Узнаёшь это в своей жизни?</p><div class="sw3"><button class="btn secondary sm" data-r="yes">Да</button><button class="btn secondary sm" data-r="part">Отчасти</button><button class="btn secondary sm" data-r="no">Нет</button></div>
        <details class="plain"><summary>Выбрать другую тему</summary><div class="chips">${Object.entries(X.paths).map(([k, t]) => `<button class="chip ${String(n) === k ? "on" : ""}" data-t="${k}">${k} · ${esc(t.name)}</button>`).join("")}</div></details>
        <div class="row tight"><button class="btn ghost" id="rm">Убрать число</button><a class="btn ghost" href="#story">Назад</a></div>`;
      $$("[data-r]").forEach(b => b.onclick = async () => { P.symbolic.recog = b.dataset.r; await saveProfile(); toast(b.dataset.r === "no" ? "Хорошо. Ниже можно выбрать другую тему — или не выбирать." : "Записано"); });
      $$("[data-t]").forEach(b => b.onclick = async () => { P.symbolic.chosen = Number(b.dataset.t); await saveProfile(); symbol(); });
      $("#rm").onclick = async () => { P.symbolic = null; await saveProfile(); go("story"); };
      return;
    }
    app.innerHTML = `<h1>Символическая тема</h1><p class="small muted">По желанию. Сумма цифр даты рождения даёт число 1–9 и тему для размышления. Это традиция, а не наука: на выводы, упражнения и результаты число не влияет.</p>
      <label for="b">Дата рождения</label><input type="date" id="b" min="1920-01-01" max="${today()}"><div class="row"><button class="btn block" id="go">Посчитать</button></div><div class="row tight"><a class="btn ghost" href="#story">Не нужно</a></div>`;
    $("#go").onclick = async () => {
      const v = $("#b").value; const r = R.calcNum(v); if (!r) return toast("Укажи дату");
      P.symbolic = { birth: v, num: r.num, chosen: null }; await saveProfile();
      const red = reduce();
      app.innerHTML = `<div class="astro"><img src="${IMG("astrolabe")}" alt=""><div class="orb ${red ? "shown" : "calc"}" id="orb"><div class="core"><i class="fl"></i><img class="num" src="${IMG("num-" + r.num)}" alt="Число ${r.num}"></div></div></div>
        <div class="digits" id="digits">${r.digits.map(d => `<span class="d">${d}</span>`).join("<span class='d'> + </span>")}<span class="sum d" id="sum"></span></div><div id="after"></div>`;
      const spans = $$("#digits .d"); let i = 0;
      const tick = () => { if (i < spans.length - 1) { spans[i++].style.opacity = 1; setTimeout(tick, red ? 0 : 90); return; } $("#sum").textContent = "= " + r.chain.join(" → "); $("#sum").style.opacity = 1; const orb = $("#orb"); if (!red) { orb.classList.remove("calc"); orb.classList.add("shown", "reveal"); } setTimeout(() => { $("#after").innerHTML = `${topicHtml(r.num)}<div class="row"><a class="btn block" href="#symbol">Дальше</a></div>`; }, red ? 0 : 900); };
      spans.forEach(s => s.style.opacity = 0); tick();
    };
  }

  /* =================== О МЕТОДЕ =================== */
  function about() {
    const A = X.about;
    app.innerHTML = `<h1>Как это работает</h1><p>${esc(C.entryCopy.promise)} Цикл: случай → моя реакция → возможное объяснение → маленький шаг → что вышло на самом деле → уточнение.</p>
      <h2>Образы и пределы</h2><p>${esc(A.frame)}</p>
      <h2>Что под шагами</h2><p>${esc(A.method)}</p>
      <div class="card"><div class="k">${ic("mirror")}Источники</div><ul class="src">${C.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="w">основа метода; адаптированные упражнения не проверены как этот продукт</span></li>`).join("")}<li><a href="https://pubmed.ncbi.nlm.nih.gov/9150580/" target="_blank" rel="noopener">Newman, Duff &amp; Baumeister, 1997</a><br><span class="w">проекция при подавлении мыслей; не основание трактовать любое раздражение как зеркало</span></li></ul></div>
      <div class="card"><div class="k">${ic("key")}Пределы выводов</div><ul class="small">${A.limits.map(l => `<li>${esc(l)}</li>`).join("")}</ul></div>
      <p class="small muted">${esc(A.extra)}</p>
      <div class="row"><a class="btn block" href="${anyPattern() ? "#today" : "#start"}">Назад</a></div>`;
  }

  /* =================== НАСТРОЙКИ =================== */
  function settings() {
    const rem = P.reminders;
    app.innerHTML = `<h1>Настройки</h1>
      <div class="card"><div class="k">${ic("sunrise")}Оформление</div><div class="chips" id="theme">${[["auto", "По времени суток"], ["light", "Рассвет"], ["dark", "Звёздный вечер"]].map(([v, l]) => `<button class="chip ${P.theme === v ? "on" : ""}" data-v="${v}">${l}</button>`).join("")}</div>
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
      <div class="card tight"><div class="row tight"><a class="btn ghost sm" href="#about">О методе и источниках</a><a class="btn ghost sm" href="#symbol">Символическая тема</a><a class="btn ghost sm" href="#entry">Другой сюжет</a></div></div>
      <details class="plain"><summary>Для разработчика</summary><div class="card tight"><div class="switch"><span>Режим разработки</span><input type="checkbox" id="dev" ${P.devMode ? "checked" : ""}></div>
        ${P.devMode ? `<p class="small muted">Тестовые часы: ${esc(R.human(today()))}, ${R.fmtTime(nowTs())}, сдвиг +${P.offsetH || 0} ч.</p><div class="row tight"><button class="btn secondary sm" data-o="6">+6 ч</button><button class="btn secondary sm" data-o="24">+1 день</button><button class="btn secondary sm" data-o="168">+7 дней</button><button class="btn secondary sm" data-o="0">Сброс</button></div>` : ""}
        <p class="tiny">Версия ${esc(window.KARMA_VERSION || "v2")} · контент ${esc(C.contentVersion)}</p></div></details>`;
    $$("#theme .chip").forEach(b => b.onclick = async () => { P.theme = b.dataset.v; await saveProfile(); applyTheme(); settings(); });
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
    return Object.assign({ theme: "auto", bigText: false, reminders: { evening: { on: true, time: "20:30" }, morning: { on: false, time: "08:30" }, day: { on: false, time: "13:00" } }, times: { morningStart: 5, dayStart: 12, eveningStart: 17 }, devMode: false, offsetH: 0, installId: R.uuid().slice(0, 8), seen: {}, drafts: {}, symbolic: null, legacyDecision: null }, keep || {});
  }
  async function boot() {
    D = await ST.load();
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
    if (sv < 4) {
      if (sv < 3) {
        D.checkins = R.normalizeCheckins(D.checkins); R.backfillEvidence(D);
        const m = R.migrateDrafts(P.drafts, { patterns: D.patterns, episodes: D.episodes }, DRAFT_V);
        P.drafts = m.drafts; if (m.recovered.length) P.recovered = [...(P.recovered || []), ...m.recovered];
      }
      R.markMigratedPermissions(D.patterns);
      D.meta.schemaVersion = R.SCHEMA_VERSION; D.meta.upgradedAt = Date.now();
      try { await ST.replaceAll(Object.assign(D, { profile: P })); } catch (e) { saveError(e); }
    }
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
