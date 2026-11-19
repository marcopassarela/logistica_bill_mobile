const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const resultado = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*)::int AS total_itens,
      COUNT("notaFiscalData")::int AS total_com_pdf,
      COUNT(*) FILTER (
        WHERE "notaFiscalData" LIKE 'gzip+base64:%'
      )::int AS total_compactados,
      COUNT(*) FILTER (
        WHERE "notaFiscalData" LIKE 'data:application/pdf;base64,%'
      )::int AS total_base64,
      COUNT(*) FILTER (
        WHERE "notaFiscalData" IS NOT NULL
          AND "notaFiscalData" NOT LIKE 'gzip+base64:%'
          AND "notaFiscalData" NOT LIKE 'data:application/pdf;base64,%'
      )::int AS total_formato_desconhecido
    FROM "CarregamentoItem";
  `);

  console.log(JSON.stringify(resultado, null, 2));
}

main()
  .catch((error) => {
    console.error("Erro ao consultar os PDFs:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
