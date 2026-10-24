# Logísticas Bill

Sistema profissional de gestão logística — desktop e mobile.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + componentes acessíveis (Radix)
- **Prisma** + PostgreSQL (Layerbase)
- **Argon2id** para hash de senhas
- **JWT + Session** no banco (cookie HttpOnly)
- **Leaflet + OpenStreetMap** (tiles OSM France — gratuito)
- **Recharts** + **Framer Motion**
- Tema claro / escuro

## Estrutura de pastas

```
logisticas-bill/
├── prisma/
│   ├── schema.prisma      # Tabelas profissionais
│   └── seed.ts            # Usuário admin + dados iniciais
├── public/                # Coloque sua logo aqui (ex: logo.png)
├── src/
│   ├── app/
│   │   ├── (auth)/login/  # Tela de login
│   │   ├── (dashboard)/   # Área logada
│   │   │   ├── dashboard/
│   │   │   ├── rotas/
│   │   │   ├── caminhoes/
│   │   │   ├── funcionarios/
│   │   │   ├── produtos/
│   │   │   ├── diarias/
│   │   │   ├── faltas/
│   │   │   ├── relatorios/
│   │   │   └── configuracoes/
│   │   └── api/auth/      # Login / Logout
│   ├── components/
│   │   ├── layout/        # Sidebar, ThemeToggle, Shell
│   │   ├── map/           # Mapa OSM
│   │   ├── ui/            # Button, Card, Dialog, etc.
│   │   └── AdminPasswordModal.tsx
│   ├── lib/
│   │   ├── auth.ts        # Argon2 + JWT + sessões
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   └── validations.ts # Zod
│   └── hooks/
└── package.json
```

## Como rodar

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Configurar ambiente**
   ```bash
   cp .env.example .env
   ```
   Edite `.env` e cole a connection string do seu banco Layerbase:
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
   JWT_SECRET="uma-string-longa-e-aleatoria-com-no-minimo-32-caracteres"
   ```

3. **Criar tabelas e seed**
   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. **Desenvolvimento**
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000  
   Login inicial: **admin** / **admin123** (troque imediatamente)

## Segurança

- Senhas: Argon2id (64 MB memory, timeCost 3, parallelism 4)
- Sessão: JWT assinado + registro no banco + cookie HttpOnly / Secure / SameSite
- Exclusão e edições sensíveis: modal pedindo senha do administrador
- Sem polling agressivo — dados sob demanda e no foco da janela (ideal para multi-dispositivo)

## Logo

Coloque sua logo em `public/logo.png` e substitua o placeholder "LB" nos componentes `Sidebar` e `Login` se desejar.

## Próximos passos sugeridos

1. Conectar formulários de CRUD às APIs (criar rotas em `src/app/api/...`)
2. Upload de atestados (S3, R2 ou storage do próprio Layerbase)
3. LISTEN/NOTIFY do Postgres ou WebSocket para real-time verdadeiro entre desktop e mobile
4. Exportação de relatórios em PDF (ex: `@react-pdf/renderer` ou puppeteer)

## Layerbase

O schema Prisma está pronto para PostgreSQL. Use a connection string fornecida pelo painel Layerbase. As tabelas são criadas com `prisma db push` (ou migrations se preferir).

---

Desenvolvido para uso interno — Logísticas Bill.
