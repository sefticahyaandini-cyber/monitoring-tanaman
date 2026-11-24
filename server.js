const express = require("express");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT || 3000);
const authToken = process.env.BLYNK_AUTH_TOKEN;
const allowedFrontendOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const blynkApiUrl = new URL(
  process.env.BLYNK_API_URL || "https://blynk.cloud/external/api/get"
);
const requestTimeoutMs = 5000;

if (!authToken || authToken === "replace_with_your_blynk_auth_token") {
  console.error("BLYNK_AUTH_TOKEN belum diatur. Isi nilainya di file .env.");
  process.exit(1);
}

if (blynkApiUrl.protocol !== "https:") {
  console.error("BLYNK_API_URL harus menggunakan HTTPS.");
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT harus berupa angka antara 1 dan 65535.");
  process.exit(1);
}

async function readVirtualPin(pin) {
  const url = new URL(blynkApiUrl);
  url.search = `token=${encodeURIComponent(authToken)}&${pin}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Blynk mengembalikan HTTP ${response.status} untuk ${pin}.`);
    }

    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      result = body.trim();
    }

    if (Array.isArray(result) && result.length === 1) result = result[0];
    if ((typeof result !== "number" && typeof result !== "string") || String(result).trim() === "") {
      throw new Error(`Respons Blynk untuk ${pin} tidak berisi angka.`);
    }

    const value = Number(result);
    if (!Number.isFinite(value)) {
      throw new Error(`Respons Blynk untuk ${pin} bukan angka yang valid.`);
    }
    return value;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Permintaan Blynk ${pin} melewati batas waktu.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

app.disable("x-powered-by");

app.use("/api", (request, response, next) => {
  const origin = request.get("Origin");
  if (!origin) return next();
  if (!allowedFrontendOrigins.has(origin)) {
    return response.status(403).json({ error: "Origin tidak diizinkan." });
  }

  response.set({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  });
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.get("/api/sensor", async (request, response) => {
  response.set("Cache-Control", "no-store");
  try {
    const [temperature, humidity] = await Promise.all([
      readVirtualPin("V0"),
      readVirtualPin("V1")
    ]);

    response.json({
      temperature,
      humidity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Gagal membaca sensor dari Blynk:", error.message);
    response.status(503).json({ error: "Koneksi ke Blynk terputus." });
  }
});

const publicPaths = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/config.js",
  "/app.js",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/sw.js"
]);
const serveStatic = express.static(path.resolve(__dirname), {
  dotfiles: "deny",
  index: "index.html"
});

app.use((request, response, next) => {
  if (!publicPaths.has(request.path)) return response.sendStatus(404);
  serveStatic(request, response, next);
});

app.listen(port, () => {
  console.log(`Kebun berjalan di http://localhost:${port}`);
});
