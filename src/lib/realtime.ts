import { createHttpClient } from "@ably/pubsub-server";

type AblyHttpClient = ReturnType<typeof createHttpClient>;

const globalForAbly = globalThis as typeof globalThis & {
  __logisticaAbly?: AblyHttpClient;
};

function getAblyClient(): AblyHttpClient | null {
  const apiKey = process.env.ABLY_API_KEY;

  if (!apiKey) {
    console.error("ABLY_API_KEY não configurada.");
    return null;
  }

  if (!globalForAbly.__logisticaAbly) {
    globalForAbly.__logisticaAbly = createHttpClient({ key: apiKey });
  }

  return globalForAbly.__logisticaAbly;
}

async function publish(event: string, data: Record<string, unknown>) {
  try {
    const ably = getAblyClient();
    if (!ably) return;

    await ably.channels.get("logistica-global").publish(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Falha ao publicar evento em tempo real:", error);
  }
}

export function publishDataChanged(...modules: string[]) {
  return publish("data:changed", { modules });
}

export function publishAuthInvalidated() {
  return publish("auth:invalidate", {
    reason: "password_changed",
  });
}
