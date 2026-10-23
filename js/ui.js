const UI = {
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
    document.body.style.overflow = 'hidden';
  },

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('show');
    document.body.style.overflow = '';
  },

  goTo(page) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');
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
    el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${type==='ok'?'#059669':'#dc2626'};color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s`;
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
      document.getElementById('btnConfirmAdm').onclick = () => {
        const senha = document.getElementById('admPass').value;
        if (!DB.requireAdmPassword(senha)) {
          UI.toast('Senha incorreta', 'err');
          return;
        }
        UI.closeModal();
        callback();
      };
      document.getElementById('admPass').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btnConfirmAdm').click();
      });
    }, 50);
  }
};
