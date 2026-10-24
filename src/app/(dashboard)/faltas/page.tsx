"use client";

import { useState } from "react";
import { Plus, Paperclip, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const mockFaltas = [
  { id: "1", funcionario: "Carlos Souza", data: "2026-10-20", tipo: "ATESTADO", justificativa: "Consulta médica", temAnexo: true },
  { id: "2", funcionario: "João Silva", data: "2026-10-15", tipo: "FALTA", justificativa: null, temAnexo: false },
  { id: "3", funcionario: "Maria Oliveira", data: "2026-10-10", tipo: "FOLGA", justificativa: "Folga programada", temAnexo: false },
  { id: "4", funcionario: "Ana Costa", data: "2026-09-28", tipo: "LICENCA", justificativa: "Licença maternidade", temAnexo: true },
];

const tipoVariant: Record<string, "destructive" | "warning" | "secondary" | "default"> = {
  FALTA: "destructive",
  ATESTADO: "warning",
  FOLGA: "secondary",
  LICENCA: "default",
  OUTRO: "secondary",
};

export default function FaltasPage() {
  const [funcionario, setFuncionario] = useState("");
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("FALTA");
  const [justificativa, setJustificativa] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faltas</h1>
        <p className="text-muted-foreground">
          Controle de faltas, atestados, folgas e licenças com anexo de documentos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Registrar Falta / Ausência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Input
                value={funcionario}
                onChange={(e) => setFuncionario(e.target.value)}
                placeholder="Nome do funcionário"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="FALTA">Falta</option>
                <option value="ATESTADO">Atestado</option>
                <option value="FOLGA">Folga</option>
                <option value="LICENCA">Licença</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Input
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Anexar atestado / documento</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">PDF, JPG ou PNG (máx. 5 MB)</p>
            </div>
            <Button className="w-full">
              <UserX className="mr-2 h-4 w-4" />
              Registrar
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Registros recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mockFaltas.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{f.funcionario}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(f.data)}
                    {f.justificativa ? ` • ${f.justificativa}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {f.temAnexo && (
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Possui anexo" />
                  )}
                  <Badge variant={tipoVariant[f.tipo] || "secondary"}>{f.tipo}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
