"use client";

import { pdfjs } from "react-pdf";
import { jsPDF } from "jspdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/**
 * Cria uma cópia de compartilhamento independente das fontes do PDF original.
 * O PDF original permanece inalterado; esta cópia usa páginas renderizadas em
 * alta resolução para funcionar nos previews de Android, iPhone e desktop.
 */
export async function criarPdfUniversalParaCompartilhar(
  bytes: ArrayBuffer,
  nomeArquivo: string
): Promise<File> {
  const documento = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let pdf: jsPDF | null = null;

  try {
    for (let paginaNumero = 1; paginaNumero <= documento.numPages; paginaNumero += 1) {
      const pagina = await documento.getPage(paginaNumero);
      const escala = 2.5;
      const viewport = pagina.getViewport({ scale: escala });
      const canvas = document.createElement("canvas");
      const contexto = canvas.getContext("2d", { alpha: false });
      if (!contexto) throw new Error("Não foi possível preparar o PDF para compartilhar.");

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, canvas.width, canvas.height);

      await pagina.render({ canvasContext: contexto, viewport }).promise;

      const larguraPt = viewport.width / escala;
      const alturaPt = viewport.height / escala;
      if (!pdf) {
        pdf = new jsPDF({ unit: "pt", format: [larguraPt, alturaPt], compress: true });
      } else {
        pdf.addPage([larguraPt, alturaPt]);
      }

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.96),
        "JPEG",
        0,
        0,
        larguraPt,
        alturaPt,
        undefined,
        "FAST"
      );
      canvas.width = 1;
      canvas.height = 1;
      pagina.cleanup();
    }

    if (!pdf) throw new Error("O PDF não contém páginas para compartilhar.");
    const blob = pdf.output("blob");
    const nome = nomeArquivo.toLowerCase().endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`;
    return new File([blob], nome, { type: "application/pdf", lastModified: Date.now() });
  } finally {
    await documento.destroy();
  }
}
