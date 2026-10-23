const UI = {
<<<<<<< HEAD
  _navBound: false,
  _modalBound: false,

  initNav() {
    // Só liga os eventos uma vez (antes, sair e entrar de novo duplicava os cliques)
    if (this._navBound) return;
    this._navBound = true;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.page));
    });

    const toggle = document.getElementById('menuToggle');
    if (toggle) {
      toggle.addEventListener('click', e => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }
    const close = document.getElementById('sidebarClose');
    if (close) close.addEventListener('click', () => this.closeSidebar());
    const backdrop = document.getElementById('sidebarBackdrop');
    if (backdrop) backdrop.addEventListener('click', () => this.closeSidebar());
  },

  isSidebarOpen() {
    const sb = document.getElementById('sidebar');
    return !!(sb && sb.classList.contains('open'));
  },

  toggleSidebar() {
    if (this.isSidebarOpen()) this.closeSidebar();
    else this.openSidebar();
  },

  openSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.add('open');
    if (bd) bd.classList.add('show');
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
=======
  initNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => this.goTo(btn.dataset.page));
    });
    document.getElementById('menuToggle')?.addEventListener('click', () => this.openSidebar());
    document.getElementById('sidebarClose')?.addEventListener('click', () => this.closeSidebar());
    document.getElementById('sidebarBackdrop')?.addEventListener('click', () => this.closeSidebar());
  },

  openSidebar() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarBackdrop')?.classList.add('show');
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    document.body.style.overflow = 'hidden';
  },

  closeSidebar() {
<<<<<<< HEAD
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (sb) sb.classList.remove('open');
    if (bd) bd.classList.remove('show');
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
=======
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('show');
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    document.body.style.overflow = '';
  },

  goTo(page) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
<<<<<<< HEAD
    const navBtn = document.querySelector('[data-page="' + page + '"]');
    if (navBtn) navBtn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');
=======
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    this.closeSidebar();
    const titles = {
      dashboard: 'Dashboard',
      carregamento: 'Carregamento',
      rotas: 'Rotas',
      caminhoes: 'Caminhões',
      funcionarios: 'Funcionários',
      produtos: 'Produtos',
      diarias: 'Diárias',
      faltas: 'Faltas',
      relatorios: 'Relatórios',
      config: 'Configurações'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    if (window.App) App.refreshPage(page);
  },

  openModal(title, bodyHtml, footerHtml, large) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    const box = document.getElementById('modalBox');
    if (large) box.classList.add('modal-lg');
    else box.classList.remove('modal-lg');
    document.getElementById('modal').classList.add('show');
  },

  closeModal() {
    document.getElementById('modal').classList.remove('show');
  },

  initModal() {
<<<<<<< HEAD
    if (this._modalBound) return;
    this._modalBound = true;
=======
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modal').addEventListener('click', e => {
      if (e.target.id === 'modal') this.closeModal();
    });
  },

  badge(status) {
    const map = {
      disponivel: ['badge-green', 'Disponível'],
      carregado: ['badge-blue', 'Carregado'],
      'em-transito': ['badge-orange', 'Em Trânsito'],
      ativo: ['badge-green', 'Ativo'],
      inativo: ['badge-gray', 'Inativo'],
      operando: ['badge-orange', 'Carregando'],
      pronto: ['badge-blue', 'Pronto p/ sair'],
      manutencao: ['badge-red', 'Manutenção'],
      ok: ['badge-green', 'Dentro do peso'],
      excesso: ['badge-red', 'Acima do peso'],
      carregando: ['badge-carregando', 'Carregando'],
      'carregado-carga': ['badge-carregado-st', 'Carregado'],
      liberado: ['badge-liberado', 'Liberado']
    };
    const [cls, label] = map[status] || ['badge-gray', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  formGroup(label, inputHtml) {
    return `<div class="form-group"><label>${label}</label>${inputHtml}</div>`;
  },

  toast(msg, type = 'ok') {
    const el = document.createElement('div');
<<<<<<< HEAD
    el.style.cssText = `position:fixed;bottom:24px;right:24px;max-width:calc(100vw - 48px);z-index:9999;background:${type==='ok'?'#059669':'#dc2626'};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s`;
=======
    el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${type==='ok'?'#059669':'#dc2626'};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s`;
>>>>>>> a60888c (Initial commit: Logísticas Bill — sistema de logística web)
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
  },

  askPassword(callback) {
    this.openModal('Senha do Administrador', `
      <p class="text-muted">Para editar ou excluir, informe a senha do ADM.</p>
      ${this.formGroup('Senha', '<input type="password" class="form-control" id="admPass" autofocus>')}
    `, `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnConfirmAdm">Confirmar</button>
    `);
    setTimeout(() => {
      const confirm = async () => {
        const senha = document.getElementById('admPass').value;
        const btn = document.getElementById('btnConfirmAdm');
        if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
        const ok = await DB.requireAdmPassword(senha);
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }
        if (!ok) {
          UI.toast('Senha incorreta', 'err');
          return;
        }
        UI.closeModal();
        callback();
      };
      document.getElementById('btnConfirmAdm').onclick = () => confirm();
      document.getElementById('admPass').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirm();
      });
    }, 50);
  }
};
