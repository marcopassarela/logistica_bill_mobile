-- Logísticas Bill - migração das melhorias solicitadas
-- Execute no PostgreSQL/Layerbase com DATABASE_URL apontando para o banco correto.

-- Os produtos de catálogo foram descontinuados. Primeiro preservamos o nome
-- nas cargas existentes; depois removemos o catálogo e o vínculo.
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "descricaoLivre" TEXT;
DO $$
BEGIN
  IF to_regclass('"Produto"') IS NOT NULL THEN
    EXECUTE 'UPDATE "CarregamentoItem" ci SET "descricaoLivre" = p."nome" FROM "Produto" p WHERE ci."produtoId" = p."id" AND (ci."descricaoLivre" IS NULL OR ci."descricaoLivre" = '''')';
  END IF;
END $$;
DROP TABLE IF EXISTS "Produto" CASCADE;
ALTER TABLE "CarregamentoItem" DROP COLUMN IF EXISTS "produtoId";

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cargoUsuario" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "funcionarioId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogoutAt" TIMESTAMP(3);

ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "ordemServico" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "clienteNome" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "clienteTelefone" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "clienteCidade" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "clienteBairro" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "mapaUrl" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "notaFiscalNome" TEXT;
ALTER TABLE "CarregamentoItem" ADD COLUMN IF NOT EXISTS "notaFiscalData" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_funcionarioId_key" ON "User" ("funcionarioId");
CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User" ("lastSeenAt");
CREATE INDEX IF NOT EXISTS "Carregamento_motoristaId_data_idx" ON "Carregamento" ("motoristaId", "data");
CREATE INDEX IF NOT EXISTS "CarregamentoItem_ordemServico_idx" ON "CarregamentoItem" ("ordemServico");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_funcionarioId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_funcionarioId_fkey"
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Auditar alterações de perfil/exclusão já usa a tabela AuditLog existente.
-- O Prisma Client deve ser regenerado depois desta migração:
-- npx prisma generate
