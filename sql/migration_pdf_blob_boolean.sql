-- PDFs ficam no Vercel Blob; o banco guarda somente metadados e presença.
-- Faça backup antes de executar em produção.
ALTER TABLE "CarregamentoItem"
  ADD COLUMN IF NOT EXISTS "notaFiscalDisponivel" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE "CarregamentoItem"
SET "notaFiscalDisponivel" = TRUE
WHERE "notaFiscalPath" IS NOT NULL OR "notaFiscalData" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "CarregamentoItem_carregamentoId_notaFiscalDisponivel_idx"
  ON "CarregamentoItem" ("carregamentoId", "notaFiscalDisponivel");
-- Após validar os downloads legados, remova bytes que já possuem path no Blob:
-- UPDATE "CarregamentoItem" SET "notaFiscalData" = NULL WHERE "notaFiscalPath" IS NOT NULL;
