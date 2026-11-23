"use client";


import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User, CheckCircle2, KeyRound } from "lucide-react";
import { getOrCreateDeviceKey, signDeviceChallenge } from "@/lib/device-crypto";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showActivation, setShowActivation] = useState(true);
  const [activationCode, setActivationCode] = useState("");
  const [activationError, setActivationError] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationPhase, setActivationPhase] = useState<"idle" | "validating" | "success">("idle");
  const [activationBlockedUntil, setActivationBlockedUntil] = useState<number | null>(null);
  const [activationRemainingSeconds, setActivationRemainingSeconds] = useState(0);
  const [activationAttempts, setActivationAttempts] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const [slowConnection, setSlowConnection] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(false);
  const requestLock = useRef(false);

  async function refreshActivationStatus(silent = false) {
    try {
      const response = await fetch("/api/devices/activation-status", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok && response.status !== 429) {
        throw new Error(data.error || "Falha ao consultar o status.");
      }

      setActivationAttempts(data.attempts ?? 0);
      setActivationBlockedUntil(data.blockedUntil ?? null);
      setActivationRemainingSeconds(
        data.blockedUntil
          ? Math.max(0, data.blockedUntil - Math.floor(Date.now() / 1000))
          : 0
      );
    } catch {
      if (!silent) {
        setActivationError("Não foi possível consultar o status de ativação.");
      }
    }
  }

  useEffect(() => {
    if (!showActivation) return;
    void refreshActivationStatus();
  }, [showActivation]);

  useEffect(() => {
    if (!activationBlockedUntil) return;

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        activationBlockedUntil - Math.floor(Date.now() / 1000)
      );

      setActivationRemainingSeconds(remaining);

      if (remaining === 0) {
        window.clearInterval(interval);
        void refreshActivationStatus();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activationBlockedUntil]);


  async function handleActivation() {
    if (activationLoading || (activationBlockedUntil !== null && activationBlockedUntil > Math.floor(Date.now() / 1000))) return;

    setActivationError("");
    setActivationLoading(true);
    setActivationPhase("validating");

    try {
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

      if (!challengeResponse.ok) {
        throw new Error(challengeData.error || "Não foi possível iniciar a ativação.");
      }

      const signed = await signDeviceChallenge(challengeData.challenge);

      const response = await fetch("/api/devices/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activationCode.trim().toUpperCase(),
          publicKey: signed.publicKey,
          challenge: challengeData.challenge,
          signature: signed.signature,
        }),
        cache: "no-store",
      });

      const data = await response.json();

      await refreshActivationStatus(true);

      if (!response.ok) {
        if (response.status === 429 && data.blockedUntil) {
          setActivationBlockedUntil(data.blockedUntil);
          setActivationRemainingSeconds(
            Math.max(0, data.blockedUntil - Math.floor(Date.now() / 1000))
          );
        }

        if (typeof data.attempts === "number") setActivationAttempts(data.attempts);
        throw new Error(data.error || "Não foi possível ativar este dispositivo.");
      }

      setActivationPhase("success");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));

      if (data.identity?.type === "VISITOR") {
        setIsNavigating(true);
        router.push("/dashboard");
        return;
      }

      setActivationCode("");
      setShowActivation(false);
      setActivationPhase("idle");

      if (data.identity?.username) {
        setUsername(data.identity.username);
      }
    } catch (activationFailure) {
      setActivationPhase("idle");
      setActivationError(
        activationFailure instanceof Error
          ? activationFailure.message
          : "Erro ao ativar o dispositivo. Tente novamente."
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

      let response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: loginController.signal,
      });

      let data = await response.json();

      if (
        response.status === 403 &&
        data.error === "Ative este dispositivo antes de entrar."
      ) {
        const device = await getOrCreateDeviceKey();

        const challengeResponse = await fetch("/api/devices/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: device.publicKey,
            purpose: "LOGIN",
          }),
          signal: loginController.signal,
        });

        const challengeData = await challengeResponse.json();

        if (!challengeResponse.ok) {
          if (challengeResponse.status === 401) {
            setError("Este dispositivo ainda não foi ativado. Use a opção 'Ativar dispositivo'.");
            return;
          }

          setError(challengeData.error || "Não foi possível validar o dispositivo.");
          return;
        }

        const signed = await signDeviceChallenge(challengeData.challenge);

        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            publicKey: signed.publicKey,
            challenge: challengeData.challenge,
            signature: signed.signature,
          }),
          signal: loginController.signal,
        });

        data = await response.json();
      }

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
    <motion.div initial={false} animate={{ opacity: isNavigating ? 0 : 1 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="light flex min-h-screen items-center justify-center bg-gradient-to-br from-[#02040a] via-[#10264a] to-[#02040a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
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
            {showActivation ? (
              <div className="space-y-4">
                <div className="text-center">
                  <KeyRound className="mx-auto mb-2 h-9 w-9 text-primary" />
                  <h2 className="text-lg font-semibold">Ativar dispositivo</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Informe a chave de ativação fornecida pelo administrador.
                  </p>
                </div>

                {activationPhase === "validating" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-6"
                  >
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm font-medium">Validando dispositivo...</p>
                  </motion.div>
                ) : activationPhase === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-6 text-center"
                  >
                    <CheckCircle2 className="h-14 w-14 text-green-500" />
                    <p className="font-semibold text-green-600">
                      Chave ativada com sucesso!
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="activationCode">Código de ativação</Label>
                      <Input
                        id="activationCode"
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                        placeholder="LB-XXXX-XXXX-..."
                        autoComplete="off"
                        className="login-input-field text-center font-mono tracking-wider"
                        disabled={activationLoading || (activationBlockedUntil !== null && activationBlockedUntil > Math.floor(Date.now() / 1000))}
                      />
                    </div>

                    {activationAttempts > 0 && (
                      <p className="text-center text-xs text-muted-foreground">
                        Tentativas inválidas: {activationAttempts} de 5
                      </p>
                    )}

                    {activationRemainingSeconds > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                        <p className="text-sm font-medium text-destructive">
                          Muitas tentativas. Aguarde para tentar novamente.
                        </p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-destructive">
                          {String(Math.floor(activationRemainingSeconds / 60)).padStart(2, "0")}:{String(activationRemainingSeconds % 60).padStart(2, "0")}
                        </p>
                      </div>
                    )}

                    {activationError && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-sm text-destructive"
                      >
                        {activationError}
                      </motion.p>
                    )}

                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={handleActivation}
                      disabled={!activationCode.trim() || activationLoading || (activationBlockedUntil !== null && activationBlockedUntil > Math.floor(Date.now() / 1000))}
                    >
                      {activationLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Ativar dispositivo
                    </Button>
                  </>
                )}
              </div>
            ) : (
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
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setActivationError("");
                  setActivationPhase("idle");
                  setShowActivation(true);
                }}
                disabled={loading}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Ativar dispositivo
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Logísticas Bill — Todos os direitos reservados
        </p>
      </motion.div>
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
      )}    </motion.div>
  );
}





