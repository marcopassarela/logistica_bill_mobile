import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const funcionarioSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  cpf: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  cargoId: z.string().optional().nullable(),
  dataAdmissao: z.string().optional().nullable(),
  salario: z.coerce.number().optional().nullable(),
  status: z.enum(["ATIVO", "INATIVO", "AFASTADO"]).default("ATIVO"),
  observacoes: z.string().optional().nullable(),
});

export const caminhaoSchema = z.object({
  placa: z.string().min(7, "Placa inválida").max(8),
  modelo: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  ano: z.coerce.number().min(1980).max(2030).optional().nullable(),
  capacidadeKg: z.coerce.number().optional().nullable(),
  tipo: z.string().optional().nullable(),
  status: z
    .enum(["LIBERADO", "CARREGANDO", "CARREGADO", "EM_ROTA", "MANUTENCAO"])
    .default("LIBERADO"),
  quilometragem: z.coerce.number().optional().nullable(),
  renavam: z.string().optional().nullable(),
  chassi: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const diariaSchema = z.object({
  funcionarioId: z.string().min(1, "Funcionário obrigatório"),
  caminhaoId: z.string().optional().nullable(),
  data: z.string().min(1, "Data obrigatória"),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo"),
  observacao: z.string().optional().nullable(),
});

export const faltaSchema = z.object({
  funcionarioId: z.string().min(1, "Funcionário obrigatório"),
  data: z.string().min(1, "Data obrigatória"),
  tipo: z.enum(["FALTA", "ATESTADO", "FOLGA", "LICENCA", "OUTRO"]),
  justificativa: z.string().optional().nullable(),
});

export const cargoSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  descricao: z.string().optional().nullable(),
});

export const rotaSchema = z.object({
  nome: z.string().min(2),
  origem: z.string().min(2),
  destino: z.string().min(2),
  origemLat: z.coerce.number().optional().nullable(),
  origemLng: z.coerce.number().optional().nullable(),
  destinoLat: z.coerce.number().optional().nullable(),
  destinoLng: z.coerce.number().optional().nullable(),
  distanciaKm: z.coerce.number().optional().nullable(),
  caminhaoId: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

