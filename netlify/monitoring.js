const BLYNK_AUTH_TOKEN = process.env.BLYNK_AUTH_TOKEN;

const BLYNK_API_URL =
  process.env.BLYNK_API_URL ||
  "https://blynk.cloud/external/api/get";

const REQUEST_TIMEOUT_MS = 5000;

async function readVirtualPin(pin) {
  if (!BLYNK_AUTH_TOKEN) {
    throw new Error("BLYNK_AUTH_TOKEN belum diatur.");
  }

  const url = new URL(BLYNK_API_URL);
  url.search = `token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}&${pin}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Blynk HTTP ${response.status}`);
    }

    const body = await response.text();

    let result;
    try {
      result = JSON.parse(body);
    } catch {
      result = body.trim();
    }

    if (Array.isArray(result) && result.length === 1) {
      result = result[0];
    }

    const value = Number(result);

    if (
      result === "" ||
      result === null ||
      result === undefined ||
      !Number.isFinite(value)
    ) {
      throw new Error(`Data ${pin} tidak valid.`);
    }

    return value;
  } finally {
    clearTimeout(timeout);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Allow": "GET" },
      body: JSON.stringify({ error: "Metode tidak diizinkan." })
    };
  }

  try {
    const [temperature, humidity] = await Promise.all([
      readVirtualPin("V0"),
      readVirtualPin("V1")
    ]);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        temperature,
        humidity,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error("Gagal membaca Blynk:", error.message);

    return {
      statusCode: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        error: "Koneksi ke Blynk terputus."
      })
    };
  }
};