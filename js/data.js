/**
<<<<<<< HEAD
 * Logísticas Bill — Camada de dados
 *
 * - Cópia local no aparelho (localStorage) = rápido e funciona sem internet
 * - Sincroniza com o servidor (banco Layerbase) em segundo plano, registro por registro
 *   → PC e iPhone enxergam os mesmos dados; alterações em itens diferentes não se sobrescrevem
 * - A API pública (get/update/add/updateItem/remove/save/...) é a mesma de antes,
 *   então o app.js continua funcionando sem mudanças.
 * - Aberto direto como arquivo (file://) ou sem servidor: continua no modo local de sempre.
 */

// localStorage "à prova de falhas": se o navegador bloquear (ex.: iPhone com cookies bloqueados,
// aba privada, cota cheia), guarda em memória em vez de quebrar o sistema.
const LS = (function () {
  const mem = {};
  let ok = true;
  try {
    localStorage.setItem('__lb_test', '1');
    localStorage.removeItem('__lb_test');
  } catch (e) { ok = false; }
  return {
    get: function (k) {
      if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k];
      if (ok) { try { return localStorage.getItem(k); } catch (e) { /* cai no null */ } }
      return null;
    },
    set: function (k, v) {
      if (ok) {
        try { localStorage.setItem(k, v); delete mem[k]; return true; } catch (e) { /* cota cheia */ }
      }
      mem[k] = v;
      return false;
    },
    del: function (k) {
      delete mem[k];
      if (ok) { try { localStorage.removeItem(k); } catch (e) { /* ignora */ } }
    }
  };
})();

// Texto estável (chaves em ordem) só para comparar objetos — o banco pode reordenar as chaves.
function lbCanon(v) {
  if (Array.isArray(v)) return '[' + v.map(lbCanon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + lbCanon(v[k]);
    }).join(',') + '}';
  }
  return JSON.stringify(v);
}

