export const PERMISSION_KEYS = [
  "dashboard", "carregamentos", "programacoes", "rotas", "caminhoes", "funcionarios", "diarias", "faltas", "relatorios", "agendamentos", "manutencoes", "configuracoes", "usuarios", "painel",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PermissionMap = Record<string, boolean>;

export const MODULE_ACTIONS: Record<PermissionKey, Record<string, string>> = {
  dashboard: { visualizar: "Visualizar" },
  carregamentos: { visualizar: "Visualizar", criar: "Criar carga", editar: "Editar carga", excluir: "Excluir carga", alterarStatus: "Carregar / Não / Pendente", detalhesCliente: "Ver dados do cliente", rotaCompleta: "Rota completa" },
  programacoes: { visualizar: "Visualizar", criar: "Criar", editar: "Editar", excluir: "Excluir" },
  rotas: { visualizar: "Visualizar", criar: "Criar rota", editar: "Editar rota", excluir: "Excluir rota" },
  caminhoes: { visualizar: "Visualizar", criar: "Cadastrar", editar: "Editar", excluir: "Excluir" },
  funcionarios: { visualizar: "Visualizar", criar: "Cadastrar", editar: "Editar", excluir: "Excluir" },
  diarias: { visualizar: "Visualizar", criar: "Lançar", editar: "Editar", excluir: "Excluir" },
  faltas: { visualizar: "Visualizar", criar: "Registrar", editar: "Editar", excluir: "Excluir" },
  relatorios: { visualizar: "Visualizar", exportar: "Exportar / imprimir" },
  agendamentos: { visualizar: "Visualizar", criar: "Cadastrar", editar: "Editar", excluir: "Excluir" },
  manutencoes: { visualizar: "Visualizar", criar: "Cadastrar", editar: "Editar", excluir: "Excluir" },
  configuracoes: { visualizar: "Visualizar", editarPerfil: "Alterar perfil", alterarSenha: "Alterar senha" },
  usuarios: { visualizar: "Visualizar", criar: "Cadastrar usuário", editar: "Editar usuário", excluir: "Excluir usuário" },
  painel: { visualizar: "Visualizar", editarPermissoes: "Editar permissões", ativarUsuario: "Ativar / desativar" },
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, key[0].toUpperCase() + key.slice(1)])
) as Record<PermissionKey, string>;

export function permissionId(module: PermissionKey, action = "visualizar") { return `${module}.${action}`; }

export function normalizePermissions(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: PermissionMap = {};
  for (const [key, enabled] of Object.entries(input)) {
    if (typeof enabled !== "boolean") continue;
    // Compatibilidade com o formato antigo: uma aba antiga equivale somente
    // à permissão de visualizar, nunca às ações de seus botões.
    output[key.includes(".") ? key : `${key}.visualizar`] = enabled;
  }
  return output;
}

export function canAccess(role: string, permissions: unknown, permission: string): boolean {
  if (role === "ADMIN") return true;
  const normalized = normalizePermissions(permissions);
  return normalized[permission] === true;
}

export function firstAllowedPath(role: string, permissions: unknown): string {
  const preferred = ["dashboard", ...PERMISSION_KEYS];
  const key = preferred.find((item) => canAccess(role, permissions, permissionId(item as PermissionKey)));
  return `/${key || "login"}`;
}

export function permissionFromPath(pathname: string): string | null {
  const route = pathname.replace(/^\//, "").split("/")[0];
  if (!route) return permissionId("dashboard");
  if (!PERMISSION_KEYS.includes(route as PermissionKey)) return null;
  return permissionId(route as PermissionKey);
}
