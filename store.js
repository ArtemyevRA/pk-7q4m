/* Путь кармы v2 — хранилище. IndexedDB, запасной вариант localStorage. Все записи только на устройстве. */
(function (root) {
  const DB_NAME = "put-karmy-v2", DB_VER = 2, LS_KEY = "put-karmy-v2-fallback", LEGACY_KEY = "put-karmy-v9";
  const STORES = ["patterns", "episodes", "hypotheses", "experiments", "reviews", "flags", "checkins", "research", "kv"];
  /* Версия 2 базы: записи дня по ключу «дата|сюжет» (id), а не по дате. */
  const KEY = { checkins: "id", research: "patternId", kv: "key" };
  const R = root.KARMA_RULES;

  const Store = {
    mode: "idb", db: null, data: null, listeners: [], lastError: null,
    empty() { return { patterns: [], episodes: [], hypotheses: [], experiments: [], reviews: [], flags: [], checkins: {}, research: {}, profile: null, meta: null }; },
    onChange(fn) { this.listeners.push(fn); },
    emit(kind) { this.listeners.forEach(f => { try { f(kind, this.lastError); } catch (e) {} }); },

    open() {
      return new Promise(resolve => {
        if (!root.indexedDB) { this.mode = "ls"; return resolve(); }
        let req;
        try { req = root.indexedDB.open(DB_NAME, DB_VER); } catch (e) { this.mode = "ls"; return resolve(); }
        req.onupgradeneeded = ev => {
          const db = req.result, tx = req.transaction;
          STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: KEY[s] || "id" }); });
          /* 1 → 2: переносим записи дня на составной ключ внутри той же транзакции обновления. */
          if (ev.oldVersion && ev.oldVersion < 2 && db.objectStoreNames.contains("checkins")) {
            const old = tx.objectStore("checkins");
            if (old.keyPath !== "id") {
              const rq = old.getAll();
              rq.onsuccess = () => {
                const rows = rq.result || []; db.deleteObjectStore("checkins");
                const ns = db.createObjectStore("checkins", { keyPath: "id" });
                const map = {}; rows.forEach(r => { if (r && r.dateKey) map[r.dateKey] = r; });
                Object.values(R.normalizeCheckins(map)).forEach(r => ns.put(r));
              };
            }
          }
        };
        req.onsuccess = () => { this.db = req.result; this.db.onversionchange = () => { try { this.db.close(); } catch (e) {} }; resolve(); };
        req.onerror = () => { this.mode = "ls"; resolve(); };
        req.onblocked = () => { this.mode = "ls"; resolve(); };
      });
    },
    async load() {
      await this.open();
      const d = this.empty();
      if (this.mode === "idb") {
        try {
          const all = await Promise.all(STORES.map(s => this.getAll(s)));
          STORES.forEach((s, i) => {
            const rows = all[i];
            if (s === "checkins") { const map = {}; rows.forEach((r, j) => map[r.id || r.dateKey || String(j)] = r); d.checkins = R.normalizeCheckins(map); }
            else if (s === "research") rows.forEach(r => d.research[r.patternId] = r);
            else if (s === "kv") rows.forEach(r => { if (r.key === "profile") d.profile = r.value; if (r.key === "meta") d.meta = r.value; });
            else d[s] = rows;
          });
        } catch (e) { this.mode = "ls"; this.lastError = e; }
      }
      if (this.mode === "ls") {
        try { const raw = root.localStorage.getItem(LS_KEY); if (raw) Object.assign(d, JSON.parse(raw)); d.checkins = R.normalizeCheckins(d.checkins || {}); }
        catch (e) { this.mode = "none"; this.lastError = e; }
      }
      this.data = d;
      return d;
    },
    getAll(store) {
      return new Promise((res, rej) => { try { const tx = this.db.transaction(store, "readonly"); const rq = tx.objectStore(store).getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); } catch (e) { rej(e); } });
    },
    /* Запись одной сущности. Возвращает promise; «Сохранено» показывать только после успеха. */
    put(store, obj) {
      if (this.mode === "none") return Promise.reject(new Error("Хранилище недоступно"));
      if (this.mode === "ls") return this.flushLS();
      return new Promise((res, rej) => {
        try {
          const tx = this.db.transaction(store, "readwrite"); tx.objectStore(store).put(obj);
          tx.oncomplete = () => { this.lastError = null; res(); };
          tx.onerror = () => { this.lastError = tx.error; rej(tx.error); };
          tx.onabort = () => { this.lastError = tx.error || new Error("abort"); rej(this.lastError); };
        } catch (e) { this.lastError = e; rej(e); }
      });
    },
    del(store, key) {
      if (this.mode === "none") return Promise.reject(new Error("Хранилище недоступно"));
      if (this.mode === "ls") return this.flushLS();
      return new Promise((res, rej) => { try { const tx = this.db.transaction(store, "readwrite"); tx.objectStore(store).delete(key); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); } catch (e) { rej(e); } });
    },
    flushLS() {
      return new Promise((res, rej) => { try { root.localStorage.setItem(LS_KEY, JSON.stringify(this.data)); this.lastError = null; res(); } catch (e) { this.lastError = e; rej(e); } });
    },
    async clearAll() {
      if (this.mode === "idb") await new Promise((res, rej) => { const tx = this.db.transaction(STORES, "readwrite"); STORES.forEach(s => tx.objectStore(s).clear()); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("abort")); });
      try { root.localStorage.removeItem(LS_KEY); } catch (e) {}
      this.data = this.empty();
    },
    /* Полная перезапись (импорт, восстановление). Одна транзакция на все хранилища:
       при ошибке или прерывании база остаётся прежней, данные в памяти не подменяются. */
    replaceAll(d) {
      if (this.mode === "none") return Promise.reject(new Error("Хранилище недоступно"));
      if (this.mode === "ls") {
        const prev = this.data; this.data = d;
        return this.flushLS().catch(e => { this.data = prev; throw e; });
      }
      return new Promise((res, rej) => {
        let tx; try { tx = this.db.transaction(STORES, "readwrite"); } catch (e) { this.lastError = e; return rej(e); }
        let done = false;
        tx.oncomplete = () => { done = true; this.data = d; this.lastError = null; res(); };
        tx.onerror = () => { this.lastError = tx.error || new Error("ошибка записи"); };
        tx.onabort = () => { if (done) return; this.lastError = tx.error || this.lastError || new Error("abort"); rej(this.lastError); };
        try {
          STORES.forEach(s => tx.objectStore(s).clear());
          R.COLLECTIONS.forEach(c => (d[c] || []).forEach(x => tx.objectStore(c).put(x)));
          Object.values(R.normalizeCheckins(d.checkins || {})).forEach(c => tx.objectStore("checkins").put(c));
          Object.values(d.research || {}).forEach(r => tx.objectStore("research").put(r));
          if (d.profile) tx.objectStore("kv").put({ key: "profile", value: d.profile });
          if (d.meta) tx.objectStore("kv").put({ key: "meta", value: d.meta });
        } catch (e) { this.lastError = e; try { tx.abort(); } catch (_) {} }
      });
    },
    exportJSON(nowTs) {
      const d = this.data; return JSON.stringify({ schemaVersion: R.SCHEMA_VERSION, exportedAt: new Date(nowTs || Date.now()).toISOString(), app: "put-karmy", profile: d.profile, meta: d.meta, patterns: d.patterns, episodes: d.episodes, hypotheses: d.hypotheses, experiments: d.experiments, reviews: d.reviews, flags: d.flags, checkins: d.checkins, research: d.research }, null, 1);
    },
    readLegacy() { try { const raw = root.localStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    hasLegacy() { const l = this.readLegacy(); return !!(l && (l.num || l.sprint || (l.archive && l.archive.length))); },
  };
  root.KARMA_STORE = Store;
})(typeof self !== "undefined" ? self : this);
