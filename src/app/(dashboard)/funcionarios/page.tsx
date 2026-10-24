"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";

const mock = [
  { id: "1", nome: "João Silva", cargo: "Motorista", status: "ATIVO", telefone: "(11) 99999-1111" },
  { id: "2", nome: "Maria Oliveira", cargo: "Ajudante", status: "ATIVO", telefone: "(11) 98888-2222" },
  { id: "3", nome: "Carlos Souza", cargo: "Motorista", status: "AFASTADO", telefone: "(11) 97777-3333" },
  { id: "4", nome: "Ana Costa", cargo: "Supervisor", status: "ATIVO", telefone: "(11) 96666-4444" },
];

export default function FuncionariosPage() {
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const filtered = mock.filter((f) =>
    f.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground">Cadastro de funcionários e cargos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Gerenciar Cargos</Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar funcionário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((f) => (
          <Card key={f.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{f.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground">{f.cargo}</p>
                </div>
              </div>
              <Badge variant={f.status === "ATIVO" ? "success" : "warning"}>
                {f.status}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{f.telefone}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AdminPasswordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={async (p) => p.length >= 6}
        title="Excluir Funcionário"
      />
    </div>
  );
}
