
"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PDF_OPTIONS = {
  standardFontDataUrl: "/standard_fonts/",
  cMapUrl: "/cmaps/",
  cMapPacked: true,
};

type Props = {
  src: string;
};

export function NotaFiscalPdfViewer({ src }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth || 320);
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    updateWidth();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setError(null);
    setNumPages(0);
    setPageNumber(1);
  }, [src]);

  const pageWidth = Math.max(280, Math.min(containerWidth - 24, 1100));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted">
      {numPages > 0 && (
        <div className="flex shrink-0 items-center justify-center gap-5 border-b bg-background px-3 py-2">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
          >
            Anterior
          </button>

          <span className="text-sm font-medium tabular-nums">
            Página {pageNumber} de {numPages}
          </span>

          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((page) => Math.min(numPages, page + 1))}
          >
            Próxima
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-auto p-3"
      >
        {error ? (
          <div className="mx-auto mt-8 max-w-md rounded-lg border border-red-500/30 bg-background p-4 text-center">
            <p className="text-sm font-medium text-red-600">
              Não foi possível exibir esta nota fiscal.
            </p>
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : (
          <Document
            file={src}
            options={PDF_OPTIONS}
            loading={
              <p className="py-8 text-center text-sm text-muted-foreground">
                Carregando nota fiscal...
              </p>
            }
            onLoadSuccess={(pdf) => {
              setNumPages(pdf.numPages);
              setPageNumber(1);
              setError(null);
            }}
            onLoadError={(reason) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Erro ao carregar o arquivo PDF."
              );
            }}
          >
            <div className="flex justify-center">
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Renderizando página...
                  </p>
                }
              />
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
