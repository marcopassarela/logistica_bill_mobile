/**
 * Logísticas Bill — Aplicação Principal
 */
const App = {
  chartPeso: null,
  chartCaminhoes: null,
  cargaItens: [], // temp items for new loading

  async init() {
    this.bindGlobal();
    const remote = await DB.initRemote();
    if (remote.mode === 'layerbase') {
      console.log('[App] Banco Layerbase ativo');
    } else if (remote.error) {
      console.warn('[App] Layerbase offline:', remote.error);
    }
    const auth = DB.getAuth();
    if (auth) {
      this.showApp(auth);
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  showApp(auth) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('userName').textContent = auth.user;
    document.getElementById('userAvatar').textContent = (auth.user || 'A')[0].toUpperCase();
    DB.seedIfEmpty();
    UI.initNav();
    UI.initModal();
    this.bindEvents();
    this.refreshAll();
    this.updateDate();
  },

  doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    if (DB.login(user, pass)) {
      err.style.display = 'none';
      this.showApp(DB.getAuth());
    } else {
      err.textContent = 'Usuário ou senha incorretos.';
      err.style.display = 'block';
    }
  },

  doLogout() {
    DB.logout();
    this.showLogin();
  },

  updateDate() {
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  },

  refreshAll() {
    this.refreshDashboard();
    this.refreshCarregamentos();
    this.refreshRotas();
    this.refreshCaminhoes();
    this.refreshFuncionarios();
    this.refreshCargos();
    this.refreshProdutos();
    this.refreshDiariasPreview();
    this.refreshFaltas();
    this.refreshConfig();
  },

  refreshPage(page) {
    if (page === 'dashboard') this.refreshDashboard();
    if (page === 'carregamento') this.refreshCarregamentos();
    if (page === 'rotas') this.refreshRotas();
    if (page === 'caminhoes') this.refreshCaminhoes();
    if (page === 'funcionarios') { this.refreshFuncionarios(); this.refreshCargos(); }
    if (page === 'produtos') this.refreshProdutos();
    if (page === 'diarias') this.refreshDiariasPreview();
    if (page === 'faltas') this.refreshFaltas();
    if (page === 'config') this.refreshConfig();
  },

  // ==================== DASHBOARD ====================
  refreshDashboard() {
    const d = DB.get();
    const ativos = d.caminhoes.filter(c => c.status !== 'manutencao').length;
    const carregando = d.caminhoes.filter(c => c.status === 'operando').length;
    const prontos = d.caminhoes.filter(c => c.status === 'pronto').length;
    const disponiveis = d.caminhoes.filter(c => c.status === 'disponivel').length;

    let okPeso = 0, excessoPeso = 0;
    d.carregamentos.forEach(c => {
      if (c.pesoTotal > c.capacidadeKg) excessoPeso++;
      else okPeso++;
    });

    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card"><div class="stat-icon blue">🚛</div><div class="stat-info"><span class="stat-label">Caminhões Ativos</span><strong class="stat-value">${ativos}</strong></div></div>
      <div class="stat-card"><div class="stat-icon orange">🔄</div><div class="stat-info"><span class="stat-label">Carregando</span><strong class="stat-value">${carregando}</strong></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><span class="stat-label">Prontos p/ sair</span><strong class="stat-value">${prontos}</strong></div></div>
      <div class="stat-card"><div class="stat-icon purple">📦</div><div class="stat-info"><span class="stat-label">Disponíveis</span><strong class="stat-value">${disponiveis}</strong></div></div>
    `;

    // Charts
    const ctxP = document.getElementById('chartPeso');
    const ctxC = document.getElementById('chartCaminhoes');
    if (ctxP) {
      if (this.chartPeso) this.chartPeso.destroy();
      this.chartPeso = new Chart(ctxP, {
        type: 'doughnut',
        data: {
          labels: ['Dentro do peso', 'Acima do peso'],
          datasets: [{ data: [okPeso || 0, excessoPeso || 0], backgroundColor: ['#059669', '#dc2626'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
    if (ctxC) {
      if (this.chartCaminhoes) this.chartCaminhoes.destroy();
      this.chartCaminhoes = new Chart(ctxC, {
        type: 'bar',
        data: {
          labels: ['Disponível', 'Carregando', 'Pronto', 'Manutenção'],
          datasets: [{
            label: 'Caminhões',
            data: [disponiveis, carregando, prontos, d.caminhoes.filter(c => c.status === 'manutencao').length],
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
            borderRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    }

    // Recentes
    const rec = document.getElementById('dashRecentes');
    if (!d.carregamentos.length) {
      rec.innerHTML = '<p class="empty">Nenhum carregamento ainda.</p>';
    } else {
      rec.innerHTML = d.carregamentos.slice(0, 6).map(c => {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        const statusPeso = c.pesoTotal > c.capacidadeKg ? 'excesso' : 'ok';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px">
          <div><strong>${cam ? cam.placa : '—'}</strong><br><span style="color:#64748b;font-size:11px">${new Date(c.data).toLocaleString('pt-BR')} · ${c.itens?.length || 0} itens · ${c.pesoTotal} kg</span></div>
          ${UI.badge(statusPeso)}
        </div>`;
      }).join('');
    }

    // Alertas
    const alertas = d.carregamentos.filter(c => c.pesoTotal > c.capacidadeKg).slice(0, 6);
    const al = document.getElementById('dashAlertas');
    if (!alertas.length) {
      al.innerHTML = '<p class="empty" style="color:#059669">Nenhum alerta de excesso de peso.</p>';
    } else {
      al.innerHTML = alertas.map(c => {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        return `<div style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px">
          <strong style="color:#dc2626">${cam ? cam.placa : '—'}</strong> —
          ${c.pesoTotal} kg / ${c.capacidadeKg} kg
          <span class="badge badge-red">+${c.pesoTotal - c.capacidadeKg} kg</span>
        </div>`;
      }).join('');
    }
  },

  // ==================== CARREGAMENTO ====================
  refreshCarregamentos() {
    const d = DB.get();
    const tbody = document.querySelector('#tableCarregamentos tbody');
    if (!d.carregamentos.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">Nenhum carregamento registrado.</td></tr>';
      return;
    }
    let html = '';
    d.carregamentos.forEach(c => {
      const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
      const mot = d.funcionarios.find(f => f.id === c.motoristaId);
      const aju = d.funcionarios.find(f => f.id === c.ajudanteId);
      const st = c.statusCarga || (c.status === 'concluido' ? 'carregado' : 'carregando');
      // normaliza: carregando | carregado | liberado
      let statusNorm = st;
      if (st === 'em-andamento' || st === 'concluido') statusNorm = st === 'concluido' ? 'carregado' : 'carregando';
      if (st === 'carregado-carga') statusNorm = 'carregado';
      const rowCls = statusNorm === 'liberado' ? 'row-status-liberado'
        : statusNorm === 'carregado' ? 'row-status-carregado'
        : 'row-status-carregando';
      const dataStr = c.data ? c.data.slice(0, 10).split('-').reverse().join('/') : '—';
      const carregados = (c.itens || []).filter(i => i.status === 'carregado').length;
      const totalItens = (c.itens || []).length;
      html += `<tr class="${rowCls}">
        <td>${dataStr}</td>
        <td><strong>${cam ? cam.placa : '—'}</strong></td>
        <td>${mot ? mot.nome : '—'}</td>
        <td>${aju ? aju.nome : '—'}</td>
        <td>${carregados}/${totalItens}</td>
        <td>${c.pesoTotal} kg</td>
        <td>${c.capacidadeKg} kg</td>
        <td>
          <select class="form-control" style="width:auto;padding:4px 8px;font-size:12px" onchange="App.setStatusCarga('${c.id}', this.value)">
            <option value="carregando" ${statusNorm==='carregando'?'selected':''}>Carregando</option>
            <option value="carregado" ${statusNorm==='carregado'?'selected':''}>Carregado</option>
            <option value="liberado" ${statusNorm==='liberado'?'selected':''}>Liberado</option>
          </select>
        </td>
        <td class="td-actions">
          <div class="action-btns">
            <button class="btn btn-sm btn-outline" onclick="App.verCarga('${c.id}')">Itens</button>
            <button class="btn btn-sm btn-outline" onclick="App.editCarga('${c.id}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteCarga('${c.id}')">Excluir</button>
          </div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;
  },

  setStatusCarga(id, status) {
    DB.update(d => {
      const c = d.carregamentos.find(x => x.id === id);
      if (!c) return;
      c.statusCarga = status;
      if (status === 'liberado' || status === 'carregado') {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        if (cam) cam.status = status === 'liberado' ? 'disponivel' : 'pronto';
      } else if (status === 'carregando') {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        if (cam) cam.status = 'operando';
      }
    });
    this.refreshCarregamentos();
    this.refreshDashboard();
    UI.toast('Status atualizado: ' + status.charAt(0).toUpperCase() + status.slice(1));
  },

  novoCarregamento() {
    const d = DB.get();
    this.cargaItens = [];
    const optsCam = d.caminhoes.map(c =>
      `<option value="${c.id}" data-cap="${c.capacidadeKg || 8000}">${c.placa} — ${c.modelo} (${c.capacidadeKg || 8000} kg)</option>`
    ).join('');
    const motoristas = d.funcionarios.filter(f => {
      const cargo = d.cargos.find(c => c.id === f.cargoId);
      return cargo && cargo.nome.toLowerCase().includes('motorista');
    });
    const ajudantes = d.funcionarios.filter(f => {
      const cargo = d.cargos.find(c => c.id === f.cargoId);
      return cargo && cargo.nome.toLowerCase().includes('ajudante');
    });
    // Se não achar por cargo, mostra todos
    const optsMot = (motoristas.length ? motoristas : d.funcionarios).map(f =>
      `<option value="${f.id}">${f.nome}</option>`
    ).join('');
    const optsAju = (ajudantes.length ? ajudantes : d.funcionarios).map(f =>
      `<option value="${f.id}">${f.nome}</option>`
    ).join('');
    const optsProd = d.produtos.filter(p => p.status === 'disponivel').map(p =>
      `<option value="${p.id}" data-peso="${p.peso}" data-nome="${p.nome || p.codigo}">${p.codigo} — ${p.nome || ''} (${p.peso} kg)</option>`
    ).join('');
    const hoje = new Date().toISOString().slice(0, 10);

    UI.openModal('Novo Carregamento', `
      ${UI.formGroup('Data do carregamento', `<input type="date" class="form-control" id="cargaData" value="${hoje}">`)}
      ${UI.formGroup('Caminhão (placa)', `<select class="form-control" id="cargaCam" onchange="App.updateCargaPeso()"><option value="">— Selecione —</option>${optsCam}</select>`)}
      ${UI.formGroup('Motorista', `<select class="form-control" id="cargaMot"><option value="">— Selecione —</option>${optsMot}</select>`)}
      ${UI.formGroup('Ajudante', `<select class="form-control" id="cargaAju"><option value="">— Selecione —</option>${optsAju}</select>`)}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0">
      <h4 style="font-size:13px;margin-bottom:8px">Adicionar Produtos</h4>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1">${UI.formGroup('Produto', `<select class="form-control" id="cargaProd"><option value="">— Selecione —</option>${optsProd}</select>`)}</div>
        <div style="width:80px">${UI.formGroup('Qtd', `<input type="number" class="form-control" id="cargaQtd" value="1" min="1">`)}</div>
        <button class="btn btn-outline" style="margin-bottom:12px" onclick="App.addItemCarga()">+ Add</button>
      </div>
      <div id="cargaItensList" style="max-height:160px;overflow-y:auto;margin-top:8px"></div>
      <div id="cargaPesoBox" class="peso-box ok">
        <div>Peso total da carga: <strong id="cargaPesoTotal">0</strong> kg</div>
        <div>Capacidade do caminhão: <strong id="cargaCapacidade">—</strong> kg</div>
        <div id="cargaPesoMsg" style="margin-top:6px"></div>
      </div>
    `, `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarCarga()">Finalizar Carregamento</button>
    `, true);
  },

  addItemCarga() {
    const sel = document.getElementById('cargaProd');
    const id = sel.value;
    if (!id) return UI.toast('Selecione um produto', 'err');
    const qtd = Math.max(1, +document.getElementById('cargaQtd').value || 1);
    const opt = sel.options[sel.selectedIndex];
    const peso = +opt.dataset.peso || 0;
    const nome = opt.dataset.nome || opt.text;
    this.cargaItens.push({ produtoId: id, nome, peso, qtd, pesoTotal: peso * qtd });
    this.renderItensCarga();
    this.updateCargaPeso();
  },

  removeItemCarga(idx) {
    this.cargaItens.splice(idx, 1);
    this.renderItensCarga();
    this.updateCargaPeso();
  },

  renderItensCarga() {
    const el = document.getElementById('cargaItensList');
    if (!el) return;
    if (!this.cargaItens.length) {
      el.innerHTML = '<p class="empty" style="padding:8px 0">Nenhum item adicionado.</p>';
      return;
    }
    el.innerHTML = this.cargaItens.map((it, i) => `
      <div class="item-row">
        <span style="flex:1">${it.qtd}x ${it.nome}</span>
        <span>${it.peso} kg/un</span>
        <strong>${it.pesoTotal} kg</strong>
        <button class="btn btn-sm btn-danger" onclick="App.removeItemCarga(${i})">×</button>
      </div>
    `).join('');
  },

  updateCargaPeso() {
    const total = this.cargaItens.reduce((s, it) => s + it.pesoTotal, 0);
    const camSel = document.getElementById('cargaCam');
    let cap = 0;
    if (camSel && camSel.value) {
      const opt = camSel.options[camSel.selectedIndex];
      cap = +opt.dataset.cap || 8000;
    }
    const elTotal = document.getElementById('cargaPesoTotal');
    const elCap = document.getElementById('cargaCapacidade');
    const elMsg = document.getElementById('cargaPesoMsg');
    const box = document.getElementById('cargaPesoBox');
    if (elTotal) elTotal.textContent = total;
    if (elCap) elCap.textContent = cap || '—';
    if (!cap) {
      if (elMsg) elMsg.textContent = 'Selecione um caminhão para verificar o peso.';
      if (box) { box.className = 'peso-box ok'; }
      return;
    }
    if (total > cap) {
      if (box) box.className = 'peso-box over';
      if (elMsg) elMsg.innerHTML = `<span class="peso-over">⚠ ATENÇÃO: Carga acima da capacidade em ${total - cap} kg!</span>`;
    } else {
      if (box) box.className = 'peso-box ok';
      if (elMsg) elMsg.innerHTML = `<span class="peso-ok">✓ Dentro da capacidade (${cap - total} kg livres)</span>`;
    }
  },

  salvarCarga() {
    const caminhaoId = document.getElementById('cargaCam').value;
    const motoristaId = document.getElementById('cargaMot').value;
    const ajudanteId = document.getElementById('cargaAju').value;
    if (!caminhaoId) return UI.toast('Selecione o caminhão', 'err');
    if (!motoristaId) return UI.toast('Selecione o motorista', 'err');
    if (!this.cargaItens.length) return UI.toast('Adicione pelo menos um produto', 'err');

    const camSel = document.getElementById('cargaCam');
    const cap = +camSel.options[camSel.selectedIndex].dataset.cap || 8000;
    const pesoTotal = this.cargaItens.reduce((s, it) => s + it.pesoTotal, 0);

    if (pesoTotal > cap) {
      if (!confirm(`A carga está ${pesoTotal - cap} kg ACIMA da capacidade (${cap} kg).\nDeseja salvar mesmo assim?`)) return;
    }

    const dataCarga = document.getElementById('cargaData')?.value;
    const dataISO = dataCarga
      ? new Date(dataCarga + 'T12:00:00').toISOString()
      : new Date().toISOString();

    DB.add('carregamentos', {
      caminhaoId,
      motoristaId,
      ajudanteId,
      data: dataISO,
      itens: this.cargaItens.map(it => ({ ...it, status: 'nao-carregou' })),
      pesoTotal,
      capacidadeKg: cap,
      status: 'em-andamento',
      statusCarga: 'carregando'
    });

    // Atualiza status do caminhão
    DB.updateItem('caminhoes', caminhaoId, { status: 'pronto' });

    // Marca produtos usados (opcional — marca como carregado a quantidade)
    this.cargaItens.forEach(it => {
      // Não remove produtos do estoque de modelos, apenas registra
    });

    UI.closeModal();
    this.cargaItens = [];
    this.refreshAll();
    UI.toast(pesoTotal > cap ? 'Carregamento salvo com alerta de peso!' : 'Carregamento finalizado!');
  },

  verCarga(id) {
    const d = DB.get();
    const c = d.carregamentos.find(x => x.id === id);
    if (!c) return;
    const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
    const mot = d.funcionarios.find(f => f.id === c.motoristaId);
    const aju = d.funcionarios.find(f => f.id === c.ajudanteId);
    const excesso = c.pesoTotal > c.capacidadeKg;
    const itensHtml = (c.itens || []).map((it, idx) => {
      const st = it.status === 'carregado' ? 'carregado' : 'nao-carregou';
      const label = st === 'carregado' ? 'Carregado' : 'Não carregou';
      const cls = st === 'carregado' ? 'row-carregado' : 'row-nao-carregou';
      return `<div class="item-row ${cls}" style="padding:10px;border-radius:6px;margin-bottom:6px">
        <span style="flex:1">${it.qtd}x ${it.nome} <small>(${it.pesoTotal} kg)</small></span>
        <button class="btn btn-sm ${st==='carregado'?'btn-success':'btn-outline'}" onclick="App.toggleItemStatus('${id}',${idx})">${label}</button>
      </div>`;
    }).join('');
    UI.openModal('Itens do Carregamento', `
      <p><strong>Placa:</strong> ${cam ? cam.placa : '—'} · <strong>Motorista:</strong> ${mot ? mot.nome : '—'} · <strong>Ajudante:</strong> ${aju ? aju.nome : '—'}</p>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px">Clique no status para alternar: amarelo = Não carregou · verde = Carregado</p>
      ${itensHtml || '<p class="empty">Sem itens</p>'}
      <div class="peso-box ${excesso ? 'over' : 'ok'}">
        Peso total: <strong>${c.pesoTotal} kg</strong> / Capacidade: <strong>${c.capacidadeKg} kg</strong><br>
        ${excesso ? `<span class="peso-over">⚠ Excesso de ${c.pesoTotal - c.capacidadeKg} kg</span>` : '<span class="peso-ok">✓ Dentro do peso</span>'}
      </div>
    `, `<button class="btn btn-outline" onclick="UI.closeModal()">Fechar</button>`, true);
  },

  toggleItemStatus(cargaId, idx) {
    DB.update(d => {
      const c = d.carregamentos.find(x => x.id === cargaId);
      if (!c || !c.itens[idx]) return;
      c.itens[idx].status = c.itens[idx].status === 'carregado' ? 'nao-carregou' : 'carregado';
      const allDone = c.itens.every(i => i.status === 'carregado');
      c.status = allDone ? 'concluido' : 'em-andamento';
      if (allDone) {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        if (cam) cam.status = 'pronto';
      }
    });
    this.verCarga(cargaId);
    this.refreshCarregamentos();
    this.refreshDashboard();
  },


  editCarga(id) {
    UI.askPassword(() => {
      const d = DB.get();
      const c = d.carregamentos.find(x => x.id === id);
      if (!c) return;
      this.cargaItens = (c.itens || []).map(it => ({ ...it }));
      const optsCam = d.caminhoes.map(cam =>
        `<option value="${cam.id}" data-cap="${cam.capacidadeKg || 8000}" ${cam.id===c.caminhaoId?'selected':''}>${cam.placa} — ${cam.modelo} (${cam.capacidadeKg || 8000} kg)</option>`
      ).join('');
      const motoristas = d.funcionarios.filter(f => {
        const cargo = d.cargos.find(cg => cg.id === f.cargoId);
        return cargo && cargo.nome.toLowerCase().includes('motorista');
      });
      const ajudantes = d.funcionarios.filter(f => {
        const cargo = d.cargos.find(cg => cg.id === f.cargoId);
        return cargo && cargo.nome.toLowerCase().includes('ajudante');
      });
      const optsMot = (motoristas.length ? motoristas : d.funcionarios).map(f =>
        `<option value="${f.id}" ${f.id===c.motoristaId?'selected':''}>${f.nome}</option>`
      ).join('');
      const optsAju = (ajudantes.length ? ajudantes : d.funcionarios).map(f =>
        `<option value="${f.id}" ${f.id===c.ajudanteId?'selected':''}>${f.nome}</option>`
      ).join('');
      const optsProd = d.produtos.map(p =>
        `<option value="${p.id}" data-peso="${p.peso}" data-nome="${p.nome || p.codigo}">${p.codigo} — ${p.nome || ''} (${p.peso} kg)</option>`
      ).join('');
      const dataVal = (c.data || '').slice(0, 10) || new Date().toISOString().slice(0, 10);

      UI.openModal('Editar Carregamento', `
        ${UI.formGroup('Data do carregamento', `<input type="date" class="form-control" id="cargaData" value="${dataVal}">`)}
        ${UI.formGroup('Caminhão (placa)', `<select class="form-control" id="cargaCam" onchange="App.updateCargaPeso()"><option value="">—</option>${optsCam}</select>`)}
        ${UI.formGroup('Motorista', `<select class="form-control" id="cargaMot"><option value="">—</option>${optsMot}</select>`)}
        ${UI.formGroup('Ajudante', `<select class="form-control" id="cargaAju"><option value="">—</option>${optsAju}</select>`)}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0">
        <h4 style="font-size:13px;margin-bottom:8px">Produtos</h4>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <div style="flex:1">${UI.formGroup('Produto', `<select class="form-control" id="cargaProd"><option value="">—</option>${optsProd}</select>`)}</div>
          <div style="width:80px">${UI.formGroup('Qtd', `<input type="number" class="form-control" id="cargaQtd" value="1" min="1">`)}</div>
          <button class="btn btn-outline" style="margin-bottom:12px" onclick="App.addItemCarga()">+ Add</button>
        </div>
        <div id="cargaItensList" style="max-height:160px;overflow-y:auto;margin-top:8px"></div>
        <div id="cargaPesoBox" class="peso-box ok">
          <div>Peso total: <strong id="cargaPesoTotal">0</strong> kg</div>
          <div>Capacidade: <strong id="cargaCapacidade">—</strong> kg</div>
          <div id="cargaPesoMsg" style="margin-top:6px"></div>
        </div>
      `, `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarEditCarga('${id}')">Salvar Alterações</button>
      `, true);

      setTimeout(() => {
        this.renderItensCarga();
        this.updateCargaPeso();
      }, 50);
    });
  },

  salvarEditCarga(id) {
    const caminhaoId = document.getElementById('cargaCam').value;
    const motoristaId = document.getElementById('cargaMot').value;
    const ajudanteId = document.getElementById('cargaAju').value;
    if (!caminhaoId) return UI.toast('Selecione o caminhão', 'err');
    if (!this.cargaItens.length) return UI.toast('Adicione pelo menos um produto', 'err');
    const camSel = document.getElementById('cargaCam');
    const cap = +camSel.options[camSel.selectedIndex].dataset.cap || 8000;
    const pesoTotal = this.cargaItens.reduce((s, it) => s + it.pesoTotal, 0);
    const dataCarga = document.getElementById('cargaData')?.value;
    const dataISO = dataCarga
      ? new Date(dataCarga + 'T12:00:00').toISOString()
      : new Date().toISOString();

    if (pesoTotal > cap && !confirm(`Carga ${pesoTotal - cap} kg acima da capacidade. Salvar mesmo assim?`)) return;

    DB.updateItem('carregamentos', id, {
      caminhaoId,
      motoristaId,
      ajudanteId,
      data: dataISO,
      itens: this.cargaItens.map(it => ({
        ...it,
        status: it.status || 'nao-carregou'
      })),
      pesoTotal,
      capacidadeKg: cap
    });
    UI.closeModal();
    this.cargaItens = [];
    this.refreshAll();
    UI.toast('Carregamento atualizado!');
  },

  deleteCarga(id) {
    UI.askPassword(async () => {
      if (!confirm('Excluir este carregamento permanentemente?')) return;
      try {
        if (typeof Layerbase !== 'undefined' && Layerbase.isReady()) {
          await Layerbase.query("DELETE FROM carregamentos WHERE id = '" + String(id).replace(/'/g, "''") + "'");
        }
        DB.remove('carregamentos', id);
        this.refreshAll();
        UI.toast('Carregamento apagado do banco');
      } catch (e) {
        UI.toast(e.message || 'Erro ao excluir', 'err');
      }
    });
  },

  // ==================== CAMINHÕES ====================
  refreshCaminhoes() {
    const d = DB.get();
    const tbody = document.querySelector('#tableCaminhoes tbody');
    tbody.innerHTML = d.caminhoes.map(c => `<tr>
      <td><strong>${c.placa}</strong></td>
      <td>${c.modelo}</td>
      <td>${(c.capacidadeKg || 0).toLocaleString('pt-BR')} kg</td>
      <td>${UI.badge(c.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="App.editCaminhao('${c.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="App.deleteCaminhao('${c.id}')">Excluir</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhum caminhão.</td></tr>';
  },

  formCaminhao(data = {}) {
    return `
      ${UI.formGroup('Placa', `<input class="form-control" id="fPlaca" value="${data.placa || ''}" placeholder="ABC1D23">`)}
      ${UI.formGroup('Modelo', `<input class="form-control" id="fModelo" value="${data.modelo || 'MB Accelo 1017 2024'}">`)}
      ${UI.formGroup('Capacidade de carga (kg)', `<input type="number" class="form-control" id="fCapKg" value="${data.capacidadeKg || 8000}">`)}
      ${UI.formGroup('Status', `<select class="form-control" id="fStatus">
        <option value="disponivel" ${!data.status || data.status==='disponivel'?'selected':''}>Disponível</option>
        <option value="operando" ${data.status==='operando'?'selected':''}>Carregando</option>
        <option value="pronto" ${data.status==='pronto'?'selected':''}>Pronto p/ sair</option>
        <option value="manutencao" ${data.status==='manutencao'?'selected':''}>Manutenção</option>
      </select>`)}
    `;
  },

  novoCaminhao() {
    UI.openModal('Novo Caminhão', this.formCaminhao(), `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarCaminhao()">Salvar</button>
    `);
  },

  editCaminhao(id) {
    UI.askPassword(() => {
      const c = DB.get().caminhoes.find(x => x.id === id);
      if (!c) return;
      UI.openModal('Editar Caminhão', this.formCaminhao(c), `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarCaminhao('${id}')">Salvar</button>
      `);
    });
  },

  salvarCaminhao(id) {
    const obj = {
      placa: document.getElementById('fPlaca').value.trim().toUpperCase(),
      modelo: document.getElementById('fModelo').value.trim(),
      capacidadeKg: +document.getElementById('fCapKg').value || 8000,
      status: document.getElementById('fStatus').value
    };
    if (!obj.placa) return UI.toast('Informe a placa', 'err');
    if (id) DB.updateItem('caminhoes', id, obj);
    else DB.add('caminhoes', obj);
    UI.closeModal();
    this.refreshAll();
    UI.toast('Caminhão salvo!');
  },

  deleteCaminhao(id) {
    UI.askPassword(async () => {
      if (!confirm('Excluir este caminhão permanentemente do banco?')) return;
      try {
        if (typeof Layerbase !== 'undefined' && Layerbase.isReady()) {
          await Layerbase.query("DELETE FROM caminhoes WHERE id = '" + String(id).replace(/'/g, "''") + "'");
        }
        DB.remove('caminhoes', id);
        this.refreshAll();
        UI.toast('Caminhão apagado do banco');
      } catch (e) {
        UI.toast(e.message || 'Erro ao excluir', 'err');
      }
    });
  },

  // ==================== FUNCIONÁRIOS ====================
  refreshFuncionarios() {
    const d = DB.get();
    const tbody = document.querySelector('#tableFuncionarios tbody');
    tbody.innerHTML = d.funcionarios.map(f => {
      const cargo = d.cargos.find(c => c.id === f.cargoId);
      return `<tr>
        <td><strong>${f.nome}</strong></td>
        <td>${cargo ? cargo.nome : '—'}</td>
        <td>${f.telefone || '—'}</td>
        <td>${UI.badge(f.status)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="App.editFuncionario('${f.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteFuncionario('${f.id}')">Excluir</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty">Nenhum funcionário.</td></tr>';
  },

  refreshCargos() {
    const d = DB.get();
    const tbody = document.querySelector('#tableCargos tbody');
    tbody.innerHTML = d.cargos.map(c => `<tr>
      <td><strong>${c.nome}</strong></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="App.editCargo('${c.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="App.deleteCargo('${c.id}')">Excluir</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="2" class="empty">Nenhum cargo.</td></tr>';
  },

  formFuncionario(data = {}) {
    const d = DB.get();
    const opts = d.cargos.map(c =>
      `<option value="${c.id}" ${data.cargoId === c.id ? 'selected' : ''}>${c.nome}</option>`
    ).join('');
    return `
      ${UI.formGroup('Nome', `<input class="form-control" id="fNome" value="${data.nome || ''}">`)}
      ${UI.formGroup('Cargo', `<select class="form-control" id="fCargo"><option value="">—</option>${opts}</select>`)}
      ${UI.formGroup('Telefone', `<input class="form-control" id="fTel" value="${data.telefone || ''}">`)}
      ${UI.formGroup('CNH (se motorista)', `<input class="form-control" id="fCnh" value="${data.cnh || ''}">`)}
      ${UI.formGroup('Status', `<select class="form-control" id="fStatus">
        <option value="ativo" ${data.status !== 'inativo' ? 'selected' : ''}>Ativo</option>
        <option value="inativo" ${data.status === 'inativo' ? 'selected' : ''}>Inativo</option>
      </select>`)}
    `;
  },

  novoFuncionario() {
    UI.openModal('Novo Funcionário', this.formFuncionario(), `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarFuncionario()">Salvar</button>
    `);
  },

  editFuncionario(id) {
    UI.askPassword(() => {
      const f = DB.get().funcionarios.find(x => x.id === id);
      if (!f) return;
      UI.openModal('Editar Funcionário', this.formFuncionario(f), `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarFuncionario('${id}')">Salvar</button>
      `);
    });
  },

  salvarFuncionario(id) {
    const obj = {
      nome: document.getElementById('fNome').value.trim(),
      cargoId: document.getElementById('fCargo').value,
      telefone: document.getElementById('fTel').value.trim(),
      cnh: document.getElementById('fCnh').value.trim(),
      status: document.getElementById('fStatus').value
    };
    if (!obj.nome) return UI.toast('Informe o nome', 'err');
    if (id) DB.updateItem('funcionarios', id, obj);
    else DB.add('funcionarios', obj);
    UI.closeModal();
    this.refreshAll();
    UI.toast('Funcionário salvo!');
  },

  deleteFuncionario(id) {
    UI.askPassword(async () => {
      if (!confirm('Excluir este funcionário permanentemente do banco?')) return;
      try {
        if (typeof Layerbase !== 'undefined' && Layerbase.isReady()) {
          await Layerbase.query("DELETE FROM funcionarios WHERE id = '" + String(id).replace(/'/g, "''") + "'");
        }
        DB.remove('funcionarios', id);
        this.refreshAll();
        UI.toast('Funcionário apagado do banco');
      } catch (e) {
        UI.toast(e.message || 'Erro ao excluir', 'err');
      }
    });
  },

  novoCargo() {
    UI.openModal('Novo Cargo', UI.formGroup('Nome do cargo', '<input class="form-control" id="fCargoNome">'), `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarCargo()">Salvar</button>
    `);
  },

  editCargo(id) {
    UI.askPassword(() => {
      const c = DB.get().cargos.find(x => x.id === id);
      if (!c) return;
      UI.openModal('Editar Cargo', UI.formGroup('Nome do cargo', `<input class="form-control" id="fCargoNome" value="${c.nome}">`), `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarCargo('${id}')">Salvar</button>
      `);
    });
  },

  salvarCargo(id) {
    const nome = document.getElementById('fCargoNome').value.trim();
    if (!nome) return UI.toast('Informe o nome', 'err');
    if (id) DB.updateItem('cargos', id, { nome });
    else DB.add('cargos', { nome });
    UI.closeModal();
    this.refreshAll();
    UI.toast('Cargo salvo!');
  },

  deleteCargo(id) {
    UI.askPassword(() => {
      if (!confirm('Excluir este cargo?')) return;
      DB.remove('cargos', id);
      this.refreshAll();
      UI.toast('Cargo excluído');
    });
  },

  // ==================== PRODUTOS ====================
  refreshProdutos(filtro) {
    const d = DB.get();
    let lista = d.produtos;
    if (filtro) {
      const q = filtro.toLowerCase();
      lista = lista.filter(p =>
        (p.codigo || '').toLowerCase().includes(q) ||
        (p.nome || '').toLowerCase().includes(q)
      );
    }
    const tbody = document.querySelector('#tableProdutos tbody');
    tbody.innerHTML = lista.map(p => `<tr>
      <td><strong>${p.codigo}</strong></td>
      <td>${p.nome || '—'}</td>
      <td>${p.comprimento || '—'} m</td>
      <td>${p.diametro || '—'} mm</td>
      <td>${p.peso} kg</td>
      <td>R$ ${(p.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td>${UI.badge(p.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="App.editProduto('${p.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="App.deleteProduto('${p.id}')">Excluir</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhum produto.</td></tr>';
  },

  formProduto(data = {}) {
    return `
      ${UI.formGroup('Código', `<input class="form-control" id="fCodigo" value="${data.codigo || ''}" placeholder="P-9M-250">`)}
      ${UI.formGroup('Nome', `<input class="form-control" id="fNomeProd" value="${data.nome || ''}">`)}
      ${UI.formGroup('Comprimento (m)', `<input type="number" step="0.5" class="form-control" id="fComp" value="${data.comprimento || 9}">`)}
      ${UI.formGroup('Diâmetro (mm)', `<input type="number" class="form-control" id="fDiam" value="${data.diametro || 250}">`)}
      ${UI.formGroup('Peso (kg)', `<input type="number" class="form-control" id="fPeso" value="${data.peso || 400}">`)}
      ${UI.formGroup('Preço (R$)', `<input type="number" step="0.01" class="form-control" id="fPreco" value="${data.preco || 0}">`)}
      ${UI.formGroup('Status', `<select class="form-control" id="fProdStatus">
        <option value="disponivel" ${!data.status || data.status==='disponivel'?'selected':''}>Disponível</option>
        <option value="carregado" ${data.status==='carregado'?'selected':''}>Carregado</option>
        <option value="em-transito" ${data.status==='em-transito'?'selected':''}>Em Trânsito</option>
      </select>`)}
    `;
  },

  novoProduto() {
    UI.openModal('Novo Produto', this.formProduto(), `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarProduto()">Salvar</button>
    `);
  },

  editProduto(id) {
    UI.askPassword(() => {
      const p = DB.get().produtos.find(x => x.id === id);
      if (!p) return;
      UI.openModal('Editar Produto', this.formProduto(p), `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarProduto('${id}')">Salvar</button>
      `);
    });
  },

  salvarProduto(id) {
    const obj = {
      codigo: document.getElementById('fCodigo').value.trim(),
      nome: document.getElementById('fNomeProd').value.trim(),
      comprimento: +document.getElementById('fComp').value,
      diametro: +document.getElementById('fDiam').value,
      peso: +document.getElementById('fPeso').value,
      preco: +document.getElementById('fPreco').value,
      status: document.getElementById('fProdStatus').value
    };
    if (!obj.codigo) return UI.toast('Informe o código', 'err');
    if (id) DB.updateItem('produtos', id, obj);
    else DB.add('produtos', obj);
    UI.closeModal();
    this.refreshAll();
    UI.toast('Produto salvo!');
  },

  deleteProduto(id) {
    UI.askPassword(async () => {
      if (!confirm('Excluir este produto permanentemente do banco?')) return;
      try {
        // Remove direto no Postgres (não fica como excluido)
        if (typeof Layerbase !== 'undefined' && Layerbase.isReady()) {
          await Layerbase.query("DELETE FROM produtos WHERE id = '" + String(id).replace(/'/g, "''") + "'");
        }
        DB.remove('produtos', id);
        this.refreshAll();
        UI.toast('Produto apagado do banco');
      } catch (e) {
        UI.toast(e.message || 'Erro ao excluir', 'err');
      }
    });
  },

  // ==================== DIÁRIAS ====================
  refreshDiariasPreview() {
    const d = DB.get();
    // Fill selects
    const selCam = document.getElementById('diaCaminhao');
    const selFun = document.getElementById('diaFuncionario');
    if (selCam) {
      selCam.innerHTML = '<option value="">—</option>' + d.caminhoes.map(c =>
        `<option value="${c.id}">${c.placa}</option>`
      ).join('');
    }
    if (selFun) {
      selFun.innerHTML = '<option value="">—</option>' + d.funcionarios.map(f =>
        `<option value="${f.id}">${f.nome}</option>`
      ).join('');
    }
    const diaData = document.getElementById('diaData');
    if (diaData && !diaData.value) diaData.value = new Date().toISOString().slice(0, 10);
    const diaValor = document.getElementById('diaValor');
    if (diaValor) diaValor.value = d.config.diariaPadrao || 350;

    // Preview
    const prev = document.getElementById('diaPreview');
    if (!prev) return;
    const total = d.diarias.reduce((s, x) => s + (x.valor || 0), 0);
    let html = `<div style="font-family:Inter,sans-serif">
      <h3 style="color:#1a56db;margin-bottom:4px">Logísticas Bill</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px">Pré-visualização de Diárias · Total: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
        <colgroup>
          <col style="width:12%">
          <col style="width:14%">
          <col style="width:22%">
          <col style="width:14%">
          <col style="width:22%">
          <col style="width:16%">
        </colgroup>
        <tr style="background:#f1f5f9">
          <th style="padding:8px 6px;text-align:left">Data</th>
          <th style="padding:8px 6px;text-align:left">Caminhão</th>
          <th style="padding:8px 6px;text-align:left">Funcionário</th>
          <th style="padding:8px 6px;text-align:right">Valor</th>
          <th style="padding:8px 6px;text-align:left">Obs</th>
          <th style="padding:8px 6px;text-align:center">Ações</th>
        </tr>`;
    d.diarias.slice().reverse().forEach(x => {
      const cam = d.caminhoes.find(c => c.id === x.caminhaoId);
      const fun = d.funcionarios.find(f => f.id === x.funcionarioId);
      html += `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;word-break:break-word">${(x.data||'').split('-').reverse().join('/')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle">${cam ? cam.placa : '—'}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;word-break:break-word">${fun ? fun.nome : '—'}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;text-align:right;white-space:nowrap">R$ ${(x.valor||0).toFixed(2)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;word-break:break-word;color:#64748b">${x.obs || '—'}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:middle;text-align:center;white-space:nowrap">
          <button class="btn btn-sm btn-outline" onclick="App.editDiaria('${x.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteDiaria('${x.id}')">×</button>
        </td>
      </tr>`;
    });
    html += '</table></div></div>';
    prev.innerHTML = d.diarias.length ? html : '<p class="empty">Nenhuma diária registrada.</p>';
  },

  editDiaria(id) {
    UI.askPassword(() => {
      const d = DB.get();
      const x = d.diarias.find(i => i.id === id);
      if (!x) return;
      const optsCam = d.caminhoes.map(c => `<option value="${c.id}" ${c.id===x.caminhaoId?'selected':''}>${c.placa}</option>`).join('');
      const optsFun = d.funcionarios.map(f => `<option value="${f.id}" ${f.id===x.funcionarioId?'selected':''}>${f.nome}</option>`).join('');
      UI.openModal('Editar Diária', `
        ${UI.formGroup('Data', `<input type="date" class="form-control" id="editDiaData" value="${x.data||''}">`)}
        ${UI.formGroup('Caminhão', `<select class="form-control" id="editDiaCam">${optsCam}</select>`)}
        ${UI.formGroup('Funcionário', `<select class="form-control" id="editDiaFun">${optsFun}</select>`)}
        ${UI.formGroup('Valor (R$)', `<input type="number" class="form-control" id="editDiaValor" value="${x.valor||0}">`)}
        ${UI.formGroup('Observação', `<input class="form-control" id="editDiaObs" value="${x.obs||''}">`)}
      `, `
        <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="App.salvarEditDiaria('${id}')">Salvar</button>
      `);
    });
  },

  salvarEditDiaria(id) {
    DB.updateItem('diarias', id, {
      data: document.getElementById('editDiaData').value,
      caminhaoId: document.getElementById('editDiaCam').value,
      funcionarioId: document.getElementById('editDiaFun').value,
      valor: +document.getElementById('editDiaValor').value,
      obs: document.getElementById('editDiaObs').value.trim()
    });
    UI.closeModal();
    this.refreshAll();
    UI.toast('Diária atualizada!');
  },

  deleteDiaria(id) {
    UI.askPassword(() => {
      DB.remove('diarias', id);
      this.refreshAll();
      UI.toast('Diária excluída');
    });
  },

  salvarDiaria() {
    const obj = {
      data: document.getElementById('diaData').value,
      caminhaoId: document.getElementById('diaCaminhao').value,
      funcionarioId: document.getElementById('diaFuncionario').value,
      valor: +document.getElementById('diaValor').value,
      obs: document.getElementById('diaObs').value.trim()
    };
    if (!obj.data || !obj.caminhaoId) return UI.toast('Preencha data e caminhão', 'err');
    DB.add('diarias', obj);
    document.getElementById('diaObs').value = '';
    this.refreshAll();
    UI.toast('Diária salva!');
  },

  // ==================== FALTAS ====================
  refreshFaltas() {
    const d = DB.get();
    const tbody = document.querySelector('#tableFaltas tbody');
    tbody.innerHTML = d.faltas.map(f => {
      const fun = d.funcionarios.find(x => x.id === f.funcionarioId);
      return `<tr>
        <td>${(f.data||'').split('-').reverse().join('/')}</td>
        <td>${fun ? fun.nome : '—'}</td>
        <td>${f.tipoFalta || '—'}</td>
        <td>${f.motivo || '—'}</td>
        <td>${f.atestadoNome ? `<span class="badge badge-blue">${f.atestadoNome}</span>` : '<span class="badge badge-gray">Não</span>'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="App.deleteFalta('${f.id}')">Excluir</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">Nenhuma falta.</td></tr>';
  },

  novaFalta() {
    const d = DB.get();
    const opts = d.funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    const hoje = new Date().toISOString().slice(0, 10);
    UI.openModal('Registrar Falta', `
      ${UI.formGroup('Data', `<input type="date" class="form-control" id="fFaltaData" value="${hoje}">`)}
      ${UI.formGroup('Funcionário', `<select class="form-control" id="fFaltaFun"><option value="">—</option>${opts}</select>`)}
      ${UI.formGroup('Tipo', `<select class="form-control" id="fFaltaTipo">
        <option value="Falta">Falta</option>
        <option value="Atestado médico">Atestado médico</option>
        <option value="Licença">Licença</option>
        <option value="Folga">Folga</option>
        <option value="Outro">Outro</option>
      </select>`)}
      ${UI.formGroup('Motivo', `<input class="form-control" id="fFaltaMotivo">`)}
      ${UI.formGroup('Anexar atestado (opcional)', `<input type="file" class="form-control" id="fFaltaAtestado" accept=".pdf,.jpg,.jpeg,.png">`)}
    `, `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarFalta()">Salvar</button>
    `);
  },

  salvarFalta() {
    const funcionarioId = document.getElementById('fFaltaFun').value;
    if (!funcionarioId) return UI.toast('Selecione o funcionário', 'err');
    const file = document.getElementById('fFaltaAtestado').files[0];
    const save = (atestadoData, atestadoNome) => {
      DB.add('faltas', {
        data: document.getElementById('fFaltaData').value,
        funcionarioId,
        tipoFalta: document.getElementById('fFaltaTipo').value,
        motivo: document.getElementById('fFaltaMotivo').value.trim(),
        atestadoData: atestadoData || null,
        atestadoNome: atestadoNome || null
      });
      UI.closeModal();
      this.refreshAll();
      UI.toast('Falta registrada!');
    };
    if (file) {
      const reader = new FileReader();
      reader.onload = e => save(e.target.result, file.name);
      reader.readAsDataURL(file);
    } else save(null, null);
  },

  deleteFalta(id) {
    UI.askPassword(() => {
      DB.remove('faltas', id);
      this.refreshAll();
      UI.toast('Registro excluído');
    });
  },

  // ==================== RELATÓRIOS ====================
  gerarRelatorio() {
    const tipo = document.getElementById('relTipo').value;
    const inicio = document.getElementById('relInicio').value;
    const fim = document.getElementById('relFim').value;
    const d = DB.get();
    const agora = new Date().toLocaleString('pt-BR');
    const filtroData = (iso) => {
      if (!iso) return true;
      const dia = iso.slice(0, 10);
      if (inicio && dia < inicio) return false;
      if (fim && dia > fim) return false;
      return true;
    };

    let html = `<div style="font-family:Inter,sans-serif">
      <div style="border-bottom:2px solid #1a56db;padding-bottom:12px;margin-bottom:16px">
        <h2 style="margin:0;color:#1a56db">Logísticas Bill</h2>
        <p style="margin:4px 0 0;color:#64748b;font-size:12px">Centro de Logística — Relatório gerado em ${agora}</p>
        ${inicio || fim ? `<p style="margin:4px 0 0;font-size:12px">Período: ${inicio || '…'} até ${fim || '…'}</p>` : ''}
      </div>`;

    if (tipo === 'completo' || tipo === 'frota') {
      html += `<h3 style="margin:16px 0 8px">Frota e Equipe</h3>
        <p>Caminhões: <strong>${d.caminhoes.length}</strong> | Funcionários: <strong>${d.funcionarios.length}</strong> | Cargos: <strong>${d.cargos.length}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Placa</th><th>Modelo</th><th>Capacidade</th><th>Status</th></tr>`;
      d.caminhoes.forEach(c => {
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${c.placa}</td><td>${c.modelo}</td><td>${c.capacidadeKg} kg</td><td>${c.status}</td></tr>`;
      });
      html += '</table>';
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Nome</th><th>Cargo</th><th>Status</th></tr>`;
      d.funcionarios.forEach(f => {
        const cargo = d.cargos.find(c => c.id === f.cargoId);
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${f.nome}</td><td>${cargo?cargo.nome:'—'}</td><td>${f.status}</td></tr>`;
      });
      html += '</table>';
    }

    if (tipo === 'completo' || tipo === 'estoque') {
      const valor = d.produtos.reduce((s, p) => s + (p.preco || 0), 0);
      html += `<h3 style="margin:16px 0 8px">Estoque de Produtos</h3>
        <p>Total: <strong>${d.produtos.length}</strong> | Valor: <strong>R$ ${valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Código</th><th>Nome</th><th>Peso</th><th>Preço</th><th>Status</th></tr>`;
      d.produtos.forEach(p => {
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${p.codigo}</td><td>${p.nome||'—'}</td><td>${p.peso}kg</td><td>R$ ${(p.preco||0).toFixed(2)}</td><td>${p.status}</td></tr>`;
      });
      html += '</table>';
    }

    if (tipo === 'completo' || tipo === 'carregamentos') {
      const lista = d.carregamentos.filter(c => filtroData(c.data));
      html += `<h3 style="margin:16px 0 8px">Carregamentos (${lista.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Data</th><th>Placa</th><th>Itens</th><th>Peso</th><th>Capacidade</th><th>Status</th></tr>`;
      lista.forEach(c => {
        const cam = d.caminhoes.find(x => x.id === c.caminhaoId);
        const st = c.pesoTotal > c.capacidadeKg ? 'ACIMA' : 'OK';
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${new Date(c.data).toLocaleString('pt-BR')}</td><td>${cam?cam.placa:'—'}</td><td>${c.itens?.length||0}</td><td>${c.pesoTotal}kg</td><td>${c.capacidadeKg}kg</td><td>${st}</td></tr>`;
      });
      html += '</table>';
    }

    if (tipo === 'completo' || tipo === 'diarias') {
      const lista = d.diarias.filter(x => filtroData(x.data));
      const total = lista.reduce((s, x) => s + (x.valor || 0), 0);
      // Totais por funcionário
      const porPessoa = {};
      lista.forEach(x => {
        const fun = d.funcionarios.find(f => f.id === x.funcionarioId);
        const nome = fun ? fun.nome : '—';
        if (!porPessoa[nome]) porPessoa[nome] = 0;
        porPessoa[nome] += (x.valor || 0);
      });
      html += `<h3 style="margin:16px 0 8px">Diárias — Resumo por Pessoa</h3>
        <p>Total geral: <strong>R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong> (${lista.length} registros)</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Funcionário</th><th style="text-align:right">Total a Receber</th></tr>`;
      Object.entries(porPessoa).sort((a,b)=>b[1]-a[1]).forEach(([nome, val]) => {
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${nome}</td><td style="text-align:right;font-weight:600">R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td></tr>`;
      });
      html += `</table>
        <h3 style="margin:16px 0 8px">Diárias — Detalhamento Dia a Dia</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Data</th><th>Caminhão</th><th>Funcionário</th><th>Valor</th><th>Obs</th></tr>`;
      lista.forEach(x => {
        const cam = d.caminhoes.find(c => c.id === x.caminhaoId);
        const fun = d.funcionarios.find(f => f.id === x.funcionarioId);
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${(x.data||'').split('-').reverse().join('/')}</td><td>${cam?cam.placa:'—'}</td><td>${fun?fun.nome:'—'}</td><td>R$ ${(x.valor||0).toFixed(2)}</td><td>${x.obs||'—'}</td></tr>`;
      });
      html += '</table>';
    }

    if (tipo === 'completo' || tipo === 'faltas') {
      const lista = d.faltas.filter(f => filtroData(f.data));
      html += `<h3 style="margin:16px 0 8px">Faltas (${lista.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <tr style="background:#f1f5f9"><th style="padding:6px;text-align:left">Data</th><th>Funcionário</th><th>Tipo</th><th>Motivo</th><th>Atestado</th></tr>`;
      lista.forEach(f => {
        const fun = d.funcionarios.find(x => x.id === f.funcionarioId);
        html += `<tr><td style="padding:6px;border-bottom:1px solid #e2e8f0">${(f.data||'').split('-').reverse().join('/')}</td><td>${fun?fun.nome:'—'}</td><td>${f.tipoFalta}</td><td>${f.motivo||'—'}</td><td>${f.atestadoNome||'Não'}</td></tr>`;
      });
      html += '</table>';
    }

    html += `<p style="margin-top:24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px">Documento gerado por Logísticas Bill — uso interno.</p></div>`;
    document.getElementById('relPreview').innerHTML = html;
    UI.toast('Relatório gerado!');
  },

  imprimirRelatorio() {
    const content = document.getElementById('relPreview').innerHTML;
    if (!content || content.includes('Selecione o tipo')) return UI.toast('Gere o relatório primeiro', 'err');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Relatório — Logísticas Bill</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1e293b} table{width:100%;border-collapse:collapse}@media print{body{padding:0}}</style>
      </head><body>${content}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  },

  // ==================== CONFIG ====================
  refreshConfig() {
    const d = DB.get();
    document.getElementById('cfgUser').value = d.config.usuario || 'Admin';
    document.getElementById('cfgSenha').value = '';
    document.getElementById('cfgSenhaAtual').value = '';
    document.getElementById('cfgDiaria').value = d.config.diariaPadrao || 350;
  },

  async salvarConfig() {
    const senhaAtual = document.getElementById('cfgSenhaAtual').value;
    const usuario = document.getElementById('cfgUser').value.trim() || 'Admin';
    const nova = document.getElementById('cfgSenha').value;
    const diaria = +document.getElementById('cfgDiaria').value || 350;

    if (!senhaAtual) return UI.toast('Informe a senha atual', 'err');

    // Se mudou senha ou usuário → Argon2 no servidor
    if (nova || (typeof Layerbase !== 'undefined' && Layerbase.isReady())) {
      try {
        if (nova) {
          await DB.changePassword(senhaAtual, nova, usuario);
        } else {
          const ok = await DB.requireAdmPassword(senhaAtual);
          if (!ok) return UI.toast('Senha atual incorreta', 'err');
          DB.update(d => {
            d.config.usuario = usuario;
            d.config.diariaPadrao = diaria;
          });
          // Atualiza só usuário no banco (sem tocar no hash)
          if (typeof Layerbase !== 'undefined' && Layerbase.isReady()) {
            await Layerbase.query(
              "UPDATE config SET usuario = '" + usuario.replace(/'/g, "''") +
              "', diaria_padrao = " + diaria + " WHERE id = 1"
            );
          }
        }
        if (nova) {
          DB.update(d => {
            d.config.usuario = usuario;
            d.config.diariaPadrao = diaria;
            d.config.senha = '';
          });
        }
        UI.toast('Configurações salvas!');
        this.refreshConfig();
      } catch (e) {
        UI.toast(e.message || 'Erro ao salvar', 'err');
      }
      return;
    }

    const ok = await DB.requireAdmPassword(senhaAtual);
    if (!ok) return UI.toast('Senha atual incorreta', 'err');
    DB.update(d => {
      d.config.usuario = usuario;
      if (nova) d.config.senha = nova;
      d.config.diariaPadrao = diaria;
    });
    UI.toast('Configurações salvas!');
    this.refreshConfig();
  },

  exportar() {
    const blob = new Blob([JSON.stringify(DB.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `logisticas-bill-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    UI.toast('Backup exportado!');
  },

  importar(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        DB.save(data);
        this.refreshAll();
        UI.toast('Backup importado!');
      } catch { UI.toast('Arquivo inválido', 'err'); }
    };
    reader.readAsText(file);
  },

  limparDados() {
    UI.askPassword(() => {
      if (!confirm('ATENÇÃO: Apagará TODOS os dados. Continuar?')) return;
      if (!confirm('Tem certeza absoluta?')) return;
      DB.clearAll();
      DB.seedIfEmpty();
      this.refreshAll();
      UI.toast('Dados reiniciados');
    });
  },


  // ==================== ROTAS (OpenStreetMap + Leaflet) ====================
  map: null,
  mapMarkers: [],
  pendingCliente: null,

  letraPonto(idx) {
    // 0→A, 1→B ... 25→Z, 26→AA
    let n = idx;
    let s = '';
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  },

  async desenharRotaEstrada(clientes, rotaId) {
    if (!this.map || clientes.length < 2) return;
    const coordsLatLng = clientes.map(cli => [cli.lat, cli.lng]);
    const linhaReta = L.polyline(coordsLatLng, { color: '#94a3b8', weight: 2, opacity: 0.5, dashArray: '4 6' }).addTo(this.map);
    this.mapMarkers.push(linhaReta);
    try {
      const path = clientes.map(cli => cli.lng + ',' + cli.lat).join(';');
      const url = 'https://router.project-osrm.org/route/v1/driving/' + path + '?overview=full&geometries=geojson';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.routes || !data.routes[0]) return;
      const geo = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
      const linhaEstrada = L.polyline(geo, { color: '#1a56db', weight: 4, opacity: 0.85 }).addTo(this.map);
      this.mapMarkers.push(linhaEstrada);
      try { this.map.removeLayer(linhaReta); } catch (e) {}
    } catch (e) {
      console.warn('OSRM indisponível — linha reta', e);
    }
  },


  async buscarEndereco() {
    const q = (document.getElementById('mapSearch')?.value || '').trim();
    if (!q) return UI.toast('Digite cidade, bairro ou coordenadas', 'err');
    if (!this.map) this.initMap();

    // 1) Coordenadas diretas: "-23.55, -46.63" ou "-23.55 -46.63"
    const coordMatch = q.match(/^(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1].replace(',', '.'));
      const lng = parseFloat(coordMatch[2].replace(',', '.'));
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        this.map.setView([lat, lng], 15);
        const m = L.marker([lat, lng]).addTo(this.map).bindPopup(`Coordenadas<br>${lat}, ${lng}`).openPopup();
        this.mapMarkers.push(m);
        UI.toast('Localização por coordenadas');
        return;
      }
    }

    // 2) Photon (Komoot) — gratuito, dados OSM, sem API key
    try {
      const url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=5&lang=pt';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const feats = json.features || [];
        if (feats.length) {
          const f = feats[0];
          const lng = f.geometry.coordinates[0];
          const lat = f.geometry.coordinates[1];
          const p = f.properties || {};
          const nome = [p.name, p.street, p.district, p.city, p.county, p.state].filter(Boolean).join(', ');
          this.map.setView([lat, lng], 14);
          const m = L.marker([lat, lng]).addTo(this.map).bindPopup(nome || q).openPopup();
          this.mapMarkers.push(m);
          UI.toast('Encontrado: ' + (p.name || p.city || q));
          return;
        }
      }
    } catch (e) {
      console.warn('Photon falhou', e);
    }

    // 3) Open-Meteo Geocoding — gratuito, sem API key
    try {
      const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=5&language=pt&format=json';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const results = json.results || [];
        if (results.length) {
          const r = results[0];
          const nome = [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', ');
          this.map.setView([r.latitude, r.longitude], 13);
          const m = L.marker([r.latitude, r.longitude]).addTo(this.map).bindPopup(nome).openPopup();
          this.mapMarkers.push(m);
          UI.toast('Encontrado: ' + (r.name || q));
          return;
        }
      }
    } catch (e) {
      console.warn('Open-Meteo falhou', e);
    }

    UI.toast('Local não encontrado. Tente outro nome ou use lat, lng', 'err');
  },

  initMap() {
    const el = document.getElementById('map');
    if (!el) return;

    if (typeof L === 'undefined') {
      el.innerHTML = '<div style="padding:32px;text-align:center;color:#64748b;font-size:13px"><strong>Leaflet não carregou</strong><br>Confira se a pasta assets/leaflet existe.</div>';
      return;
    }

    // Ícones locais (sem CDN)
    try {
      L.Icon.Default.mergeOptions({
        iconUrl: 'assets/leaflet/marker-icon.png',
        iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png'
      });
    } catch (e) {}

    if (this.map) {
      const forceSize = () => {
        try {
          this.map.invalidateSize(true);
        } catch (e) {}
      };
      forceSize();
      setTimeout(forceSize, 100);
      setTimeout(forceSize, 300);
      setTimeout(forceSize, 600);
      return;
    }

    try {
      this.map = L.map(el, { scrollWheelZoom: true }).setView([-23.5505, -46.6333], 12);

      /*
       * tile.openstreetmap.org bloqueia muitos apps (403 / usage policy).
       * Usamos tiles GRATUITOS baseados em dados OpenStreetMap, sem API key:
       * 1) CARTO  2) OSM France  3) OSM Germany (fallback)
       */
      const atrOSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
      const atrCarto = atrOSM + ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

      const tilesCarto = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: atrCarto
      });
      const tilesFr = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
        attribution: atrOSM + ' &copy; OpenStreetMap France'
      });
      const tilesDe = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: atrOSM + ' &copy; OpenStreetMap Germany'
      });

      // Padrão: OSM France (funciona bem no Brasil; tile.openstreetmap.org bloqueia)
      tilesFr.addTo(this.map);
      L.control.layers({
        'OSM France': tilesFr,
        'OSM Germany': tilesDe,
        'CARTO': tilesCarto
      }, null, { position: 'topright' }).addTo(this.map);

      this.map.on('click', (e) => {
        if (!this._addingCliente) {
          UI.toast('Clique em "+ Ponto no mapa" na rota para começar a marcar');
          return;
        }
        this.promptClienteNome(e.latlng);
      });

      const forceSize = () => { try { this.map.invalidateSize(true); } catch (e) {} };
      forceSize();
      setTimeout(forceSize, 100);
      setTimeout(forceSize, 350);
      setTimeout(forceSize, 700);
      window.addEventListener('resize', forceSize);
      console.log('[Mapa] OK');
    } catch (err) {
      console.error(err);
      el.innerHTML = '<div style="padding:32px;text-align:center;color:#dc2626;font-size:13px"><strong>Erro no mapa</strong><br>' + err.message + '<br><br>Dica: hospede em http://localhost (não abra só como arquivo).</div>';
    }
  },


  refreshRotas() {
    this.initMap();
    const d = DB.get();
    const ativas = d.rotas.filter(r => r.status === 'ativa');
    const el = document.getElementById('listaRotas');
    if (!el) return;

    // Clear markers
    this.mapMarkers.forEach(m => this.map && this.map.removeLayer(m));
    this.mapMarkers = [];

    if (!ativas.length) {
      el.innerHTML = '<p class="empty">Nenhuma rota ativa. Clique em + Nova Rota.</p>';
      return;
    }

    el.innerHTML = ativas.map(r => {
      const cam = d.caminhoes.find(c => c.id === r.caminhaoId);
      const entregues = (r.clientes || []).filter(c => c.status === 'entregue').length;
      const total = (r.clientes || []).length;
      const clientesHtml = (r.clientes || []).map((cli, idx) => {
        const letra = this.letraPonto(idx);
        return `<div class="cliente-item ${cli.status === 'entregue' ? 'entregue' : ''}">
          <span style="width:26px;height:26px;border-radius:50%;background:${cli.status==='entregue'?'#059669':'#ea580c'};color:#fff;font-weight:700;font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${letra}</span>
          <span class="cli-nome">${cli.nome}${cli.endereco ? ' — ' + cli.endereco : ''}${cli.lat ? '' : ' <em style="color:#94a3b8">(sem mapa)</em>'}</span>
          <button class="btn btn-sm ${cli.status==='entregue'?'btn-success':'btn-outline'}"
            onclick="App.toggleEntrega('${r.id}',${idx})">${cli.status==='entregue'?'Entregue':'Pendente'}</button>
          <button class="btn btn-sm btn-danger" title="Excluir ponto" onclick="App.excluirPonto('${r.id}',${idx})">×</button>
        </div>`;
      }).join('');

      // Marcadores A, B, C... (arrastar para mover)
      (r.clientes || []).forEach((cli, idx) => {
        if (cli.lat != null && cli.lng != null && this.map) {
          const letra = this.letraPonto(idx);
          const entregue = cli.status === 'entregue';
          const bg = entregue ? '#059669' : '#ea580c';
          const rotaId = r.id;
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              width:32px;height:32px;border-radius:50%;
              background:${bg};color:#fff;font-weight:700;font-size:14px;
              display:flex;align-items:center;justify-content:center;
              border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
              font-family:Inter,Arial,sans-serif;cursor:grab">${letra}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
          });
          const marker = L.marker([cli.lat, cli.lng], { icon, draggable: true })
            .addTo(this.map)
            .bindPopup(
              `<b>Ponto ${letra}</b><br>${cli.nome}<br>${cli.endereco || ''}<br>` +
              `<em>${entregue ? 'Entregue' : 'Pendente'}</em><br>` +
              `<small>Arraste o marcador para mover</small><br><br>` +
              `<button type="button" onclick="App.excluirPonto('${rotaId}',${idx})" ` +
              `style="background:#dc2626;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px">Excluir ponto ${letra}</button>`
            );
          marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            App.moverPonto(rotaId, idx, pos.lat, pos.lng);
          });
          this.mapMarkers.push(marker);
        }
      });
      // Linha pela estrada (OSRM gratuito) ou reta se falhar
      const comCoord = (r.clientes || []).filter(cli => cli.lat != null && cli.lng != null);
      if (comCoord.length >= 2 && this.map) {
        this.desenharRotaEstrada(comCoord, r.id);
      }

      return `<div class="rota-card">
        <h4>${cam ? cam.placa : '—'} · ${r.data ? r.data.split('-').reverse().join('/') : ''}</h4>
        <div class="meta">${entregues}/${total} entregas · ${r.obs || ''}</div>
        ${clientesHtml || '<p style="font-size:12px;color:#64748b">Nenhum cliente ainda.</p>'}
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="App.marcarNoMapa('${r.id}')">+ Ponto no mapa (A,B,C...)</button>
          <button class="btn btn-sm btn-outline" onclick="App.addClienteRota('${r.id}')">+ Cliente sem mapa</button>
          <button class="btn btn-sm btn-success" onclick="App.finalizarRota('${r.id}')">Finalizar Rota</button>
          <button class="btn btn-sm btn-danger" onclick="App.deleteRota('${r.id}')">Excluir</button>
        </div>
      </div>`;
    }).join('');

    // Fit bounds
    if (this.mapMarkers.length && this.map) {
      const group = L.featureGroup(this.mapMarkers);
      this.map.fitBounds(group.getBounds().pad(0.2));
    }
  },

  novaRota() {
    const d = DB.get();
    const opts = d.caminhoes.map(c => `<option value="${c.id}">${c.placa} — ${c.modelo}</option>`).join('');
    const hoje = new Date().toISOString().slice(0, 10);
    UI.openModal('Nova Rota', `
      ${UI.formGroup('Caminhão', `<select class="form-control" id="rotaCam"><option value="">—</option>${opts}</select>`)}
      ${UI.formGroup('Data', `<input type="date" class="form-control" id="rotaData" value="${hoje}">`)}
      ${UI.formGroup('Observação', `<input class="form-control" id="rotaObs" placeholder="Opcional">`)}
    `, `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarRota()">Criar</button>
    `);
  },

  salvarRota() {
    const caminhaoId = document.getElementById('rotaCam').value;
    if (!caminhaoId) return UI.toast('Selecione o caminhão', 'err');
    DB.add('rotas', {
      caminhaoId,
      data: document.getElementById('rotaData').value,
      obs: document.getElementById('rotaObs').value.trim(),
      status: 'ativa',
      clientes: []
    });
    UI.closeModal();
    this.refreshRotas();
    UI.toast('Rota criada!');
  },

  addClienteRota(rotaId) {
    UI.openModal('Adicionar Cliente à Rota', `
      ${UI.formGroup('Nome do cliente', `<input class="form-control" id="cliNome" placeholder="Ex: Cliente XYZ">`)}
      ${UI.formGroup('Referência / observação', `<input class="form-control" id="cliEndereco" placeholder="Ex: Portaria 2, ao lado do mercado">`)}
      <p class="text-muted" style="margin-top:8px">Para marcar no mapa: use <strong>Marcar no mapa</strong> e clique no local desejado no OpenStreetMap.</p>
    `, `
      <button class="btn btn-outline" onclick="UI.closeModal()">Cancelar</button>
      <button class="btn btn-outline" onclick="App.marcarNoMapa('${rotaId}')">Marcar no mapa</button>
      <button class="btn btn-primary" onclick="App.salvarClienteRota('${rotaId}')">Salvar sem mapa</button>
    `);
  },

  salvarClienteRota(rotaId) {
    const nome = document.getElementById('cliNome').value.trim();
    const endereco = document.getElementById('cliEndereco').value.trim();
    if (!nome) return UI.toast('Informe o nome', 'err');
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r) return;
      r.clientes.push({ nome, endereco, lat: null, lng: null, status: 'pendente' });
    });
    UI.closeModal();
    this.refreshRotas();
    UI.toast('Cliente adicionado!');
  },

  marcarNoMapa(rotaId) {
    UI.closeModal();
    this._addingCliente = rotaId;
    this.initMap();
    const d = DB.get();
    const r = d.rotas.find(x => x.id === rotaId);
    const proxima = this.letraPonto((r && r.clientes) ? r.clientes.length : 0);
    this.mostrarBannerMapa(`Modo marcação ativo — clique no mapa para o ponto <b>${proxima}</b> (ESC cancela)`);
    UI.toast(`Clique no mapa para marcar o ponto ${proxima}`);
  },

  mostrarBannerMapa(html) {
    let b = document.getElementById('mapBanner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'mapBanner';
      b.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:1000;background:#1a56db;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:90%;text-align:center';
      const wrap = document.getElementById('map')?.parentElement;
      if (wrap) {
        wrap.style.position = 'relative';
        wrap.appendChild(b);
      }
    }
    b.innerHTML = html;
    b.style.display = 'block';
  },

  esconderBannerMapa() {
    const b = document.getElementById('mapBanner');
    if (b) b.style.display = 'none';
  },

  promptClienteNome(latlng) {
    const rotaId = this._addingCliente;
    // não limpa ainda — só após salvar; se cancelar, limpa
    const d = DB.get();
    const r = d.rotas.find(x => x.id === rotaId);
    const proxima = this.letraPonto((r && r.clientes) ? r.clientes.length : 0);
    UI.openModal(`Ponto ${proxima} no mapa`, `
      <p style="margin-bottom:12px;font-size:13px">Marcador <strong>${proxima}</strong> · Lat ${latlng.lat.toFixed(5)}, Lng ${latlng.lng.toFixed(5)}</p>
      ${UI.formGroup('Nome do cliente / local', `<input class="form-control" id="cliNomeMap" autofocus placeholder="Ex: Cliente Silva">`)}
      ${UI.formGroup('Referência', `<input class="form-control" id="cliEndMap" placeholder="Opcional">`)}
      <p class="text-muted">Depois você pode marcar o próximo ponto (B, C, D...) clicando de novo em "+ Ponto no mapa".</p>
    `, `
      <button class="btn btn-outline" onclick="App.cancelarMarcacao();UI.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="App.salvarClienteMap('${rotaId}',${latlng.lat},${latlng.lng})">Salvar ponto ${proxima}</button>
    `);
  },

  salvarClienteMap(rotaId, lat, lng) {
    const nome = document.getElementById('cliNomeMap').value.trim();
    if (!nome) return UI.toast('Informe o nome', 'err');
    const endereco = document.getElementById('cliEndMap').value.trim();
    let letra = 'A';
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r) return;
      letra = this.letraPonto(r.clientes.length);
      r.clientes.push({ nome, endereco, lat, lng, status: 'pendente' });
    });
    UI.closeModal();
    // Continua no modo marcação para o próximo ponto (B, C, D...)
    this._addingCliente = rotaId;
    this.refreshRotas();
    const d2 = DB.get();
    const r2 = d2.rotas.find(x => x.id === rotaId);
    const proxima = this.letraPonto((r2 && r2.clientes) ? r2.clientes.length : 0);
    this.mostrarBannerMapa(`Ponto <b>${letra}</b> salvo! Clique no mapa para o ponto <b>${proxima}</b> · <a href="#" style="color:#fff;text-decoration:underline" onclick="App.cancelarMarcacao();return false">Parar</a>`);
    UI.toast(`Ponto ${letra} salvo! Clique no mapa para ${proxima}`);
  },

  cancelarMarcacao() {
    this._addingCliente = null;
    this.esconderBannerMapa();
    UI.toast('Marcação encerrada');
  },

  excluirPonto(rotaId, idx) {
    if (!confirm('Excluir este ponto da rota?')) return;
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r || !r.clientes[idx]) return;
      r.clientes.splice(idx, 1);
    });
    try { this.map && this.map.closePopup(); } catch (e) {}
    this.refreshRotas();
    UI.toast('Ponto excluído');
  },

  moverPonto(rotaId, idx, lat, lng) {
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r || !r.clientes[idx]) return;
      r.clientes[idx].lat = lat;
      r.clientes[idx].lng = lng;
    });
    this.refreshRotas();
    UI.toast('Ponto movido');
  },

  toggleEntrega(rotaId, idx) {
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r || !r.clientes[idx]) return;
      r.clientes[idx].status = r.clientes[idx].status === 'entregue' ? 'pendente' : 'entregue';
    });
    this.refreshRotas();
  },

  finalizarRota(rotaId) {
    if (!confirm('Finalizar esta rota? Ela sairá da lista do dia e ficará salva no histórico.')) return;
    DB.update(d => {
      const r = d.rotas.find(x => x.id === rotaId);
      if (!r) return;
      r.status = 'finalizada';
      r.finalizadaEm = new Date().toISOString();
    });
    this.refreshRotas();
    UI.toast('Rota finalizada e salva!');
  },

  deleteRota(rotaId) {
    UI.askPassword(() => {
      DB.remove('rotas', rotaId);
      this.refreshRotas();
      UI.toast('Rota excluída');
    });
  },

  // ==================== EVENTS ====================
  bindGlobal() {
    document.getElementById('btnLogin')?.addEventListener('click', () => this.doLogin());
    document.getElementById('loginPass')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doLogin();
    });
  },

  bindEvents() {
    document.getElementById('btnSair')?.addEventListener('click', () => this.doLogout());
    document.getElementById('btnNovoCarregamento')?.addEventListener('click', () => this.novoCarregamento());
    document.getElementById('btnNovaRota')?.addEventListener('click', () => this.novaRota());
    document.getElementById('btnMapSearch')?.addEventListener('click', () => this.buscarEndereco());
    document.getElementById('mapSearch')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.buscarEndereco();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._addingCliente) this.cancelarMarcacao();
    });
    document.getElementById('btnNovoCaminhao')?.addEventListener('click', () => this.novoCaminhao());
    document.getElementById('btnNovoFuncionario')?.addEventListener('click', () => this.novoFuncionario());
    document.getElementById('btnNovoCargo')?.addEventListener('click', () => this.novoCargo());
    document.getElementById('btnNovoProduto')?.addEventListener('click', () => this.novoProduto());
    document.getElementById('btnNovaFalta')?.addEventListener('click', () => this.novaFalta());
    document.getElementById('btnSalvarDiaria')?.addEventListener('click', () => this.salvarDiaria());
    document.getElementById('btnGerarRelatorio')?.addEventListener('click', () => this.gerarRelatorio());
    document.getElementById('btnImprimirRelatorio')?.addEventListener('click', () => this.imprimirRelatorio());
    document.getElementById('btnSalvarConfig')?.addEventListener('click', () => this.salvarConfig());
    document.getElementById('btnExportar')?.addEventListener('click', () => this.exportar());
    document.getElementById('btnImportar')?.addEventListener('click', () => document.getElementById('fileImport').click());
    document.getElementById('fileImport')?.addEventListener('change', e => {
      if (e.target.files[0]) this.importar(e.target.files[0]);
    });
    document.getElementById('btnLimparDados')?.addEventListener('click', () => this.limparDados());
    document.getElementById('buscaProduto')?.addEventListener('input', e => this.refreshProdutos(e.target.value));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
