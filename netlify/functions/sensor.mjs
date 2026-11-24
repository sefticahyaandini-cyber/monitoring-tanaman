export default async () => {
  const token = process.env.BLYNK_TOKEN;
  const host = process.env.BLYNK_HOST || "blynk.cloud";
  const pinSuhu = (process.env.PIN_SUHU || "v0").toLowerCase();
  const pinLembap = (process.env.PIN_LEMBAP || "v1").toLowerCase();
  const url = `https://${host}/external/api/get?token=${token}&${pinSuhu}&${pinLembap}`;
  const res = await fetch(url);
  if (!res.ok) {
    return Response.json({ error: "Blynk tidak merespons" }, { status: 502 });
  }
  const d = await res.json();
  const temperature = Number(d[pinSuhu]);
  const humidity = Number(d[pinLembap]);
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return Response.json({ error: "Data Blynk tidak valid" }, { status: 502 });
  }
  return Response.json(
    { temperature, humidity, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
};
export const config = { path: "/api/sensor" };
