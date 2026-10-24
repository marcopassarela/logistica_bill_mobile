/**
 * Logísticas Bill — Inicialização (carregar DEPOIS de app.js)
 *
 * Ajusta o App sem precisar mexer no app.js:
 *  - login/entrada passam a falar com o servidor (Layerbase) e sincronizar
 *  - um erro numa tela (ex.: gráfico ou mapa que não carregou) não derruba o resto nem o menu
 *  - eventos não duplicam ao sair e entrar de novo
 *  - indicador de sincronização no topo
 */
(function () {
  'use strict';
  if (typeof App === 'undefined' || typeof DB === 'undefined') return;

  function report(msg) {
    if (typeof window.__lbReport === 'function') window.__lbReport(msg);
  }

  // ---------- 1. bindEvents só uma vez ----------
  const origBind = App.bindEvents;
  let bound = false;
  App.bindEvents = function () {
    if (bound) return;
    bound = true;
    origBind.call(this);
  };

  // ---------- 2. refreshAll tolerante a erro ----------
  const PARTS = [
    'refreshDashboard', 'refreshCarregamentos', 'refreshRotas', 'refreshCaminhoes',
    'refreshFuncionarios', 'refreshCargos', 'refreshProdutos', 'refreshDiariasPreview',
    'refreshFaltas', 'refreshConfig'
  ];
  App.refreshAll = function () {
    const self = this;
    PARTS.forEach(function (name) {
      try {
        if (typeof self[name] === 'function') self[name]();
      } catch (e) {
        console.error(name, e);
        report('Erro em ' + name + ': ' + (e && e.message));
      }
    });
  };

  // ---------- 3. indicador de sincronização ----------
  const LABEL = {
    ok: '● Sincronizado',
    syncing: '↻ Sincronizando…',
    offline: '● Sem conexão',
    local: '● Só neste aparelho'
  };
  function renderBadge(status, pending) {
    const b = document.getElementById('syncBadge');
    if (!b) return;
    b.className = 'sync-badge ' + status;
    b.textContent = status === 'pending'
      ? '● ' + pending + ' a enviar'
      : (LABEL[status] || '');
  }
  function ensureBadge() {
    if (document.getElementById('syncBadge')) return;
    const host = document.querySelector('.topbar-actions');
    if (!host) return;
    const b = document.createElement('span');
    b.id = 'syncBadge';
    host.insertBefore(b, host.firstChild);
    renderBadge(DB._status, DB._dirty ? DB._dirty.size : 0);
  }
  DB.onStatus = renderBadge;

  const origShow = App.showApp;
  App.showApp = function (auth) {
    origShow.call(this, auth);
    ensureBadge();
  };

  // ---------- 4. chegou dado novo de outro aparelho ----------
  DB.onRemoteChange = function () {
    const appEl = document.getElementById('app');
    if (!appEl || appEl.style.display === 'none') return;
    const modal = document.getElementById('modal');
    if (modal && modal.classList.contains('show')) return;          // não atrapalha quem está num formulário
    const ae = document.activeElement;
    if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
    if (App._addingCliente) return;                                  // marcando pontos no mapa
    const pageEl = document.querySelector('.page.active');
    const page = pageEl ? pageEl.id.replace('page-', '') : 'dashboard';
    if (page === 'diarias' || page === 'config') return;             // telas com formulário fixo na página
    try { App.refreshPage(page); } catch (e) { report('Erro ao atualizar: ' + (e && e.message)); }
  };

  DB.onAuthLost = function () {
    UI.toast('Sessão expirada. Entre novamente.', 'err');
    App.doLogout();
  };

  // ---------- 4b. Configurações ----------
  // Algumas versões do app.js trocam a senha por uma rota de API antiga e limpam a senha local.
  // Aqui usamos sempre a regra simples: confere a senha atual e grava (o DB sincroniza com o servidor).
  App.salvarConfig = function () {
    const senhaAtual = document.getElementById('cfgSenhaAtual').value;
    if (!DB.requireAdmPassword(senhaAtual)) return UI.toast('Senha atual incorreta', 'err');
    DB.update(function (d) {
      d.config.usuario = document.getElementById('cfgUser').value.trim() || 'Admin';
      const nova = document.getElementById('cfgSenha').value;
      if (nova) d.config.senha = nova;
      d.config.diariaPadrao = +document.getElementById('cfgDiaria').value || 350;
    });
    UI.toast('Configurações salvas!');
    this.refreshConfig();
  };

  // ---------- 5. entrar / sair / iniciar ----------
  App.init = function () {
    DB.init();
    const auth = DB.getAuth();
    if (auth) {
      this.showApp(auth);
      DB.startSync();
    } else {
      this.showLogin();
    }
    this.bindGlobal();
  };

  App.doLogin = async function () {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Entrando…';
    try {
      const ok = await DB.login(user, pass);
      if (ok) {
        err.style.display = 'none';
        document.getElementById('loginPass').value = '';
        await DB.syncNowWait(8000);        // traz os dados do servidor antes de mostrar o sistema
        this.showApp(DB.getAuth());
        DB.startSync();
      } else {
        err.textContent = 'Usuário ou senha incorretos.';
        err.style.display = 'block';
      }
    } catch (e) {
      err.textContent = (e && e.userMessage) || 'Não foi possível entrar. Tente de novo.';
      err.style.display = 'block';
      report('Login: ' + (e && e.message));
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };

  App.doLogout = function () {
    DB.stopSync();
    DB.logout();
    UI.closeSidebar();      // não volta com o menu aberto no próximo login
    UI.closeModal();
    this.showLogin();
  };
})();