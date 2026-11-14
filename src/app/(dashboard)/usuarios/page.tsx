"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2, UserPlus, Users, Wifi, WifiOff, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionMap } from "@/lib/permissions";

type UserRecord = { id: string; username: string; name: string; role: string; cargoUsuario: string | null; funcionarioId: string | null; isActive: boolean; online: boolean; lastSeenAt: string | null; permissions?: PermissionMap | null };
type Funcionario = { id: string; nome: string; status: string };
type EditForm = { username: string; name: string; password: string; cargoUsuario: string; funcionarioId: string; role: string };
const emptyForm: EditForm = { username: "", name: "", password: "", cargoUsuario: "", funcionarioId: "", role: "USER" };
const roleLabel: Record<string, string> = { ADMIN: "Administrador", MANAGER: "Gestor", USER: "Usuário" };

function offlineText(user: UserRecord) {
  if (user.online) return "Online agora";
  if (!user.lastSeenAt) return "Nunca acessou";
  return `Offline desde ${new Date(user.lastSeenAt).toLocaleString("pt-BR")}`;
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, password: "" });
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, f] = await Promise.all([fetch("/api/users", { cache: "no-store" }), fetch("/api/funcionarios", { cache: "no-store" })]);
      const data = await u.json();
      if (!u.ok) throw new Error(data.error);
      setIsAdmin(data.admin === true);
      setUsers(data.users || []);
      if (f.ok) setFuncionarios(await f.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onDataChanged = (event: Event) => {
      const modules = (event as CustomEvent<{ modules?: string[] }>).detail?.modules ?? [];
      if (modules.includes("usuarios")) void load();
    };
    window.addEventListener("logistica:data-changed", onDataChanged);
    return () => window.removeEventListener("logistica:data-changed", onDataChanged);
  }, [load]);

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, cargoUsuario: form.cargoUsuario || null, funcionarioId: form.funcionarioId || null, permissions }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível cadastrar.");
      setForm({ ...emptyForm, password: "" }); setPermissions({}); setMessage("Usuário cadastrado com sucesso."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar."); } finally { setSaving(false); }
  }

  function beginEdit(user: UserRecord) {
    setEditUser(user);
    setEditForm({ username: user.username, name: user.name, password: "", cargoUsuario: user.cargoUsuario || "", funcionarioId: user.funcionarioId || "", role: user.role });
    setError(""); setMessage("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editUser) return; setSaving(true); setError(""); setMessage("");
    try {
      const payload = { id: editUser.id, ...editForm, password: editForm.password || undefined, cargoUsuario: editForm.cargoUsuario || null, funcionarioId: editForm.funcionarioId || null };
      const r = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível atualizar o perfil.");
      setEditUser(null); setMessage("Perfil atualizado com sucesso. O usuário deverá entrar novamente se o acesso foi alterado."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao atualizar perfil."); } finally { setSaving(false); }
  }

  async function toggleActive(user: UserRecord) {
    const r = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, isActive: !user.isActive }) });
    const d = await r.json(); if (!r.ok) setError(d.error || "Não foi possível alterar o status.");
  }

  async function confirmDelete(password: string) {
    if (!deleteUser) return false;
    const r = await fetch("/api/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteUser.id, adminPassword: password }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || "Não foi possível excluir.");
    setDeleteUser(null); setMessage("Usuário excluído com sucesso."); return true;
  }

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold tracking-tight">Usuários</h1><p className="text-muted-foreground">Gerencie perfis, cargos, permissões e usuários do sistema.</p></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-green-600">{message}</p>}
    <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Usuários cadastrados</CardTitle><CardDescription className="text-xs">Atualização em tempo real: a lista só consulta novamente quando há mudança ou presença.</CardDescription></CardHeader><CardContent>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{users.map(user => <div key={user.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">@{user.username} - {user.cargoUsuario || roleLabel[user.role] || user.role}</p></div><span title={user.online ? "Online" : "Offline"} className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${user.online ? "bg-green-500" : "bg-slate-300"}`} /></div><p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">{user.online ? <Wifi className="h-3 w-3 text-green-600" /> : <WifiOff className="h-3 w-3" />}{offlineText(user)}</p>{isAdmin && <div className="mt-2 flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => beginEdit(user)}><Pencil className="mr-1 h-3 w-3" />Editar perfil</Button><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void toggleActive(user)}>{user.isActive ? "Desativar" : "Ativar"}</Button><Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDeleteUser(user)}><Trash2 className="mr-1 h-3 w-3" />Excluir</Button></div>}</div>)}</div>}</CardContent></Card>
    {isAdmin && editUser && <Card><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="flex items-center gap-2 text-base"><Pencil className="h-4 w-4" /> Editar perfil: {editUser.name}</CardTitle><CardDescription className="text-xs">O administrador pode alterar cargo, tipo de acesso, vínculo, usuário e senha.</CardDescription></div><Button type="button" variant="ghost" size="icon" onClick={() => setEditUser(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent><form onSubmit={saveEdit} className="grid gap-3 md:grid-cols-3"><div className="space-y-1"><Label className="text-xs">Nome de exibição</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Nome de usuário</Label><Input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Nova senha (opcional)</Label><Input type="password" minLength={4} value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Mínimo 4 caracteres" /></div><div className="space-y-1"><Label className="text-xs">Cargo / perfil</Label><Input value={editForm.cargoUsuario} onChange={e => setEditForm({ ...editForm, cargoUsuario: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Tipo de acesso</Label><select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}><option value="USER">Usuário</option><option value="MANAGER">Gestor</option><option value="ADMIN">Administrador</option></select></div><div className="space-y-1"><Label className="text-xs">Funcionário / motorista</Label><select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={editForm.funcionarioId} onChange={e => setEditForm({ ...editForm, funcionarioId: e.target.value })}><option value="">Não vincular</option>{funcionarios.filter(f => f.status === "ATIVO").map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div><div className="flex gap-2 md:col-span-3"><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar perfil</Button><Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button></div></form></CardContent></Card>}
    {isAdmin && <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Cadastrar usuário</CardTitle><CardDescription className="text-xs">A senha deve ter no mínimo 4 caracteres. As permissões de botões são liberadas depois no Painel.</CardDescription></CardHeader><CardContent><form onSubmit={createUser} className="grid gap-3 md:grid-cols-3"><div className="space-y-1"><Label className="text-xs">Nome de exibição</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Nome de usuário</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Senha</Label><Input type="password" minLength={4} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Cargo / perfil</Label><Input placeholder="Vendedor, Motorista, Eletricista..." value={form.cargoUsuario} onChange={e => setForm({ ...form, cargoUsuario: e.target.value })} required /></div><div className="space-y-1"><Label className="text-xs">Tipo de acesso</Label><select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="USER">Usuário</option><option value="MANAGER">Gestor</option><option value="ADMIN">Administrador</option></select></div><div className="space-y-1"><Label className="text-xs">Funcionário / motorista</Label><select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.funcionarioId} onChange={e => setForm({ ...form, funcionarioId: e.target.value })}><option value="">Não vincular</option>{funcionarios.filter(f => f.status === "ATIVO").map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></div><div className="md:col-span-3"><p className="mb-2 text-xs font-medium">Permissões iniciais de páginas</p><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{PERMISSION_KEYS.map(key => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={permissions[`${key}.visualizar`] === true} onChange={e => setPermissions({ ...permissions, [`${key}.visualizar`]: e.target.checked })} />{PERMISSION_LABELS[key]}</label>)}</div></div><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cadastrar usuário</Button></form></CardContent></Card>}
    <AdminPasswordModal open={Boolean(deleteUser)} onOpenChange={open => !open && setDeleteUser(null)} onConfirm={confirmDelete} title="Excluir usuário" description={`Digite a senha de um administrador para excluir ${deleteUser?.name || "este usuário"}.`} />
  </div>;
}
