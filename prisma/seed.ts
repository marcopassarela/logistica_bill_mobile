import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash("admin123", {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      name: "Administrador",
      role: "ADMIN",
    },
  });

  console.log("Admin criado:", admin.username);
  console.log("Senha padrão: admin123 — TROQUE IMEDIATAMENTE após o primeiro login!");

  // Cargos
  const motorista = await prisma.cargo.upsert({
    where: { nome: "Motorista" },
    update: {},
    create: { nome: "Motorista", descricao: "Condutor de veículos de carga" },
  });

  await prisma.cargo.upsert({
    where: { nome: "Ajudante" },
    update: {},
    create: { nome: "Ajudante", descricao: "Auxiliar de carga e descarga" },
  });

  await prisma.cargo.upsert({
    where: { nome: "Supervisor" },
    update: {},
    create: { nome: "Supervisor", descricao: "Supervisão de operações" },
  });

  // Funcionário exemplo
  await prisma.funcionario.upsert({
    where: { cpf: "000.000.000-00" },
    update: {},
    create: {
      nome: "João Silva",
      cpf: "000.000.000-00",
      telefone: "(11) 99999-0000",
      cargoId: motorista.id,
      status: "ATIVO",
    },
  });

  // Caminhão exemplo
  await prisma.caminhao.upsert({
    where: { placa: "ABC1D23" },
    update: {},
    create: {
      placa: "ABC1D23",
      marca: "Volvo",
      modelo: "FH 540",
      ano: 2022,
      capacidadeKg: 28000,
      tipo: "Carreta",
      status: "LIBERADO",
    },
  });

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
