"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

type EntregaItem = {
  id: string;
  descricaoLivre?: string | null;
  ordemServico?: string | null;
  clienteNome?: string | null;
  clienteCidade?: string | null;
  clienteBairro?: string | null;
  adicionais?: { id: string; descricao: string }[];
};

type EntregaCarregamento = {
  id: string;
  destino?: string | null;
  motorista?: { id: string; nome: string } | null;
  caminhao?: { placa: string } | null;
};

type Props = {
  open: boolean;
  item: EntregaItem | null;
  carregamento: EntregaCarregamento | null;
  onClose: () => void;
  onSuccess: (itemId: string) => void;
};

const MAX_BYTES = 350 * 1024;

export function ConfirmarEntregaModal({
  open,
  item,
  carregamento,
  onClose,
  onSuccess,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  function pararCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraAtiva(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => {
    if (!open) {
      pararCamera();
      setFoto(null);
      setPreview(null);
      setObservacao("");
      setErro("");
      setCarregando(false);
      setEnviando(false);
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!cameraAtiva) return;

    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) return;

    video.srcObject = stream;

    const iniciarReproducao = () => {
      video.play().catch(() => {
        setErro("Nao foi possivel iniciar a imagem da camera. Tente novamente.");
      });
    };

    video.onloadedmetadata = iniciarReproducao;

    if (video.readyState >= 1) {
      iniciarReproducao();
    }

    return () => {
      video.onloadedmetadata = null;
      video.pause();
      video.srcObject = null;
    };
  }, [cameraAtiva]);
  async function ativarCamera() {
    setErro("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador não oferece acesso à câmera.");
      }

      pararCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1200 },
          height: { ideal: 1600 },
          aspectRatio: { ideal: 0.75 },
        },
      });

      streamRef.current = stream;


      setCameraAtiva(true);
    } catch (error) {
      pararCamera();
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível acessar a câmera."
      );
    }
  }

  async function gerarWebP(
    canvas: HTMLCanvasElement,
    qualidade: number
  ): Promise<Blob> {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (resultado) => {
          if (resultado) resolve(resultado);
          else reject(new Error("Não foi possível processar a fotografia."));
        },
        "image/webp",
        qualidade
      );
    });

    const assinatura = new Uint8Array(
      await blob.slice(0, 12).arrayBuffer()
    );

    const valido =
      blob.type.toLowerCase() === "image/webp" &&
      assinatura[0] === 0x52 &&
      assinatura[1] === 0x49 &&
      assinatura[2] === 0x46 &&
      assinatura[3] === 0x46 &&
      assinatura[8] === 0x57 &&
      assinatura[9] === 0x45 &&
      assinatura[10] === 0x42 &&
      assinatura[11] === 0x50;

    if (!valido) {
      throw new Error("O navegador não gerou uma imagem WebP válida. Atualize o navegador ou tente outro dispositivo.");
    }

    return blob;
  }
  async function capturarFoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setErro("A câmera ainda não está pronta.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Não foi possível processar a imagem.");
      }

      const proporcaoAlvo = 3 / 4;
      let sx = 0;
      let sy = 0;
      let larguraFonte = video.videoWidth;
      let alturaFonte = video.videoHeight;

      if (video.videoWidth / video.videoHeight > proporcaoAlvo) {
        larguraFonte = video.videoHeight * proporcaoAlvo;
        sx = (video.videoWidth - larguraFonte) / 2;
      } else {
        alturaFonte = video.videoWidth / proporcaoAlvo;
        sy = (video.videoHeight - alturaFonte) / 2;
      }

      const maiorLadoOriginal = Math.max(larguraFonte, alturaFonte);
      const resolucoes = [1600, 1400, 1200, 1000, 900, 800, 700, 600, 500, 400, 320];
      const qualidades = [0.82, 0.74, 0.66, 0.58, 0.50, 0.42, 0.35, 0.30, 0.25, 0.20, 0.15, 0.12];

      let fotoFinal: Blob | null = null;

      for (const limiteResolucao of resolucoes) {
        const proporcao = Math.min(
          1,
          limiteResolucao / maiorLadoOriginal
        );

        canvas.width = Math.round(larguraFonte * proporcao);
        canvas.height = Math.round(alturaFonte * proporcao);

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          video,
          sx,
          sy,
          larguraFonte,
          alturaFonte,
          0,
          0,
          canvas.width,
          canvas.height
        );

        for (const qualidade of qualidades) {
          const blob = await gerarWebP(canvas, qualidade);

          if (blob.size <= MAX_BYTES) {
            fotoFinal = blob;
            break;
          }
        }

        if (fotoFinal) break;
      }

      if (!fotoFinal || fotoFinal.size > MAX_BYTES) {
        throw new Error(
          "Não foi possível reduzir a fotografia para 350 KB. Tente capturar novamente."
        );
      }

      setFoto(fotoFinal);
      setPreview(URL.createObjectURL(fotoFinal));
      pararCamera();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao capturar a fotografia."
      );
    } finally {
      setCarregando(false);
    }
  }
  async function confirmarEntrega() {
    if (!item || !foto) {
      setErro("A fotografia é obrigatória para concluir a entrega.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const formData = new FormData();
      formData.append(
        "file",
        new File([foto], "comprovante.webp", { type: "image/webp" })
      );
      formData.append("observacao", observacao.trim());

      const response = await fetch(
        `/api/entregas/${encodeURIComponent(item.id)}/comprovante`,
        {
          method: "POST",
          body: formData,
        }
      );

      const resultado = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          resultado.error || `Não foi possível concluir (HTTP ${response.status}).`
        );
      }

      pararCamera();
      onSuccess(item.id);
      onClose();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao enviar o comprovante."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!open || !item || !carregamento) return null;

  const endereco = [
    item.clienteBairro,
    item.clienteCidade,
    carregamento.destino,
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(" - ");

  return (
    <div
      className="fixed inset-0 z-[10001] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      {cameraAtiva ? (
        <div
          className="fixed inset-0 z-[10002] flex flex-col bg-black text-white"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-center justify-between px-5 py-4">
            <span className="font-semibold">Fotografar entrega</span>
            <button
              type="button"
              onClick={pararCamera}
              aria-label="Fechar câmera"
              className="rounded-full bg-white/15 p-3"
            >
              <X className="h-6 w-6" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>

          <footer className="flex flex-col items-center gap-3 px-5 pb-8 pt-5">
            <p className="text-center text-sm text-white/80">
              Enquadre o comprovante e toque para fotografar
            </p>
            <Button
              type="button"
              disabled={carregando}
              onClick={() => void capturarFoto()}
              className="h-16 w-16 rounded-full border-4 border-white bg-white text-black hover:bg-gray-200"
            >
              {carregando ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </Button>
          </footer>
        </div>
      ) : (      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmar-entrega"
        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Camera className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="titulo-confirmar-entrega" className="font-bold">
              Finalizar entrega
            </h2>
            <p className="text-xs text-muted-foreground">
              Fotografia obrigatória como comprovante
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Fechar"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[calc(100dvh-9rem)] space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="font-semibold">{item.clienteNome || "Não informado"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Ordem de serviço</p>
              <p className="font-medium">{item.ordemServico || "—"}</p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Produto adquirido</p>
              <p className="font-medium">{item.descricaoLivre || "Não informado"}</p>
              {item.adicionais?.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Adicionais: {item.adicionais.map((a) => a.descricao).join(", ")}
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Endereço / destino</p>
              <p className="font-medium">{endereco || "Não informado"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Motorista</p>
              <p className="font-medium">{carregamento.motorista?.nome || "—"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Caminhão</p>
              <p className="font-medium">{carregamento.caminhao?.placa || "—"}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Comprovante fotográfico</p>
              {foto && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Comprovante carregado
                </span>
              )}
            </div>

            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview}
                  alt="Pré-visualização do comprovante"
                  className="max-h-72 w-full rounded-xl border bg-black object-contain"
                />
                <p className="text-center text-xs text-muted-foreground">
                  {(foto!.size / 1024).toFixed(0)} KB · WebP
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => {
                    setFoto(null);
                    setPreview(null);
                    void ativarCamera();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Tirar outra fotografia
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {cameraAtiva ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="mx-auto aspect-[3/4] max-h-[65vh] w-full rounded-xl bg-black object-cover"
                    />
                    <Button
                      type="button"
                      className="w-full"
                      disabled={carregando}
                      onClick={() => void capturarFoto()}
                    >
                      {carregando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      Capturar fotografia
                    </Button>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <Camera className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Ative a câmera para fotografar o comprovante da entrega.
                    </p>
                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() => void ativarCamera()}
                    >
                      <Camera className="h-4 w-4" />
                      Ativar câmera
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="observacao-entrega" className="mb-2 block text-sm font-medium">
              Observação (opcional)
            </label>
            <textarea
              id="observacao-entrega"
              value={observacao}
              onChange={(event) => setObservacao(event.target.value)}
              maxLength={2000}
              rows={3}
              disabled={enviando}
              placeholder="Ex.: entregue ao responsável no local..."
              className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {erro && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {erro}
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={!foto || enviando || carregando}
            onClick={() => void confirmarEntrega()}
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando comprovante...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar conclusão
              </>
            )}
          </Button>
        </div>
      </section>
      )}
    </div>
  );
}
