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

export async function getOnlineUserIds(): Promise<Set<string> | null> {
  try {
    const ably = getAblyClient();
    if (!ably) return null;

    const presence = ably.channels.get("logistica-global").presence;
    const onlineUserIds = new Set<string>();
    let page: Awaited<ReturnType<typeof presence.get>> | null = await presence.get();

    while (page) {
      for (const member of page.items) {
        if (member.clientId) onlineUserIds.add(member.clientId);
      }
      page = await page.next();
    }

    return onlineUserIds;
  } catch (error) {
    console.error("Falha ao consultar usuários online no Ably:", error);
    return null;
  }
}
