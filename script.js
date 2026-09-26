// ---------- Datos históricos aproximados (fecha, oficial, paralelo) ----------
const historicalData = [
  {d:"2011-11", of:6.96, pa:6.96},
  {d:"2013-01", of:6.96, pa:6.96},
  {d:"2015-01", of:6.96, pa:6.96},
  {d:"2017-01", of:6.96, pa:6.96},
  {d:"2019-01", of:6.96, pa:6.96},
  {d:"2020-01", of:6.96, pa:6.96},
  {d:"2021-01", of:6.96, pa:6.96},
  {d:"2022-01", of:6.96, pa:6.96},
  {d:"2023-01", of:6.96, pa:6.96},
  {d:"2023-06", of:6.96, pa:6.98},
  {d:"2023-09", of:6.96, pa:7.20},
  {d:"2023-12", of:6.96, pa:7.50},
  {d:"2024-03", of:6.96, pa:8.00},
  {d:"2024-06", of:6.96, pa:8.60},
  {d:"2024-08", of:6.96, pa:15.60},
  {d:"2024-10", of:6.96, pa:11.20},
  {d:"2024-12", of:6.96, pa:10.00},
  {d:"2025-02", of:6.96, pa:11.00},
  {d:"2025-03", of:6.96, pa:12.00},
  {d:"2025-04", of:6.96, pa:15.00},
  {d:"2025-06", of:6.96, pa:19.00},
  {d:"2025-07", of:6.96, pa:17.00},
  {d:"2025-09", of:6.96, pa:12.40},
  {d:"2025-11", of:7.89, pa:10.20},
  {d:"2025-12", of:8.55, pa:9.60},
  {d:"2026-02", of:9.50, pa:10.50},
  {d:"2026-04", of:10.50, pa:11.50},
  {d:"2026-06", of:11.30, pa:11.80},
  {d:"2026-09", of:12.06, pa:12.32},
];

// Valores de referencia por defecto (fallback si las APIs en vivo fallan)
let current = { oficial: 12.06, paralelo: 12.32 };

function fmtBs(n){
  return "Bs " + n.toLocaleString("es-BO", {minimumFractionDigits:2, maximumFractionDigits:2});
}

function updateCards(){
  document.getElementById("cardOficial").textContent = fmtBs(current.oficial);
  document.getElementById("cardParalelo").textContent = fmtBs(current.paralelo);
  const brecha = ((current.paralelo - current.oficial) / current.oficial) * 100;
  document.getElementById("cardBrecha").textContent = (brecha >= 0 ? "+" : "") + brecha.toFixed(1) + "%";
  updateConverter();
}

function updateConverter(){
  const amount = parseFloat(document.getElementById("amount").value) || 0;
  const type = document.getElementById("rateType").value;
  const rate = type === "oficial" ? current.oficial : current.paralelo;
  document.getElementById("convResult").textContent = fmtBs(amount * rate);
}
document.getElementById("amount").addEventListener("input", updateConverter);
document.getElementById("rateType").addEventListener("change", updateConverter);

// ---------- Cotizaciones en vivo: BCB (oficial) + paralelo.bo (paralelo) ----------
async function fetchLiveRates(showStatus){
  const status = document.getElementById("fetchStatus");
  if(showStatus) status.textContent = "Consultando BCB y paralelo.bo...";

  let oficialOk = false, paraleloOk = false;

  // 1) Tipo de cambio oficial (BCB), vía API independiente CUCU
  try{
    const res = await fetch("https://apibcb.cucu.bo/api/v1/tc/oficial");
    const data = await res.json();
    if(data && data.tc_oficial && typeof data.tc_oficial.compra === "number"){
      current.oficial = data.tc_oficial.compra; // TCO = tipo de cambio oficial de compra
      oficialOk = true;
    }
  }catch(err){ /* se mantiene el valor de referencia */ }

  // 2) Dólar paralelo, vía paralelo.bo
  try{
    const res = await fetch("https://paralelo.bo/api/v1/rate");
    const data = await res.json();
    if(data && typeof data.median === "number"){
      current.paralelo = data.median;
      paraleloOk = true;
    }
  }catch(err){ /* se mantiene el valor de referencia */ }

  updateCards();

  if(oficialOk && paraleloOk){
    status.textContent = "Cotizaciones en vivo: oficial " + fmtBs(current.oficial) +
      " (fuente: BCB vía apibcb.cucu.bo) · paralelo " + fmtBs(current.paralelo) +
      " (fuente: paralelo.bo).";
  } else if(oficialOk || paraleloOk){
    status.textContent = "Se actualizó parcialmente (una de las dos fuentes no respondió). Se mantiene el valor de referencia para la otra.";
  } else {
    status.textContent = "No se pudo conectar con las APIs en vivo (red bloqueada o caída). Se mantienen los valores de referencia (sept/2026).";
  }
}

document.getElementById("fetchBtn").addEventListener("click", () => fetchLiveRates(true));

// ---------- Gráfico SVG hecho a mano (sin librerías externas) ----------
function renderChart(data){
  const width = 800, height = 320;
  const margin = { top: 20, right: 20, bottom: 36, left: 46 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const allValues = data.flatMap(p => [p.of, p.pa]);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.1);
  const minVal = 0;
  const n = data.length;
  const xStep = n > 1 ? innerW / (n - 1) : 0;

  const xPos = i => margin.left + i * xStep;
  const yPos = v => margin.top + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;

  const ticks = 5;
  let gridLines = "", yLabels = "";
  for(let t=0; t<=ticks; t++){
    const val = minVal + (maxVal - minVal) * t / ticks;
    const y = yPos(val);
    gridLines += `<line x1="${margin.left}" y1="${y}" x2="${width-margin.right}" y2="${y}" stroke="#1c283f" stroke-width="1"/>`;
    yLabels += `<text x="${margin.left-8}" y="${y+4}" fill="#93a1bd" font-size="11" text-anchor="end">${val.toFixed(1)}</text>`;
  }

  const labelEvery = Math.max(1, Math.ceil(n / 8));
  let xLabels = "";
  data.forEach((p,i) => {
    if(i % labelEvery === 0 || i === n-1){
      xLabels += `<text x="${xPos(i)}" y="${height-margin.bottom+18}" fill="#93a1bd" font-size="10" text-anchor="middle">${p.d}</text>`;
    }
  });

  function buildLine(key, color){
    const points = data.map((p,i) => `${xPos(i)},${yPos(p[key])}`).join(" ");
    const circles = data.map((p,i) =>
      `<circle cx="${xPos(i)}" cy="${yPos(p[key])}" r="3.2" fill="${color}"><title>${p.d}: Bs ${p[key].toFixed(2)}</title></circle>`
    ).join("");
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"/>${circles}`;
  }

  const svg = `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${gridLines}
      ${buildLine("of", "#4fb0ff")}
      ${buildLine("pa", "#ff9f4f")}
      ${yLabels}
      ${xLabels}
    </svg>`;

  document.getElementById("chartContainer").innerHTML = svg;
}

document.querySelectorAll(".range-btns button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btns button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const range = btn.dataset.range;
    let filtered = historicalData;
    if(range !== "all"){
      const yearLimit = range === "2025" ? "2025-01" : range + "-01";
      filtered = historicalData.filter(p => p.d >= yearLimit);
    }
    renderChart(filtered);
  });
});

// ---------- Inicio ----------
updateCards();          // muestra valores de referencia al instante
renderChart(historicalData);
fetchLiveRates(false);  // intenta traer datos reales apenas carga la página, sin bloquear la vista inicial