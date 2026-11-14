
import { PrismaClient } from "@prisma/client";
import { compressPdfBytes } from "../src/lib/pdf-storage";

const prisma = new PrismaClient();

async function main() {
  const itens = await prisma.carregamentoItem.findMany({
    where: { notaFiscalData: { not: null } },
    select: { id: true, notaFiscalData: true, notaFiscalNome: true },
  });

  let compactados = 0;
  let ignorados = 0;
  let bytesAntes = 0;
  let bytesDepois = 0;

  for (const item of itens) {
    const original = item.notaFiscalData;

    if (!original) {
      ignorados++;
      continue;
    }

    try {
      const compactado = compressPdfBytes(original);

      if (!compactado) {
        ignorados++;
        continue;
      }

      if (Buffer.from(original).subarray(0, 2).toString("hex") === "1f8b") {
        ignorados++;
        continue;
      }

      bytesAntes += original.byteLength;
      bytesDepois += compactado.byteLength;

      await prisma.carregamentoItem.update({
        where: { id: item.id },
        data: { notaFiscalData: compactado },
      });

      compactados++;
      console.log(`Compactado: ${item.notaFiscalNome || item.id}`);
    } catch (error) {
      console.error(`Ignorado por formato inválido: ${item.notaFiscalNome || item.id}`, error);
    }
  }

  const economia = bytesAntes > 0
    ? ((1 - bytesDepois / bytesAntes) * 100).toFixed(1)
    : "0.0";

  console.log(`Concluído. Compactados: ${compactados}; ignorados: ${ignorados}.`);
  console.log(`Tamanho antes: ${bytesAntes} bytes; depois: ${bytesDepois} bytes; economia aproximada: ${economia}%.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
