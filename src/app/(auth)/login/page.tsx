"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [slowConnection, setSlowConnection] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(false);
  const requestLock = useRef(false);
  const startupStageDurations = useRef<number[]>([3, 3, 3, 3]);
  const startupProgressMilestones = useRef<number[][]>([]);
  const loadingSteps = [
    { title: "Inicializando banco de dados", description: "Estabelecendo uma conexão segura com o banco." },
    { title: "Preparando as ferramentas", description: "Organizando os serviços necessários para o sistema." },
    { title: "Validando acesso seguro", description: "Aguardando a validação das credenciais." },
    { title: "Abrindo o Logísticas Bill", description: "Finalizando a preparação para acessar o painel." },
  ];

  useEffect(() => {
    if (!loading || !showStartupModal) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 0.25);
    }, 250);

    return () => window.clearInterval(timer);
  }, [loading, showStartupModal]);

  async function checkDatabase(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

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

    const randomizedDurations = [3, 3, 3, 3];
    for (let i = 0; i < 4; i++) {
      randomizedDurations[Math.floor(Math.random() * 4)]++;
    }
    startupStageDurations.current = randomizedDurations;

    startupProgressMilestones.current = Array.from({ length: 4 }, () => {
      const values = new Set<number>();

      while (values.size < 7) {
        values.add(Math.floor(Math.random() * 93) + 5);
      }

      return [...values].sort((a, b) => a - b).concat(100);
    });

    setError("");
    setLoading(true);
    setSlowConnection(false);
    setShowStartupModal(false);
    setElapsedSeconds(0);

    let keepModalOpen = false;
    let loginController: AbortController | null = null;
    let loginTimeoutId: number | undefined;

    const date = new Date();
    const today =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const storageKey = "logisticas-bill-startup-date";

    let firstAccessToday = true;

    try {
      firstAccessToday = localStorage.getItem(storageKey) !== today;
    } catch {
      firstAccessToday = true;
    }

    let mustShowModal = firstAccessToday;

    if (mustShowModal) {
      setShowStartupModal(true);
    }

    try {
      let databaseReady = await checkDatabase();

      if (!databaseReady) {
        mustShowModal = true;
        setShowStartupModal(true);
      }

      if (mustShowModal) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < 46000) {
          const elapsed = Date.now() - startedAt;

          if (elapsed >= 16000) {
            databaseReady = await checkDatabase();

            if (databaseReady) break;
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 1000);
          });
        }

        if (!databaseReady || Date.now() - startedAt < 16000) {
          keepModalOpen = true;
          setShowStartupModal(true);
          setSlowConnection(true);
          setError(
            "O banco de dados do Layerbase continua indisponível. Tente novamente."
          );
          return;
        }
      }

      loginController = new AbortController();
      loginTimeoutId = window.setTimeout(
        () => loginController?.abort(),
        30000
      );

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: loginController.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Credenciais inválidas");
        return;
      }

      try {
        localStorage.setItem(storageKey, today);
      } catch {
        // Se o navegador bloquear o armazenamento, o modal poderá
        // reaparecer no próximo acesso. O login continua normalmente.
      }

      router.push("/dashboard");
      router.refresh();
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
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
                    className="pl-9"
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
                    className="pl-9"
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
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Logísticas Bill — Todos os direitos reservados
        </p>
      </motion.div>
      {(showStartupModal || slowConnection) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-md"
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
                <div className="mb-5 flex items-center justify-center gap-2 text-blue-300">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Preparando seu ambiente de trabalho</span>
                </div>

                <div className="space-y-5">
                  {loadingSteps.map((step, index) => {
                    const stageDurations = startupStageDurations.current;
                    const startAt = stageDurations
                      .slice(0, index)
                      .reduce((total, duration) => total + duration, 0);
                    const duration = stageDurations[index];
                    const stageElapsed = Math.max(0, elapsedSeconds - startAt);
                    const completed = elapsedSeconds >= startAt + duration;
                    const active = !completed && elapsedSeconds >= startAt;
                    const stageProgress = Math.min(1, stageElapsed / duration);
                    const milestones = startupProgressMilestones.current[index] ??
                      [5, 25, 30, 60, 77, 80, 95, 100];
                    const milestoneIndex = Math.min(
                      7,
                      Math.floor(stageProgress * 8)
                    );
                    const progress = completed
                      ? 100
                      : active
                        ? milestones[milestoneIndex]
                        : 0;

                    return (
                      <div key={step.title} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              completed
                                ? "bg-emerald-500/20 text-emerald-300"
                                : active
                                  ? "bg-blue-500/20 text-blue-300"
                                  : "bg-white/5 text-slate-500"
                            }`}
                          >
                            {completed ? "✓" : index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm font-medium ${active || completed ? "text-white" : "text-slate-500"}`}>
                                {step.title}
                              </p>
                              <span className="shrink-0 text-xs tabular-nums text-slate-400">
                                {completed ? "100%" : `${Math.round(progress)}%`}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              {step.description}
                            </p>
                          </div>
                        </div>
                        <div
                          className="ml-11 h-2 overflow-hidden rounded-full bg-white/10"
                          role="progressbar"
                          aria-label={step.title}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={completed ? 100 : Math.round(progress)}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                              completed ? "bg-emerald-400" : "bg-blue-500"
                            }`}
                            style={{ width: `${completed ? 100 : progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-6 text-center text-xs text-slate-400">
                  {elapsedSeconds < 16
                    ? "Aguarde enquanto preparamos cada etapa."
                    : "Preparação concluída."}
                </p>
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
      )}    </div>
  );
}
