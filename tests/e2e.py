"""Сценарии проверки v2 в браузере: python3 tests/e2e.py  (сервер: cd dist && python3 -m http.server 8787)"""
import sys, json, os, time
from playwright.sync_api import sync_playwright
U = "http://localhost:8787/"
OUT = os.path.join(os.path.dirname(__file__), "shots"); os.makedirs(OUT, exist_ok=True)
FAILS = []
def check(name, cond, info=""):
    print(("ok  - " if cond else "FAIL- ") + name + ("" if cond else f"   {info}"));
    if not cond: FAILS.append(name)

def fresh(ctx):
    pg = ctx.new_page(); pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: pg.errors.append("console:" + m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text and "googleapis" not in m.text else None)
    return pg
def snap(pg, n): pg.screenshot(path=os.path.join(OUT, n + ".png"), full_page=True)
def shift(pg, hours):
    pg.evaluate(f"""async () => {{ const A = window.KARMA_APP; A.profile.devMode = true; A.profile.offsetH = (A.profile.offsetH||0) + {hours}; await A.saveProfile(); location.hash = '#today'; A.route(); }}""")
    pg.wait_for_timeout(250)
def set_hour(pg, h):
    """сдвигает тестовые часы так, чтобы текущий час стал h (в тот же или следующий день)"""
    pg.evaluate(f"""async () => {{ const A = window.KARMA_APP; A.profile.devMode = true; const cur = new Date(A.nowTs()).getHours(); let d = {h} - cur; if (d < 0) d += 24; A.profile.offsetH = (A.profile.offsetH||0) + d; await A.saveProfile(); location.hash = '#today'; A.route(); }}""")
    pg.wait_for_timeout(250)
def state(pg): return pg.evaluate("() => JSON.parse(JSON.stringify(window.KARMA_APP.data))")
def ck(st, date, pid=None):
    """запись дня по дате (и сюжету): ключ «дата|сюжет»"""
    for c in st["checkins"].values():
        if c["dateKey"] == date and (pid is None or c.get("patternId") == pid): return c
    return None
def go(pg, h): pg.evaluate(f"() => window.KARMA_APP.go('{h[1:]}')"); pg.wait_for_timeout(300)
def h1(pg): return pg.inner_text("h1") if pg.query_selector("h1") else ""
def click_chip(pg, text): pg.click(f".chip >> text={text}"); pg.wait_for_timeout(260)

def skill_id_of(pg): return pg.evaluate("() => { const A = window.KARMA_APP; const p = A.data.patterns.find(q => q.status === 'active'); const x = A.data.experiments.find(e => e.id === p.experimentId); return (x && x.skillId) || p.skillId; }")
def consent_start(pg):
    """первый экран v5: чекбокс «О подходе» пустой, кнопка неактивна до отметки"""
    if pg.query_selector("#consent") and not pg.evaluate("() => document.getElementById('consent').checked"): pg.click("#consent")
    if pg.query_selector("#go"): pg.click("#go"); pg.wait_for_timeout(250)
def to_cards(pg, area="Работа и общение", ctx="По-разному"):
    """вход v5: проблема (согласие) → дата (пропуск) → сфера (→ контекст работы) → события"""
    if pg.query_selector("#consent") and "снова происходит" in pg.inner_text("#app"): consent_start(pg)
    if pg.query_selector("#skip"): pg.click("#skip"); pg.wait_for_timeout(300)
    if area and pg.query_selector(f".chip >> text={area}"): pg.click(f".chip >> text={area}"); pg.wait_for_timeout(400)
    if area == "Работа и общение" and ctx and pg.query_selector(f".chip >> text={ctx}"): pg.click(f".chip >> text={ctx}"); pg.wait_for_timeout(400)
def answer_cards(pg, answers):
    for r in answers: pg.click("#" + r); pg.wait_for_timeout(280)
def finish_onb(pg, teacher="Повторяющаяся ситуация", when="Сегодня", date=None, repeat="Такое повторяется", meaning=0, case_text=None):
    """после выбора события: учитель → случай → что задело → резюме «Да, это моя ситуация» → экран урока"""
    if pg.query_selector(f"#ch .chip >> text={teacher}"):
        on = pg.evaluate("() => [...document.querySelectorAll('#ch .chip.on')].map(b => b.textContent)")
        if teacher in on: pg.click("#next")
        else: click_chip(pg, teacher)
    pg.wait_for_timeout(300)
    if pg.query_selector("h1.q") and "переключаемся" in pg.inner_text("h1.q"): click_chip(pg, "Да, это важнее")
    if pg.query_selector("#a"):
        if case_text: pg.fill("#a", case_text)
        else: pg.click("#tg .chip >> nth=0")
        pg.click("#next"); pg.wait_for_timeout(250)
    click_chip(pg, when)
    if pg.query_selector("#dt"):
        if date: pg.fill("#dt", date); pg.click("#next")
        elif when == "На этой неделе": pg.click("#next")
        else: pg.click("#skipq")
        pg.wait_for_timeout(250)
    click_chip(pg, repeat); pg.wait_for_timeout(300)
    if isinstance(meaning, int): pg.click(f"#ch .chip >> nth={meaning}")
    else: click_chip(pg, meaning)
    pg.wait_for_timeout(350)
    pg.click("#ok"); pg.wait_for_timeout(350)
def start_lesson(pg):
    """«Начать этот урок» → карта дня «Понятно, начнём» (если ещё не показана) → главная"""
    pg.click("#go"); pg.wait_for_timeout(500)
    if pg.query_selector("#go") and "устроен твой путь" in pg.inner_text("#app"): pg.click("#go"); pg.wait_for_timeout(400)
def human(pg, k): return pg.evaluate("k => window.KARMA_RULES.human(k)", k).lower()
def add_days(pg, k, n): return pg.evaluate("([k, n]) => window.KARMA_RULES.addDays(k, n)", [k, n])
def onboard(pg, area="Работа и общение", ctx="С руководителем", answers=("yes", "no", "unsure", "no", "yes"), **kw):
    """полный вход v5 из любого состояния первого экрана; возвращает колоду"""
    to_cards(pg, area, ctx); deck = pg.evaluate("() => window.KARMA_APP.profile.onb.deck.map(c => ({ id: c.id, text: c.text, areas: c.areas, ctx: c.ctx }))")
    answer_cards(pg, answers); pg.click("#pick"); pg.wait_for_timeout(300); pg.click(".chip[data-i='0']"); pg.wait_for_timeout(350)
    finish_onb(pg, **kw); start_lesson(pg); return deck
def first_episode(pg, text="Коллега попросил подменить, я согласился, хотя не хотел", plan=0):
    go(pg, "#new"); pg.wait_for_selector("#a"); pg.fill("#a", text); pg.click("#next"); pg.wait_for_timeout(200)
    click_chip(pg, "коллега"); click_chip(pg, "Злость"); pg.click("#next"); pg.wait_for_timeout(200)
    click_chip(pg, "Согласился, хотя не хотел")
    if pg.query_selector("#ch"): pg.click(f"#ch .chip >> nth={plan}"); pg.click("#next")
    pg.wait_for_timeout(500)
    if pg.query_selector("#go") and "устроен твой путь" in pg.inner_text("#app"): pg.click("#go"); pg.wait_for_timeout(400)
def do_event(pg, rel="Это текущий сюжет", emo="Злость", inten=5, after="Просто записать"):
    go(pg, "#event")
    if pg.query_selector(f".chip >> text={rel}"): click_chip(pg, rel)
    click_chip(pg, emo); pg.eval_on_selector("#sc", f"e=>{{e.value={inten};e.dispatchEvent(new Event('input'))}}"); pg.click("#next"); pg.wait_for_timeout(300)
    if after: pg.click(f"text={after}"); pg.wait_for_timeout(300)
def do_action(pg, typ="Отказ", rehearsal=False):
    go(pg, "#action"); click_chip(pg, typ)
    if typ == "Пауза": click_chip(pg, "Выбранная пауза")
    pg.fill("#a", "сказал: сегодня не могу"); pg.click("#next"); pg.wait_for_timeout(200)
    if pg.query_selector(".chip >> text=Отдельная запись"): pg.click(".chip >> nth=0"); pg.wait_for_timeout(260)
    click_chip(pg, "Репетиция" if rehearsal else "Реальный повод"); pg.wait_for_timeout(300)
def do_evening(pg, opp="Был повод", act="Получилось", impact=1, date=None, quick=False):
    go(pg, "#evening" + ("/" + date if date else "")); pg.wait_for_timeout(200)
    if pg.query_selector("#quick") and quick: pg.click("#quick")
    elif pg.query_selector("#full"): pg.click("#full")
    else: return False
    pg.wait_for_timeout(200)
    for _ in range(8):
        if not pg.query_selector("h1.q"): break
        q = pg.inner_text("h1.q")
        if "повод" in q and "трениров" in q: click_chip(pg, opp)
        elif "что получилось" in q: click_chip(pg, opp)
        elif "действие получилось" in q: click_chip(pg, act)
        elif "на самом деле" in q: click_chip(pg, "Отчасти")
        elif "возвращаться" in q: pg.eval_on_selector("#sc", f"e=>{{e.value={impact};e.dispatchEvent(new Event('input'))}}"); pg.click("#next"); pg.wait_for_timeout(200)
        elif "заметил" in q: click_chip(pg, "Без изменений")
        else: pg.click("#next"); pg.wait_for_timeout(200)
    return True
