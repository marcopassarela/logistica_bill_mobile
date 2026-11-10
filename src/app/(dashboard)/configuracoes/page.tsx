"use client";

import { ScreenAssembly } from "@/components/layout/ScreenAssembly";
import { Skeleton } from "@/components/ui/skeleton";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { User, Lock, Palette, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

type Action = "profile" | "password";
type Profile = { id: string; username: string; name: string; role: string; theme: string | null };

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pageError, setPageError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch("/api/auth/profile", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar o perfil.");
      const profile = data as Profile;
      setUsername(profile.username);
      setName(profile.name);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Erro ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function requestSave(action: Action) {
    setMessage("");
    setPageError("");
    if (action === "profile") {
      if (username.trim().length < 3 || name.trim().length < 2) {
        setPageError("Informe um usuário com pelo menos 3 caracteres e um nome com pelo menos 2.");
        return;
      }
    } else {
      if (!currentPassword) {
        setPageError("Informe sua senha atual.");
        return;
      }
      if (newPassword.length < 8) {
        setPageError("A nova senha deve ter pelo menos 8 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPageError("A nova senha e a confirmação não coincidem.");
        return;
      }
      if (currentPassword === newPassword) {
        setPageError("A nova senha precisa ser diferente da senha atual.");
        return;
      }
    }
    setPendingAction(action);
    setAdminModalOpen(true);
  }

  async function handleAdminConfirm(adminPassword: string) {
    if (!pendingAction) throw new Error("Nenhuma alteração selecionada.");
    setSaving(true);
    try {
      const body = pendingAction === "profile"
        ? { action: "profile", username: username.trim(), name: name.trim(), adminPassword }
        : { action: "password", currentPassword, newPassword, adminPassword };

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar as alterações.");

      if (pendingAction === "profile" && data.user) {
        setUsername(data.user.username);
        setName(data.user.name);
        setMessage("Perfil atualizado com sucesso.");
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setMessage("Senha alterada com sucesso.");
      }
      setPendingAction(null);

      if (pendingAction === "password") {
        window.location.replace("/login");
      }

      return true;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Perfil, segurança e preferências. Alterações sensíveis exigem senha do administrador.</p>
      </div>

      {loading && <div role="status" aria-label="Carregando configurações" aria-busy="true" className="space-y-3"><Skeleton className="h-4 w-48" /><Skeleton className="h-10 w-full max-w-md" /></div>}
      {pageError && <p role="alert" className="text-sm text-destructive">{pageError}</p>}
      {message && <p role="status" className="text-sm text-green-600">{message}</p>}

      <ScreenAssembly className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Perfil</CardTitle>
          <CardDescription>Altere seu nome de usuário e nome de exibição.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome de usuário</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={loading || saving} />
          </div>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading || saving} />
          </div>
          <Button onClick={() => requestSave("profile")} disabled={loading || saving}>Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" /> Alterar senha</CardTitle>
          <CardDescription>A nova senha deve ter pelo menos 8 caracteres.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input type="password" autoComplete="current-password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} disabled={saving} />
          </div>
          <Button onClick={() => requestSave("password")} disabled={saving}>Alterar senha</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Aparência</CardTitle>
          <CardDescription>Escolha entre tema claro, escuro ou sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button key={t} variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>
                {t === "light" ? "Claro" : t === "dark" ? "Escuro" : "Sistema"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Segurança</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p> Senhas armazenadas com Argon2id.</p>
          <p> Sessões com JWT e cookie HttpOnly.</p>
          <p> Alterações sensíveis validadas no servidor.</p>
        </CardContent>
      </Card>
      </ScreenAssembly>

      <AdminPasswordModal open={adminModalOpen} onOpenChange={setAdminModalOpen}
        onConfirm={handleAdminConfirm} title="Confirmar alteração"
        description="Digite a senha de um administrador ativo para aplicar esta alteração." />
    </div>
  );
}
