"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Pencil, Trash2, UserPlus, Users, Wifi, WifiOff, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionMap } from "@/lib/permissions";

type UserRecord = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  role: string;
  cargoUsuario: string | null;
  funcionarioId: string | null;
  isActive: boolean;
  online: boolean;
  lastSeenAt: string | null;
  permissions?: PermissionMap | null;
};

type Funcionario = { id: string; nome: string; status: string };

type EditForm = {
  username: string;
  name: string;
  email: string;
  password: string;
  cargoUsuario: string;
  funcionarioId: string;
  role: string;
};

type ActivationKey = {
  id: string;
  targetUser: { id: string; username: string; name: string } | null;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  status: "PENDING" | "USED" | "EXPIRED" | "REVOKED";
};

const emptyForm: EditForm = {
  username: "",
  name: "",
  email: "",
  password: "",
  cargoUsuario: "",
  funcionarioId: "",
  role: "USER",
};

const roleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  USER: "Usuário",
};

function offlineText(user: UserRecord) {
  if (user.online) return "Online agora";
  if (!user.lastSeenAt) return "Nunca acessou";
  const lastSeen = new Date(user.lastSeenAt);
  const date = lastSeen.toLocaleDateString("pt-BR");
  const today = new Date().toLocaleDateString("pt-BR");
  const time = lastSeen.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (date === today) return `Visto por último hoje às ${time}`;
  return `Visto por último em ${date} às ${time}`;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);

  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState("");
  const [keyNeverExpires, setKeyNeverExpires] = useState(false);
  const [keyExpiresAt, setKeyExpiresAt] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  const [codeCopied, setCodeCopied] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedKeyId, setGeneratedKeyId] = useState('');

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/activation-keys");
      if (res.ok) setKeys(await res.json());
    } catch {
      /* silencioso */
    }
  }, []);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [uRes, fRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/funcionarios"),
      ]);
      const uData = await uRes.json();
      if (!uRes.ok) throw new Error(uData.error || "Não foi possível carregar os usuários.");
      setIsAdmin(uData.admin === true);
      setUsers(uData.users || []);
      if (fRes.ok) {
        const fData = await fRes.json();
        setFuncionarios(Array.isArray(fData) ? fData : fData.funcionarios || []);
      }
      if (uData.admin === true) await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [loadKeys]);

  useEffect(() => {
    void load();
  }, [load]);

  // Atualiza o histórico quando outra pessoa ativa uma chave.
  useEffect(() => {
    const refreshKeys = () => {
      if (document.visibilityState === "visible") {
        void loadKeys();
      }
    };

    window.addEventListener("focus", refreshKeys);
    document.addEventListener("visibilitychange", refreshKeys);
    const timer = window.setInterval(refreshKeys, 15000);

    return () => {
      window.removeEventListener("focus", refreshKeys);
      document.removeEventListener("visibilitychange", refreshKeys);
      window.clearInterval(timer);
    };
  }, [loadKeys]);

  async function createKey() {
    if (!selectedTargetUserId) {
      setError("Selecione o usuário que receberá a chave.");
      return;
    }

    if (!keyNeverExpires && (!keyExpiresAt || new Date(keyExpiresAt).getTime() <= Date.now())) {
      setError("Selecione uma data e hora futuras para a expiração.");
      return;
    }

    setKeyLoading(true);
    setError("");
    setMessage("");
    setGeneratedCode("");
    setGeneratedKeyId('');

    try {
      const res = await fetch("/api/activation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedTargetUserId,
          neverExpires: keyNeverExpires,
          expiresAt: keyNeverExpires ? null : new Date(keyExpiresAt).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar chave.");

      setGeneratedCode(data.code || "");
      setGeneratedKeyId(data.key.id);
      setCodeCopied(false);
      setKeys((current) => [
        {
          ...data.key,
          usedAt: null,
          closedAt: null,
          closedReason: null,
          status: "PENDING" as const,
        },
        ...current,
      ]);
      setKeyNeverExpires(false);
      setMessage(data.message || "Chave de ativação gerada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar chave.");
    } finally {
      setKeyLoading(false);
    }
  }

  async function copyGeneratedCode() {
    if (!generatedCode) return;

    try {
      await navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
    } catch {
      setError("Não foi possível copiar o código. Selecione o campo e copie manualmente.");
    }
  }

  async function deleteKey(id: string) {
    setError("");

    try {
      const res = await fetch("/api/activation-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível revogar a chave.");

      setKeys((current) => current.filter((key) => key.id !== id));
      setMessage("Chave revogada e removida.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao revogar chave.");
      await loadKeys();
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email.trim().toLowerCase(),
          funcionarioId: form.funcionarioId || null,
          permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha no cadastro.");
      setForm({ ...emptyForm });
      setPermissions({});
      setMessage("Usuário cadastrado com sucesso.");
      void load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(user: UserRecord) {
    setEditUser(user);
    setEditForm({
      username: user.username,
      name: user.name,
      email: user.email || "",
      password: "",
      cargoUsuario: user.cargoUsuario || "",
      funcionarioId: user.funcionarioId || "",
      role: user.role,
    });
    setPermissions(user.permissions || {});
    setError("");
    setMessage("");
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        id: editUser.id,
        username: editForm.username,
        name: editForm.name,
        email: editForm.email.trim().toLowerCase() || null,
        cargoUsuario: editForm.cargoUsuario,
        funcionarioId: editForm.funcionarioId || null,
        role: editForm.role,
        permissions,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar.");
      setEditUser(null);
      setMessage("Usuário atualizado.");
      void load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(adminPassword: string) {
    if (!deleteUser) return false;
    const res = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteUser.id, adminPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Não foi possível excluir.");
    setDeleteUser(null);
    setMessage("Usuário excluído.");
    void load(false);
    return true;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8  text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de contas, permissões e chaves de ativação.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}

      {/* Card: Gerar chave de ativação */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Gerar chave de ativação
              </CardTitle>
              <CardDescription>
                Escolha o usuário, defina a validade e gere uma chave exclusiva para ativar um dispositivo.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Usuário que receberá a chave</Label>
                  <select
                    value={selectedTargetUserId}
                    onChange={(e) => setSelectedTargetUserId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecione um usuário</option>
                    {users
                      .filter((user) => user.isActive && user.role !== "ADMIN")
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} (@{user.username})
                        </option>
                      ))}
                  </select>
                </div>

                {!keyNeverExpires && (
                  <div className="space-y-1">
                    <Label>Data e hora de expiracao</Label>
                    <Input
                      type="datetime-local"
                      min={(() => {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                        return now.toISOString().slice(0, 16);
                      })()}
                      value={keyExpiresAt}
                      onChange={(e) => setKeyExpiresAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={keyNeverExpires}
                  onChange={(e) => setKeyNeverExpires(e.target.checked)}
                />
                Esta chave não expira
              </label>

              <Button
                type="button"
                onClick={createKey}
                disabled={keyLoading || !selectedTargetUserId}
                className="w-full sm:w-auto"
              >
                {keyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar chave de ativação
              </Button>


            </CardContent>
          </Card>
          {generatedCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chave gerada</CardTitle>
                <CardDescription>Copie o código e compartilhe com o usuário.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input readOnly value={generatedCode} className="min-w-0 flex-1 font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" size="icon" variant="outline" onClick={copyGeneratedCode}>
                    {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {(() => {
                  const item = keys.find((key) => key.id === generatedKeyId);
                  if (!item) return null;
                  return (
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p>Usuário: {item.targetUser?.name || item.targetUser?.username || "Não identificado"}</p>
                      <p>Criada em: {new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                      <p>Validade: {item.expiresAt ? new Date(item.expiresAt).toLocaleString("pt-BR") : "Não expira"}</p>
                      <p>Status: {item.status === "USED" ? <span className="font-medium text-emerald-600">Ativada</span> : item.status === "PENDING" ? <span className="font-medium text-amber-600">Não ativado</span> : <span className="text-muted-foreground">{item.status === "REVOKED" ? "Revogada" : "Expirada"}</span>}</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Histórico de chaves de ativação
              </CardTitle>
              <CardDescription>Acompanhe as chaves pendentes e utilizadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {keys.filter((key) => key.status !== "REVOKED").length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma chave registrada.</p>
              ) : keys.filter((key) => key.status !== "REVOKED").map((key) => (
                <div key={key.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">{key.targetUser?.name || "Usuário não identificado"} {key.targetUser?.username ? `(@${key.targetUser.username})` : ""}</p>
                    <p className="text-muted-foreground">Criada em: {new Date(key.createdAt).toLocaleString("pt-BR")}</p>
                    <p className="text-muted-foreground">Validade: {key.expiresAt ? new Date(key.expiresAt).toLocaleString("pt-BR") : "Não expira"}</p>
                    <p>Status: {key.status === "USED" ? <span className="text-emerald-600">Ativado</span> : key.status === "PENDING" ? <span className="text-amber-600">Não ativado</span> : <span className="text-muted-foreground">Expirada</span>}</p>
                    {key.usedAt && <p className="text-muted-foreground">Ativada em: {new Date(key.usedAt).toLocaleString("pt-BR")}</p>}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => deleteKey(key.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />Remover
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>


        </>
      )}
      {/* Card: Usuários cadastrados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Usuários cadastrados
          </CardTitle>
          <CardDescription>{users.length} conta(s) no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {users.map((user) => (
              <div key={user.id} className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    {user.online ? (
                      <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <p className="truncate font-medium">{user.name}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                  <p className="text-xs font-medium">
                    {roleLabel[user.role] || user.role}
                    {user.cargoUsuario ? ` · ${user.cargoUsuario}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{offlineText(user)}</p>
                  {!user.isActive && (
                    <p className="text-xs text-destructive">Inativo</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button type="button" size="icon" variant="outline" onClick={() => startEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={() => setDeleteUser(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Card: Editar */}
      {editUser && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Editar usuário</CardTitle>
            <Button type="button" size="icon" variant="ghost" onClick={() => setEditUser(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={onEdit} className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome de exibição</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome de usuário</Label>
                <Input
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nova senha (opcional)</Label>
                <Input
                  type="password"
                  minLength={4}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo / perfil</Label>
                <Input
                  value={editForm.cargoUsuario}
                  onChange={(e) => setEditForm({ ...editForm, cargoUsuario: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de acesso</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="USER">Usuário</option>
                  <option value="MANAGER">Gestor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Funcionário / motorista</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={editForm.funcionarioId}
                  onChange={(e) => setEditForm({ ...editForm, funcionarioId: e.target.value })}
                >
                  <option value="">Não vincular</option>
                  {funcionarios
                    .filter((f) => f.status === "ATIVO")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <p className="mb-2 text-xs font-medium">Permissões de páginas</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {PERMISSION_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={permissions[`${key}.visualizar`] === true}
                        onChange={(e) =>
                          setPermissions({ ...permissions, [`${key}.visualizar`]: e.target.checked })
                        }
                      />
                      {PERMISSION_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Card: Cadastrar usuário */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Cadastrar usuário
            </CardTitle>
            <CardDescription>
              O e-mail é obrigatório para recuperação de senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome de exibição</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nome de usuário</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Senha</Label>
                <Input
                  type="password"
                  minLength={4}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo / perfil</Label>
                <Input
                  placeholder="Vendedor, Motorista..."
                  value={form.cargoUsuario}
                  onChange={(e) => setForm({ ...form, cargoUsuario: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de acesso</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="USER">Usuário</option>
                  <option value="MANAGER">Gestor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Funcionário / motorista</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.funcionarioId}
                  onChange={(e) => setForm({ ...form, funcionarioId: e.target.value })}
                >
                  <option value="">Não vincular</option>
                  {funcionarios
                    .filter((f) => f.status === "ATIVO")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <p className="mb-2 text-xs font-medium">Permissões iniciais de páginas</p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {PERMISSION_KEYS.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={permissions[`${key}.visualizar`] === true}
                        onChange={(e) =>
                          setPermissions({ ...permissions, [`${key}.visualizar`]: e.target.checked })
                        }
                      />
                      {PERMISSION_LABELS[key]}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar usuário
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <AdminPasswordModal
        open={Boolean(deleteUser)}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        onConfirm={confirmDelete}
        title="Excluir usuário"
        description={`Digite a senha de um administrador para excluir ${deleteUser?.name || "este usuário"}.`}
      />
    </div>
  );
}