def do_morning(pg): go(pg, "#morning"); pg.wait_for_timeout(200); ok = bool(pg.query_selector("#take"));
def morning(pg):
    go(pg, "#morning"); pg.wait_for_timeout(200)
    if pg.query_selector("#take"): pg.click("#take"); pg.wait_for_timeout(300); return True
    return False

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- Сценарий 1: первый заход вечером ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}); pg = fresh(ctx)
    pg.goto(U); pg.wait_for_timeout(600); to_cards(pg)
    # дата рождения и число не обязательны: свой случай сразу из карточек
    pg.evaluate("async () => { const A = window.KARMA_APP; A.profile.devMode = true; const cur = new Date(A.nowTs()).getHours(); A.profile.offsetH = 21 - cur; await A.saveProfile(); A.route(); }"); pg.wait_for_timeout(300)
    first_episode(pg)
    check("1: вечером сразу вечерняя практика", "подвести итог дня" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:200])
    st = state(pg); today = pg.evaluate("() => window.KARMA_APP.today()")
    check("1: утренней записи задним числом нет", not ((ck(st, today) or {}).get("morning")))
    check("1: дата рождения не требовалась", st["profile"].get("symbolic") is None)
    snap(pg, "01_today_evening")
    # ---------- Сценарий 6: выход на шаге и перезапуск ----------
    go(pg, "#event"); click_chip(pg, "Это текущий сюжет"); click_chip(pg, "Обида")
    pg.reload(); pg.wait_for_timeout(700)
    check("6: черновик шага восстановлен после перезапуска", "сильно задело" in pg.inner_text("#app"), pg.inner_text("#app")[:120])
    pg.eval_on_selector("#sc", "e=>{e.value=8;e.dispatchEvent(new Event('input'))}"); pg.click("#next"); pg.wait_for_timeout(300)
    check("интенсивность 8: предложена помощь до анализа", "Задело сильно" in pg.inner_text("#app"))
    snap(pg, "06_after_event_high")
    pg.click("text=Просто записать"); pg.wait_for_timeout(200)
    st = state(pg); check("эпизод сохранён сразу (quick)", any(e["intensity"] == 8 and e["verificationStatus"] == "quick" for e in st["episodes"]))
    # ---------- Сценарий 4: злится сильно, но спокойно отказал ----------
    do_action(pg, "Отказ")
    check("4: действие признано", "Отмечено" in h1(pg), h1(pg))
    st = state(pg); r = pg.evaluate("() => window.KARMA_RULES.lastRating({checkins: window.KARMA_APP.data.checkins, episodes: window.KARMA_APP.data.episodes})")
    check("состояние не меняется от клика: явной оценки ещё нет, сила эмоции события в камни не входит (v5)", r is None and pg.evaluate("() => window.KARMA_RULES.lastRating({checkins: window.KARMA_APP.data.checkins, episodes: window.KARMA_APP.data.episodes, includeEpisodes: true}).value") == 8, r)
    # ---------- Пауза «страшно сказать» не подтверждает ----------
    go(pg, "#action"); click_chip(pg, "Пауза"); click_chip(pg, "Было страшно сказать"); pg.fill("#a", "промолчал"); pg.click("#next"); pg.wait_for_timeout(200)
    if pg.query_selector(".chip >> text=Отдельная запись"): click_chip(pg, "Отдельная запись")
    click_chip(pg, "Реальный повод")
    check("пауза от страха — не успех", "Честная запись" in pg.inner_text("#app"))
    # ---------- Вечер ----------
    ok = do_evening(pg, "Был повод", "Получилось", 2)
    check("вечер закрыт", ok and "День закрыт" in h1(pg), h1(pg))
    st = state(pg); pid0 = st["patterns"][0]["id"]; ev = ck(st, today, pid0)["evening"]; check("вечер: повод/действие/трудность сохранены", ev["hadOpportunity"] == "yes" and ev["actionStatus"] == "done" and ev["currentImpact"] == 2, ev)
    check("P1-2: вечер и действие помнят навык и версию плана", ev.get("skillId") == "pause" and ev.get("planVersion") == 1 and all(e["newResponse"].get("skillId") == "pause" for e in st["episodes"] if e.get("newResponse")), (ev.get("skillId"), [e["newResponse"] for e in st["episodes"] if e.get("newResponse")]))
    check("день 1: второй модуль не предлагается (один шаг в день)", "один шаг исследования" not in pg.inner_text("#app").lower())
    snap(pg, "07_evening_done")
    # день 2, утро
    set_hour(pg, 8)
    check("день 2: утро предложено", "шаг на день" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:120]); morning(pg)
    d2 = pg.evaluate("() => window.KARMA_APP.today()")
    go(pg, "#story"); check("мой сюжет: следующий шаг — значение", "Что я услышал" in pg.inner_text("#app"))
    pg.click("a[href='#module/meaning']"); pg.wait_for_timeout(300); click_chip(pg, "Опять всё на мне"); click_chip(pg, "Это моя версия")
    pg.wait_for_timeout(300); check("модуль «значение» завершён → Мой путь", "Мой путь" in pg.inner_text("#hero"), pg.inner_text("#hero"))
    st = state(pg); pid = st["patterns"][0]["id"]; check("мысль записана как версия", st["patterns"][0]["thought"] == "Опять всё на мне" and st["patterns"][0]["thoughtKind"] == "version")
    go(pg, "#module/need"); check("второй модуль в тот же день заблокирован", "уже был" in pg.inner_text("#app"), pg.inner_text("#app")[:100])
    pg.click("#deep"); pg.wait_for_timeout(300); check("углублённый разбор открывает модуль", "не хватило" in pg.inner_text("#app"))
    click_chip(pg, "Уважение"); click_chip(pg, "Просьбы и обязательства")
    pg.click(".chip >> nth=0"); pg.click(".chip >> nth=1"); pg.click("#next"); pg.wait_for_timeout(250)
    pg.click(".chip >> nth=0"); pg.wait_for_timeout(400)
    st = state(pg); hyps = [h for h in st["hypotheses"] if h["patternId"] == pid]
    check("гипотезы: две версии, одна выбрана", len(hyps) == 2 and sum(1 for h in hyps if h["status"] == "selected") == 1, [h["status"] for h in hyps])
    # ---------- Сценарий 5: отвергает гипотезу ----------
    go(pg, "#story"); pg.click("button[data-edit='hyp']"); pg.wait_for_timeout(200); pg.click("#rej"); pg.wait_for_timeout(400)
    st = state(pg); check("5: гипотеза отвергнута, путь продолжается (снова шаг объяснения)", any(h["status"] == "rejected" for h in st["hypotheses"]) and "не хватило" in pg.inner_text("#app"), pg.inner_text("#app")[:80])
    click_chip(pg, "Справедливость")
    pg.click(".chip >> text=Другой не выполняет"); pg.click("#next"); pg.wait_for_timeout(250); pg.click(".chip >> nth=0"); pg.wait_for_timeout(400)
    st = state(pg); sel = [h for h in st["hypotheses"] if h["status"] == "selected"]
    check("3: выбрана ветка «граница»", len(sel) == 1 and sel[0]["branch"] == "boundary", sel)
    go(pg, "#module/rule"); pg.wait_for_timeout(200)
    if pg.query_selector("#deep"): pg.click("#deep"); pg.wait_for_timeout(300)
    click_chip(pg, "Это про границу")
    check("3: ветка границы не требует искать то же качество в себе", "неприемлемо" in pg.inner_text("#app"), pg.inner_text("#app")[:100])
    pg.fill("#a", "обещал и не сделал"); pg.click("#next"); pg.wait_for_timeout(200); pg.fill("#a", "ограничу свой вклад"); pg.click("#next"); pg.wait_for_timeout(400)
    st = state(pg); check("граница записана", st["patterns"][0].get("boundary", {}).get("unacceptable") == "обещал и не сделал")
    go(pg, "#module/experiment"); pg.wait_for_timeout(200)
    if pg.query_selector("#deep"): pg.click("#deep"); pg.wait_for_timeout(300)
    pg.fill("#a", "Скажу: сегодня не могу"); pg.click("#next"); pg.wait_for_timeout(200); click_chip(pg, "Человек обидится"); click_chip(pg, "По ответу человека"); click_chip(pg, "Могу отказать"); click_chip(pg, "меня попросят"); pg.wait_for_timeout(400)
    st = state(pg); x = [e for e in st["experiments"] if e["status"] == "active"][0]
    check("эксперимент: предсказание, шаг, если-то, навык", x["prediction"] == "Человек обидится" and x["skillId"] == "refuse" and x["ifThen"]["signal"] == "меня попросят", x)
    go(pg, "#story"); snap(pg, "08_story")
    # ---------- Сценарий 12: новый человек с тем же правилом ----------
    go(pg, "#event"); click_chip(pg, "Похоже, но другой человек"); click_chip(pg, "Злость"); pg.click("#next"); pg.wait_for_timeout(300)
    check("12: вопрос про ту же мысль/запрет", "Похоже, но другой человек" in pg.inner_text("#app"))
    pg.click("button[data-link='yes']"); pg.wait_for_timeout(300)
    st = state(pg); e = st["episodes"][-1]; check("12: эпизод привязан к текущему сюжету, сюжет один", e["linkStatus"] == "confirmed" and e["patternId"] == pid and len([q for q in st["patterns"] if q["status"] == "active"]) == 1)
    do_event(pg, "Другое", "Тревога", 4, after=None); st = state(pg); check("«другое» уходит в очередь, активный сюжет не меняется", st["episodes"][-1]["linkStatus"] == "queued" and st["episodes"][-1]["patternId"] is None)
    # ---------- Сценарий 11: вечер дня 2 не закрыт; день 3 ----------
    set_hour(pg, 2)
    check("ночь: предложено закрыть вчерашний вечер", "Закрыть вчерашний вечер" in pg.inner_text("#app"), pg.inner_text("#app")[:150])
    set_hour(pg, 8); morning(pg)
    check("11: сегодняшнее утро заполнено, вчерашний вечер всё ещё доступен", "закрыть вчерашний вечер" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:200])
    ok = do_evening(pg, "Не было повода", None, 3, date=d2)
    st = state(pg); evs = [c for c in st["checkins"].values() if c.get("evening") and c["evening"].get("late")]
    check("11: поздняя запись помечена и относится к прошлой дате", len(evs) == 1 and evs[0]["dateKey"] == d2, [(c["dateKey"], c.get("evening", {}).get("late")) for c in st["checkins"].values()])
    check("«не было повода» не превратилось в ноль триггеров", evs[0]["evening"]["hadOpportunity"] == "no" and evs[0]["evening"].get("actionStatus") is None)
    set_hour(pg, 20); do_evening(pg, "Был повод", "Получилось", 1)
    check("день 3: модуль предложен внутри вечера", "один шаг исследования" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:200])
    snap(pg, "07_evening_module")
    # ---------- Сценарий 10: завершённая неделя на 8-м дне и далее ----------
    # дни 4..8: утро+вечер
    for i in range(5):
        set_hour(pg, 8); morning(pg); set_hour(pg, 20); do_evening(pg, "Был повод" if i % 2 == 0 else "Не было повода", "Получилось", 1 + (i % 2))
    set_hour(pg, 10)
    txt = pg.inner_text("#app"); check("день 8: главная без ошибок, предложен итог недели", "итог недели" in txt.lower() and not pg.errors, (txt[:120], pg.errors[:2]))
    snap(pg, "10_day8")
    go(pg, "#review"); pg.wait_for_timeout(300); check("итог недели: знаменатели", "вечерних записей" in pg.inner_text("#app"))
    snap(pg, "10_review"); pg.click("#next"); pg.wait_for_timeout(200)
    if pg.query_selector(".chip >> text=Отчасти"): click_chip(pg, "Отчасти")
    click_chip(pg, "Продолжить"); pg.fill("#a", "отказ принят спокойно"); pg.click("#next"); pg.wait_for_timeout(400)
    st = state(pg); check("итог недели сохранён с решением", len(st["reviews"]) == 1 and st["reviews"][0]["decision"] == "continue" and st["reviews"][0]["snapshot"]["eveningCount"] >= 5, st["reviews"])
    for d in (7, 22):
        shift(pg, 24 * d); set_hour(pg, 10); txt = pg.inner_text("#app")
        check(f"день +{d}: главная без ошибок", not pg.errors and len(txt) > 50, pg.errors[:2])
    # ---------- Сценарий 13/флаг: без условий флага нет ----------
    go(pg, "#flag"); pg.wait_for_timeout(200); check("флаг не начисляется автоматически; причины показаны", "мало случаев" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:120])
    cl = pg.evaluate("() => window.KARMA_RULES.clarity(window.KARMA_APP.data.flags, 6).pct"); check("13: ясность 0 без флагов", cl == 0)
    snap(pg, "13_flag_not")
    go(pg, "#history"); snap(pg, "hist"); check("история открывается", "История" in pg.inner_text("#hero") and not pg.errors, pg.errors[:2])
    # ---------- Сценарий 14: экспорт/импорт без дублей ----------
    exp = pg.evaluate("() => window.KARMA_STORE.exportJSON()")
    n_before = pg.evaluate("() => window.KARMA_APP.data.episodes.length")
    go(pg, "#settings"); pg.click("#imp"); pg.wait_for_timeout(200); pg.fill("#t", exp); pg.click("#prev"); pg.wait_for_timeout(300)
    check("импорт: предпросмотр", "Сюжетов:" in pg.inner_text("#pv")); pg.click("#merge"); pg.wait_for_timeout(600)
    n_after = pg.evaluate("() => window.KARMA_APP.data.episodes.length"); check("14: повторный импорт не дублирует", n_after == n_before, (n_before, n_after))
    pg.reload(); pg.wait_for_timeout(700); n_re = pg.evaluate("() => window.KARMA_APP.data.episodes.length"); check("данные пережили перезагрузку (IndexedDB)", n_re == n_before, (n_before, n_re))
    # ---------- Сценарий 17: тело — нет вывода по органу ----------
    go(pg, "#event"); click_chip(pg, "Это текущий сюжет"); click_chip(pg, "Злость"); pg.click("#next"); pg.wait_for_timeout(300); pg.click("#detail"); pg.wait_for_timeout(300)
    pg.click("#skipq"); pg.wait_for_timeout(200); pg.click("#skipq"); pg.wait_for_timeout(200)
    txt = pg.inner_text("#app"); check("17: наблюдение тела с оговоркой", "не определение причины" in txt, txt[:150])
    pg.click(".chip >> text=Плечи"); pg.click("#next"); pg.wait_for_timeout(200); click_chip(pg, "Напряжение"); pg.click("#skipq"); pg.wait_for_timeout(300)
    st = state(pg); check("тело записано", st["episodes"][-1].get("body", {}).get("locations") == ["Плечи"])
    allt = (open("/home/claude/v2/app.js", encoding="utf8").read() + open("/home/claude/v2/content.js", encoding="utf8").read()).lower()
    check("17: нет таблиц орган→обида и обещаний лечения", "болезнь уйдёт" not in allt and "потому что ты всё несёшь" not in allt)
    # ---------- Сценарий 18: смена времени суток ----------
    set_hour(pg, 20); t1 = pg.inner_text("#hero"); set_hour(pg, 9); t2 = pg.inner_text("#hero")
    check("18: CTA/фон обновляются по времени", "вечер" in t1 and "утро" in t2, (t1[:40], t2[:40]))
    check("18: прошлые записи сохранили дату", ck(st, today, pid)["dateKey"] == today)
    # ---------- Сценарий 20: 360px, крупный текст ----------
    ctx2 = b.new_context(viewport={"width": 360, "height": 740}); pg2 = fresh(ctx2); pg2.goto(U); pg2.wait_for_timeout(500); to_cards(pg2)
    w = pg2.evaluate("() => document.documentElement.scrollWidth"); check("20: нет горизонтального скролла на 360px", w <= 362, w)
    pg2.focus("#swc"); pg2.keyboard.press("ArrowRight"); pg2.wait_for_timeout(300)
    o2 = pg2.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks[0].r, S.deck.length]; }")
    check("20: карточки работают с клавиатуры; первое «цепляет» подбор не завершает (v5)", o2 == [1, "yes", 6] and "2 из 6" in pg2.inner_text("#app") and pg2.query_selector("#pick") is None, (o2, pg2.inner_text("#app")[:60]))
    snap(pg2, "20_cards_360")
    # ---------- Сценарий 2: ни одна карточка не подходит ----------
    pg2.click("#undo"); pg2.wait_for_timeout(200)
    for _ in range(6): pg2.click("#no"); pg2.wait_for_timeout(260)
    check("2: шесть «не цепляет» — без тупика и без вывода о человеке: другие события, свой случай, другой контекст, наблюдение", "ничего не зацепило" in pg2.inner_text("#app").lower() and pg2.query_selector("#more") and pg2.query_selector("#observe") and pg2.query_selector("a[href='#own']") and pg2.query_selector("a[href='#workctx']") and "сопротивлен" not in pg2.inner_text("#app").lower() and "не понял" not in pg2.inner_text("#app").lower(), pg2.inner_text("#app")[:160])
    pg2.click("#observe"); pg2.wait_for_timeout(400)
    check("v5: после входа — карта дня до главной", "устроен твой путь" in pg2.inner_text("#app").lower() and "утром" in pg2.inner_text("#app").lower(), pg2.inner_text("#app")[:100]); pg2.click("#go"); pg2.wait_for_timeout(400)
    st2 = state(pg2); check("2: режим наблюдения без назначенного сюжета и без выдуманного старта практики", st2["patterns"][0]["status"] == "observe" and st2["patterns"][0]["startDate"] is None and st2["patterns"][0].get("practiceStartDate") is None and "наблюдение" in pg2.inner_text("#app").lower() and st2["profile"]["seen"].get("map"), pg2.inner_text("#app")[:80])
    snap(pg2, "02_observe")
    # ---------- Сценарий 15: недоступное хранилище ----------
    ctx3 = b.new_context(viewport={"width": 390, "height": 844}); pg3 = fresh(ctx3)
    pg3.add_init_script("Object.defineProperty(window, 'indexedDB', {get(){ return undefined; }}); Object.defineProperty(window, 'localStorage', {get(){ throw new Error('blocked'); }});")
    pg3.goto(U); pg3.wait_for_timeout(700)
    check("15: видимое сообщение о недоступном хранилище", "Хранилище недоступно" in pg3.inner_text("#banner"), pg3.inner_text("#banner"))
    check("v5: кнопка старта неактивна, пока чекбокс «О подходе» не отмечен; чекбокс пустой", pg3.evaluate("() => document.getElementById('go').disabled && !document.getElementById('consent').checked"))
    consent_start(pg3); pg3.wait_for_timeout(300); check("15: нет ложного «Сохранено»", not pg3.evaluate("() => document.getElementById('saved').classList.contains('on')"))
    # ---------- Сценарий 16: офлайн после первого посещения ----------
    ctx4 = b.new_context(viewport={"width": 390, "height": 844}); pg4 = fresh(ctx4); pg4.goto(U); pg4.wait_for_timeout(1500)
    pg4.evaluate("() => navigator.serviceWorker.ready"); pg4.wait_for_timeout(1500)
    ctx4.set_offline(True); pg4.reload(); pg4.wait_for_timeout(1200)
    off_ok = pg4.query_selector("#go") is not None
    check("16: офлайн после установки — экран работает (Chromium, десктоп)", off_ok, pg4.content()[:100])
    if off_ok:
        pg4.click("a[href='#help']"); pg4.wait_for_timeout(200); check("16: помощь доступна офлайн", "безопасном" in pg4.inner_text("#app"))
    ctx4.set_offline(False)
    # ---------- Сценарий 19: миграция ----------
    ctx5 = b.new_context(viewport={"width": 390, "height": 844}); pg5 = fresh(ctx5)
    v9 = {"num": 6, "birth": "1981-01-22", "theme": "dark", "teacher": "Брат", "teacherType": "person", "portrait": {"quality": "контроль", "action": "спрашиваю"}, "queue": [{"text": "болячка", "heat": 6, "at": 1760000000000}], "signs": [{"at": 1760000000000, "text": "позвонил сам", "teacher": "Брат"}],
          "archive": [{"start": "2026-09-01", "step": 1, "teacher": "Брат", "teacherType": "person", "round": 1, "days": {"1": {"morning": {"at": 1, "score": 7}, "moments": [{"kind": "hold", "note": "промолчал", "at": 2}], "evening": {"at": 3, "weight": 5, "answers": {"x": "было равнодушие"}}}}, "summary": {"at": 4, "score": 1, "me": "спокойнее", "around": "", "passed": True}}], "sprint": None}
    pg5.add_init_script(f"localStorage.setItem('put-karmy-v9', {json.dumps(json.dumps(v9, ensure_ascii=False))});")
    pg5.goto(U); pg5.wait_for_timeout(900)
    txt = pg5.inner_text("#app"); check("19: карточка миграции на главной", "прошлой версии" in txt.lower() and "Брат" in txt, txt[:160])
    raw = pg5.evaluate("() => localStorage.getItem('put-karmy-v9')"); check("19: исходник не удалён", raw is not None and "Брат" in raw)
    st5 = state(pg5); check("19: legacy-флаг не входит в ясность", st5["flags"][0]["legacy"] and pg5.evaluate("() => window.KARMA_RULES.clarity(window.KARMA_APP.data.flags, 6).pct") == 0)
    go(pg5, "#history"); check("19: история показывает прошлую версию", "прошлая версия" in pg5.inner_text("#app").lower()); snap(pg5, "19_history_legacy")
    go(pg5, "#today"); pg5.click("[data-cont]"); pg5.wait_for_timeout(400); st5 = state(pg5)
    check("19: продолжение создаёт новый сюжет в наблюдении, без автогипотезы", any(q["status"] == "observe" and q["hypothesisVersionId"] is None for q in st5["patterns"]))
    go(pg5, "#story"); check("19: старое число не назначает гипотезу автоматически", len(st5["hypotheses"]) == 0 and "символическая тема" in pg5.inner_text("#app").lower())
    # ---------- Сценарий 7/8/9: правила флага (rules.test.js) + UI ----------
    # ---------- Помощь без онбординга ----------
    ctx6 = b.new_context(viewport={"width": 390, "height": 844}); pg6 = fresh(ctx6); pg6.goto(U + "#help"); pg6.wait_for_timeout(600)
    check("помощь доступна без онбординга и даты", "безопасном" in pg6.inner_text("#app")); click_chip(pg6, "Да"); click_chip(pg6, "Опора вокруг");
    for _ in range(4): pg6.click("#n"); pg6.wait_for_timeout(150)
    check("после упражнения — оценка без наград", "Как сейчас" in h1(pg6)); click_chip(pg6, "Тяжелее"); check("при «тяжелее» не повторяем то же", "Повторять то же" in pg6.inner_text("#app"))
    snap(pg6, "11_help")
    go(pg6, "#help"); click_chip(pg6, "Мне плохо"); check("кризис: карточка реальной помощи без заданий", "живая помощь" in pg6.inner_text("#app").lower() and "нет заданий" in pg6.inner_text("#app").lower()); snap(pg6, "11_help_harm")
    # ---------- Символическая тема по желанию ----------
    go(pg6, "#symbol"); pg6.fill("#b", "1981-01-22"); pg6.click("#go"); pg6.wait_for_timeout(2500); check("астролябия: число 6, тема без обесценивающих оговорок", "путь заботы" in pg6.inner_text("#app").lower() and "число пути" in pg6.inner_text("#app").lower() and "не наука" not in pg6.inner_text("#app").lower()); snap(pg6, "symbol")
    go(pg6, "#about"); check("о методе: источники и пределы", "пределы выводов" in pg6.inner_text("#app").lower() and "nhs.uk" in pg6.content())
    # ---------- P1-3: черновики не теряются ----------
    set_hour(pg, 12)
    go(pg, "#new"); pg.wait_for_selector("#a"); pg.fill("#a", "Партнёр перенёс встречу без предупреждения"); pg.wait_for_timeout(600)
    pg.click("#cancel"); pg.wait_for_timeout(300)
    go(pg, "#new"); pg.wait_for_selector("#a")
    check("P1-3: текст восстановлен после «Позже»", pg.input_value("#a") == "Партнёр перенёс встречу без предупреждения", pg.input_value("#a"))
    pg.fill("#a", "Партнёр перенёс встречу без предупреждения, второй раз"); pg.wait_for_timeout(100); go(pg, "#story"); pg.wait_for_timeout(200)
    go(pg, "#new"); pg.wait_for_selector("#a")
    check("P1-3: текст сохранён при уходе в другой раздел без паузы", pg.input_value("#a").endswith("второй раз"), pg.input_value("#a"))
    pg.reload(); pg.wait_for_timeout(700); go(pg, "#new"); pg.wait_for_selector("#a")
    check("P1-3: текст восстановлен после перезагрузки", pg.input_value("#a").endswith("второй раз"), pg.input_value("#a"))
    pg.click("#next"); pg.wait_for_timeout(200); pg.click("#back"); pg.wait_for_timeout(200)
    check("P1-3: «Назад» не теряет текст", pg.input_value("#a").endswith("второй раз"))
    keys = pg.evaluate("() => Object.keys(window.KARMA_APP.profile.drafts)")
    check("P1-3: ключ черновика содержит сюжет и версию схемы", any(k.startswith("new|") and pid in k and k.endswith("|2") for k in keys), keys)
    # устаревший черновик: предложение продолжить, не молчаливая потеря
    go(pg, "#story")
    pg.evaluate("async () => { const A = window.KARMA_APP; const k = Object.keys(A.profile.drafts).find(x => x.startsWith('new|')); A.profile.drafts[k].at -= 3 * 24 * 3600e3; await A.saveProfile(); }")
    go(pg, "#new"); pg.wait_for_timeout(200)
    check("P1-3: устаревший черновик предлагает продолжить или начать заново", "незаконченная запись" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:100])
    pg.click("#cont"); pg.wait_for_timeout(200); check("P1-3: «Продолжить» возвращает текст", pg.input_value("#a").endswith("второй раз"))
    pg.click("#cancel"); pg.wait_for_timeout(200)
    # ошибка хранилища при завершении: черновик остаётся, ответ доступен для повторной записи
    pg.evaluate("() => { window.__origPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v) { if (this.name === 'episodes') throw new Error('disk full'); return window.__origPut.apply(this, arguments); }; }")
    go(pg, "#event"); click_chip(pg, "Это текущий сюжет"); click_chip(pg, "Обида"); pg.eval_on_selector("#sc", "e=>{e.value=6;e.dispatchEvent(new Event('input'))}"); pg.click("#next"); pg.wait_for_timeout(400)
    check("P1-3: при ошибке записи показано сообщение, а не «Сохранено»", "Не удалось сохранить" in pg.inner_text("#banner"), pg.inner_text("#banner"))
    dk = pg.evaluate("() => Object.keys(window.KARMA_APP.profile.drafts).filter(k => k.startsWith('event|'))")
    check("P1-3: черновик не удалён после ошибки", len(dk) == 1, dk)
    pg.evaluate("() => { IDBObjectStore.prototype.put = window.__origPut; }"); pg.click("#retrySave"); pg.wait_for_timeout(400)
    go(pg, "#event"); pg.wait_for_timeout(200)
    check("P1-3: ответы доступны для повторной записи (поток открылся на последнем шаге)", "сильно задело" in pg.inner_text("#app").lower(), pg.inner_text("#app")[:100])
    pg.click("#next"); pg.wait_for_timeout(300); pg.click("text=Просто записать"); pg.wait_for_timeout(200)
    dk = pg.evaluate("() => Object.keys(window.KARMA_APP.profile.drafts).filter(k => k.startsWith('event|'))"); check("P1-3: после успешной записи черновик удалён", len(dk) == 0, dk)
    # ---------- P1-4: импорт атомарен ----------
    exp = pg.evaluate("() => window.KARMA_STORE.exportJSON()")
    before = pg.evaluate("() => { const d = window.KARMA_APP.data; return { ep: d.episodes.length, pt: d.patterns.length, hy: d.hypotheses.length, ck: Object.keys(d.checkins).length }; }")
    pg.evaluate("() => { let n = 0; window.__origPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v) { if (this.name === 'episodes' && ++n === 3) throw new Error('boom'); return window.__origPut.apply(this, arguments); }; }")
    go(pg, "#settings"); pg.click("#imp"); pg.wait_for_timeout(200); pg.fill("#t", exp); pg.click("#prev"); pg.wait_for_timeout(300); pg.click("#merge"); pg.wait_for_timeout(800)
    check("P1-4: ошибка импорта показана", "Не удалось сохранить" in pg.inner_text("#banner"), pg.inner_text("#banner"))
    pg.evaluate("() => { IDBObjectStore.prototype.put = window.__origPut; }")
    pg.reload(); pg.wait_for_timeout(800)
    after = pg.evaluate("() => { const d = window.KARMA_APP.data; return { ep: d.episodes.length, pt: d.patterns.length, hy: d.hypotheses.length, ck: Object.keys(d.checkins).length }; }")
    check("P1-4: прерванный импорт оставил базу прежней (ничего не стёрто)", after == before, (before, after))
    go(pg, "#settings"); pg.click("#imp"); pg.wait_for_timeout(200); pg.fill("#t", exp); pg.click("#prev"); pg.wait_for_timeout(300); pg.click("#merge"); pg.wait_for_timeout(800)
    pg.reload(); pg.wait_for_timeout(800)
    after2 = pg.evaluate("() => { const d = window.KARMA_APP.data; return { ep: d.episodes.length, pt: d.patterns.length, hy: d.hypotheses.length, ck: Object.keys(d.checkins).length }; }")
    check("P1-4: успешный импорт восстанавливается после перезагрузки без дублей", after2 == before, (before, after2))
    # ---------- P2-5: короткий вечер ----------
    shift(pg, 24); set_hour(pg, 11); do_action(pg, "Отказ", rehearsal=True)
    set_hour(pg, 20); ok = do_evening(pg, "Повода не было", None, 2, quick=True)
    st = state(pg); tk = pg.evaluate("() => window.KARMA_APP.today()"); ev = ck(st, tk, pid)["evening"]
    check("P2-5: короткий вечер — репетиция не стала поводом", ok and ev["quick"] and ev["hadOpportunity"] == "no" and ev["actionStatus"] is None and ev["currentImpact"] == 2, ev)
    shift(pg, 24); set_hour(pg, 20); ok = do_evening(pg, "Был повод и получилось", None, 1, quick=True)
    st = state(pg); tk = pg.evaluate("() => window.KARMA_APP.today()"); ev = ck(st, tk, pid)["evening"]
    check("P2-5: короткий вечер фиксирует и повод, и действие", ok and ev["hadOpportunity"] == "yes" and ev["actionStatus"] == "done" and ev.get("skillId") == "refuse", ev)
    # ---------- P2-6: смена объяснения помечает разрешение и план ----------
    st = state(pg); x0 = [e for e in st["experiments"] if e["status"] == "active"][0]
    check("P2-6: план помнит версию объяснения", x0.get("hypothesisVersionId") == st["patterns"][0]["hypothesisVersionId"], (x0.get("hypothesisVersionId"), st["patterns"][0]["hypothesisVersionId"]))
    go(pg, "#story"); check("P2-6: до смены объяснения пересмотр не предлагается", "объяснение изменилось" not in pg.inner_text("#app").lower())
    pg.click("button[data-edit='hyp']"); pg.wait_for_timeout(200); pg.click("#rej"); pg.wait_for_timeout(400); go(pg, "#story"); pg.wait_for_timeout(200)
    txt = pg.inner_text("#app").lower(); check("P2-6: после отказа от объяснения разрешение и шаг ждут решения", "объяснение изменилось" in txt and "шаг «" in txt and "разрешение «" in txt, txt[:200])
    pg.click("#keepDep"); pg.wait_for_timeout(300); st = state(pg); x1 = [e for e in st["experiments"] if e["status"] == "active"][0]
    check("P2-6: «Оставить» снимает пометку осознанно", "объяснение изменилось" not in pg.inner_text("#app").lower() and x1.get("keptFor") is None and st["patterns"][0]["permissionSource"].get("keptFor") is None, (x1.get("keptFor"), st["patterns"][0].get("permissionSource")))
    # ветка «Пока не знаю» в шаге разрешения — отдельная версия объяснения
    go(pg, "#module/rule"); pg.wait_for_timeout(200)
    if pg.query_selector("#deep"): pg.click("#deep"); pg.wait_for_timeout(300)
    click_chip(pg, "Пока не знаю"); pg.fill("#a", "что я чувствую в первую секунду"); pg.click("#next"); pg.wait_for_timeout(400)
    st = state(pg); hcur = [h for h in st["hypotheses"] if h["id"] == st["patterns"][0]["hypothesisVersionId"]]
    check("P2-6: «Пока не знаю» записано как версия с неопределённостью", len(hcur) == 1 and hcur[0]["branch"] == "unknown" and hcur[0]["status"] == "selected", hcur)
    go(pg, "#story"); txt = pg.inner_text("#app").lower(); check("P2-6: неопределённость видна в сюжете, план снова ждёт решения", "пока неясно" in txt and "объяснение изменилось" in txt and "разрешение «" not in txt, txt[:200])
    pg.click("#redoDep"); pg.wait_for_timeout(300); check("P2-6: «Выбрать другое» ведёт к шагу действия", "выполнимый шаг" in pg.inner_text("#app").lower() or "Маленький" in pg.inner_text("#app"), pg.inner_text("#app")[:100])
    pg.fill("#a", "Спрошу, что именно нужно"); pg.click("#next"); pg.wait_for_timeout(200); click_chip(pg, "Станет спокойнее"); click_chip(pg, "По своему состоянию после"); click_chip(pg, "Говорю о своей потребности"); click_chip(pg, "меня попросят"); pg.wait_for_timeout(400)
    st = state(pg); x2 = [e for e in st["experiments"] if e["status"] == "active"][0]
    check("P2-6: новый план привязан к текущему объяснению; старые версии в истории", x2["hypothesisVersionId"] == st["patterns"][0]["hypothesisVersionId"] and len(st["experiments"]) >= 3 and "объяснение изменилось" not in pg.inner_text("#app").lower())
    # ---------- P1-2: смена навыка — новая версия плана, старые действия остаются за прежним навыком ----------
    go(pg, "#story"); pg.click("button[data-edit='skill']"); pg.wait_for_timeout(200); click_chip(pg, "Делаю паузу"); pg.wait_for_timeout(300)
    st = state(pg); xs = sorted([e for e in st["experiments"] if e["patternId"] == pid], key=lambda e: e["version"])
    check("P1-2: смена навыка создала новую версию плана, прежняя сохранила свой навык", xs[-1]["skillId"] == "pause" and xs[-2]["skillId"] == "need" and xs[-2]["status"] == "replaced", [(e["version"], e["skillId"], e["status"]) for e in xs])
    el = pg.evaluate("() => { const A = window.KARMA_APP, R = window.KARMA_RULES; const p = A.data.patterns[0]; return R.flagEligibility({ pattern: p, checkins: A.data.checkins, episodes: A.data.episodes, todayKey: A.today(), skillId: 'pause' }); }")
    check("P1-2: для нового навыка подтверждений в последних окнах нет", not el["eligible"], el["reasons"][:2])
    # ---------- P1-1: второй сюжет в тот же день не видит вечер первого и не стирает его ----------
    n_ck = len(state(pg)["checkins"])
    go(pg, "#story"); pg.click("#newP"); pg.wait_for_timeout(150); pg.click("#newP"); pg.wait_for_timeout(300)
    first_episode(pg, "Сосед сверлит после десяти вечера")
    st = state(pg); pB = [q for q in st["patterns"] if q["status"] == "active"][0]
    check("P1-1: новый сюжет создан, старый ушёл в историю", pB["id"] != pid and len(st["checkins"]) == n_ck)
    set_hour(pg, 20); txt = pg.inner_text("#app")
    check("P1-1: для нового сюжета вечер сегодня открыт, вечер прежнего сюжета не приписан", "подвести итог дня" in txt.lower() and ck(st, tk, pid) is not None and ck(st, tk, pB["id"]) is None, txt[:120])
    do_evening(pg, "Был повод", "Получилось", 1); st = state(pg)
    check("P1-1: вечера двух сюжетов за один день хранятся отдельно", ck(st, tk, pid) is not None and ck(st, tk, pB["id"]) is not None and len(st["checkins"]) == n_ck + 1)
    # ---------- P2-7: карточки без объяснения человека ----------
    ctx7 = b.new_context(viewport={"width": 390, "height": 844}); pg7 = fresh(ctx7); pg7.goto(U); pg7.wait_for_timeout(500); to_cards(pg7)
    titles = pg7.evaluate("() => window.KARMA_CONTENT.packs.map(p => p.title)")
    check("P2-7: заголовки карточек нейтральны", all(not t.lower().startswith(("мне ", "меня ", "я ")) for t in titles) and "Контроль и самостоятельность" in titles, titles)
    check("P2-7: на экране карточки нет «мне трудно»", "мне трудно" not in pg7.inner_text("#app").lower() and "потому что" not in pg7.inner_text("#app").lower())
    # ---------- обновление базы 1 → 2: записи по дате переносятся на ключ «дата|сюжет» ----------
    ctx8 = b.new_context(viewport={"width": 390, "height": 844}); pg8 = fresh(ctx8); pg8.goto(U + "manifest.webmanifest"); pg8.wait_for_timeout(300)
    pg8.evaluate("""() => new Promise(res => { const rq = indexedDB.open('put-karmy-v2', 1); rq.onupgradeneeded = () => { const db = rq.result; ['patterns','episodes','hypotheses','experiments','reviews','flags','research','kv'].forEach(s => db.createObjectStore(s, { keyPath: s === 'research' ? 'patternId' : s === 'kv' ? 'key' : 'id' })); db.createObjectStore('checkins', { keyPath: 'dateKey' }); }; rq.onsuccess = () => { const db = rq.result; const tx = db.transaction(['checkins','patterns','experiments','episodes','kv'], 'readwrite'); tx.objectStore('patterns').put({ id: 'pA', title: 'Старый', status: 'active', startDate: '2026-10-10', createdAt: 1, experimentId: 'xA', skillId: 'pause', hypothesisVersionId: null, queue: [], permission: 'Старое разрешение' }); tx.objectStore('experiments').put({ id: 'xA', patternId: 'pA', version: 1, skillId: 'pause', action: 'пауза', status: 'active', createdAt: 1, kind: 'first-plan', results: [] }); tx.objectStore('episodes').put({ id: 'eA', patternId: 'pA', dateKey: '2026-10-11', loggedAt: 5, linkStatus: 'confirmed', newResponse: { type: 'pause', chosen: 'chosen', at: 5 } }); tx.objectStore('checkins').put({ dateKey: '2026-10-11', patternId: 'pA', evening: { at: 6, currentImpact: 1, hadOpportunity: 'yes', actionStatus: 'done' } }); tx.objectStore('checkins').put({ dateKey: '2026-10-12', help: [{ at: 7 }] }); tx.objectStore('kv').put({ key: 'profile', value: { seen: { start: true }, drafts: { 'event': { i: 1, ans: { relation: 'same' } }, 'new': { i: 0, ans: { event: 'Набрано до обновления' }, at: 1 }, 'mod-need': { i: 0, ans: { need: 'Уважение' } } } } }); tx.objectStore('kv').put({ key: 'meta', value: { schemaVersion: 2 } }); tx.oncomplete = () => { db.close(); res(); }; }; })""")
    pg8.goto(U); pg8.wait_for_timeout(900); st8 = state(pg8)
    check("обновление базы: записи дня получили ключ «дата|сюжет», принадлежность не додумана", set(st8["checkins"].keys()) == {"2026-10-11|pA", "2026-10-12|-"} and st8["checkins"]["2026-10-12|-"]["patternId"] is None, list(st8["checkins"].keys()))
    check("обновление базы: старые действия получили навык из плана того времени", st8["episodes"][0]["newResponse"].get("skillId") == "pause" and st8["checkins"]["2026-10-11|pA"]["evening"].get("skillId") == "pause", st8["episodes"][0]["newResponse"])
    dr8 = st8["profile"]["drafts"]
    check("обновление базы: схема 5, черновики прежней сборки перенесены с областью сюжета", st8["meta"]["schemaVersion"] == 5 and "event" not in dr8 and dr8.get("new|pA|2", {}).get("ans", {}).get("event") == "Набрано до обновления" and "mod-need|pA|2" in dr8 and "event|pA|2" in dr8 and not pg8.errors, (st8["meta"], list(dr8.keys()), pg8.errors[:2]))
    check("обновление базы: старое действие помечено backfilled и не входит в флаг", st8["episodes"][0]["newResponse"].get("backfilled") is True and not pg8.evaluate("() => window.KARMA_RULES.isConfirmedAction(window.KARMA_APP.data.episodes[0], 'pause')"))
    check("обновление базы: старое разрешение получило происхождение migrated", st8["patterns"][0].get("permissionSource", {}).get("origin") == "migrated", st8["patterns"][0].get("permissionSource"))
    check("v5: действующий сюжет получил старт практики = прежний startDate (история не переписана), обучение считается пройденным", st8["patterns"][0].get("practiceStartDate") == "2026-10-10" and st8["patterns"][0].get("practiceStartOrigin") == "migrated" and st8["patterns"][0]["startDate"] == "2026-10-10" and st8["profile"]["seen"].get("map") and st8["profile"]["seen"].get("trail") and st8["profile"].get("guideOffer") is True, (st8["patterns"][0].get("practiceStartDate"), st8["profile"].get("seen")))
    txt8 = pg8.inner_text("#app"); check("v5: существующему пользователю предложено объяснение практики, без сброса данных", "мы добавили объяснение практики" in txt8.lower() and pg8.query_selector("a[href='#guide']") is not None and "устроен твой путь" not in txt8.lower(), txt8[:200])
    pg8.click("#guideOffer a[href='#guide']"); pg8.wait_for_timeout(300); txt8 = pg8.inner_text("#app").lower()
    check("v5: «Как пользоваться» объясняет кнопки, камни, шаги, небо и флаг; предложение снято", all(w in txt8 for w in ["меня зацепило", "попробовал новый ответ", "камни", "шаги", "небо", "флаг", "как получить флаг"]) and pg8.evaluate("() => window.KARMA_APP.profile.guideOffer === false"), txt8[:200]); snap(pg8, "v5_guide")
    go(pg8, "#today"); check("v5: после просмотра предложение не повторяется", "мы добавили объяснение" not in pg8.inner_text("#app").lower())
    go(pg8, "#new"); pg8.wait_for_timeout(200); check("обновление базы: старый черновик предложен к продолжению", "незаконченная запись" in pg8.inner_text("#app").lower(), pg8.inner_text("#app")[:80])
    pg8.click("#cont"); pg8.wait_for_selector("#a"); check("обновление базы: текст старого черновика виден в форме", pg8.input_value("#a") == "Набрано до обновления", pg8.input_value("#a")); pg8.click("#cancel"); pg8.wait_for_timeout(200)
    pg8.reload(); pg8.wait_for_timeout(800); check("обновление базы: повторный запуск без ошибок", len(state(pg8)["checkins"]) == 2 and not pg8.errors, pg8.errors[:2])
    # неоднозначный черновик (сюжет завершён) сохраняется текстом в настройках
    pg8.evaluate("""async () => { const A = window.KARMA_APP; A.data.patterns[0].status = 'done'; A.data.meta.schemaVersion = 2; A.profile.drafts = { 'mod-need': { i: 0, ans: { need: 'Признание' } } }; await window.KARMA_STORE.replaceAll(Object.assign(A.data, { profile: A.profile })); }""")
    pg8.reload(); pg8.wait_for_timeout(800); st8 = state(pg8)
    check("обновление базы: неоднозначный черновик не приписан сюжету, текст сохранён", "mod-need|-|2" not in st8["profile"]["drafts"] and st8["profile"].get("recovered", [{}])[0].get("ans", {}).get("need") == "Признание", st8["profile"].get("recovered"))
    go(pg8, "#settings"); pg8.click("summary >> text=Незаконченные записи"); pg8.wait_for_timeout(200); check("обновление базы: восстановимые записи видны в настройках", "признание" in pg8.inner_text("#app").lower() and "незаконченные записи" in pg8.inner_text("#app").lower(), pg8.inner_text("#app")[-300:])
    # импорт файла с неверной структурой: причина показана, исключения нет
    pg8.click("#imp"); pg8.wait_for_timeout(200); pg8.fill("#t", '{"schemaVersion":3,"patterns":{}}'); pg8.click("#prev"); pg8.wait_for_timeout(300)
    check("импорт: неверная структура объяснена пользователю", "списком" in pg8.inner_text("#pv") and not pg8.errors, (pg8.inner_text("#pv"), pg8.errors[:2]))
    # ---------- Полный путь: вход → карточки → эпизод → гипотеза → эксперимент → вечер → пересмотр → итоги недель → флаг, с пропуском ----------
    ctx9 = b.new_context(viewport={"width": 390, "height": 844}); pg9 = fresh(ctx9); pg9.goto(U); pg9.wait_for_timeout(600)
    pg9.evaluate("async () => { const A = window.KARMA_APP; A.profile.devMode = true; const cur = new Date(A.nowTs()).getHours(); A.profile.offsetH = 10 - cur; await A.saveProfile(); A.route(); }"); pg9.wait_for_timeout(300)
    check("v5: «О подходе» — раскрываемый текст и пустой чекбокс; краткая строка видна; кнопка неактивна", pg9.evaluate("() => { const d = document.querySelector('#approach details'); return d && !d.open && !document.getElementById('consent').checked && document.getElementById('go').disabled && d.textContent.includes('не ставит диагнозы'); }") and "нумерология задаёт тему пути" in pg9.inner_text("#app").lower() and "не ставит диагнозы" not in pg9.inner_text("#app").lower(), pg9.inner_text("#app")[:300])
    pg9.click("#approach summary"); pg9.wait_for_timeout(200); check("v5: подробности открываются без ухода с экрана", "не ставит диагнозы" in pg9.inner_text("#app").lower() and pg9.query_selector("#consent") is not None); snap(pg9, "v5_start")
    consent_start(pg9); pg9.wait_for_timeout(300); check("v4: интрига без черт характера", "пара коротких вопросов" in pg9.inner_text("#app").lower() and "боишься" not in pg9.inner_text("#app").lower())
    c9 = pg9.evaluate("() => window.KARMA_APP.profile.consent"); check("v5: согласие сохранено локально с версией текста", c9 and c9.get("version") == pg9.evaluate("() => window.KARMA_CONTENT.extra.onboarding.approach.version") and c9.get("at"), c9)
    pg9.fill("#b", "1981-01-22"); pg9.click("#go"); pg9.wait_for_timeout(300)
    check("путь: открытие числа с возможностью пропуска", pg9.query_selector("#skipAnim") is not None); pg9.click("#skipAnim"); pg9.wait_for_timeout(200)
    txt = pg9.inner_text("#app").lower(); check("v4/v5: число показано коротко, без толкования личности и без повторной оговорки", "твоё число — 6" in txt and "с какого сюжета" in txt and "забота" not in txt and "молчишь" not in txt and "не влияет" not in txt and "традиция" not in txt, txt[:200])
    snap(pg9, "v4_number"); pg9.click("#go"); pg9.wait_for_timeout(400)
    check("v4: сфера — навигация, не тест", "напряжение" in pg9.inner_text("h1.q").lower() and "один выбор" in pg9.inner_text("#app").lower()); snap(pg9, "v4_area")
    click_chip(pg9, "Работа и общение"); pg9.wait_for_timeout(300)
    check("v5: работа — сначала контекст (руководитель / коллеги / клиенты / переписка / нагрузка / по-разному)", "где именно" in pg9.inner_text("h1.q").lower() and len(pg9.query_selector_all(".chip")) == 6 and "С руководителем" in pg9.inner_text("#app"), pg9.inner_text("#app")[:200]); snap(pg9, "v5_workctx")
    click_chip(pg9, "С руководителем"); pg9.wait_for_timeout(300)
    deck9 = pg9.evaluate("() => window.KARMA_APP.profile.onb.deck.map(c => ({ id: c.id, areas: c.areas, ctx: c.ctx || [] }))")
    check("v5: колода — шесть событий: четыре под руководителя и два соседних, все рабочие, без дублей; число не влияет", len(deck9) == 6 and all("work" in c["areas"] for c in deck9) and all("boss" in c["ctx"] for c in deck9[:4]) and len(set(c["id"] for c in deck9)) == 6 and not any(c["id"] == "ev-silence" for c in deck9[:4]), deck9)
    txt = pg9.inner_text("#app"); check("v5: перед карточками — задача про раздражение; счётчик «1 из 6»; кнопки «Не цепляет / Цепляет / Не уверен»; обучение жесту той же терминологией", "1 из 6" in txt and "цепляло тебя" in txt.lower() and "шесть коротких ситуаций" in txt.lower() and pg9.inner_text("#yes") == "Цепляет" and pg9.inner_text("#no") == "Не цепляет" and pg9.inner_text("#unsure") == "Не уверен" and "вправо — цепляет" in txt.lower() and "%" not in txt and "точность" not in txt.lower(), txt[:300]); snap(pg9, "v5_first_card")
    check("v4: карточка — одно событие без реакции и причины", "потому что" not in pg9.inner_text("#swc").lower())
    ev9 = pg9.evaluate("() => window.KARMA_APP.profile.onb.deck[0]")
    pg9.click("#yes"); pg9.wait_for_timeout(300); check("v5: первое «цепляет» не завершает подбор — следующая карточка, подсказка «хотя бы на пять»", "2 из 6" in pg9.inner_text("#app") and pg9.query_selector("#pick") is None and "хотя бы на пять" in pg9.inner_text("#app").lower() and pg9.query_selector("#take") is None, pg9.inner_text("#app")[:160])
    check("путь: обучение показывается один раз", "вправо — цепляет" not in pg9.inner_text("#app").lower())
    answer_cards(pg9, ["no", "unsure", "no"]); check("v5: после четырёх ответов выбора ещё нет", pg9.query_selector("#pick") is None and "5 из 6" in pg9.inner_text("#app"))
    pg9.click("#yes"); pg9.wait_for_timeout(300); check("v5: после пяти ответов (включая «не уверен») можно выбрать из отмеченных или досмотреть шестую", pg9.query_selector("#pick") is not None and "(2)" in pg9.inner_text("#pick") and "6 из 6" in pg9.inner_text("#app"), pg9.inner_text("#app")[:200]); snap(pg9, "v5_card6")
    pg9.click("#pick"); pg9.wait_for_timeout(300); check("v5: «Что из этого сейчас задевает сильнее всего?» — один фокус, остальное на потом; можно досмотреть", "задевает сильнее всего" in pg9.inner_text("h1.q").lower() and "один фокус" in pg9.inner_text("#app").lower() and len(pg9.query_selector_all(".chip[data-i]")) == 2 and pg9.query_selector("#back") is not None, pg9.inner_text("#app")[:200]); snap(pg9, "v5_choose")
    pg9.click(".chip[data-i='0']"); pg9.wait_for_timeout(400)
    check("v5: учитель — первый вопрос после выбора; контекст «руководитель» предложен к подтверждению", "с кем или с чем" in pg9.inner_text("h1.q").lower() and pg9.evaluate("() => [...document.querySelectorAll('#ch .chip.on')].map(b => b.textContent)") == ["Начальник"] and ev9["text"] in pg9.inner_text("#app"), pg9.inner_text("#app")[:200]); snap(pg9, "v5_teacher")
    pg9.click("#next"); pg9.wait_for_timeout(400)
    check("v5: «вспомни последний случай» — одна фраза, примеры подставляются", "последний случай" in pg9.inner_text("h1.q").lower() and pg9.query_selector("#a") is not None and pg9.inner_text("#tg .chip >> nth=0") == ev9["text"], pg9.inner_text("#app")[:200]); snap(pg9, "v5_case")
    pg9.fill("#a", "Начальник поменял задачу в пятницу вечером"); pg9.click("#next"); pg9.wait_for_timeout(300); check("v5: когда это было — без обязательной даты", "когда это было" in pg9.inner_text("h1.q").lower())
    click_chip(pg9, "На этой неделе"); pg9.click("#next"); pg9.wait_for_timeout(300); check("v5: повторение — один компактный выбор", "повторяется" in pg9.inner_text("h1.q").lower() and "Такое повторяется" in pg9.inner_text("#app") and "Это первый случай" in pg9.inner_text("#app"))
    click_chip(pg9, "Такое повторяется"); pg9.wait_for_timeout(400)
    check("v4/v5: «что задело» с вариантами события, «не задело» и «другое»; реакция не спрашивается (отложена)", "задело сильнее" in pg9.inner_text("h1.q").lower() and "не задело" in pg9.inner_text("#app").lower() and "трудно сказать" in pg9.inner_text("#app").lower() and "Начальник поменял задачу" in pg9.inner_text("#app"), pg9.inner_text("#app")[:200]); snap(pg9, "v4_sting")
    m9 = pg9.evaluate("() => { const S = window.KARMA_APP.profile.onb; const e = window.KARMA_CONTENT.extra.events.find(x => x.id === S.event); return e.meanings[0]; }")
    pg9.click("#ch .chip >> nth=0"); pg9.wait_for_timeout(400)
    txt = pg9.inner_text("#app"); tl = txt.lower()
    check("v5: резюме «Вот с чего начинаем»: сфера, учитель, сюжет, что задевает — только подтверждённое; тема числа отдельно", "вот с чего начинаем" in tl and "сфера: работа и общение · с руководителем" in tl and "учитель: отношения с начальником" in tl and "начальник поменял задачу в пятницу вечером" in tl and "это повторяется" in tl and ("особенно задевает: " + m9["text"].lower()) in tl and "тема твоего пути · 6" in tl and "дата предсказала" not in tl and "обычно ты" not in tl and "%" not in txt and pg9.query_selector("#ok") is not None and pg9.query_selector("#fix") is not None, txt[:500]); snap(pg9, "v5_summary")
    check("v4: в резюме только подтверждённые ответы", "боишься" not in tl and "запрещаешь" not in tl and "внутренняя причина" not in tl)
    pg9.click("#fix"); pg9.wait_for_timeout(200); check("v5: «Поправить» — учителя, случай, что задело", pg9.query_selector("#fixbox a[href='#case']") is not None and pg9.query_selector("#fixbox a[href='#teacher']") is not None and pg9.query_selector("#fixbox a[href='#sting']") is not None)
    pg9.click("#fixbox a[href='#case']"); pg9.wait_for_timeout(300); check("v5: правка случая возвращает прежний текст", pg9.input_value("#a") == "Начальник поменял задачу в пятницу вечером", pg9.input_value("#a"))
    go(pg9, "#help"); pg9.wait_for_timeout(200); pg9.click("a[href='#today']"); pg9.wait_for_timeout(300); check("v5: помощь и возврат сохраняют этап входа", pg9.query_selector("#a") is not None and pg9.input_value("#a") == "Начальник поменял задачу в пятницу вечером", pg9.inner_text("#app")[:80])
    pg9.click("#next"); pg9.wait_for_timeout(250); click_chip(pg9, "На этой неделе"); pg9.click("#next"); pg9.wait_for_timeout(250); click_chip(pg9, "Такое повторяется"); pg9.wait_for_timeout(300)
    check("v5: после правки — снова «что задело» с прежним выбором", "задело сильнее" in pg9.inner_text("h1.q").lower() and pg9.evaluate("() => document.querySelectorAll('#ch .chip.on').length") == 1); pg9.click("#next"); pg9.wait_for_timeout(300)
    pg9.reload(); pg9.wait_for_timeout(700); check("v5: перезагрузка возвращает на резюме", "вот с чего начинаем" in pg9.inner_text("#app").lower(), pg9.inner_text("#app")[:80])
    pg9.click("#ok"); pg9.wait_for_timeout(400)
    txt = pg9.inner_text("#app"); check("v5: урок предлагается после резюме: «предлагаю начать с этого урока… проверим»; учитель, урок, в действии", "предлагаю начать с этого урока" in txt.lower() and "проверим, подходит ли он" in txt.lower() and "Твой учитель сейчас" in txt and ("Возможный урок" in txt or "Первый шаг" in txt) and "В действии:" in txt and "причина найдена" not in txt.lower(), txt[:300]); snap(pg9, "v4_lesson")
    exp9 = pg9.evaluate("() => { const S = window.KARMA_APP.profile.onb; const e = window.KARMA_CONTENT.extra.events.find(x => x.id === S.event); const m = e.meanings[0]; return m.lessonId ? window.KARMA_RULES.findLesson(window.KARMA_CONTENT.packs, m.lessonId).title : m.observe.title; }")
    check("v4.1: предложенный урок соответствует выбранному значению события", exp9.lower() in txt.lower(), (exp9, txt[:200]))
    pg9.click("#rej"); pg9.wait_for_timeout(300); alts = pg9.evaluate("() => [...document.querySelectorAll('[data-l]')].map(b => b.dataset.l)")
    check("путь: «не мой урок» → альтернативы без отвергнутого и наблюдение, учитель сохранён", len(alts) >= 2 and "__observe" in alts and pg9.evaluate("() => !!window.KARMA_APP.profile.onb.teacher"), alts)
    pg9.click(f"[data-l='{alts[0]}']"); pg9.wait_for_timeout(300); pg9.click("#go"); pg9.wait_for_timeout(600)
    txt = pg9.inner_text("#app"); check("v5: после урока — карта «Как будет устроен твой путь»: утром / когда зацепит / вечером, без обязательных трёх входов", "как будет устроен твой путь" in txt.lower() and "утром" in txt.lower() and "когда зацепит" in txt.lower() and "вечером" in txt.lower() and "всё сразу заполнять не нужно" in txt.lower() and "Понятно, начнём" in txt, txt[:300]); snap(pg9, "v5_map")
    pg9.reload(); pg9.wait_for_timeout(700); check("v5: перезагрузка не пропускает карту", "как будет устроен" in pg9.inner_text("#app").lower()); pg9.click("#go"); pg9.wait_for_timeout(500)
    st9 = state(pg9); P9 = st9["patterns"][0]; day1 = pg9.evaluate("() => window.KARMA_APP.today()")
    check("путь: сюжет с учителем, уроком и первым планом по навыку урока; происхождение частей резюме записано", P9["status"] == "active" and P9["packId"] and P9["lesson"]["id"] == alts[0] and P9["skillId"] == P9["lesson"]["skillId"] and P9["teacher"]["kind"] == "boss" and P9["startDate"] == day1 and len(st9["episodes"]) == 1 and P9["scenario"]["eventOrigin"] == "user_selected" and P9["scenario"]["caseOrigin"] == "user_written" and P9["scenario"]["caseText"] == "Начальник поменял задачу в пятницу вечером" and P9["scenario"]["meaningOrigin"] == "user_selected" and P9["lesson"]["origin"] == "editorial_hypothesis" and P9["lesson"]["basis"]["meaningId"] == m9["id"] and P9["scenario"]["ctx"] == "boss", (P9.get("lesson"), P9.get("scenario")))
    check("v5: утренний первый запуск — практика с сегодня, дата случая отдельно, первый день записан", P9["practiceStartDate"] == day1 and P9["practiceStartOrigin"] == "user" and P9["caseDate"] == day1 and st9["episodes"][0]["dateKey"] == day1 and P9["firstDay"]["kind"] == "morning" and P9["firstDay"]["date"] == day1 and st9["profile"]["seen"].get("map"), (P9.get("practiceStartDate"), P9.get("firstDay")))
    check("v4: остальное «цепляет» сохранено на потом", len(st9["profile"].get("savedScenarios", [])) == 1 and st9["profile"]["savedScenarios"][0]["id"] == deck9[4]["id"], st9["profile"].get("savedScenarios"))
    txt = pg9.inner_text("#app"); tl = txt.lower()
    check("v5: главная первого утра — «Сегодня — первый день», шаг на сегодня, учитель и урок, прямые названия кнопок с подписями", "сегодня — первый день" in tl and "возьми шаг на сегодня" in tl and "взять шаг на сегодня" in tl and "сегодня на твоём пути" in tl and "учитель" in tl and "урок" in tl and "меня зацепило" in tl and "попробовал новый ответ" in tl and "знакомый сценарий повторился?" in tl and "отметь, какое действие попробовал" in tl and "сейчас тяжело" in tl and "прийти в себя" in tl and "день 1" in pg9.inner_text("#hero").lower(), txt[:400]); snap(pg9, "v5_home_morning")
    check("v5: до обучения — тропа без панели метрик, без «0%»; обучение из трёх подсказок с «Дальше»", pg9.query_selector(".trail.bare") is not None and "%" not in txt and "камни — текущая тяжесть" in tl and pg9.inner_text("#tipNext") == "Дальше" and "1 из 3" in txt, txt[:200])
    pg9.click("#tipNext"); pg9.wait_for_timeout(200); pg9.reload(); pg9.wait_for_timeout(700); check("v5: этап обучения тропе сохраняется после перезагрузки", "шаги — участие в практике" in pg9.inner_text("#app").lower() and "2 из 3" in pg9.inner_text("#app"), pg9.inner_text("#app")[:200])
    pg9.click("#tipNext"); pg9.wait_for_timeout(200); check("v5: третья подсказка — небо и флаг, кнопка «Понятно»", "небо и флаг" in pg9.inner_text("#app").lower() and pg9.inner_text("#tipNext") == "Понятно"); snap(pg9, "v5_trail_tip3")
    pg9.click("#tipNext"); pg9.wait_for_timeout(300); txt = pg9.inner_text("#app"); tl = txt.lower()
    check("v5: после обучения — метрики с подписями: «Пока нет оценки», «0 шагов практики», «Навыки: 0», знаменатель линии объяснён; камни не выдуманы", "пока нет оценки" in tl and "0 шагов практики" in tl and "навыки: 0" in tl and "день практики 1" in tl and "не раньше дня 21" in tl and "%" not in txt and "камн" not in pg9.inner_text(".trail").lower() and pg9.evaluate("() => window.KARMA_APP.profile.seen.trail === true"), txt[:200]); snap(pg9, "v5_home_after_tutorial")
    morning(pg9); check("v5: после утра — обычная карточка шага без повторного обучения", "сегодня — первый день" in pg9.inner_text("#app").lower() and "взять шаг" not in pg9.inner_text("#app").lower())
    set_hour(pg9, 20); do_evening(pg9, "Был повод", "Получилось", 1)
    def day(pg, n, module=None, opp="Был повод", act="Получилось", impact=1, before=None):
        set_hour(pg, 8); morning(pg)
        if module:
            go(pg, "#module/" + module); pg.wait_for_timeout(200)
            if pg.query_selector("#deep"): pg.click("#deep"); pg.wait_for_timeout(300)
            module_fill(pg, module)
        if before: before()
        set_hour(pg, 20); return do_evening(pg, opp, act, impact)
    def module_fill(pg, m):
        if m == "meaning": click_chip(pg, "Опять всё на мне"); click_chip(pg, "Это моя версия")
        elif m == "need": click_chip(pg, "Уважение"); pg.click(".chip >> nth=0"); pg.click("#next"); pg.wait_for_timeout(250); pg.click(".chip >> nth=0"); pg.wait_for_timeout(400)
        elif m == "rule": click_chip(pg, "Это моё внутреннее правило"); pg.fill("#a", "отказать в необязательной просьбе"); pg.click("#next"); pg.wait_for_timeout(200); click_chip(pg, "Подведу человека"); pg.fill("#a", "Мои потребности тоже имеют значение"); pg.click("#next"); pg.wait_for_timeout(400)
        elif m == "experiment": pg.fill("#a", "Скажу: сегодня не могу"); pg.click("#next"); pg.wait_for_timeout(200); click_chip(pg, "Человек обидится"); click_chip(pg, "По ответу человека"); click_chip(pg, "Могу отказать"); click_chip(pg, "меня попросят"); pg.wait_for_timeout(400)
        elif m == "transfer": click_chip(pg, "Не было")
        pg.wait_for_timeout(300)
    day(pg9, 2, "meaning"); day(pg9, 3, "need"); day(pg9, 4, "rule"); day(pg9, 5, "experiment")
    st9 = state(pg9); x9 = [e for e in st9["experiments"] if e["status"] == "active"][0]; h9 = [h for h in st9["hypotheses"] if h["id"] == st9["patterns"][0]["hypothesisVersionId"]][0]
    check("путь: гипотеза выбрана, эксперимент привязан к ней, навык отказа", h9["status"] == "selected" and x9["hypothesisVersionId"] == h9["id"] and x9["skillId"] == "refuse", (h9["status"], x9["skillId"]))
    go(pg9, "#story"); txt = pg9.inner_text("#app").lower(); L9 = st9["patterns"][0]["lesson"]
    if L9["skillId"] == "refuse": check("v3.1: урок подтверждён практикой с тем же навыком", L9["status"] == "confirmed" and "направление практики изменилось" not in txt, L9)
    else:
        check("v3.1: практика ушла на другой навык → предложено уточнить или сохранить урок", "направление практики изменилось" in txt, txt[:200])
        pg9.click("#refineLesson"); pg9.wait_for_timeout(300); opts9 = pg9.evaluate("() => [...document.querySelectorAll('[data-l]')].map(b => b.dataset.l)")
        check("v3.1: уточнение предлагает уроки под текущий навык", len(opts9) >= 1 and all(l["skillId"] == "refuse" for l in pg9.evaluate("() => window.KARMA_CONTENT.packs.flatMap(p => p.lessons)") if l["id"] in opts9), opts9)
        pg9.click(f"[data-l='{opts9[0]}']"); pg9.wait_for_timeout(300); st9 = state(pg9); L9b = st9["patterns"][0]["lesson"]
        check("v3.1: урок согласован с практикой, история прежнего урока сохранена", L9b["skillId"] == "refuse" and L9b["status"] == "confirmed" and L9["id"] in L9b["rejected"] and "направление практики изменилось" not in pg9.inner_text("#app").lower(), L9b)
    day(pg9, 6, "transfer"); day(pg9, 7)
    # день 8: итог недели 1
    set_hour(pg9, 10); check("путь: день 8 — предложен итог недели", "итог недели" in pg9.inner_text("#app").lower(), pg9.inner_text("#app")[:120])
    go(pg9, "#review"); pg9.click("#next"); pg9.wait_for_timeout(200); click_chip(pg9, "Отчасти"); click_chip(pg9, "Продолжить"); pg9.click("#skipq"); pg9.wait_for_timeout(400)
    set_hour(pg9, 20); do_evening(pg9, "Не было повода", None, 1)
    # дни 9–10: пропуск (ни утра, ни вечера); день 11: возвращение
    shift(pg9, 48); set_hour(pg9, 9); txt = pg9.inner_text("#app")
    check("путь: возврат после пропуска — главная работает, вчерашний вечер ещё можно закрыть", "шаг на день" in txt.lower() and "не закрыт" in txt.lower(), txt[:200])
    d10 = pg9.evaluate("() => window.KARMA_RULES.addDays(window.KARMA_APP.today(), -1)"); do_evening(pg9, "Не уверен", None, 2, date=d10)
    morning(pg9); set_hour(pg9, 20); do_evening(pg9, "Был повод", "Получилось", 1)
    day(pg9, 12); day(pg9, 13, opp="Не было повода", act=None); day(pg9, 14)
    # день 15: итог недели 2 → сменить гипотезу
    set_hour(pg9, 10); go(pg9, "#review"); pg9.click("#next"); pg9.wait_for_timeout(200)
    if pg9.query_selector("#next") and "Пользы" in pg9.inner_text("#app"): pg9.click("#next"); pg9.wait_for_timeout(200)
    click_chip(pg9, "Не подходит"); click_chip(pg9, "Сменить гипотезу"); click_chip(pg9, "Неверная гипотеза"); pg9.click("#skipq"); pg9.wait_for_timeout(500)
    check("путь: после «сменить гипотезу» открыт шаг объяснения", "не хватило" in pg9.inner_text("#app"), pg9.inner_text("#app")[:100])
    click_chip(pg9, "Уважение"); pg9.click(".chip >> nth=1"); pg9.click("#next"); pg9.wait_for_timeout(250); pg9.click(".chip >> nth=0"); pg9.wait_for_timeout(400)
    st9 = state(pg9); go(pg9, "#story"); txt = pg9.inner_text("#app").lower()
    check("путь: прежняя гипотеза отвергнута, новая выбрана, план ждёт решения", any(h["status"] == "rejected" for h in st9["hypotheses"]) and "объяснение изменилось" in txt, txt[:160])
    pg9.click("#keepDep"); pg9.wait_for_timeout(300)
    set_hour(pg9, 20); do_evening(pg9, "Был повод", "Получилось", 1)
    for n in range(16, 22): day(pg9, n, opp="Был повод" if n % 2 == 0 else "Не было повода", act="Получилось" if n % 2 == 0 else None, impact=1 + n % 2)
    # день 22: флаг
    set_hour(pg9, 10); txt = pg9.inner_text("#app")
    check("путь: день 22 — предложена проверка навыка", "проверка навыка" in txt.lower(), txt[:160])
    dbg = pg9.evaluate("() => { const A = window.KARMA_APP, R = window.KARMA_RULES; const p = A.data.patterns[0]; const x = A.data.experiments.find(e => e.id === p.experimentId); const el = R.flagEligibility({ pattern: p, checkins: A.data.checkins, episodes: A.data.episodes, todayKey: A.today(), skillId: x.skillId, policy: window.KARMA_CONTENT.progressPolicy }); return { reasons: el.reasons, skill: x.skillId, start: p.startDate, today: A.today(), evs: Object.values(A.data.checkins).filter(c => c.evening).map(c => [c.dateKey, c.patternId === p.id, c.evening.hadOpportunity, c.evening.actionStatus, c.evening.skillId, c.evening.currentImpact]) }; }")
    go(pg9, "#flag"); pg9.wait_for_timeout(300); check("путь: экран флага с условиями выполнен", "Проверка навыка" in h1(pg9) and pg9.evaluate("() => document.getElementById('ok').disabled"), h1(pg9))
    for i in range(3): pg9.click(f"#cf .chip[data-i='{i}']")
    check("путь: кнопка активна только после трёх подтверждений", not pg9.evaluate("() => document.getElementById('ok').disabled"))
    pg9.click("#ok"); pg9.wait_for_timeout(500); st9 = state(pg9)
    check("путь: флаг отмечен за навык отказа, ясность 17%", "Флаг твой" in pg9.inner_text("#app") and len(st9["flags"]) == 1 and st9["flags"][0]["skillId"] == "refuse" and pg9.evaluate("() => window.KARMA_RULES.clarity(window.KARMA_APP.data.flags, 6).pct") == 17, [f.get("skillId") for f in st9["flags"]])
    snap(pg9, "full_path_flag")
    go(pg9, "#today"); check("путь: после флага главная без ошибок и без повторного предложения проверки", not pg9.errors and pg9.query_selector(".card.mark a[href='#flag']") is None and "день практики 22" in pg9.inner_text("#app").lower() and "не раньше" not in pg9.inner_text(".trail").lower(), (pg9.errors[:2], pg9.inner_text(".trail")))
    # ---------- v3: смена числа не переписывает практику; старый сюжет без нового входа ----------
    st9 = state(pg9); P9 = st9["patterns"][0]
    go(pg9, "#symbol"); pg9.click("summary >> text=Выбрать другую тему"); pg9.wait_for_timeout(200); pg9.click("[data-t='3']"); pg9.wait_for_timeout(300)
    st9b = state(pg9); P9b = st9b["patterns"][0]
    check("v3: смена символической темы не трогает урок, план, старт и записи", P9b["lesson"] == P9["lesson"] and P9b["skillId"] == P9["skillId"] and P9b["experimentId"] == P9["experimentId"] and P9b["startDate"] == P9["startDate"] and len(st9b["episodes"]) == len(st9["episodes"]) and len(st9b["flags"]) == len(st9["flags"]) and st9b["profile"]["symbolic"]["chosen"] == 3)
    pg9.reload(); pg9.wait_for_timeout(700); go(pg9, "#today"); check("v3: действующий сюжет открывается без нового входа", "снова происходит" not in pg9.inner_text("#app").lower() and "сегодня на твоём пути" in pg9.inner_text("#app").lower())
    # ---------- v5: механика карточек событий ----------
    ctx10 = b.new_context(viewport={"width": 390, "height": 844}); pg10 = fresh(ctx10); pg10.goto(U); pg10.wait_for_timeout(500)
    # помощь до даты и возврат на место
    consent_start(pg10); pg10.click("a[href='#help']"); pg10.wait_for_timeout(300); check("v3: помощь доступна до даты", "безопасном" in pg10.inner_text("#app"))
    pg10.click("a[href='#today']"); pg10.wait_for_timeout(300); check("v3: после помощи возвращает на прежний шаг (дата)", "очертания" in pg10.inner_text("#app").lower(), pg10.inner_text("#app")[:80])
    pg10.click("#skip"); pg10.wait_for_timeout(300); check("v4: без даты — сразу сфера", "напряжение" in pg10.inner_text("h1.q").lower())
    click_chip(pg10, "Пока трудно понять"); pg10.wait_for_timeout(300)
    d10 = pg10.evaluate("() => window.KARMA_APP.profile.onb.deck.map(c => c.areas[0])")
    check("v5: «пока трудно понять» — шесть событий из разных сфер", len(d10) == 6 and len(set(d10)) >= 4, d10)
    check("v3: обучение свайпу на первой карточке", "вправо — цепляет" in pg10.inner_text("#app").lower() and pg10.query_selector(".swcard.demo") is not None)
    # двойной быстрый ввод — один ответ
    pg10.evaluate("() => { const b = document.getElementById('yes'); b.click(); b.click(); b.click(); }"); pg10.wait_for_timeout(400)
    o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return { idx: S.idx, picks: S.picks.length, seen: !!window.KARMA_APP.profile.seen.swipe, offer: !!S.offer }; }")
    check("v3: тройной клик = один ответ; признак обучения сохранён; промежуточного «разобрать?» нет", o["idx"] == 1 and o["picks"] == 1 and o["seen"] and not o["offer"], o)
    check("v3: обучение не повторяется", "вправо — цепляет" not in pg10.inner_text("#app").lower())
    # вертикальное движение — не ответ
    box = pg10.locator("#swc").bounding_box(); cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg10.mouse.move(cx, cy); pg10.mouse.down(); pg10.mouse.move(cx + 4, cy + 40, steps=5); pg10.mouse.move(cx + 6, cy + 90, steps=5); pg10.mouse.up(); pg10.wait_for_timeout(300)
    o = pg10.evaluate("() => window.KARMA_APP.profile.onb.idx"); check("v3: вертикальная прокрутка не записывает ответ", o == 1, o)
    # горизонтальный свайп мышью вправо — «цепляет», подпись проявляется
    pg10.mouse.move(cx, cy); pg10.mouse.down(); pg10.mouse.move(cx + 40, cy + 2, steps=4); pg10.wait_for_timeout(200)
    lab = pg10.evaluate("() => getComputedStyle(document.getElementById('labR')).opacity"); check("v3: при движении вправо проявляется «Цепляет»", float(lab) > 0.3 and pg10.inner_text("#labR") == "Цепляет", lab)
    pg10.mouse.move(cx + 130, cy + 3, steps=6); pg10.mouse.up(); pg10.wait_for_timeout(400)
    o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks[S.picks.length-1].r]; }"); check("v3: свайп вправо = «цепляет»", o == [2, "yes"], o)
    # свайп влево мышью — «не цепляет»; малое движение — без ответа
    box = pg10.locator("#swc").bounding_box(); cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    pg10.mouse.move(cx, cy); pg10.mouse.down(); pg10.mouse.move(cx - 30, cy, steps=3); pg10.mouse.up(); pg10.wait_for_timeout(300)
    check("v3: малое движение возвращает карточку без ответа", pg10.evaluate("() => window.KARMA_APP.profile.onb.idx") == 2)
    pg10.mouse.move(cx, cy); pg10.mouse.down(); pg10.mouse.move(cx - 130, cy, steps=6); pg10.mouse.up(); pg10.wait_for_timeout(400)
    o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks[S.picks.length-1].r]; }"); check("v3: свайп влево = «не цепляет»", o == [3, "no"], o)
    # «не уверен» — не да и не нет и тоже просмотр; отмена; клавиатура
    pg10.click("#unsure"); pg10.wait_for_timeout(300); o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks[S.picks.length-1].r, window.KARMA_RULES.deckYes(S).length]; }")
    check("v3: «не уверен» — отдельный ответ, в отмеченные не входит", o == [4, "unsure", 2], o)
    check("v5: четыре ответа — выбора ещё нет, есть подсказка", pg10.query_selector("#pick") is None and "хотя бы на пять" in pg10.inner_text("#app").lower() and "5 из 6" in pg10.inner_text("#app"), pg10.inner_text("#app")[:120])
    pg10.click("#no"); pg10.wait_for_timeout(300); check("v5: пятый ответ открывает «Выбрать из отмеченных (2)»", pg10.query_selector("#pick") is not None and "(2)" in pg10.inner_text("#pick"), pg10.inner_text("#app")[:120])
    pg10.click("#undo"); pg10.wait_for_timeout(300); o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks.length, S.undo]; }"); check("v3: отмена возвращает карточку и ответ, без дублей; выбор снова закрыт", o[0] == 4 and o[1] == 4 and o[2] is None and pg10.query_selector("#pick") is None, o)
    pg10.focus("#swc"); pg10.keyboard.press("ArrowRight"); pg10.wait_for_timeout(300); o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks[S.picks.length-1].r]; }"); check("v3: клавиатура даёт тот же результат", o == [5, "yes"], o)
    pg10.reload(); pg10.wait_for_timeout(700); o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return [S.idx, S.picks.length]; }")
    check("v3: перезагрузка восстанавливает место и ответы", o == [5, 5] and "6 из 6" in pg10.inner_text("#app") and "(3)" in pg10.inner_text("#pick"), (o, pg10.inner_text("#app")[:60]))
    pg10.click("#yes"); pg10.wait_for_timeout(400)
    check("v3.1/v5: конец колоды с несколькими «цепляет» → явный выбор фокуса и отмена", "задевает сильнее всего" in pg10.inner_text("#app").lower() and pg10.query_selector("#undo") is not None and len(pg10.query_selector_all(".chip[data-i]")) == 4, pg10.inner_text("#app")[:100]); snap(pg10, "v5_choose_many")
    # уточнения не теряют выбор и ввод: назад, перезагрузка, другое событие; учитель сохраняется
    ev10 = pg10.evaluate("() => window.KARMA_RULES.deckYes(window.KARMA_APP.profile.onb).map(c => c.id)")
    pg10.click(".chip[data-i='0']"); pg10.wait_for_timeout(300); check("v5: после выбора фокуса — учитель", "с кем или с чем" in pg10.inner_text("h1.q").lower())
    click_chip(pg10, "Коллега"); pg10.wait_for_timeout(300); check("v5: затем последний случай", "последний случай" in pg10.inner_text("h1.q").lower())
    pg10.fill("#a", "Решили, что я и так справлюсь"); pg10.wait_for_timeout(600); pg10.click("#cancel"); pg10.wait_for_timeout(300)
    check("v5: «К учителю» показывает прежний выбор учителя", pg10.evaluate("() => [...document.querySelectorAll('#ch .chip.on')].map(b => b.textContent)") == ["Коллега"]); pg10.click("#next"); pg10.wait_for_timeout(300)
    check("v5: текст случая сохранён после возврата", pg10.input_value("#a") == "Решили, что я и так справлюсь", pg10.input_value("#a"))
    pg10.reload(); pg10.wait_for_timeout(700); check("v5: перезагрузка возвращает на «последний случай» с текстом", pg10.query_selector("#a") is not None and pg10.input_value("#a") == "Решили, что я и так справлюсь", pg10.inner_text("#app")[:80])
    pg10.click("#cancel"); pg10.wait_for_timeout(250); pg10.click("#cancel"); pg10.wait_for_timeout(300); check("v5: назад из учителя — снова выбор фокуса", "задевает сильнее всего" in pg10.inner_text("#app").lower())
    pg10.click(".chip[data-i='1']"); pg10.wait_for_timeout(300); pg10.click("#next"); pg10.wait_for_timeout(300); check("v5: текст одного события не переносится в другое, учитель остаётся", pg10.query_selector("#a") is not None and not pg10.input_value("#a") and pg10.evaluate("() => window.KARMA_APP.profile.onb.teacher.kind") == "colleague", pg10.inner_text("#app")[:80])
    pg10.click("#cancel"); pg10.wait_for_timeout(250); pg10.click("#cancel"); pg10.wait_for_timeout(300); pg10.click(".chip[data-i='0']"); pg10.wait_for_timeout(300); pg10.click("#next"); pg10.wait_for_timeout(300)
    check("v5: возврат к первому событию — его текст на месте", pg10.input_value("#a") == "Решили, что я и так справлюсь", pg10.input_value("#a"))
    pg10.click("#next"); pg10.wait_for_timeout(250); click_chip(pg10, "Сегодня"); click_chip(pg10, "Это первый случай"); pg10.wait_for_timeout(300)
    # «не задело» возвращает к подборке, событие не становится триггером
    click_chip(pg10, "В этот раз меня это не задело"); pg10.wait_for_timeout(400)
    o = pg10.evaluate("() => { const S = window.KARMA_APP.profile.onb; return { stung: S.picks.filter(p => p.notStung).length, ev: S.event, yes: window.KARMA_RULES.deckYes(S).length, teacher: S.teacher && S.teacher.kind }; }")
    check("v4: «не задело» — событие остаётся отмеченным, но не триггер; ответы и учитель не потеряны", o["stung"] == 1 and o["ev"] is None and o["yes"] == 4 and o["teacher"] == "colleague" and "задевает сильнее всего" in pg10.inner_text("#app").lower(), (o, pg10.inner_text("#app")[:60]))
    check("v4.1: «не задело» не предлагается как триггер, но доступно для пересмотра", len(pg10.query_selector_all(".chip[data-i]")) == 3 and len(pg10.query_selector_all("[data-rs]")) == 1 and "было, но не задело" in pg10.inner_text("#app").lower(), pg10.inner_text("#app")[:200])
    pg10.click(".chip[data-i='0']"); pg10.wait_for_timeout(300); pg10.click("#next"); pg10.wait_for_timeout(300); pg10.click("#tg .chip >> nth=0"); pg10.click("#next"); pg10.wait_for_timeout(250)
    click_chip(pg10, "Конкретного случая пока нет"); click_chip(pg10, "Пока не уверен"); pg10.wait_for_timeout(300)
    click_chip(pg10, "Своё"); pg10.fill("#own", "Решили, что я и так справлюсь"); pg10.click("#next"); pg10.wait_for_timeout(400)
    txt = pg10.inner_text("#app").lower(); check("v5: без даты — резюме из подтверждённых ответов и предложение добавить дату", "вот с чего начинаем" in txt and "решили, что я и так справлюсь" in txt and "повторяется ли — не уверен" in txt and "учитель: отношения с коллегой" in txt and pg10.query_selector("a[href='#birth']") is not None and "тема твоего пути" not in txt, txt[:300]); snap(pg10, "v5_summary_nodate")
    pg10.click("#ok"); pg10.wait_for_timeout(400)
    check("v4: свой вариант значения без редакционного урока → наблюдение", "заметить свою реакцию" in pg10.inner_text("#app").lower(), pg10.inner_text("#app")[:200])
    start_lesson(pg10); st10 = state(pg10); P10 = st10["patterns"][0]
    check("v3: нет реального случая → наблюдение без выдуманной даты и записей, шаг есть", P10["status"] == "observe" and P10["startDate"] is None and P10.get("practiceStartDate") is None and len(st10["episodes"]) == 0 and P10["scenario"]["meaningOrigin"] == "user_written" and "наблюда" in pg10.inner_text("#app").lower() and P10["experimentId"], (P10["status"], P10["startDate"], pg10.inner_text("#app")[:120]))
    el10 = pg10.evaluate("() => window.KARMA_RULES.flagEligibility({ pattern: window.KARMA_APP.data.patterns[0], checkins: {}, episodes: [], todayKey: window.KARMA_APP.today(), skillId: 'pause' })")
    check("v3: в наблюдении флага нет", not el10["eligible"] and "Нет первого реального эпизода" in el10["reasons"][0])
    check("v3.1: главная в наблюдении без тройного повтора шага", pg10.inner_text("#app").lower().count("твой шаг") == 1 and "урок начат" in pg10.inner_text("#app").lower())
    snap(pg10, "v3_observe_home")
    # остальные «цепляет» сохранены на потом (кроме «не задело»)
    saved = st10["profile"].get("savedScenarios", []); check("v3.1: остальное «цепляет» сохранено, «не задело» — нет", len(saved) == 2 and all(x["kind"] == "event" for x in saved) and ev10[0] not in [x["id"] for x in saved] and set(x["id"] for x in saved) == set(ev10[2:]), (saved, ev10))
    pg10.reload(); pg10.wait_for_timeout(700); go(pg10, "#story"); txt = pg10.inner_text("#app").lower()
    check("v3.1: сохранённые сюжеты видны в «Моём пути» после перезагрузки", "знакомые сюжеты на потом" in txt and len(pg10.query_selector_all("[data-saved]")) == 2, txt[-300:])
    pg10.click("[data-saved='0']"); pg10.wait_for_timeout(150); pg10.click("[data-saved='0']"); pg10.wait_for_timeout(400)
    check("v3.1/v5: старт сохранённого события ведёт к учителю, прежний сюжет в истории", "с кем или с чем" in pg10.inner_text("h1.q").lower() and pg10.evaluate("() => window.KARMA_APP.data.patterns.filter(p => p.status === 'done').length") == 1 and pg10.evaluate("() => window.KARMA_APP.profile.savedScenarios.length") == 1, pg10.inner_text("#app")[:80])
    finish_onb(pg10, teacher="Друг", when="Сегодня", repeat="Такое повторяется", meaning=0); start_lesson(pg10)
    st10 = state(pg10); act = [q for q in st10["patterns"] if q["status"] == "active"]
    check("v3.1: новый путь из сохранённого события: активный сюжет с учителем и уроком", len(act) == 1 and act[0]["teacher"]["kind"] == "friend" and act[0]["lesson"] and act[0]["scenario"]["eventId"] == saved[0]["id"], [(q["status"], q.get("teacher")) for q in st10["patterns"]])
    # ---------- v4: своя ситуация — полноценный вход ----------
    ctx12 = b.new_context(viewport={"width": 390, "height": 844}); pg12 = fresh(ctx12); pg12.goto(U); pg12.wait_for_timeout(500); to_cards(pg12, area=None)
    click_chip(pg12, "Конкретная ситуация"); pg12.wait_for_timeout(300); check("v4: «конкретная ситуация» — сразу текст, без обязательной колоды", "что произошло" in pg12.inner_text("h1.q").lower(), pg12.inner_text("#app")[:80])
    pg12.fill("#a", "Коллега попросил подменить в выходной, я согласился"); pg12.wait_for_timeout(600); go(pg12, "#help"); pg12.wait_for_timeout(200); go(pg12, "#own"); pg12.wait_for_timeout(300)
    check("v3.1: текст своего случая не потерян после помощи", pg12.input_value("#a").startswith("Коллега попросил"), pg12.input_value("#a"))
    pg12.click("#next"); pg12.wait_for_timeout(300); check("v3.1: предложена тема без назначения причины", "больше похоже" in pg12.inner_text("h1.q").lower() and "пока не ясно" in pg12.inner_text("#app").lower())
    click_chip(pg12, "Пока не ясно"); pg12.wait_for_timeout(400); check("v5: свой случай — те же уточнения без колоды: учитель", "с кем или с чем" in pg12.inner_text("h1.q").lower() and "коллега попросил подменить" in pg12.inner_text("#app").lower(), pg12.inner_text("#app")[:120])
    click_chip(pg12, "Коллега"); pg12.wait_for_timeout(300); check("v5: для своего текста случай не переспрашивается — сразу «когда это было»", "когда это было" in pg12.inner_text("h1.q").lower() and pg12.query_selector("#a") is None, pg12.inner_text("#app")[:120])
    click_chip(pg12, "Сегодня"); click_chip(pg12, "Такое повторяется"); pg12.wait_for_timeout(300)
    check("v4: для своего текста — общие значения, без анализа текста", "задело сильнее" in pg12.inner_text("h1.q").lower() and "со мной не считались" in pg12.inner_text("#app").lower())
    click_chip(pg12, "Со мной не считались"); pg12.wait_for_timeout(400)
    txt = pg12.inner_text("#app").lower(); check("v5: резюме своего случая из подтверждённых ответов; реакция не спрашивалась", "вот с чего начинаем" in txt and "коллега попросил подменить" in txt and "со мной не считались" in txt and "сфера: своя ситуация" in txt and "обычно ты" not in txt, txt[:300])
    pg12.click("#ok"); pg12.wait_for_timeout(400)
    txt = pg12.inner_text("#app"); check("v4: без темы — «первый шаг — заметить свою реакцию», без внутреннего запрета", "заметить свою реакцию" in txt.lower() and "Внутри:" not in txt and "уточним на реальном случае" in txt.lower(), txt[:200])
    pg12.click("#rej"); pg12.wait_for_timeout(300); check("v3.1: «выбрать направление» без темы предлагает темы", len(pg12.query_selector_all("[data-pk]")) == 8); pg12.click("[data-pk='refusal']"); pg12.wait_for_timeout(300)
    check("v3.1: после выбора темы — урок темы", "Возможный урок" in pg12.inner_text("#app") or "заметить свою реакцию" in pg12.inner_text("#app").lower())
    if pg12.query_selector("#rej") and "заметить свою реакцию" in pg12.inner_text("#app").lower(): pg12.click("#rej"); pg12.wait_for_timeout(300); pg12.click("[data-l] >> nth=0"); pg12.wait_for_timeout(300)
    start_lesson(pg12)
    st12 = state(pg12); P12 = st12["patterns"][0]; txt = pg12.inner_text("#app").lower()
    check("v3.1: свой случай даёт полноценный путь: сценарий, учитель, урок, главная с каркасом", P12["scenario"]["origin"] == "own" and P12["scenario"]["eventOrigin"] == "user_written" and P12["teacher"]["kind"] == "colleague" and P12["lesson"]["id"].startswith("refusal") and P12["packId"] == "refusal" and len(st12["episodes"]) == 1 and st12["episodes"][0]["response"] is None and "сегодня на твоём пути" in txt and "меня зацепило" in txt, (P12.get("scenario"), txt[:120]))
    check("v3.1: своя формулировка видна в «Моём пути»", (go(pg12, "#story") or True) and "коллега попросил подменить" in pg12.inner_text("#app").lower())
    # расхождение урока и практики: смена навыка → предложение уточнить или сохранить формулировку
    cur12 = P12["lesson"]["skillId"]; other12 = "Могу отказать" if cur12 != "refuse" else "Делаю паузу"
    pg12.click("button[data-edit='skill']"); pg12.wait_for_timeout(200); click_chip(pg12, other12); pg12.wait_for_timeout(400); txt = pg12.inner_text("#app").lower()
    check("v3.1: смена навыка → карточка «направление практики изменилось»", "направление практики изменилось" in txt and pg12.query_selector("#keepLesson") is not None, txt[:200])
    pg12.click("#keepLesson"); pg12.wait_for_timeout(300); st12 = state(pg12); L12 = st12["patterns"][0]["lesson"]
    check("v3.1: «сохранить формулировку» снимает вопрос и привязано к версии плана", "направление практики изменилось" not in pg12.inner_text("#app").lower() and L12["status"] == "confirmed" and L12["keptForExperimentId"] == st12["patterns"][0]["experimentId"] and L12["title"] == P12["lesson"]["title"], L12)
    pg12.click("button[data-edit='lesson']"); pg12.wait_for_timeout(300); pg12.fill("#a", "учитывать свою нагрузку, прежде чем соглашаться"); pg12.click("#own"); pg12.wait_for_timeout(300); st12 = state(pg12); L12 = st12["patterns"][0]["lesson"]
    check("v3.1: урок своими словами: origin user, навык текущий, прежний урок в истории", L12["origin"] == "user" and L12["skillId"] == skill_id_of(pg12) and P12["lesson"]["id"] in L12["rejected"] and "учитывать свою нагрузку" in pg12.inner_text("#app").lower(), L12)
    # ---------- v4.1: по одному случаю на каждую сферу: событие → значение → направление → действие ----------
    for area_label, area_id in [("Отношения с близкими", "close"), ("Работа и общение", "work"), ("Деньги и обязательства", "money"), ("Отношение к себе", "self")]:
        ctxA = b.new_context(viewport={"width": 390, "height": 844}); pgA = fresh(ctxA); pgA.goto(U); pgA.wait_for_timeout(500); to_cards(pgA, area=area_label)
        evA = pgA.evaluate("() => window.KARMA_APP.profile.onb.deck[0]"); answer_cards(pgA, ["yes", "no", "no", "no", "no"]); pgA.click("#pick"); pgA.wait_for_timeout(300); pgA.click(".chip[data-i='0']"); pgA.wait_for_timeout(350)
        mA = pgA.evaluate("() => { const S = window.KARMA_APP.profile.onb; const e = window.KARMA_CONTENT.extra.events.find(x => x.id === S.event); return e.meanings[e.meanings.length - 1]; }")
        finish_onb(pgA, teacher="Повторяющаяся ситуация", when="Сегодня", repeat="Такое повторяется", meaning=pgA.evaluate("() => { const S = window.KARMA_APP.profile.onb; const e = window.KARMA_CONTENT.extra.events.find(x => x.id === S.event); return e.meanings.length - 1; }"))
        txtA = pgA.inner_text("#app"); expA = pgA.evaluate("(m) => m.lessonId ? window.KARMA_RULES.findLesson(window.KARMA_CONTENT.packs, m.lessonId) : null", mA)
        wantA = (expA["title"] if expA else mA["observe"]["title"]).lower()
        check(f"v4.1 {area_id}: «{evA['text']}» → «{mA['text']}» → направление «{wantA[:40]}…» в карточке урока", wantA in txtA.lower() and "В действии:" in txtA, txtA[:220])
        start_lesson(pgA); stA = state(pgA); PA = stA["patterns"][0]
        okPack = (PA["packId"] == expA["packId"]) if expA else True
        check(f"v4.1 {area_id}: сюжет создан, пакет — по направлению, подтверждённые факты сохранены", PA["status"] == "active" and okPack and PA["scenario"]["eventId"] == evA["id"] and PA["scenario"]["meaningId"] == mA["id"] and (PA["lesson"]["id"] == (expA["id"] if expA else PA["lesson"]["id"])) and PA["lesson"]["action"], (PA.get("packId"), expA and expA["packId"], PA.get("lesson", {}).get("id")))
        if not pgA.errors: pass
        else: check(f"v4.1 {area_id}: без ошибок страницы", False, pgA.errors[:2])
        ctxA.close()
    # межпакетная ссылка: «Решают за меня» → «Решили, что знают лучше меня» → control-l3
    ctxB = b.new_context(viewport={"width": 390, "height": 844}); pgB = fresh(ctxB); pgB.goto(U); pgB.wait_for_timeout(500); to_cards(pgB, area=None); click_chip(pgB, "Пока трудно понять"); pgB.wait_for_timeout(300)
    pgB.evaluate("async () => { const A = window.KARMA_APP; A.profile.onb.event = 'ev-decide'; A.profile.onb.picks = [{ id: 'ev-decide', packId: 'voice', text: 'Решают за меня, не спрашивая', r: 'yes' }]; A.profile.onb.step = 'teacher'; await A.saveProfile(); A.go('teacher'); }"); pgB.wait_for_timeout(400)
    finish_onb(pgB, teacher="Партнёр", when="Сегодня", repeat="Такое повторяется", meaning="Решили, что знают лучше меня")
    txtB = pgB.inner_text("#app").lower(); check("v4.1: межпакетная ссылка разрешается: урок из другого пакета предложен", "сохранять право выбирать способ" in txtB, txtB[:200])
    start_lesson(pgB); PB = state(pgB)["patterns"][0]
    check("v4.1: пакет сюжета — control (по уроку), событие — voice (факт сохранён)", PB["packId"] == "control" and PB["lesson"]["id"] == "control-l3" and PB["scenario"]["eventId"] == "ev-decide", (PB["packId"], PB["lesson"]["id"]))
    # деньги: «не вижу, куда уходят» → предметное наблюдение, без финансовых советов
    ctxC = b.new_context(viewport={"width": 390, "height": 844}); pgC = fresh(ctxC); pgC.goto(U); pgC.wait_for_timeout(500); to_cards(pgC, area=None); click_chip(pgC, "Деньги и обязательства"); pgC.wait_for_timeout(300)
    pgC.evaluate("async () => { const A = window.KARMA_APP; A.profile.onb.event = 'ev-money'; A.profile.onb.picks = [{ id: 'ev-money', packId: 'fairness', text: 'Деньги заканчиваются раньше, чем я рассчитывал', r: 'yes' }]; A.profile.onb.step = 'teacher'; await A.saveProfile(); A.go('teacher'); }"); pgC.wait_for_timeout(400)
    click_chip(pgC, "Повторяющаяся ситуация"); pgC.wait_for_timeout(300); pgC.click("#tg .chip >> nth=0"); pgC.click("#next"); pgC.wait_for_timeout(250); click_chip(pgC, "Сегодня"); click_chip(pgC, "Такое повторяется"); pgC.wait_for_timeout(300)
    optsC = pgC.evaluate("() => [...document.querySelectorAll('#ch .chip')].map(b => b.textContent)")
    check("v4.1: значения денежного события — от события, уровень «что неприятно/важно»", "Теряю ощущение контроля" in optsC and "Не хватает на необходимое" in optsC and not any(o.startswith("Не могу") for o in optsC), optsC)
    click_chip(pgC, "Теряю ощущение контроля"); pgC.wait_for_timeout(400)
    check("v5: привычная реакция во входе не спрашивается — сразу резюме", "вот с чего начинаем" in pgC.inner_text("#app").lower() and "обычно" not in pgC.inner_text("#app").lower(), pgC.inner_text("#app")[:120])
    pgC.click("#ok"); pgC.wait_for_timeout(400)
    txtC = pgC.inner_text("#app").lower(); check("v4.1: направление — предметное наблюдение по событию, без советов по деньгам", "первый шаг — замечать момент неожиданного расхода" in txtC and "отметить, что было перед этим" in txtC and "инвест" not in txtC and "кредит" not in txtC and "Внутри:" not in pgC.inner_text("#app"), txtC[:260])
    start_lesson(pgC); PC = state(pgC)["patterns"][0]; txtC = pgC.inner_text("#app").lower()
    check("v4.1: сюжет с предметным наблюдением; на главной шаг продолжает выбранный ответ", PC["lesson"]["id"].startswith("observe:ev-money") and "неожиданн" in txtC and "расход" in txtC, (PC["lesson"]["id"], txtC[:200]))
    # ---------- v5: приёмочные сценарии первого дня и обучения ----------
    # 1. Первый запуск в 18:00 (вспомненный случай — три дня назад)
    ctxE = b.new_context(viewport={"width": 390, "height": 844}); pgE = fresh(ctxE); pgE.goto(U); pgE.wait_for_timeout(500); set_hour(pgE, 18)
    d3 = add_days(pgE, pgE.evaluate("() => window.KARMA_APP.today()"), -3)
    deckE = onboard(pgE, "Работа и общение", "С руководителем", when="Раньше", date=d3)
    todayE = pgE.evaluate("() => window.KARMA_APP.today()"); tomE = add_days(pgE, todayE, 1)
    stE = state(pgE); PE = stE["patterns"][0]; txt = pgE.inner_text("#app"); tl = txt.lower()
    check("v5-1: вечерний первый запуск — «Сегодня — начало твоего пути», шаг, завтра с датой, «Взять шаг на завтра»; итог дня не навязывается", "сегодня — начало твоего пути" in tl and "твой шаг:" in tl and "завтра:" in tl and human(pgE, tomE) in tl and "взять шаг на завтра" in tl and "подвести итог дня" not in tl and "уже был повод попробовать" in tl and "уведомления не присылает" in tl and ("практика с " + human(pgE, tomE)) in pgE.inner_text("#hero").lower(), txt[:600]); snap(pgE, "v5_first_evening")
    check("v5-4: вспомненный случай трёхдневной давности — старт практики завтра, дата случая отдельно, нет «День 4»", PE["practiceStartDate"] == tomE and PE["startDate"] == tomE and PE["caseDate"] == d3 and stE["episodes"][0]["dateKey"] == d3 and "день 4" not in pgE.inner_text("#hero").lower() and PE["firstDay"]["kind"] == "evening", (PE.get("practiceStartDate"), PE.get("caseDate"), pgE.inner_text("#hero")))
    check("v5-8: до первой оценки состояния камней нет; шагов нет; навыков нет; процентов нет", pgE.query_selector(".trail.bare") is not None and "%" not in txt and len(stE["checkins"]) == 0, txt[:100])
    go(pgE, "#evening"); check("v5-1: экран вечера до старта практики — «практика начинается завтра», без вопросов итога", "практика начинается завтра" in pgE.inner_text("#app").lower() and pgE.query_selector("#full") is None, pgE.inner_text("#app")[:100]); go(pgE, "#today")
    for _ in range(3): pgE.click("#tipNext"); pgE.wait_for_timeout(200)
    txt = pgE.inner_text("#app").lower(); check("v5-8: после обучения — «Пока нет оценки», «0 шагов практики», «Навыки: 0», «практика с <дата>»", "пока нет оценки" in txt and "0 шагов практики" in txt and "навыки: 0" in txt and ("практика с " + human(pgE, tomE)) in txt, txt[:200])
    pgE.click("#takeTomorrow"); pgE.wait_for_timeout(300); stE = state(pgE); PE = stE["patterns"][0]
    check("v5-10: «Взять шаг на завтра» — знакомство сохранено, ни действия, ни вечерней оценки, ни шага практики", PE["firstDay"]["taken"] and "готово. вернись завтра" in pgE.inner_text("#app").lower() and len(stE["checkins"]) == 0 and len(stE["episodes"]) == 1 and pgE.evaluate("() => window.KARMA_RULES.practiceDays(window.KARMA_APP.data.checkins).length") == 0, (PE.get("firstDay"), len(stE["checkins"])))
    pgE.reload(); pgE.wait_for_timeout(700); check("v5-12: перезагрузка сохраняет состояние первого вечера и пройденное обучение", "готово. вернись завтра" in pgE.inner_text("#app").lower() and pgE.query_selector("#tipNext") is None and pgE.query_selector(".trail.bare") is None, pgE.inner_text("#app")[:120]); snap(pgE, "v5_first_evening_taken")
    go(pgE, "#story"); check("v5: в «Моём пути» старт практики и дата случая показаны раздельно", ("практика" in pgE.inner_text("#app").lower() and "начнётся " + human(pgE, tomE) in pgE.inner_text("#app").lower() and "случай был " + human(pgE, d3) in pgE.inner_text("#app").lower()), pgE.inner_text("#app")[:400])
    set_hour(pgE, 0); tl = pgE.inner_text("#app").lower(); hero = pgE.inner_text("#hero").lower()
    check("v5-2: после полуночи — день 1, подготовка не стала пропущенной практикой", "день 1" in hero and "вчерашний вечер" not in tl and "не закрыт" not in tl and "первый день практики" in tl, (hero, tl[:200]))
    set_hour(pgE, 8); tl = pgE.inner_text("#app").lower()
    check("v5-2: утро дня 1 — шаг на день, без просроченного вечера", "шаг на день" in tl and "вчерашний" not in tl and "не закрыт" not in tl, tl[:200]); snap(pgE, "v5_day1_morning")
    morning(pgE); set_hour(pgE, 20); okE = do_evening(pgE, "Не было повода", None, 2)
    stE = state(pgE); check("v5: первый настоящий вечер — шаг практики и первая оценка", okE and pgE.evaluate("() => window.KARMA_RULES.practiceDays(window.KARMA_APP.data.checkins).length") == 1 and ck(stE, pgE.evaluate("() => window.KARMA_APP.today()"), stE["patterns"][0]["id"])["evening"]["currentImpact"] == 2)
    go(pgE, "#today"); tl = pgE.inner_text("#app").lower(); check("v5: камни — по оценке состояния; шаг — за закрытый вечер; подписи-обучение кнопок сняты, «Как пользоваться» остаётся", "2 камня" in tl and "1 шаг практики" in tl and len(pgE.query_selector_all(".tap em")) == 0 and pgE.query_selector("a[href='#guide']") is not None, tl[:200]); snap(pgE, "v5_after_first_evening")
    check("v5: флаг считает срок от старта практики", pgE.evaluate("() => { const A = window.KARMA_APP, R = window.KARMA_RULES; const p = A.data.patterns[0]; return R.flagEligibility({ pattern: p, checkins: A.data.checkins, episodes: A.data.episodes, todayKey: A.today(), skillId: p.skillId }).daysElapsed; }") == 0)
    # 2. Запуск в 23:xx → завтра; реальная попытка вечером делает день первым
    ctxF = b.new_context(viewport={"width": 390, "height": 844}); pgF = fresh(ctxF); pgF.goto(U); pgF.wait_for_timeout(500); set_hour(pgF, 23)
    onboard(pgF, "Отношения с близкими", None, when="Сегодня")
    todayF = pgF.evaluate("() => window.KARMA_APP.today()"); tomF = add_days(pgF, todayF, 1); PF = state(pgF)["patterns"][0]
    check("v5-2: запуск в 23:xx — завтра и дата указаны верно", PF["practiceStartDate"] == tomF and human(pgF, tomF) in pgF.inner_text("#app").lower() and "начало твоего пути" in pgF.inner_text("#app").lower(), (PF.get("practiceStartDate"), tomF))
    do_action(pgF, "Отказ"); stF = state(pgF); PF = stF["patterns"][0]; go(pgF, "#today")
    check("v5: реальная попытка в первый вечер — день 1 честно сегодня, итог открывается", PF["practiceStartDate"] == todayF and PF["startDate"] == todayF and PF["firstDay"]["kind"] == "acted" and "подвести итог дня" in pgF.inner_text("#app").lower() and "день 1" in pgF.inner_text("#hero").lower(), (PF.get("practiceStartDate"), pgF.inner_text("#app")[:120]))
    # 3. Первый запуск днём: действие на ближайший повод; вечером без опыта — закончить знакомство
    ctxG = b.new_context(viewport={"width": 390, "height": 844}); pgG = fresh(ctxG); pgG.goto(U); pgG.wait_for_timeout(500); set_hour(pgG, 14)
    onboard(pgG, "Отношение к себе", None, when="На этой неделе")
    tl = pgG.inner_text("#app").lower(); PG = state(pgG)["patterns"][0]
    check("v5-3: дневной первый запуск — «попробуй при ближайшем поводе», понятный вечер; практика с сегодня", "сегодня — первый день" in tl and "ближайшем поводе" in tl and "вечером" in tl and PG["practiceStartDate"] == pgG.evaluate("() => window.KARMA_APP.today()") and PG["firstDay"]["kind"] == "day", tl[:300]); snap(pgG, "v5_first_day_afternoon")
    set_hour(pgG, 20); tl = pgG.inner_text("#app").lower()
    check("v5-3: вечер первого дня без опыта — итог не нужен; можно подвести, если был повод, или закончить знакомство", "итог не нужен" in tl and "был повод — подвести итог" in tl and pgG.query_selector("#closeIntro") is not None, tl[:300]); snap(pgG, "v5_first_day_evening_noexp")
    pgG.click("#closeIntro"); pgG.wait_for_timeout(300); stG = state(pgG)
    check("v5-3: «закончить знакомство» не создаёт вечер, шаг и оценку", stG["patterns"][0]["firstDay"].get("closed") and len(stG["checkins"]) == 0 and "завтра утром возьмёшь шаг" in pgG.inner_text("#app").lower(), pgG.inner_text("#app")[:200])
    # 7. Работа → партнёр: явное переключение, ответы не исчезают
    ctxH = b.new_context(viewport={"width": 390, "height": 844}); pgH = fresh(ctxH); pgH.goto(U); pgH.wait_for_timeout(500)
    to_cards(pgH, "Работа и общение", "С коллегами"); answer_cards(pgH, ["yes", "unsure", "no", "yes", "no"]); pgH.click("#pick"); pgH.wait_for_timeout(300); pgH.click(".chip[data-i='0']"); pgH.wait_for_timeout(350)
    check("v5-7: контекст «коллеги» предложен учителем", pgH.evaluate("() => [...document.querySelectorAll('#ch .chip.on')].map(b => b.textContent)") == ["Коллега"])
    click_chip(pgH, "Партнёр"); pgH.wait_for_timeout(300); check("v5-7: партнёр при рабочей сфере — явный вопрос о переключении", "переключаемся с работы" in pgH.inner_text("h1.q").lower() and "Да, это важнее" in pgH.inner_text("#app") and "Вернуться к работе" in pgH.inner_text("#app"), pgH.inner_text("#app")[:200]); snap(pgH, "v5_switch")
    click_chip(pgH, "Вернуться к работе"); pgH.wait_for_timeout(400)
    oH = pgH.evaluate("() => { const S = window.KARMA_APP.profile.onb; return { on: [...document.querySelectorAll('#ch .chip.on')].map(b => b.textContent), picks: S.picks.length, area: S.area, sw: S.areaSwitched || null }; }")
    check("v5-7: «Вернуться к работе» — снова учитель с рабочим контекстом, ответы по колоде целы", oH == {"on": ["Коллега"], "picks": 5, "area": "work", "sw": None} and "с кем или с чем" in pgH.inner_text("h1.q").lower(), oH)
    click_chip(pgH, "Партнёр"); pgH.wait_for_timeout(300); click_chip(pgH, "Да, это важнее"); pgH.wait_for_timeout(300)
    pgH.click("#tg .chip >> nth=0"); pgH.click("#next"); pgH.wait_for_timeout(250); click_chip(pgH, "Сегодня"); click_chip(pgH, "Такое повторяется"); pgH.wait_for_timeout(300); pgH.click("#ch .chip >> nth=0"); pgH.wait_for_timeout(400)
    tl = pgH.inner_text("#app").lower(); oH = pgH.evaluate("() => { const S = window.KARMA_APP.profile.onb; return { picks: S.picks.length, area: S.area, sw: S.areaSwitched }; }")
    check("v5-7: после «Да, это важнее» — сфера в резюме личная, учитель партнёр, колода сохранена", "сфера: отношения с близкими" in tl and "учитель: отношения с партнёром" in tl and oH == {"picks": 5, "area": "work", "sw": "close"}, (tl[:200], oH))
    # 11. Оговорки собраны в одном месте
    allv = pgH.evaluate("() => (window.KARMA_CONTENT.extra.onboarding.number.text + window.KARMA_CONTENT.extra.onboarding.reveal.note + window.KARMA_CONTENT.extra.onboarding.events.sub + window.KARMA_CONTENT.extra.onboarding.home.title + window.KARMA_CONTENT.extra.onboarding.map.lines.join(' ')).toLowerCase()")
    check("v5-11: открытие числа, карточки, карта и главная без повторных оговорок; текст «О подходе» содержит пределы", "не наука" not in allv and "не влияет" not in allv and "традиция" not in allv and pgH.evaluate("() => window.KARMA_CONTENT.extra.onboarding.approach.text.includes('не ставит диагнозы') && window.KARMA_CONTENT.extra.onboarding.approach.text.includes('не гарантирует')"))
    # ---------- v3: 320 px и reduced motion ----------
    ctx11 = b.new_context(viewport={"width": 320, "height": 640}, reduced_motion="reduce"); pg11 = fresh(ctx11); pg11.goto(U); pg11.wait_for_timeout(500)
    consent_start(pg11); pg11.fill("#b", "1990-05-05"); pg11.click("#go"); pg11.wait_for_timeout(400)
    check("v3: reduced motion — открытие статично, без кнопки пропуска", pg11.query_selector("#skipAnim") is None and pg11.query_selector("#go") is not None and "твоё число" in pg11.inner_text("#app").lower(), pg11.inner_text("#app")[:80])
    pg11.click("#go"); pg11.wait_for_timeout(300); click_chip(pg11, "Отношения с близкими"); pg11.wait_for_timeout(300)
    w = pg11.evaluate("() => document.documentElement.scrollWidth"); check("v3: 320 px без горизонтального скролла на карточках", w <= 322, w)
    check("v3: reduced motion — без демонстрационного движения, подсказки текстом", pg11.query_selector(".swcard.demo") is None and "вправо — цепляет" in pg11.inner_text("#app").lower())
    yb = pg11.locator("#yes").bounding_box(); tb = pg11.locator("#tabs").bounding_box() or {"y": 9999}
    check("v3: кнопки ответа не закрыты нижней навигацией", yb and (yb["y"] + yb["height"] <= tb["y"] + 1 or tb["y"] > 640), (yb, tb))
    snap(pg11, "v3_cards_320"); print("\nошибки страниц:", pg.errors[:5], pg2.errors[:3], pg5.errors[:3], pg6.errors[:3], pg7.errors[:2], pg8.errors[:2], pg9.errors[:3], pg10.errors[:3], pg11.errors[:3], pg12.errors[:3], pgB.errors[:2], pgC.errors[:2], pgE.errors[:3], pgF.errors[:2], pgG.errors[:2], pgH.errors[:2])
    for nm, pgx in [("pg", pg), ("pg9", pg9), ("pg10", pg10), ("pg12", pg12), ("pgE", pgE), ("pgF", pgF), ("pgG", pgG), ("pgH", pgH), ("pg8", pg8)]: check(f"без ошибок страницы: {nm}", not pgx.errors, pgx.errors[:2])
    b.close()
print("\nПРОВАЛЕНО:" if FAILS else "\nВСЕ СЦЕНАРИИ ПРОШЛИ", FAILS)
sys.exit(1 if FAILS else 0)
