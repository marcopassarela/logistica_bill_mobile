"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateDeviceKey, signDeviceChallenge } from "@/lib/device-crypto";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User, KeyRound, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const [slowConnection, setSlowConnection] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(false);
  const requestLock = useRef(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");

  const [activationOpen, setActivationOpen] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [activationSuccess, setActivationSuccess] = useState(false);

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotErr("");
    setForgotMsg("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUsername, email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotErr(data.error || "Não foi possível enviar o e-mail.");
        return;
      }
      setForgotMsg(data.message || "Se os dados estiverem corretos, o e-mail foi enviado.");
    } catch {
      setForgotErr("Erro de conexão. Tente novamente.");
    } finally {
      setForgotLoading(false);
    }
  }



  async function activateDevice(e: React.FormEvent) {
    e.preventDefault();

    if (activationLoading) return;

    setActivationError("");
    setActivationSuccess(false);
    const verificationStartedAt = Date.now();

    setActivationLoading(true);

    try {
      const code = activationCode.trim().toUpperCase();

      if (!/^LB-(?:[A-F0-9]{4}-){9}[A-F0-9]{4}$/.test(code)) {
        throw new Error("Informe uma chave de ativação válida.");
      }

      const device = await getOrCreateDeviceKey();

      const challengeResponse = await fetch("/api/devices/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: device.publicKey,
          purpose: "ACTIVATE",
        }),
        cache: "no-store",
      });

      const challengeData = await challengeResponse.json();

      if (!challengeResponse.ok || !challengeData.challenge) {
        throw new Error(challengeData.error || "Não foi possível iniciar a validação do dispositivo.");
      }

      const signed = await signDeviceChallenge(challengeData.challenge);

      const response = await fetch("/api/devices/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          publicKey: signed.publicKey,
          challenge: challengeData.challenge,
          signature: signed.signature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível ativar este dispositivo.");
      }

      const elapsed = Date.now() - verificationStartedAt;
      const remaining = Math.max(0, 2000 - elapsed);

      if (remaining > 0) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, remaining)
        );
      }

      setActivationSuccess(true);
      setActivationCode("");

      await new Promise<void>((resolve) => window.setTimeout(resolve, 1800));

      setActivationOpen(false);
      setActivationSuccess(false);
    } catch (err) {
      setActivationError(
        err instanceof Error ? err.message : "Erro ao ativar o dispositivo."
      );
    } finally {
      setActivationLoading(false);
    }
  }
  async function checkDatabase(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/health/database", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data?.ok === true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function performLogin() {
    if (requestLock.current) return;

    requestLock.current = true;

    setError("");
    setLoading(true);
    setSlowConnection(false);
    setShowStartupModal(false);

    let keepModalOpen = false;
    let loginController: AbortController | null = null;
    let loginTimeoutId: number | undefined;

    try {
      let databaseReady = await checkDatabase();
      if (!databaseReady) setShowStartupModal(true);

      loginController = new AbortController();
      loginTimeoutId = window.setTimeout(
        () => loginController?.abort(),
        30000
      );

      const loginPayload: {
        username: string;
        password: string;
        publicKey?: string;
        challenge?: string;
        signature?: string;
      } = { username, password };

      try {
        const device = await getOrCreateDeviceKey();

        const challengeResponse = await fetch("/api/devices/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: device.publicKey,
            purpose: "LOGIN",
          }),
          cache: "no-store",
          signal: loginController.signal,
        });

        const challengeData = await challengeResponse.json();

        if (challengeResponse.ok && challengeData.challenge) {
          const signed = await signDeviceChallenge(challengeData.challenge);

          loginPayload.publicKey = signed.publicKey;
          loginPayload.challenge = challengeData.challenge;
          loginPayload.signature = signed.signature;
        }
      } catch {
        // Administradores podem entrar sem autorização de dispositivo.
        // Usuários comuns serão recusados pelo backend se não estiverem autorizados.
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginPayload),
        signal: loginController.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Credenciais inválidas");
        return;
      }

      setIsNavigating(true);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
      router.push("/dashboard");
    } catch {
      if (loginController?.signal.aborted) {
        keepModalOpen = true;
        setShowStartupModal(true);
        setSlowConnection(true);
        setError("O login demorou demais. Verifique a conexão e tente novamente.");
      } else {
        setError("Erro de conexão. Tente novamente.");
      }
    } finally {
      if (loginTimeoutId !== undefined) {
        window.clearTimeout(loginTimeoutId);
      }

      requestLock.current = false;
      setLoading(false);

      if (!keepModalOpen) {
        setShowStartupModal(false);
      }
    }
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin();
  }
  return (
    <div className="light flex min-h-screen items-center justify-center bg-gradient-to-br from-[#02040a] via-[#10264a] to-[#02040a] p-4">
      <div className="w-full max-w-md"
      >
        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto relative h-16 w-16 overflow-hidden rounded-2xl bg-primary shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logísticas Bill"
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const parent = el.parentElement;
                  if (parent && !parent.querySelector(".fb")) {
                    const s = document.createElement("span");
                    s.className = "fb flex h-full w-full items-center justify-center text-2xl font-bold text-primary-foreground";
                    s.textContent = "LB";
                    parent.appendChild(s);
                  }
                }}
              />
            </div>
            <div>
              <CardTitle className="text-2xl">Logísticas Bill</CardTitle>
              <CardDescription className="mt-1">
                Sua plataforma de gestão logística.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usuário"
                    className="pl-9 login-input-field focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha"
                    className="pl-9 login-input-field focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive text-center"
                >
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 text-center text-sm font-semibold text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline dark:text-blue-300"
                  onClick={() => {
                    setActivationOpen(true);
                    setActivationError("");
                    setActivationSuccess(false);
                  }}
                >
                  <KeyRound className="h-4 w-4" />
                  Ativar dispositivo
                </button>
                <button
                  type="button"
                  className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => { setForgotOpen(true); setForgotMsg(""); setForgotErr(""); }}
                >
                  Esqueci minha senha
                </button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Logísticas Bill — Todos os direitos reservados
        </p>
      </div>
      {(showStartupModal || slowConnection) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connection-title"
        >
          <div className="my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl sm:p-8">
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
                <img
                  src="/logo.png"
                  alt="Logo Logísticas Bill"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Logísticas Bill</h1>
              <p className="mt-2 text-sm text-slate-300">
                Sua plataforma de gestão logística.
              </p>
            </div>

            {loading ? (
  <>
    <style>{`
      @keyframes loading-arc {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes loading-bar {
        0%   { transform: scaleX(0); }
        8%   { transform: scaleX(0.12); }
        14%  { transform: scaleX(0.12); }
        22%  { transform: scaleX(0.28); }
        28%  { transform: scaleX(0.28); }
        38%  { transform: scaleX(0.45); }
        44%  { transform: scaleX(0.45); }
        55%  { transform: scaleX(0.62); }
        62%  { transform: scaleX(0.62); }
        74%  { transform: scaleX(0.78); }
        80%  { transform: scaleX(0.78); }
        92%  { transform: scaleX(0.92); }
        100% { transform: scaleX(1); }
      }
      @keyframes loading-dots {
        0%, 20% { content: ""; }
        40% { content: "."; }
        60% { content: ".."; }
        80%, 100% { content: "..."; }
      }
      .loading-dots::after {
        content: "";
        display: inline-block;
        width: 1.2em;
        text-align: left;
        animation: loading-dots 1.5s steps(1, end) infinite;
      }
      .loading-arc {
        animation: loading-arc 3.0s linear infinite;
        will-change: transform;
      }
      .loading-bar {
        transform: scaleX(0);
        transform-origin: left center;
        animation: loading-bar 20s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        will-change: transform;
      }
    `}</style>

    <div className="flex flex-col items-center justify-center text-center select-none">
{/* Círculo estilo cometa */}
<div className="relative mb-10 h-48 w-48">
  {/* anel de fundo bem discreto (quase invisível) */}
  <div className="absolute inset-0 rounded-full border-[20px] border-white/5" />

  {/* arco estilo cometa */}
  <div 
    className="loading-arc absolute inset-0 rounded-full"
    style={{
      background: "conic-gradient(from 0deg, transparent 0deg 240deg, rgba(163,163,163,0.15) 270deg, rgba(229,229,229,0.4) 300deg, rgba(255,255,255,0.75) 330deg, #ffffff 360deg)",
      maskImage: "radial-gradient(farthest-side, transparent calc(100% - 20px), black calc(100% - 20px))",
      WebkitMaskImage: "radial-gradient(farthest-side, transparent calc(100% - 20px), black calc(100% - 20px))",
    }}
  />
</div>

      {/* Texto LOADING... */}
      <h2 className="text-lg font-medium tracking-[0.35em] text-white/90">
        LOADING<span className="loading-dots"></span>
      </h2>

      {/* Barra linear */}
      <div className="mt-10 w-full max-w-xs">
        <div className="h-[15px] overflow-hidden rounded-full bg-white/10">
          <div className="loading-bar h-full rounded-full bg-gradient-to-r from-neutral-400 via-white to-neutral-300" />
        </div>
      </div><p className="mt-8 text-[10px] tracking-[0.25em] text-white/25">
        AGUARDE ENQUANTO O SISTEMA É INICIALIZADO.
      </p>
    </div>
  </>
) : (
              <div className="py-3 text-center">
                <h2 id="connection-title" className="text-lg font-semibold">
                  A conexão está demorando mais que o esperado
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  As etapas de preparação foram concluídas, mas não recebemos uma resposta a tempo.
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  type="button"
                  className="mt-6 w-full"
                  onClick={performLogin}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {activationOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border bg-background p-6 text-foreground shadow-2xl"
          >
            {activationSuccess ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 motion-safe:animate-pulse"
                >
                  <ShieldCheck className="h-10 w-10 motion-safe:animate-bounce" />
                </div>
                <h2 className="text-xl font-semibold text-emerald-600">
                  Chave ativada com sucesso!
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Este dispositivo foi autorizado para sua conta.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Ativar dispositivo</h2>
                    <p className="text-sm text-muted-foreground">
                      Informe a chave fornecida pelo administrador.
                    </p>
                  </div>
                </div>

                <form onSubmit={activateDevice} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activation-code">Chave de ativação</Label>
                    <Input
                      id="activation-code"
                      value={activationCode}
                      onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                      placeholder="LB-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      required
                      disabled={activationLoading}
                      className="font-mono tracking-wider"
                    />
                  </div>

                  {activationError && (
                    <p className="text-sm text-destructive" role="alert">
                      {activationError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={activationLoading}
                      onClick={() => setActivationOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={activationLoading || !activationCode.trim()}
                    >
                      {activationLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {activationLoading ? "Verificando chave..." : "Ativar"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 text-foreground shadow-lg">
            <h2 className="text-lg font-semibold">Recuperar senha</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe o usuário e o e-mail cadastrados. Enviaremos um link válido por 30 minutos.
            </p>
            <form onSubmit={submitForgot} className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Nome de usuário</Label>
                <Input value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>E-mail cadastrado</Label>
                <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
              </div>
              {forgotErr && <p className="text-sm text-destructive">{forgotErr}</p>}
              {forgotMsg && <p className="text-sm text-emerald-600">{forgotMsg}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setForgotOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando…" : "Enviar link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}





