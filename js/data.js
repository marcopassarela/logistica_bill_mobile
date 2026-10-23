/**
 * Logísticas Bill — Banco de dados local (LocalStorage)
 * Preparado para embutir no .exe futuramente
 */
const DB = {
  KEY: 'logisticas_bill_v1',
  AUTH_KEY: 'logisticas_bill_auth',

  default() {
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

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.default();
      return { ...this.default(), ...JSON.parse(raw) };
    } catch {
      return this.default();
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  get() { return this.load(); },

  update(fn) {
    const data = this.load();
    fn(data);
    this.save(data);
    return data;
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // Auth
  getAuth() {
    try {
      const raw = localStorage.getItem(this.AUTH_KEY);
      if (!raw) return null;
      const auth = JSON.parse(raw);
      if (!auth.loginAt) return null;
      const hours = (Date.now() - auth.loginAt) / 3600000;
      if (hours >= 24) {
        this.logout();
        return null;
      }
      return auth;
    } catch { return null; }
  },

  login(user, pass) {
    const d = this.load();
    if (user === d.config.usuario && pass === d.config.senha) {
      const auth = { user, loginAt: Date.now() };
      localStorage.setItem(this.AUTH_KEY, JSON.stringify(auth));
      return true;
    }
    return false;
  },

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
      ];
    });
  },

  clearAll() {
    localStorage.removeItem(this.KEY);
  }
};
