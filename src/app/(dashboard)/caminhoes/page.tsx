"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Truck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

const mockCaminhoes = [
  { id: "1", placa: "ABC-1D23", marca: "Volvo", modelo: "FH 540", ano: 2022, capacidadeKg: 28000, status: "LIBERADO", tipo: "Carreta" },
  { id: "2", placa: "XYZ-9K87", marca: "Scania", modelo: "R450", ano: 2021, capacidadeKg: 30000, status: "CARREGANDO", tipo: "Bitrem" },
  { id: "3", placa: "DEF-4M56", marca: "Mercedes", modelo: "Actros", ano: 2020, capacidadeKg: 25000, status: "EM_ROTA", tipo: "Truck" },
  { id: "4", placa: "GHI-2P11", marca: "DAF", modelo: "XF", ano: 2023, capacidadeKg: 27000, status: "CARREGADO", tipo: "Carreta" },
];

const statusMap: Record<string, { label: string; variant: "success" | "default" | "warning" | "secondary" }> = {
  LIBERADO: { label: "Liberado", variant: "success" },
  CARREGANDO: { label: "Carregando", variant: "default" },
  CARREGADO: { label: "Carregado", variant: "secondary" },
  EM_ROTA: { label: "Em Rota", variant: "warning" },
  MANUTENCAO: { label: "Manutenção", variant: "warning" },
};

export default function CaminhoesPage() {
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = mockCaminhoes.filter(
    (c) =>
      c.placa.toLowerCase().includes(search.toLowerCase()) ||
      c.marca?.toLowerCase().includes(search.toLowerCase()) ||
      c.modelo?.toLowerCase().includes(search.toLowerCase())
  );

  async function confirmDelete(password: string) {
    // Em produção: chamar API que verifica senha ADM e exclui
    const res = await fetch("/api/auth/verify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    // Por enquanto simula sucesso se senha não vazia
    if (password.length >= 6) {
      console.log("Excluir caminhão", selectedId);
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caminhões</h1>
          <p className="text-muted-foreground">Cadastro profissional de frota</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Caminhão
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por placa, marca, modelo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c, i) => {
          const st = statusMap[c.status] || statusMap.LIBERADO;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-mono">{c.placa}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {c.marca} {c.modelo}
                      </p>
                    </div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Ano</span>
                      <p className="font-medium">{c.ano}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo</span>
                      <p className="font-medium">{c.tipo}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Capacidade</span>
                      <p className="font-medium">{(c.capacidadeKg / 1000).toFixed(1)} t</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedId(c.id);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
        title="Excluir Caminhão"
        description="Esta ação é irreversível. Digite a senha do administrador para confirmar."
      />
    </div>
  );
}
