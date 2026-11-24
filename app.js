const temperatureValue = document.querySelector("#temperature-value");
const humidityValue = document.querySelector("#humidity-value");
const temperatureStatus = document.querySelector("#temperature-status");
const humidityStatus = document.querySelector("#humidity-status");
const updatedAt = document.querySelector("#updated-at");
const connectionLabel = document.querySelector("#connection-label");
const chart = document.querySelector("#sensor-chart");
const chartLine = document.querySelector("#chart-line");
const chartArea = document.querySelector("#chart-area");
const chartPoints = document.querySelector("#chart-points");
const chartGrid = document.querySelector("#chart-grid");
const chartYLabels = document.querySelector("#chart-y-labels");
const chartXLabels = document.querySelector("#chart-x-labels");
const chartCurrent = document.querySelector("#chart-current");
const legendLabel = document.querySelector("#legend-label");
const installButton = document.querySelector("#install-button");
const connectionState = document.querySelector(".connection-state");
const apiBaseUrl = (
  window.KebunConfig && typeof window.KebunConfig.apiBaseUrl === "string"
    ? window.KebunConfig.apiBaseUrl
    : ""
).replace(/\/+$/, "");

const history = [];
let activeSeries = "temperature";
let installPrompt;
let polling = false;
let pollTimer;

function setConnectionStatus(status) {
  const labels = {
    checking: "Menghubungkan ke Blynk...",
    connected: "Terhubung ke Blynk",
    disconnected: "Koneksi terputus"
  };
  connectionLabel.textContent = labels[status];
  connectionState.classList.toggle("checking", status === "checking");
  connectionState.classList.toggle("offline", status === "disconnected");
}

function currentReading(series) {
  return history[history.length - 1][series];
}

function updateReadingCards() {
  const temperature = currentReading("temperature");
  const humidity = currentReading("humidity");
  temperatureValue.textContent = temperature.toFixed(1);
  humidityValue.textContent = Math.round(humidity);
  temperatureStatus.textContent = temperature >= 20 && temperature <= 30 ? "Dalam rentang ideal" : "Perlu diperhatikan";
  humidityStatus.textContent = humidity >= 50 && humidity <= 80 ? "Dalam rentang ideal" : "Perlu diperhatikan";
  temperatureStatus.parentElement.classList.toggle("warning", !(temperature >= 20 && temperature <= 30));
  humidityStatus.parentElement.classList.toggle("warning", !(humidity >= 50 && humidity <= 80));
  updatedAt.textContent = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(history[history.length - 1].time);
}