const DB = {
  KEY: 'logisticas_bill_v1',
  AUTH_KEY: 'logisticas_bill_auth',
  DIRTY_KEY: 'logisticas_bill_dirty',
  META_KEY: 'logisticas_bill_syncmeta',
  COLLECTIONS: ['caminhoes', 'funcionarios', 'cargos', 'produtos', 'diarias', 'faltas', 'carregamentos', 'rotas'],

  // Sincroniza com o servidor quando a página vem de http(s). Em file:// fica só local.
  remote: (typeof location !== 'undefined') && (location.protocol === 'http:' || location.protocol === 'https:'),

  onStatus: null,        // (status, pendentes) => void
  onRemoteChange: null,  // () => void  — chegou dado novo de outro aparelho
  onAuthLost: null,      // () => void  — sessão expirou

  _raw: null, _last: null, _dirty: null, _failed: null, _meta: null,
  _seq: 0, _flushing: false, _syncing: false, _offline: false, _authLost: false,
  _status: 'local', _timer: null, _retryT: null, _poll: null, _listeners: false,

  default: function () {
=======
 * Logísticas Bill — Banco de dados local (LocalStorage)
 * Preparado para embutir no .exe futuramente
 */
const DB = {
  KEY: 'logisticas_bill_v1',
  AUTH_KEY: 'logisticas_bill_auth',

  default() {
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    return {
      config: {
        usuario: 'Admin',
        senha: '1234',
        diariaPadrao: 350
      },
      caminhoes: [],
      funcionarios: [],
      cargos: [
        { id: 'cargo_mot', nome: 'Motorista' },
        { id: 'cargo_aju', nome: 'Ajudante' },
        { id: 'cargo_adm', nome: 'Administrativo' },
        { id: 'cargo_op', nome: 'Operador' }
      ],
      produtos: [],
      diarias: [],
      faltas: [],
      carregamentos: [],
      rotas: []
    };
  },

<<<<<<< HEAD
  // ==================== Armazenamento local ====================
  load: function () {
    try {
      if (this._raw == null) this._raw = LS.get(this.KEY);
      if (!this._raw) return this.default();
      return Object.assign(this.default(), JSON.parse(this._raw));
    } catch (e) {
=======
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.default();
      return { ...this.default(), ...JSON.parse(raw) };
    } catch {
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
      return this.default();
    }
  },

<<<<<<< HEAD
  save: function (data) {
    const raw = JSON.stringify(data);
    this._raw = raw;
    LS.set(this.KEY, raw);
    this._track(data);
  },

  get: function () { return this.load(); },

  update: function (fn) {
=======
  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  get() { return this.load(); },

  update(fn) {
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    const data = this.load();
    fn(data);
    this.save(data);
    return data;
  },

<<<<<<< HEAD
  uid: function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  init: function () {
    this._ensure();
    if (this._storageBound) return;
    this._storageBound = true;
    const self = this;
    // outra aba mexeu nos dados → descarta o cache desta aba
    window.addEventListener('storage', function (e) {
      if (e.key === self.KEY) self._raw = null;
    });
  },

  // ==================== Controle de alterações ====================
  _snapshot: function (data) {
    const m = {};
    m['config/main'] = JSON.stringify(data.config || {});
    for (let a = 0; a < this.COLLECTIONS.length; a++) {
      const c = this.COLLECTIONS[a];
      const arr = data[c] || [];
      for (let b = 0; b < arr.length; b++) {
        const it = arr[b];
        if (it && it.id != null) m[c + '/' + it.id] = JSON.stringify(it);
      }
    }
    return m;
  },

  _index: function (data) {
    const m = {};
    m['config/main'] = data.config || {};
    for (let a = 0; a < this.COLLECTIONS.length; a++) {
      const c = this.COLLECTIONS[a];
      const arr = data[c] || [];
      for (let b = 0; b < arr.length; b++) {
        const it = arr[b];
        if (it && it.id != null) m[c + '/' + it.id] = it;
      }
    }
    return m;
  },

  _ensure: function () {
    if (this._last) return;
    this._last = this._snapshot(this.load());
    this._failed = new Map();
    try {
      const keys = JSON.parse(LS.get(this.DIRTY_KEY) || '[]');
      this._dirty = new Map(keys.map(function (k) { return [k, 0]; }));
    } catch (e) { this._dirty = new Map(); }
    try { this._meta = JSON.parse(LS.get(this.META_KEY) || '{}') || {}; } catch (e) { this._meta = {}; }
  },

  _markDirty: function (key) {
    this._seq += 1;
    this._dirty.set(key, this._seq);
    this._failed.delete(key);
  },

  _persistDirty: function () {
    LS.set(this.DIRTY_KEY, JSON.stringify(Array.from(this._dirty.keys())));
  },

  _track: function (data) {
    if (!this.remote) return;
    this._ensure();
    const snap = this._snapshot(data);
    const last = this._last;
    let changed = false;
    let k;
    for (k in snap) { if (last[k] !== snap[k]) { this._markDirty(k); changed = true; } }
    for (k in last) { if (!(k in snap)) { this._markDirty(k); changed = true; } }
    this._last = snap;
    if (changed) {
      this._persistDirty();
      this._setStatus();
      this.scheduleFlush();
    }
  },

  // ==================== Autenticação ====================
  getAuth: function () {
    try {
      const raw = LS.get(this.AUTH_KEY);
=======
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Auth
  getAuth() {
    try {
      const raw = localStorage.getItem(this.AUTH_KEY);
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
      if (!raw) return null;
      const auth = JSON.parse(raw);
      if (!auth.loginAt) return null;
      const hours = (Date.now() - auth.loginAt) / 3600000;
      if (hours >= 24) {
        this.logout();
        return null;
      }
      return auth;
<<<<<<< HEAD
    } catch (e) { return null; }
  },

  // Retorna uma Promise<boolean>. Tenta o servidor; se ele estiver fora do ar, usa a cópia local.
  login: async function (user, pass) {
    if (this.remote) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: user, pass: pass })
        });
        if (res.status === 200) {
          const j = await res.json();
          LS.set(this.AUTH_KEY, JSON.stringify({ user: j.user, loginAt: Date.now(), token: j.token }));
          this._authLost = false;
          return true;
        }
        if (res.status === 401) return false;
        if (res.status === 429) {
          let msg = 'Muitas tentativas. Aguarde alguns minutos.';
          try { msg = (await res.json()).error || msg; } catch (e) { /* mantém msg */ }
          const err = new Error(msg);
          err.userMessage = msg;
          throw err;
        }
        // outro erro (404 = site sem servidor, 5xx...) → tenta a cópia local
      } catch (e) {
        if (e && e.userMessage) throw e;
        // sem internet / servidor fora → tenta a cópia local
      }
    }
    const d = this.load();
    if (user === d.config.usuario && pass === d.config.senha) {
      LS.set(this.AUTH_KEY, JSON.stringify({ user: user, loginAt: Date.now() }));
=======
    } catch { return null; }
  },

  login(user, pass) {
    const d = this.load();
    if (user === d.config.usuario && pass === d.config.senha) {
      const auth = { user, loginAt: Date.now() };
      localStorage.setItem(this.AUTH_KEY, JSON.stringify(auth));
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
      return true;
    }
    return false;
  },

