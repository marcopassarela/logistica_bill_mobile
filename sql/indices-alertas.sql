-- Índices para as consultas de alertas (seguro rodar mais de uma vez).
-- Cole no console SQL da Aiven. Só cria índices; não altera nem apaga dados.
CREATE INDEX IF NOT EXISTS "Alerta_tipo_referencia_idx" ON "Alerta" ("tipo", "referencia");
CREATE INDEX IF NOT EXISTS "AuditLog_action_entity_entityId_idx" ON "AuditLog" ("action", "entity", "entityId");