function makeSvgElement(name, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function renderChart() {
  const isTemperature = activeSeries === "temperature";
  const values = history.map((entry) => entry[activeSeries]);
  const min = isTemperature ? 20 : 40;
  const max = isTemperature ? 35 : 90;
  const left = 44;
  const right = 744;
  const top = 14;
  const bottom = 210;
  const x = (index) => values.length === 1
    ? (left + right) / 2
    : left + (index / (values.length - 1)) * (right - left);
  const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const points = values.map((value, index) => [x(index), y(value)]);

  chartGrid.replaceChildren();
  chartYLabels.replaceChildren();
  chartXLabels.replaceChildren();
  chartPoints.replaceChildren();

  for (let index = 0; index <= 4; index += 1) {
    const position = top + (index / 4) * (bottom - top);
    const label = max - (index / 4) * (max - min);
    chartGrid.append(makeSvgElement("line", { x1: left, y1: position, x2: right, y2: position }));
    const text = makeSvgElement("text", { x: 0, y: position + 3 });
    text.textContent = isTemperature ? `${label.toFixed(0)}°` : `${label.toFixed(0)}%`;
    chartYLabels.append(text);
  }

  if (history.length === 0) {
    chartLine.setAttribute("d", "");
    chartArea.setAttribute("d", "");
    chartCurrent.textContent = "—";
    legendLabel.textContent = isTemperature ? "Suhu (°C)" : "Kelembapan (%)";
    chart.setAttribute("aria-label", `Grafik menunggu data ${isTemperature ? "suhu" : "kelembapan"}`);
    const label = makeSvgElement("text", { x: (left + right) / 2, y: 242, "text-anchor": "middle" });
    label.textContent = "Menunggu data";
    chartXLabels.append(label);
    return;
  }

  const tickCount = Math.min(5, history.length);
  const tickIndexes = Array.from({ length: tickCount }, (_, index) =>
    Math.round(index * (history.length - 1) / Math.max(1, tickCount - 1))
  );
  tickIndexes.forEach((index) => {
    const label = makeSvgElement("text", { x: x(index), y: 242,     "text-anchor": index === 0 ? "start" : index === history.length - 1 ? "end" : "middle" });
    const secondsAgo = Math.round((history[history.length - 1].time - history[index].time) / 1000);
    label.textContent = secondsAgo === 0 ? "sekarang" : `−${secondsAgo} dtk`;
    chartXLabels.append(label);
  });

  const path = points.map(([pointX, pointY], index) => `${index === 0 ? "M" : "L"} ${pointX} ${pointY}`).join(" ");
  chartLine.setAttribute("d", path);
  chartArea.setAttribute("d", `${path} L ${right} ${bottom} L ${left} ${bottom} Z`);
  points.forEach(([pointX, pointY], index) => {
    if (index === points.length - 1 || index % 3 === 0) {
      chartPoints.append(makeSvgElement("circle", { cx: pointX, cy: pointY, r: index === points.length - 1 ? 5 : 3.5, class: "chart-point" }));
    }
  });

  const value = currentReading(activeSeries);
  legendLabel.textContent = isTemperature ? "Suhu (°C)" : "Kelembapan (%)";
  chartCurrent.textContent = isTemperature ? `${value.toFixed(1)} °C` : `${Math.round(value)}%`;
  chart.setAttribute("aria-label", `Grafik riwayat ${isTemperature ? "suhu" : "kelembapan"}`);
  chartLine.setAttribute("stroke", isTemperature ? "#d28c65" : "#6da779");
  chartArea.setAttribute("fill", isTemperature ? "#fbefe8" : "#eaf4eb");
  chartPoints.querySelectorAll("circle").forEach((point) => point.setAttribute("stroke", isTemperature ? "#d28c65" : "#6da779"));
}

function addReading(reading) {
  history.push(reading);
  if (history.length > 12) history.shift();
  updateReadingCards();
  renderChart();
}

document.querySelectorAll(".series-button").forEach((button) => {
  button.addEventListener("click", () => {
    activeSeries = button.dataset.series;
    document.querySelectorAll(".series-button").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderChart();
  });
});

async function pollSensor() {
  if (polling) return;
  polling = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/sensor`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Backend mengembalikan HTTP ${response.status}`);

    const data = await response.json();
    const temperature = data.temperature;
    const humidity = data.humidity;
    const time = new Date(data.timestamp);
    if (
      typeof temperature !== "number" ||
      typeof humidity !== "number" ||
      !Number.isFinite(temperature) ||
      !Number.isFinite(humidity) ||
      !Number.isFinite(time.getTime())
    ) {
      throw new Error("Format data sensor dari backend tidak valid");
    }

    setConnectionStatus("connected");
    addReading({ temperature, humidity, time });
  } catch (error) {
    setConnectionStatus("disconnected");
    if (history.length === 0) {
      temperatureStatus.textContent = "Menunggu koneksi...";
      humidityStatus.textContent = "Menunggu koneksi...";
    } else {
      temperatureStatus.textContent = "Data terakhir";
      humidityStatus.textContent = "Data terakhir";
    }
    console.error("Gagal mengambil data sensor:", error);
  } finally {
    polling = false;
    pollTimer = window.setTimeout(pollSensor, 2000);
  }
}

window.addEventListener("online", () => {
  if (pollTimer) window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(pollSensor, 0);
});

window.addEventListener("offline", () => setConnectionStatus("disconnected"));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker gagal didaftarkan:", error);
    });
  });
}

setConnectionStatus("checking");
renderChart();
pollSensor();
