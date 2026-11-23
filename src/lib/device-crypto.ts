const DB_NAME = "logisticas-bill-security";
const STORE_NAME = "device-keys";
const DEVICE_KEY_ID = "primary";

type StoredDeviceKey = {
  id: string;
  privateKey: CryptoKey;
  publicKey: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function toBase64(bytes: ArrayBuffer): string {
  const array = new Uint8Array(bytes);
  let binary = "";

  for (let i = 0; i < array.length; i += 0x8000) {
    binary += String.fromCharCode(...array.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

async function readStoredKey(): Promise<StoredDeviceKey | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DEVICE_KEY_ID);

    request.onsuccess = () => {
      resolve((request.result as StoredDeviceKey | undefined) ?? null);
    };

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("A leitura da chave do dispositivo foi cancelada."));
    };
  });
}

async function saveStoredKey(key: StoredDeviceKey): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(key);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      const error = transaction.error;
      db.close();
      reject(error);
    };

    transaction.onabort = () => {
      const error = transaction.error;
      db.close();
      reject(error);
    };
  });
}

export async function getOrCreateDeviceKey(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error("Este navegador n�o oferece suporte � seguran�a do dispositivo.");
  }

  const stored = await readStoredKey();

  if (stored) {
    if (
      stored.privateKey.type !== "private" ||
      stored.privateKey.extractable ||
      stored.privateKey.algorithm.name !== "ECDSA" ||
      !stored.privateKey.usages.includes("sign") ||
      (stored.privateKey.algorithm as EcKeyAlgorithm).namedCurve !== "P-256"
    ) {
      throw new Error("A chave de seguran�a armazenada � inv�lida.");
    }

    return {
      publicKey: stored.publicKey,
      privateKey: stored.privateKey,
    };
  }

  const generated = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );

  const publicKeyDer = await crypto.subtle.exportKey(
    "spki",
    generated.publicKey,
  );

  const privateKeyDer = await crypto.subtle.exportKey(
    "pkcs8",
    generated.privateKey,
  );

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDer,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false,
    ["sign"],
  );

  new Uint8Array(privateKeyDer).fill(0);

  const publicKey = toBase64(publicKeyDer);

  await saveStoredKey({
    id: DEVICE_KEY_ID,
    privateKey,
    publicKey,
  });

  return { publicKey, privateKey };
}

export async function signDeviceChallenge(
  challenge: string,
): Promise<{
  publicKey: string;
  signature: string;
}> {
  const device = await getOrCreateDeviceKey();

  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    device.privateKey,
    new TextEncoder().encode(challenge),
  );

  return {
    publicKey: device.publicKey,
    signature: toBase64(signature),
  };
}