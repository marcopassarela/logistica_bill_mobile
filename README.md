# Logísticas Bill

Sistema web de gestão logística para empresas de transporte e carga. Reúne em uma única aplicação o controle de frota, funcionários, carregamentos digitados, rotas, diárias, faltas, manutenções e agendamentos, com relatórios e notificações push. A interface é responsiva e funciona em desktop e celular.

> Projeto acadêmico
> Autor: Marco Aurélio · Licença: [MIT](LICENSE)

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Como executar](#como-executar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts disponíveis](#scripts-disponíveis)
- [Implantação na Vercel](#implantação-na-vercel)
- [Segurança](#segurança)
- [Limitações conhecidas e melhorias futuras](#limitações-conhecidas-e-melhorias-futuras)

## Funcionalidades

| Módulo | Descrição |
| --- | --- |
| **Dashboard** | Indicadores e gráficos da operação (cargas, pesos, diárias, frota). |
| **Caminhões** | Cadastro da frota com capacidade em kg, status e dados do veículo. |
| **Funcionários e cargos** | Cadastro de equipe e de cargos; a exclusão exige a senha do administrador. |
| **Carregamentos** | Montagem de cargas por caminhão, controle de peso total e alerta de excesso de capacidade. |
| **Rotas** | Planejamento no mapa (OpenStreetMap), busca de endereços, cálculo do percurso por estradas e otimização da ordem das paradas. |
| **Diárias** | Lançamento de diárias de motoristas e ajudantes. |
| **Faltas** | Registro de falta, atestado, folga e licença. |
| **Agendamentos e manutenções** | Programação de carregamentos e de manutenções da frota. |
| **Programações e alertas** | Lembretes com notificações push e central de alertas no sino da barra superior. |
| **Relatórios** | Geração de relatórios com exportação para Excel e impressão/PDF em formato A4. |
| **Configurações** | Perfil do usuário, troca de senha e tema claro/escuro. |

## Tecnologias

- **Next.js 16** (App Router) e **React 19**, com **TypeScript**
- **Tailwind CSS** e componentes baseados em Radix UI
- **Prisma ORM** com **PostgreSQL**
- **Argon2id** para armazenamento de senhas
- **Jose** (JWT) combinado com sessões persistidas no banco
- **Zod** para validação de entrada
- **Leaflet / OpenStreetMap**, **Nominatim** (busca de endereços) e **OSRM** (cálculo de rotas)
- **Recharts** e **Framer Motion** para gráficos e animações
- **Web Push (VAPID)** e Service Worker para notificações

## Arquitetura

A aplicação é um monólito Next.js: as páginas (interface) e as rotas de API ficam no mesmo projeto e compartilham a camada de acesso a dados.

```
.
├── prisma/
│   ├── schema.prisma        # Modelo de dados (usuários, frota, cargas, rotas, alertas...)
│   └── seed.ts              # Cria o primeiro administrador e dados de exemplo
├── public/                  # Logo, ícones, manifest e service worker (sw.js)
└── src/
    ├── app/
    │   ├── (auth)/login/    # Tela de login
    │   ├── (dashboard)/     # Área autenticada (uma pasta por módulo)
    │   └── api/             # Rotas de API, uma pasta por recurso
    ├── components/          # Layout, mapa, notificações e componentes de interface
    └── lib/
        ├── auth.ts          # Hash de senha, sessões, JWT e verificação do administrador
        ├── rate-limit.ts    # Limitador de tentativas (login e confirmação de senha)
        ├── validations.ts   # Esquemas Zod
        ├── routing.ts       # Utilitários de rotas
        └── prisma.ts        # Cliente do banco
```

**Fluxo de autenticação:** o login valida o usuário e a senha (Argon2id), cria uma sessão no banco e grava um JWT assinado em cookie `HttpOnly`. Cada rota de API e o layout da área logada consultam essa sessão antes de responder.

## Como executar

**Pré-requisitos:** Node.js 20.9 ou superior e um banco PostgreSQL (local ou em nuvem).

```bash
# 1. Instalar as dependências (também gera o cliente do Prisma)
npm install

# 2. Configurar o ambiente
cp .env.example .env
#    preencha o .env (veja a seção "Variáveis de ambiente")

# 3. Criar as tabelas no banco
npm run db:push

# 4. Criar o primeiro administrador e os dados de exemplo
npm run db:seed

# 5. Iniciar em modo de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000` e entre com o usuário e a senha definidos em `SEED_ADMIN_USERNAME` e `SEED_ADMIN_PASSWORD`.

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). O arquivo `.env` nunca deve ser versionado.

| Variável | Obrigatória | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL. |
| `JWT_SECRET` | Sim | Segredo de assinatura da sessão (mínimo de 32 caracteres). Não há valor padrão: sem ela o login não funciona. |
| `CRON_SECRET` | Para lembretes | Protege a rota `/api/cron/lembretes`. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Para push | Chaves das notificações. Gere com `npx web-push generate-vapid-keys`. |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | Só no seed | Credenciais do primeiro administrador (senha com no mínimo 12 caracteres). |

## Scripts disponíveis

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Gera o cliente do Prisma e compila para produção. |
| `npm start` | Executa a versão compilada. |
| `npm run lint` | Análise estática com ESLint. |
| `npm run typecheck` | Verificação de tipos do TypeScript. |
| `npm run db:push` | Aplica o schema do Prisma ao banco. |
| `npm run db:seed` | Executa o seed. |
| `npm run db:studio` | Abre o Prisma Studio. |

## Implantação na Vercel

1. Importe o repositório na Vercel (o framework Next.js é detectado automaticamente).
2. Cadastre as variáveis de ambiente da seção anterior.
3. Execute `npm run db:push` e `npm run db:seed` uma vez, apontando para o banco de produção.
4. **Lembretes automáticos:** a rota `GET /api/cron/lembretes` precisa ser chamada periodicamente com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Isso pode ser feito com um agendador externo ou com `crons` em um `vercel.json`, respeitando os limites do plano contratado.

## Segurança

Medidas presentes no projeto:

- **Senhas** com Argon2id (64 MB de memória, 3 iterações); nenhuma senha é guardada em texto puro.
- **Sessão** em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção, com expiração e validação no banco (o logout invalida a sessão no servidor).
- **Segredo do JWT obrigatório**, sem valor padrão, e algoritmo de verificação fixado em HS256.
- **Limite de tentativas** no login (por IP e por usuário) e na confirmação de senha do administrador.
- **Autorização nas rotas de API** (exceto login, logout e verificação de saúde) e **validação de entrada com Zod**.
- **Ações destrutivas** (excluir funcionários, cargos, diárias, faltas, rotas) exigem a senha do administrador.
- **Rota de cron** protegida por segredo, com comparação em tempo constante.
- **Cabeçalhos HTTP de segurança** (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`).
- **Sem credenciais no código:** tudo vem de variáveis de ambiente; o seed não possui senha fixa.

## Limitações conhecidas e melhorias futuras

- O limitador de tentativas é **em memória**: em ambiente serverless cada instância tem o próprio contador. Para produção em maior escala, o ideal é um armazenamento compartilhado (por exemplo, Redis).
- Ainda não há **Content-Security-Policy**; ela exige ajuste fino por causa do mapa e das animações.
- Não há **testes automatizados**.
- As telas carregam dados com `fetch` dentro de `useEffect`. Migrar para Server Components ou para uma biblioteca de dados (como TanStack Query) removeria os avisos de lint correspondentes.
- Dependências com avisos de segurança sem correção compatível: `xlsx` (usada apenas para **gerar** planilhas, nunca para ler arquivos enviados), `zod` 3.x (a correção exige a versão 4) e `deepmerge-ts` (dependência interna do CLI do Prisma 6). Acompanhe com `npm audit`.

## Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
