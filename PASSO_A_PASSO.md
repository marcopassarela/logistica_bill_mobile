# Correções – Logísticas Bill (banco Aiven + tempo real)

## O que mudou
| Arquivo | Mudança |
|---|---|
| `src/app/api/alertas/route.ts` | Geração de alertas em lote (3 consultas fixas, em vez de 1 transação por agendamento vencido a cada consulta). Avisa os outros usuários na hora via Ably. |
| `src/app/api/auth/heartbeat/route.ts` | Não grava no banco se o último registro tem menos de 30 s (várias abas = 1 gravação). |
| `src/components/layout/DashboardShell.tsx` | Heartbeat a cada 45 s e envio imediato ao voltar para a aba. |
| `src/components/layout/NotificationBell.tsx` | Atualiza na hora pelo evento em tempo real; consulta periódica só com a aba visível. |
| `src/app/api/manutencoes/[id]/route.ts` | Editar/excluir manutenção agora avisa os outros usuários (faltava). |
| `src/app/api/carregamentos/[id]/itens/[itemId]/nota-fiscal/route.ts` | Enviar nota fiscal agora avisa os outros usuários (faltava). |
| `prisma/schema.prisma` | `directUrl` (para usar o pool da Aiven) + 2 índices. |
| `sql/indices-alertas.sql` | Os mesmos 2 índices, para rodar direto no console da Aiven. |
| `vercel.json` | Esvaziado (configurava só a pasta `api/` legada). |

## Passo a passo
1. **Backup**: `git checkout -b correcoes-banco` (ou copie a pasta do projeto).
2. **Copie os arquivos** deste zip para a raiz do projeto, mantendo as pastas (substitua quando perguntar).
3. **Apague a pasta legada `api/`** (na raiz do projeto, no PowerShell):
   `Remove-Item -Recurse -Force .\api`
   Opcional (limpeza): `Get-ChildItem -Recurse -Include *.bak,*.antes-recuperacao-* | Remove-Item -Force`
4. **Pool de conexões na Aiven**: no serviço `bill-mobile`, aba *Connection pools* → *Add pool* (modo *transaction*, banco `defaultdb`, usuário `avnadmin`). Copie a *Service URI* do pool.
5. **Variáveis na Vercel** (Settings → Environment Variables) e no seu `.env` local:
   - `DATABASE_URL` = URI **do pool** + `pgbouncer=true` (se a URI já tem `?sslmode=require`, acrescente `&pgbouncer=true`).
   - `DIRECT_URL` = URI **direta** do serviço (a que você usava antes em `DATABASE_URL`).
   - Confirme que `ABLY_API_KEY` existe (o tempo real depende dela).
6. **Índices**: cole `sql/indices-alertas.sql` no console SQL da Aiven e execute.
7. **Teste local**: `npm install`, `npm run build` e `npm run dev`.
8. **Publicar**: `git add . && git commit -m "Corrige carga no banco" && git push`. A Vercel faz o deploy.
9. **Teste do tempo real**: abra o sistema em dois navegadores (ou um anônimo) com usuários diferentes, altere algo (caminhão, carga, falta) e veja o outro atualizar sozinho.
10. **Acompanhe** a aba *Metrics* da Aiven (memória e conexões) nos dias seguintes.

## Por que não SSE
O sistema já usa Ably (WebSocket) e quase todas as telas já escutam o evento `logistica:data-changed`. SSE na Vercel mantém uma função serverless presa por conexão e é cortado pelo limite de duração, o que aumentaria a carga em vez de reduzir.

## Ainda não feito (próximas etapas)
- Mover os PDFs de nota fiscal para fora do banco (Vercel Blob / R2 / S3).
- Paginação/filtro por data em diárias, faltas, manutenções, agendamentos e funcionários.
- Limpeza periódica de sessões expiradas.
