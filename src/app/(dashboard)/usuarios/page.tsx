"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Pencil, Trash2, UserPlus, Users, Wifi, WifiOff, X } from "lucide-react";
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
  const [keyLoading, setKeyLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/activation-keys");
      if (res.ok) setKeys(await res.json());
    } catch {
      /* silencioso */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [loadKeys]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    if (!selectedTargetUserId) {
      setError("Selecione o usuário que receberá a chave.");
      return;
    }

    setKeyLoading(true);
    setError("");
    setMessage("");
    setGeneratedCode("");

    try {
      const res = await fetch("/api/activation-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedTargetUserId,
          neverExpires: keyNeverExpires,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar chave.");

      setGeneratedCode(data.code || "");
      setKeyNeverExpires(false);
      setMessage(data.message || "Chave de ativação gerada.");
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar chave.");
    } finally {
      setKeyLoading(false);
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

      setMessage("Chave revogada.");
      await loadKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao revogar chave.");
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
      await load();
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
      await load();
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
    await load();
    return true;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

      {/* Card: Chaves de ativação */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Chaves de ativação
            </CardTitle>
            <CardDescription>
              Gere uma chave exclusiva para vincular um dispositivo à conta de um usuário ativo.
              O código completo será exibido somente uma vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1 space-y-1">
                <Label className="text-xs">Usuário que receberá a chave</Label>
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

              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={keyNeverExpires}
                  onChange={(e) => setKeyNeverExpires(e.target.checked)}
                />
                Não expira
              </label>

              <Button
                type="button"
                onClick={createKey}
                disabled={keyLoading || !selectedTargetUserId}
              >
                {keyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar chave
              </Button>
            </div>

            {generatedCode && (
              <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                <p className="text-sm font-medium">Código gerado — copie agora</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all font-mono text-sm">{generatedCode}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void navigator.clipboard.writeText(generatedCode)}
                  >
                    Copiar código
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Por segurança, esse código não poderá ser consultado novamente.
                </p>
              </div>
            )}

            {keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma chave gerada.</p>
            ) : (
              <ul className="space-y-2">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {k.targetUser?.name || "Usuário não identificado"}
                        {k.targetUser?.username ? ` (@${k.targetUser.username})` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criada em {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                        {" · "}
                        {k.expiresAt
                          ? `Expira em ${new Date(k.expiresAt).toLocaleDateString("pt-BR")}`
                          : "Não expira"}
                        {" · "}
                        {{
                          PENDING: "Pendente",
                          USED: "Utilizada",
                          EXPIRED: "Expirada",
                          REVOKED: "Revogada",
                        }[k.status]}
                      </p>
                    </div>

                    {k.status === "PENDING" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteKey(k.id)}
                      >
                        Revogar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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
        <CardContent className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {user.online ? (
                    <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <p className="font-medium">
                    {user.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      @{user.username}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {roleLabel[user.role] || user.role}
                  {user.email ? ` · ${user.email}` : ""}
                  {user.cargoUsuario ? ` · ${user.cargoUsuario}` : ""}
                  {" · "}
                  {offlineText(user)}
                  {!user.isActive ? " · Inativo" : ""}
                </p>
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
