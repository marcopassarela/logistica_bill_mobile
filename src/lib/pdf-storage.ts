
import { gunzipSync, gzipSync } from "node:zlib";

const PREFIX = "gzip+base64:";
const DATA_URL_PREFIX = "data:application/pdf;base64,";

export function compressPdfDataUrl(
  value: string | null | undefined
): Uint8Array<ArrayBuffer> | null {
  if (!value) return null;

  if (!value.startsWith(DATA_URL_PREFIX)) {
    throw new Error("A nota fiscal deve ser um PDF válido.");
  }

  const pdf = Buffer.from(value.slice(DATA_URL_PREFIX.length), "base64");

  if (pdf.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("A nota fiscal não contém um PDF válido.");
  }

  return Uint8Array.from(gzipSync(pdf, { level: 9 }));
}

export function compressPdfBytes(
  value: Uint8Array | null | undefined
): Uint8Array<ArrayBuffer> | null {
  if (!value) return null;

  const bytes = Buffer.from(value);

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return Uint8Array.from(bytes);
  }

  if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new Error("Arquivo PDF inválido.");
  }

  return Uint8Array.from(gzipSync(bytes, { level: 9 }));
}

export function decodePdf(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = Buffer.from(value);

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return Uint8Array.from(gunzipSync(bytes));
  }

  if (bytes.subarray(0, 4).toString("ascii") === "%PDF") {
    return Uint8Array.from(bytes);
  }

  const legacy = bytes.toString("utf8");

  if (legacy.startsWith(PREFIX)) {
    return Uint8Array.from(
      gunzipSync(Buffer.from(legacy.slice(PREFIX.length), "base64"))
    );
  }

  throw new Error("Arquivo PDF armazenado em formato inválido.");
}
