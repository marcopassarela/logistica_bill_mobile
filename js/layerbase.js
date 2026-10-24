/**
 * Cliente → API Vercel → Layerbase (Postgres)
 * A key/DATABASE_URL nunca ficam no browser.
 */
const Layerbase = {
  isReady() {
    return !!(LB_CONFIG && LB_CONFIG.enabled);
  },

  api(path) {
    const base = (LB_CONFIG && LB_CONFIG.apiBase) || '';
    return base.replace(/\/$/, '') + path;
  },

  async query(sql, params) {
    if (!this.isReady()) throw new Error('Banco remoto desativado (config.js)');
    const res = await fetch(this.api('/api/query'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, params: params || [] })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data.rows || [];
  },

  esc(v) {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' && isFinite(v)) return String(v);
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') return "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
    return "'" + String(v).replace(/'/g, "''") + "'";
  },

  async test() {
    return this.query('SELECT 1 AS ok');
  },

  async login(user, pass) {
    const res = await fetch(this.api('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Falha no login');
    return data;
  },

  async verifyPassword(pass) {
    const res = await fetch(this.api('/api/auth/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass })
    });
    const data = await res.json().catch(() => ({}));
    return !!(res.ok && data.ok);
  },

  async changePassword(current, next, usuario) {
    const res = await fetch(this.api('/api/auth/password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current, next, usuario })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
    return data;
  },

  async loadAll() {
    const out = {
      config: { usuario: 'Admin', senha: '', diariaPadrao: 350 },
      caminhoes: [],
      funcionarios: [],
      cargos: [],
      produtos: [],
      diarias: [],
      faltas: [],
      carregamentos: [],
      rotas: []
    };

    try {
      const cfg = await this.query('SELECT usuario, diaria_padrao FROM config WHERE id = 1');
      if (cfg[0]) {
        out.config.usuario = cfg[0].usuario || 'Admin';
        out.config.diariaPadrao = +(cfg[0].diaria_padrao ?? 350);
        out.config.senha = ''; // nunca carrega hash/senha pro client
      }
    } catch (e) {
      console.warn('config:', e.message);
    }

    const map = async (sql, fn) => {
      try {
        return (await this.query(sql)).map(fn);
      } catch (e) {
        console.warn(sql.slice(0, 40), e.message);
        return [];
      }
    };

    out.cargos = await map('SELECT id, nome FROM cargos ORDER BY nome', r => ({
      id: r.id, nome: r.nome
    }));

    out.funcionarios = await map(
      'SELECT id, nome, cargo_id, telefone, cnh, status FROM funcionarios',
      r => ({
        id: r.id, nome: r.nome, cargoId: r.cargo_id, telefone: r.telefone || '',
        cnh: r.cnh || '', status: r.status || 'ativo'
      })
    );

    out.caminhoes = await map(
      'SELECT id, placa, modelo, capacidade_kg, status FROM caminhoes',
      r => ({
        id: r.id, placa: r.placa, modelo: r.modelo || '',
        capacidadeKg: +(r.capacidade_kg ?? 8000), status: r.status || 'disponivel'
      })
    );

    out.produtos = await map(
      "SELECT id, codigo, nome, comprimento, diametro, peso, preco, status FROM produtos WHERE COALESCE(status,'disponivel') <> 'excluido'",
      r => ({
        id: r.id, codigo: r.codigo, nome: r.nome || '',
        comprimento: +r.comprimento || 0, diametro: +r.diametro || 0,
        peso: +r.peso || 0, preco: +r.preco || 0, status: r.status || 'disponivel'
      })
    );

    out.diarias = await map(
      'SELECT id, data, caminhao_id, funcionario_id, valor, obs FROM diarias',
      r => ({
        id: r.id,
        data: r.data ? String(r.data).slice(0, 10) : '',
        caminhaoId: r.caminhao_id, funcionarioId: r.funcionario_id,
        valor: +r.valor || 0, obs: r.obs || ''
      })
    );

    out.faltas = await map(
      'SELECT id, data, funcionario_id, motivo, atestado FROM faltas',
      r => ({
        id: r.id,
        data: r.data ? String(r.data).slice(0, 10) : '',
        funcionarioId: r.funcionario_id, motivo: r.motivo || '', atestado: r.atestado || ''
      })
    );

    out.carregamentos = await map(
      'SELECT id, data, caminhao_id, motorista_id, ajudante_id, itens, peso_total, capacidade_kg, status, status_carga FROM carregamentos',
      r => ({
        id: r.id,
        data: r.data || null,
        caminhaoId: r.caminhao_id,
        motoristaId: r.motorista_id,
        ajudanteId: r.ajudante_id,
        itens: typeof r.itens === 'string' ? JSON.parse(r.itens || '[]') : (r.itens || []),
        pesoTotal: +(r.peso_total ?? 0),
        capacidadeKg: +(r.capacidade_kg ?? 8000),
        status: r.status || 'em-andamento',
        statusCarga: r.status_carga || 'carregando'
      })
    );

    out.rotas = await map(
      'SELECT id, data, caminhao_id, obs, status, clientes, finalizada_em FROM rotas',
      r => ({
        id: r.id,
        data: r.data ? String(r.data).slice(0, 10) : '',
        caminhaoId: r.caminhao_id,
        obs: r.obs || '',
        status: r.status || 'ativa',
        clientes: typeof r.clientes === 'string' ? JSON.parse(r.clientes || '[]') : (r.clientes || []),
        finalizadaEm: r.finalizada_em || null
      })
    );

    return out;
  },

  async replaceCollection(table, rows, columnsSql, rowToValues) {
    await this.query('DELETE FROM ' + table);
    for (const row of rows) {
      await this.query('INSERT INTO ' + table + ' ' + columnsSql + ' VALUES ' + rowToValues(row));
    }
  },

  async saveAll(data) {
    await this.query(
      'UPDATE config SET usuario = ' + this.esc(data.config.usuario) +
      ', diaria_padrao = ' + this.esc(data.config.diariaPadrao || 350) +
      ' WHERE id = 1'
    );
    // senha NÃO é salva por aqui — só via /api/auth/password (Argon2)

    await this.replaceCollection('cargos', data.cargos || [], '(id, nome)',
      r => '(' + this.esc(r.id) + ',' + this.esc(r.nome) + ')');

    await this.replaceCollection('funcionarios', data.funcionarios || [],
      '(id, nome, cargo_id, telefone, cnh, status)',
      r => '(' + [this.esc(r.id), this.esc(r.nome), this.esc(r.cargoId), this.esc(r.telefone || ''), this.esc(r.cnh || ''), this.esc(r.status || 'ativo')].join(',') + ')');

    await this.replaceCollection('caminhoes', data.caminhoes || [],
      '(id, placa, modelo, capacidade_kg, status)',
      r => '(' + [this.esc(r.id), this.esc(r.placa), this.esc(r.modelo || ''), this.esc(r.capacidadeKg || 8000), this.esc(r.status || 'disponivel')].join(',') + ')');

    await this.replaceCollection('produtos', data.produtos || [],
      '(id, codigo, nome, comprimento, diametro, peso, preco, status)',
      r => '(' + [this.esc(r.id), this.esc(r.codigo), this.esc(r.nome || ''), this.esc(r.comprimento || 0), this.esc(r.diametro || 0), this.esc(r.peso || 0), this.esc(r.preco || 0), this.esc(r.status || 'disponivel')].join(',') + ')');

    await this.replaceCollection('diarias', data.diarias || [],
      '(id, data, caminhao_id, funcionario_id, valor, obs)',
      r => '(' + [this.esc(r.id), r.data ? this.esc(r.data) : 'NULL', this.esc(r.caminhaoId), this.esc(r.funcionarioId), this.esc(r.valor || 0), this.esc(r.obs || '')].join(',') + ')');

    await this.replaceCollection('faltas', data.faltas || [],
      '(id, data, funcionario_id, motivo, atestado)',
      r => '(' + [this.esc(r.id), r.data ? this.esc(r.data) : 'NULL', this.esc(r.funcionarioId), this.esc(r.motivo || ''), this.esc(r.atestado || '')].join(',') + ')');

    await this.replaceCollection('carregamentos', data.carregamentos || [],
      '(id, data, caminhao_id, motorista_id, ajudante_id, itens, peso_total, capacidade_kg, status, status_carga)',
      r => '(' + [
        this.esc(r.id),
        r.data ? this.esc(r.data) : 'NOW()',
        this.esc(r.caminhaoId),
        this.esc(r.motoristaId),
        this.esc(r.ajudanteId),
        this.esc(r.itens || []),
        this.esc(r.pesoTotal || 0),
        this.esc(r.capacidadeKg || 8000),
        this.esc(r.status || 'em-andamento'),
        this.esc(r.statusCarga || 'carregando')
      ].join(',') + ')');

    await this.replaceCollection('rotas', data.rotas || [],
      '(id, data, caminhao_id, obs, status, clientes, finalizada_em)',
      r => '(' + [
        this.esc(r.id),
        r.data ? this.esc(r.data) : 'NULL',
        this.esc(r.caminhaoId),
        this.esc(r.obs || ''),
        this.esc(r.status || 'ativa'),
        this.esc(r.clientes || []),
        r.finalizadaEm ? this.esc(r.finalizadaEm) : 'NULL'
      ].join(',') + ')');
  }
};