<<<<<<< HEAD
  logout: function () {
    LS.del(this.AUTH_KEY);
  },

  requireAdmPassword: function (senha) {
    return senha === this.load().config.senha;
  },

  // ==================== CRUD ====================
  add: function (collection, obj) {
    const self = this;
    return this.update(function (d) {
      d[collection].push(Object.assign({ id: self.uid() }, obj));
    });
  },
  updateItem: function (collection, id, fields) {
    return this.update(function (d) {
      const i = d[collection].findIndex(function (x) { return x.id === id; });
      if (i >= 0) d[collection][i] = Object.assign({}, d[collection][i], fields);
    });
  },
  remove: function (collection, id) {
    return this.update(function (d) {
      d[collection] = d[collection].filter(function (x) { return x.id !== id; });
    });
  },

  seedIfEmpty: function () {
    // Com servidor, não cria dados de demonstração (iriam para o banco de verdade).
    if (this.remote) return;
    const d = this.load();
    if (d.caminhoes.length || d.produtos.length) return;
    const self = this;
    this.update(function (data) {
      data.funcionarios = [
        { id: self.uid(), nome: 'Carlos Silva', cargoId: 'cargo_mot', telefone: '(11) 99999-1111', cnh: '12345678900', status: 'ativo' },
        { id: self.uid(), nome: 'João Oliveira', cargoId: 'cargo_mot', telefone: '(11) 98888-2222', cnh: '98765432100', status: 'ativo' },
        { id: self.uid(), nome: 'Marcos Lima', cargoId: 'cargo_aju', telefone: '(11) 96666-4444', cnh: '', status: 'ativo' },
        { id: self.uid(), nome: 'Rafael Costa', cargoId: 'cargo_aju', telefone: '(11) 95555-5555', cnh: '', status: 'ativo' }
      ];
      data.caminhoes = [
        { id: self.uid(), placa: 'CJM0R23', modelo: 'MB Accelo 1017 2024', capacidadeKg: 8000, status: 'disponivel' },
        { id: self.uid(), placa: 'DEF4G56', modelo: 'MB Accelo 1017 2024', capacidadeKg: 8000, status: 'disponivel' }
      ];
      data.produtos = [
        { id: self.uid(), codigo: 'P-7M-200', nome: 'Poste Circular 7m', comprimento: 7, diametro: 200, peso: 280, preco: 450, status: 'disponivel' },
        { id: self.uid(), codigo: 'P-9M-250', nome: 'Poste Circular 9m', comprimento: 9, diametro: 250, peso: 420, preco: 680, status: 'disponivel' },
        { id: self.uid(), codigo: 'P-11M-300', nome: 'Poste Circular 11m', comprimento: 11, diametro: 300, peso: 580, preco: 920, status: 'disponivel' },
        { id: self.uid(), codigo: 'P-12M-350', nome: 'Poste Circular 12m', comprimento: 12, diametro: 350, peso: 720, preco: 1150, status: 'disponivel' },
        { id: self.uid(), codigo: 'P-8M-200', nome: 'Poste Circular 8m', comprimento: 8, diametro: 200, peso: 320, preco: 520, status: 'disponivel' },
        { id: self.uid(), codigo: 'P-10M-300', nome: 'Poste Circular 10m', comprimento: 10, diametro: 300, peso: 510, preco: 850, status: 'disponivel' }
=======
  logout() {
    localStorage.removeItem(this.AUTH_KEY);
  },

  requireAdmPassword(senha) {
    return senha === this.load().config.senha;
  },

  // CRUD helpers
  add(collection, obj) {
    return this.update(d => {
      d[collection].push({ id: this.uid(), ...obj });
    });
  },
  updateItem(collection, id, fields) {
    return this.update(d => {
      const i = d[collection].findIndex(x => x.id === id);
      if (i >= 0) d[collection][i] = { ...d[collection][i], ...fields };
    });
  },
  remove(collection, id) {
    return this.update(d => {
      d[collection] = d[collection].filter(x => x.id !== id);
    });
  },

  seedIfEmpty() {
    const d = this.load();
    if (d.caminhoes.length || d.produtos.length) return;
    this.update(data => {
      data.funcionarios = [
        { id: this.uid(), nome: 'Carlos Silva', cargoId: 'cargo_mot', telefone: '(11) 99999-1111', cnh: '12345678900', status: 'ativo' },
        { id: this.uid(), nome: 'João Oliveira', cargoId: 'cargo_mot', telefone: '(11) 98888-2222', cnh: '98765432100', status: 'ativo' },
        { id: this.uid(), nome: 'Marcos Lima', cargoId: 'cargo_aju', telefone: '(11) 96666-4444', cnh: '', status: 'ativo' },
        { id: this.uid(), nome: 'Rafael Costa', cargoId: 'cargo_aju', telefone: '(11) 95555-5555', cnh: '', status: 'ativo' }
      ];
      data.caminhoes = [
        { id: this.uid(), placa: 'CJM0R23', modelo: 'MB Accelo 1017 2024', capacidadeKg: 8000, status: 'disponivel' },
        { id: this.uid(), placa: 'DEF4G56', modelo: 'MB Accelo 1017 2024', capacidadeKg: 8000, status: 'disponivel' }
      ];
      data.produtos = [
        { id: this.uid(), codigo: 'P-7M-200', nome: 'Poste Circular 7m', comprimento: 7, diametro: 200, peso: 280, preco: 450, status: 'disponivel' },
        { id: this.uid(), codigo: 'P-9M-250', nome: 'Poste Circular 9m', comprimento: 9, diametro: 250, peso: 420, preco: 680, status: 'disponivel' },
        { id: this.uid(), codigo: 'P-11M-300', nome: 'Poste Circular 11m', comprimento: 11, diametro: 300, peso: 580, preco: 920, status: 'disponivel' },
        { id: this.uid(), codigo: 'P-12M-350', nome: 'Poste Circular 12m', comprimento: 12, diametro: 350, peso: 720, preco: 1150, status: 'disponivel' },
        { id: this.uid(), codigo: 'P-8M-200', nome: 'Poste Circular 8m', comprimento: 8, diametro: 200, peso: 320, preco: 520, status: 'disponivel' },
        { id: this.uid(), codigo: 'P-10M-300', nome: 'Poste Circular 10m', comprimento: 10, diametro: 300, peso: 510, preco: 850, status: 'disponivel' }
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
      ];
    });
  },

<<<<<<< HEAD
  clearAll: function () {
    if (!this.remote) {
      this._raw = null;
      LS.del(this.KEY);
      return;
    }
    // Com servidor: apaga os registros (nos dois lados) mas preserva o acesso (usuário/senha),
    // para não trocar a senha de todo mundo para "1234".
    const fresh = this.default();
    fresh.config = this.load().config;
    this.save(fresh);
  },

  // ==================== Sincronização com o servidor ====================
  _api: async function (method, url, body) {
    const auth = this.getAuth();
    const headers = { 'Content-Type': 'application/json' };
    if (auth && auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
    const res = await fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.code = res.status;
      throw err;
    }
    return res.json();
  },

  _handleErr: function (e) {
    if (e && e.code === 401) {
      this._authLost = true;
      if (typeof this.onAuthLost === 'function') this.onAuthLost();
      return;
    }
    this._offline = true;
    const self = this;
    clearTimeout(this._retryT);
    this._retryT = setTimeout(function () { self._offline = false; self.syncNow(); }, 15000);
  },

  _setStatus: function (force) {
    let s;
    const auth = this.remote ? this.getAuth() : null;
    if (!this.remote) s = 'local';
    else if (force) s = force;
    else if (this._authLost || this._offline) s = 'offline';
    else if (!auth || !auth.token) s = 'local';
    else if (this._dirty && this._dirty.size) s = 'pending';
    else s = 'ok';
    this._status = s;
    if (typeof this.onStatus === 'function') this.onStatus(s, this._dirty ? this._dirty.size : 0);
  },

  scheduleFlush: function () {
    const self = this;
    clearTimeout(this._timer);
    this._timer = setTimeout(function () { self.flush(); }, 700);
  },

  // Envia ao servidor o que foi alterado aqui.
  flush: async function () {
    if (!this.remote || this._flushing) return;
    this._ensure();
    const auth = this.getAuth();
    if (!auth || !auth.token || !this._dirty.size) { this._setStatus(); return; }

    this._flushing = true;
    this._setStatus('syncing');
    const sent = new Map(this._dirty);
    let failedPermanent = false;
    try {
      const idx = this._index(this.load());
      const ops = [];
      sent.forEach(function (seq, k) {
        const p = k.indexOf('/');
        ops.push({ k: k, seq: seq, op: { c: k.slice(0, p), i: k.slice(p + 1), d: idx[k] === undefined ? null : idx[k] } });
      });
      const self = this;
      const ack = function (list) {
        list.forEach(function (o) { if (self._dirty.get(o.k) === o.seq) self._dirty.delete(o.k); });
      };
      for (let n = 0; n < ops.length; n += 100) {
        const chunk = ops.slice(n, n + 100);
        try {
          await this._api('POST', '/api/sync', { ops: chunk.map(function (o) { return o.op; }) });
          ack(chunk);
        } catch (e) {
          // erro "do pedido" (400/413): tenta um por um para não travar os outros itens
          if (e && (e.code === 400 || e.code === 413) && chunk.length > 1) {
            for (let j = 0; j < chunk.length; j++) {
              try {
                await this._api('POST', '/api/sync', { ops: [chunk[j].op] });
                ack([chunk[j]]);
              } catch (e2) {
                if (e2 && (e2.code === 400 || e2.code === 413)) {
                  this._failed.set(chunk[j].k, chunk[j].seq);
                  this._dirty.delete(chunk[j].k);
                  failedPermanent = true;
                } else { throw e2; }
              }
            }
          } else if (e && (e.code === 400 || e.code === 413)) {
            this._failed.set(chunk[0].k, chunk[0].seq);
            this._dirty.delete(chunk[0].k);
            failedPermanent = true;
          } else { throw e; }
        }
      }
      this._persistDirty();
      this._offline = false;
    } catch (e) {
      this._handleErr(e);
    } finally {
      this._flushing = false;
      this._setStatus();
    }
    if (failedPermanent && typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Algum registro não pôde ser enviado ao servidor (muito grande?).', 'err');
    }
    if (this._dirty.size && !this._offline && !this._authLost) this.scheduleFlush();
  },

  // Baixa do servidor o que mudou em outros aparelhos. Retorna true se algo mudou aqui.
  pull: async function () {
    if (!this.remote) return false;
    this._ensure();
    const auth = this.getAuth();
    if (!auth || !auth.token) return false;

    const first = !this._meta.migrated;
    const since = first ? 0 : Math.max(0, (this._meta.rev || 0) - 5000); // 5s de sobreposição por segurança
    const res = await this._api('GET', '/api/sync?since=' + since);
    const recs = res.records || [];

    const data = this.load();
    const localBefore = this._index(data);
    const serverKeys = {};
    let changed = false;

    for (let n = 0; n < recs.length; n++) {
      const rec = recs[n];
      const key = rec.collection + '/' + rec.id;
      serverKeys[key] = true;
      if (this._dirty.has(key)) continue; // alteração local ainda não enviada vence

      if (rec.collection === 'config') {
        if (!rec.deleted && rec.data) {
          const cfg = Object.assign(this.default().config, rec.data);
          if (lbCanon(cfg) !== lbCanon(data.config)) { data.config = cfg; changed = true; }
          this._last['config/main'] = JSON.stringify(data.config);
        }
        continue;
      }
      const arr = data[rec.collection];
      if (!Array.isArray(arr)) continue;
      const i = arr.findIndex(function (x) { return x.id === rec.id; });
      if (rec.deleted) {
        if (i >= 0) { arr.splice(i, 1); changed = true; }
        delete this._last[key];
      } else if (rec.data) {
        if (i < 0) { arr.push(rec.data); changed = true; this._last[key] = JSON.stringify(rec.data); }
        else if (lbCanon(arr[i]) !== lbCanon(rec.data)) { arr[i] = rec.data; changed = true; this._last[key] = JSON.stringify(rec.data); }
      }
    }

    // Primeira sincronização deste aparelho: o que existe só aqui (dados antigos do localStorage)
    // é enviado ao servidor, sem apagar nada que já esteja lá.
    if (first) {
      for (const key in localBefore) {
        if (!serverKeys[key]) this._markDirty(key);
      }
      this._persistDirty();
    }

    if (changed) {
      this._raw = JSON.stringify(data);
      LS.set(this.KEY, this._raw);
    }
    this._meta.rev = Math.max(this._meta.rev || 0, res.rev || 0);
    if (first) this._meta.migrated = true;
    LS.set(this.META_KEY, JSON.stringify(this._meta));

    if (first && this._dirty.size) this.scheduleFlush();
    if (changed && typeof this.onRemoteChange === 'function') this.onRemoteChange();
    return changed;
  },

  syncNow: async function () {
    if (!this.remote || this._syncing) return;
    const auth = this.getAuth();
    if (!auth || !auth.token) { this._setStatus(); return; }
    this._syncing = true;
    this._setStatus('syncing');
    try {
      await this.pull();
      this._offline = false;
    } catch (e) {
      this._handleErr(e);
    }
    this._syncing = false;
    if (!this._offline && !this._authLost) await this.flush();
    this._setStatus();
  },

  // Usado no login: espera a primeira sincronização (no máximo "ms" milissegundos).
  syncNowWait: function (ms) {
    const timeout = new Promise(function (resolve) { setTimeout(resolve, ms || 8000); });
    return Promise.race([this.syncNow(), timeout]);
  },

  startSync: function () {
    if (!this.remote) { this._setStatus(); return; }
    this._ensure();
    this._authLost = false;
    const self = this;
    this.syncNow();
    clearInterval(this._poll);
    this._poll = setInterval(function () { if (!document.hidden) self.syncNow(); }, 15000);
    if (!this._listeners) {
      this._listeners = true;
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && self.getAuth()) self.syncNow();
      });
      window.addEventListener('online', function () {
        self._offline = false;
        if (self.getAuth()) self.syncNow();
      });
      window.addEventListener('pagehide', function () { self.flush(); });
    }
  },

  stopSync: function () {
    clearInterval(this._poll);
    clearTimeout(this._timer);
    clearTimeout(this._retryT);
=======
  clearAll() {
    localStorage.removeItem(this.KEY);
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
  }
};
