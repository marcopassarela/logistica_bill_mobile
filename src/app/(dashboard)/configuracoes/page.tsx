"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { User, Lock, Palette, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("admin");
  const [name, setName] = useState("Administrador");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"profile" | "password" | null>(null);

  function requestSave(action: "profile" | "password") {
    setPendingAction(action);
    setAdminModalOpen(true);
  }

  async function handleAdminConfirm(password: string) {
    if (password.length < 6) return false;
    // Em produção: chamar API que valida senha ADM e aplica a alteração
    console.log("Alteração confirmada:", pendingAction);
    setPendingAction(null);
    return true;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Perfil, segurança e preferências. Alterações sensíveis exigem senha do administrador.
        </p>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
          <CardDescription>Altere seu nome de usuário e nome de exibição</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome de usuário</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={() => requestSave("profile")}>Salvar perfil</Button>
        </CardContent>
      </Card>

      {/* Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Alterar senha
          </CardTitle>
          <CardDescription>Use uma senha forte. Hash Argon2id no servidor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button onClick={() => requestSave("password")}>Alterar senha</Button>
        </CardContent>
      </Card>

      {/* Tema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Aparência
          </CardTitle>
          <CardDescription>Escolha entre tema claro, escuro ou sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <Button
                key={t}
                variant={theme === t ? "default" : "outline"}
                onClick={() => setTheme(t)}
              >
                {t === "light" ? "Claro" : t === "dark" ? "Escuro" : "Sistema"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Segurança info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Senhas armazenadas com Argon2id (memoryCost 64MB, timeCost 3)</p>
          <p>• Sessões com JWT + token no banco e cookie HttpOnly</p>
          <p>• Exclusões e edições sensíveis exigem senha do administrador</p>
          <p>• Sem requisições desnecessárias — dados atualizados sob demanda / foco da janela</p>
        </CardContent>
      </Card>

      <AdminPasswordModal
        open={adminModalOpen}
        onOpenChange={setAdminModalOpen}
        onConfirm={handleAdminConfirm}
        title="Confirmar alteração"
        description="Digite a senha do administrador para aplicar esta alteração."
      />
    </div>
  );
}
