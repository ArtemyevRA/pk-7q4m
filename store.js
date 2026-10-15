/* Путь кармы v2 — хранилище. IndexedDB, запасной вариант localStorage. Все записи только на устройстве. */
(function (root) {
  const DB_NAME = "put-karmy-v2", DB_VER = 1, LS_KEY = "put-karmy-v2-fallback", LEGACY_KEY = "put-karmy-v9";
  const STORES = ["patterns", "episodes", "hypotheses", "experiments", "reviews", "flags", "checkins", "research", "kv"];
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
        req.onupgradeneeded = () => { const db = req.result; STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === "checkins" ? "dateKey" : s === "research" ? "patternId" : s === "kv" ? "key" : "id" }); }); };
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
            if (s === "checkins") rows.forEach(r => d.checkins[r.dateKey] = r);
            else if (s === "research") rows.forEach(r => d.research[r.patternId] = r);
            else if (s === "kv") rows.forEach(r => { if (r.key === "profile") d.profile = r.value; if (r.key === "meta") d.meta = r.value; });
            else d[s] = rows;
          });
        } catch (e) { this.mode = "ls"; this.lastError = e; }
      }
      if (this.mode === "ls") {
        try { const raw = root.localStorage.getItem(LS_KEY); if (raw) Object.assign(d, JSON.parse(raw)); }
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
      if (this.mode === "idb") await Promise.all(STORES.map(s => new Promise((res, rej) => { const tx = this.db.transaction(s, "readwrite"); tx.objectStore(s).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); })));
      try { root.localStorage.removeItem(LS_KEY); } catch (e) {}
      this.data = this.empty();
    },
    /* Полная перезапись (импорт). */
    async replaceAll(d) {
      this.data = d;
      if (this.mode === "idb") {
        await Promise.all(STORES.map(s => new Promise((res, rej) => { const tx = this.db.transaction(s, "readwrite"); tx.objectStore(s).clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); })));
        const puts = [];
        R.COLLECTIONS.forEach(c => (d[c] || []).forEach(x => puts.push(this.put(c, x))));
        Object.values(d.checkins || {}).forEach(c => puts.push(this.put("checkins", c)));
        Object.values(d.research || {}).forEach(r => puts.push(this.put("research", r)));
        if (d.profile) puts.push(this.put("kv", { key: "profile", value: d.profile }));
        if (d.meta) puts.push(this.put("kv", { key: "meta", value: d.meta }));
        await Promise.all(puts);
      } else await this.flushLS();
    },
    exportJSON(nowTs) {
      const d = this.data; return JSON.stringify({ schemaVersion: R.SCHEMA_VERSION, exportedAt: new Date(nowTs || Date.now()).toISOString(), app: "put-karmy", profile: d.profile, meta: d.meta, patterns: d.patterns, episodes: d.episodes, hypotheses: d.hypotheses, experiments: d.experiments, reviews: d.reviews, flags: d.flags, checkins: d.checkins, research: d.research }, null, 1);
    },
    readLegacy() { try { const raw = root.localStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    hasLegacy() { const l = this.readLegacy(); return !!(l && (l.num || l.sprint || (l.archive && l.archive.length))); },
  };
  root.KARMA_STORE = Store;
})(typeof self !== "undefined" ? self : this);
