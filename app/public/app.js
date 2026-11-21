// Frontend do dashboard. Cada alteração de filtro ou de fonte executa novas consultas no banco escolhido.
const $ = (s) => document.querySelector(s);
const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString("pt-BR"));
const fmtMs = (ms) => (ms < 10 ? ms.toFixed(1) : ms < 1000 ? Math.round(ms) : (ms / 1000).toFixed(1).replace(".", ",") + " s") + (ms < 1000 ? " ms" : "");

const estado = { fonte: "neo4j", metodoMy: "mysql-bfs", cidade: "São Paulo", preset: "todas", k: 6, limite: 150,
  origem: null, destino: null, pontos: [], rota: null, meta: null, vivo: 0 };
const ultimos = { indicadores: {}, porTipo: {}, vizinhos: {}, alcance: {}, rota: {} }; // ms por série, para o gráfico de comparação

const SERIES = { "neo4j": ["Neo4j", "--neo"], "mysql-cte": ["MySQL (SQL puro)", "--sql"], "mysql-bfs": ["MySQL (busca em níveis)", "--bfs"] };
const cor = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const metodoAtual = () => (estado.fonte === "neo4j" ? "neo4j" : estado.metodoMy);
const classeMs = (metodo) => (metodo === "neo4j" ? "neo" : metodo === "mysql-bfs" ? "bfs" : "sql");

const PRINCIPAIS = ["motorway", "trunk", "primary", "secondary", "motorway_link", "trunk_link", "primary_link", "secondary_link"];
const LOCAIS = ["residential", "living_street", "unclassified", "service"];
function tiposAtuais() {
  if (estado.preset === "principais") return PRINCIPAIS;
  if (estado.preset === "locais") return LOCAIS;
  if (estado.preset === "sem-residenciais") return estado.meta.tipos.map((t) => t.tipo).filter((t) => t !== "residential");
  return null;
}

async function api(rota, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ""));
  const r = await fetch("/api/" + rota + "?" + qs);
  return r.json();
}
function status(txt, erro = false) { const s = $("#status"); s.textContent = txt; s.classList.toggle("erro", erro); }
function badge(id, r, metodo) {
  const el = $("#ms-" + id); if (!el) return;
  el.className = "ms " + (r.status === "ok" ? classeMs(metodo) : "erro");
  el.textContent = r.status === "ok" ? `${SERIES[metodo] ? SERIES[metodo][0] : metodo}: ${fmtMs(r.ms)}` : r.status === "timeout" ? "estourou o limite de 30 s" : "erro";
}
function guardarTempo(consulta, metodo, r) { ultimos[consulta][metodo] = r.status === "ok" ? r.ms : r.status === "timeout" ? 30000 : null; atualizarGraficoTempos(); }

// ---------- gráficos ----------
let gTipo, gAlcance, gTempos;
function baseOpcoes() {
  return { responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    plugins: { legend: { labels: { color: cor("--texto") } } },
    scales: { x: { ticks: { color: cor("--suave") }, grid: { color: cor("--borda") } }, y: { ticks: { color: cor("--suave") }, grid: { color: cor("--borda") } } } };
}
function criarGraficos() {
  const o1 = baseOpcoes(); o1.indexAxis = "y"; o1.plugins.legend.display = false;
  o1.plugins.tooltip = { callbacks: { label: (c) => `${fmt(c.parsed.x)} trechos` } };
  gTipo = new Chart($("#g-tipo"), { type: "bar", data: { labels: [], datasets: [{ data: [], backgroundColor: cor("--neo") }] }, options: o1 });
  const o2 = baseOpcoes(); o2.plugins.legend.display = false;
  o2.plugins.tooltip = { callbacks: { label: (c) => `${fmt(c.parsed.y)} interseções` } };
  o2.scales.x.title = { display: true, text: "trechos percorridos", color: cor("--suave") };
  gAlcance = new Chart($("#g-alcance"), { type: "bar", data: { labels: [], datasets: [{ data: [], backgroundColor: cor("--neo") }] }, options: o2 });
  const o3 = baseOpcoes();
  o3.scales.y = { type: "logarithmic", min: 0.5, ticks: { color: cor("--suave") }, grid: { color: cor("--borda") }, title: { display: true, text: "ms (menor é melhor)", color: cor("--suave") } };
  o3.plugins.tooltip = { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw >= 30000 ? "estourou 30 s" : fmtMs(c.raw)}` } };
  gTempos = new Chart($("#g-tempos"), { type: "bar", data: { labels: [], datasets: [] }, options: o3 });
}
const ROTULOS = { indicadores: "Indicadores", porTipo: "Trechos por tipo", vizinhos: "Vias da origem", alcance: "Alcance", rota: "Menor caminho" };
function atualizarGraficoTempos() {
  const consultas = Object.keys(ROTULOS);
  gTempos.data.labels = consultas.map((c) => ROTULOS[c]);
  gTempos.data.datasets = Object.entries(SERIES).map(([m, [nome, v]]) => ({
    label: nome, backgroundColor: cor(v), data: consultas.map((c) => ultimos[c][m] ?? null),
  }));
  gTempos.options.scales.y.type = $("#log").checked ? "logarithmic" : "linear";
  gTempos.options.scales.y.min = $("#log").checked ? 0.5 : 0;
  gTempos.update();
}

// ---------- consultas ----------
async function atualizarIndicadores() {
  const sessao = estado.vivo;
  const r = await api("indicadores", { fonte: estado.fonte, cidade: estado.cidade });
  if (sessao !== estado.vivo) return;
  badge("indicadores", r, estado.fonte === "neo4j" ? "neo4j" : "mysql-cte");
  if (r.status !== "ok") return;
  $("#kpi-intersecoes").textContent = fmt(r.intersecoes);
  $("#kpi-trechos").textContent = fmt(r.trechos);
  $("#kpi-km").textContent = fmt(r.km) + " km";
  $("#kpi-mu").textContent = Math.round((100 * r.mao_unica) / r.trechos) + "%";
  guardarTempo("indicadores", estado.fonte === "neo4j" ? "neo4j" : "mysql-cte", r);
}
async function atualizarPorTipo() {
  const r = await api("porTipo", { fonte: estado.fonte, cidade: estado.cidade });
  badge("porTipo", r, estado.fonte === "neo4j" ? "neo4j" : "mysql-cte");
  if (r.status !== "ok") return;
  const top = r.linhas.slice(0, 9);
  gTipo.data.labels = top.map((x) => x.tipo);
  gTipo.data.datasets[0].data = top.map((x) => x.trechos);
  gTipo.data.datasets[0].backgroundColor = cor(estado.fonte === "neo4j" ? "--neo" : "--sql");
  gTipo.update();
  guardarTempo("porTipo", estado.fonte === "neo4j" ? "neo4j" : "mysql-cte", r);
}
async function atualizarAlcance() {
  if (estado.origem == null) return;
  const m = metodoAtual();
  $("#ms-alcance").className = "ms"; $("#ms-alcance").textContent = "calculando…";
  const r = await api("alcance", { metodo: m, origem: estado.origem, k: estado.k, tipos: (tiposAtuais() || []).join(",") });
  badge("alcance", r, m);
  guardarTempo("alcance", m, r);
  if (r.status !== "ok") { $("#alcance-info").textContent = r.status === "timeout" ? "Estourou o limite de tempo (30 s)." : "Erro: " + (r.erro || ""); return; }
  let acc = 0; const acum = r.porNivel.map((n) => (acc += n));
  gAlcance.data.labels = acum.map((_, i) => i + 1);
  gAlcance.data.datasets[0].data = acum;
  gAlcance.data.datasets[0].backgroundColor = cor(SERIES[m][1]);
  gAlcance.update();
  $("#alcance-info").textContent = `Da interseção ${fmt(estado.origem)}, ${fmt(acc)} interseções ficam a até ${r.k} trechos${tiposAtuais() ? " (só nas vias do filtro)" : ""}.`;
}
async function atualizarVizinhos() {
  if (estado.origem == null) return;
  const r = await api("vizinhos", { fonte: estado.fonte, origem: estado.origem });
  badge("vizinhos", r, estado.fonte === "neo4j" ? "neo4j" : "mysql-cte");
  guardarTempo("vizinhos", estado.fonte === "neo4j" ? "neo4j" : "mysql-cte", r);
  const corpo = $("#t-vizinhos tbody"); corpo.innerHTML = "";
  if (r.status !== "ok") return;
  for (const x of r.linhas) {
    const tr = document.createElement("tr");
    [x.destino, x.nome || "(sem nome)", x.tipo, x.comprimento_m, x.mao_unica ? "sim" : "não", x.velocidade_max ?? "–", x.faixas ?? "–"].forEach((v) => { const td = document.createElement("td"); td.textContent = typeof v === "number" ? fmt(v) : v; tr.appendChild(td); });
    corpo.appendChild(tr);
  }
}
async function atualizarRota() {
  if (estado.origem == null || estado.destino == null) return;
  const m = metodoAtual();
  $("#ms-rota").className = "ms"; $("#ms-rota").textContent = "calculando…";
  $("#rota-info").textContent = "Calculando a rota…";
  const r = await api("rota", { metodo: m, origem: estado.origem, destino: estado.destino, maxSaltos: estado.limite, tipos: (tiposAtuais() || []).join(",") });
  badge("rota", r, m);
  guardarTempo("rota", m, r);
  estado.rota = r;
  const info = $("#rota-info");
  if (r.status === "timeout") info.textContent = `Estourou o limite de 30 s com limite de ${r.maxSaltos} saltos.`;
  else if (r.status !== "ok") info.textContent = "Erro: " + (r.erro || "");
  else if (r.saltos == null) info.textContent = `Sem caminho até ${r.maxSaltos} trechos${tiposAtuais() ? " usando só as vias do filtro" : ""}.`;
  else if (!r.detalhe) info.textContent = `Menor caminho: ${r.saltos} trechos. O SQL puro devolve só a distância; para ver o caminho no mapa, use o Neo4j ou a busca em níveis.`;
  else info.textContent = `Menor caminho: ${r.saltos} trechos, ${(r.detalhe.metros / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km. Passa por: ${r.detalhe.ruas.slice(0, 6).join(", ")}${r.detalhe.ruas.length > 6 ? "…" : ""}.`;
  desenharMapa();
}

async function atualizarTudo() {
  const v = ++estado.vivo;
  status("Consultando " + (estado.fonte === "neo4j" ? "o Neo4j" : "o MySQL") + "…");
  try {
    await Promise.all([atualizarIndicadores(), atualizarPorTipo()]);
    if (v !== estado.vivo) return;
    await atualizarAlcance(); await atualizarVizinhos(); await atualizarRota();
    status("Pronto. Fonte: " + (estado.fonte === "neo4j" ? "Neo4j" : "MySQL"));
  } catch (e) { status("Erro: " + e.message, true); }
}

// ---------- mapa ----------
function projecao(cv) {
  const pts = estado.pontos; if (!pts.length) return null;
  let a = 90, b = -90, c = 180, d = -180;
  for (const [, lat, lon] of pts) { a = Math.min(a, lat); b = Math.max(b, lat); c = Math.min(c, lon); d = Math.max(d, lon); }
  const k = Math.cos(((a + b) / 2) * Math.PI / 180), W = cv.clientWidth, H = cv.clientHeight, m = 12;
  const esc = Math.min((W - 2 * m) / ((d - c) * k || 1), (H - 2 * m) / ((b - a) || 1));
  const ox = (W - (d - c) * k * esc) / 2, oy = (H - (b - a) * esc) / 2;
  return { xy: (lat, lon) => [ox + (lon - c) * k * esc, H - (oy + (lat - a) * esc)] };
}
function desenharMapa() {
  const cv = $("#mapa"), dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  const P = projecao(cv); if (!P) return;
  g.fillStyle = cor("--suave"); g.globalAlpha = 0.45;
  for (const [, lat, lon] of estado.pontos) { const [x, y] = P.xy(lat, lon); g.fillRect(x - 0.6, y - 0.6, 1.4, 1.4); }
  g.globalAlpha = 1;
  const det = estado.rota && estado.rota.detalhe;
  if (det) {
    g.strokeStyle = cor(SERIES[estado.rota.metodo] ? SERIES[estado.rota.metodo][1] : "--neo"); g.lineWidth = 3; g.lineJoin = "round"; g.beginPath();
    det.pontos.forEach((p, i) => { const [x, y] = P.xy(p.lat, p.lon); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  const marca = (id, cl) => { const p = (estado.extra && estado.extra[id]) || estado.pontos.find((q) => q[0] === id); if (!p) return; const [x, y] = P.xy(p[1], p[2]); g.fillStyle = cl; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke(); };
  if (estado.origem != null) marca(estado.origem, cor("--ok"));
  if (estado.destino != null) marca(estado.destino, cor("--erro"));
}
let proximoClique = "origem";
function cliqueMapa(ev) {
  const cv = $("#mapa"), P = projecao(cv); if (!P) return;
  const r = cv.getBoundingClientRect(), x0 = ev.clientX - r.left, y0 = ev.clientY - r.top;
  let melhor = null, dmin = 1e9;
  for (const p of estado.pontos) { const [x, y] = P.xy(p[1], p[2]); const d = (x - x0) ** 2 + (y - y0) ** 2; if (d < dmin) { dmin = d; melhor = p; } }
  if (!melhor || dmin > 30 * 30) return;
  estado.extra = estado.extra || {}; estado.extra[melhor[0]] = melhor;
  if (proximoClique === "origem") { estado.origem = melhor[0]; estado.destino = null; estado.rota = null; proximoClique = "destino"; $("#rota-info").textContent = "Agora clique no destino."; desenharMapa(); atualizarAlcance(); atualizarVizinhos(); }
  else { estado.destino = melhor[0]; proximoClique = "origem"; atualizarRota(); }
}
async function carregarPontos() {
  const r = await api("pontos", { cidade: estado.cidade, n: 5000 });
  estado.pontos = r.pontos; desenharMapa();
}
async function novoPar() {
  const btn = $("#novo-par"); btn.disabled = true; status("Procurando um par de pontos…");
  const r = await api("par", { cidade: estado.cidade, saltos: $("#dist-par").value, semente: Math.floor(Math.random() * 900) + 1 });
  btn.disabled = false;
  if (r.status !== "ok") { status(r.erro || "não achei par", true); return; }
  estado.extra = estado.extra || {}; r.pontos.forEach((p) => (estado.extra[p[0]] = p));
  estado.origem = r.origem; estado.destino = r.destino; estado.rota = null; proximoClique = "origem";
  await atualizarTudo();
}

// ---------- comparação entre os bancos ----------
async function compararAgora() {
  const btn = $("#comparar"); btn.disabled = true; $("#demo").disabled = true;
  const msg = $("#comp-msg"); msg.textContent = "Comparando… (cada consulta roda nos dois bancos, 1 aquecimento + 3 medidas)";
  const tipos = (tiposAtuais() || []).join(",");
  const plano = [
    ["indicadores", { cidade: estado.cidade }, ["neo4j", "mysql-cte"]],
    ["porTipo", { cidade: estado.cidade }, ["neo4j", "mysql-cte"]],
    ["vizinhos", { origem: estado.origem }, ["neo4j", "mysql-cte"]],
    ["alcance", { origem: estado.origem, k: estado.k, tipos }, ["neo4j", "mysql-cte", "mysql-bfs"]],
    ["rota", { origem: estado.origem, destino: estado.destino, maxSaltos: estado.limite, tipos }, ["neo4j", "mysql-cte", "mysql-bfs"]],
  ];
  let todasIguais = true;
  try {
    for (const [c, p, metodos] of plano) {
      if ((c !== "indicadores" && c !== "porTipo") && estado.origem == null) continue;
      if (c === "rota" && estado.destino == null) continue;
      msg.textContent = "Comparando: " + ROTULOS[c] + "…";
      const r = await api("comparar", { consulta: c, metodos: metodos.join(","), reps: 3, ...p });
      todasIguais = todasIguais && r.equivalente;
      for (const x of r.resultados) ultimos[c][x.metodo] = x.status === "ok" ? x.mediana_ms : x.status === "timeout" ? 30000 : null;
      atualizarGraficoTempos();
    }
    msg.textContent = "Pronto. Mediana de 3 medidas por consulta. Resultados iguais nos bancos: " + (todasIguais ? "sim" : "NÃO (veja o console do servidor)") + ".";
  } catch (e) { msg.textContent = "Erro: " + e.message; }
  btn.disabled = false; $("#demo").disabled = false;
}
async function demoRota() {
  if (estado.origem == null || estado.destino == null) { $("#comp-msg").textContent = "Escolha origem e destino no mapa primeiro."; return; }
  const btn = $("#demo"); btn.disabled = true; $("#comparar").disabled = true;
  const msg = $("#comp-msg"); msg.textContent = `Menor caminho com limite de ${estado.limite} saltos nos três métodos… (o SQL puro pode levar até 30 s)`;
  try {
    const r = await api("comparar", { consulta: "rota", metodos: "neo4j,mysql-bfs,mysql-cte", reps: 3, origem: estado.origem, destino: estado.destino, maxSaltos: estado.limite, tipos: (tiposAtuais() || []).join(",") });
    for (const x of r.resultados) ultimos.rota[x.metodo] = x.status === "ok" ? x.mediana_ms : x.status === "timeout" ? 30000 : null;
    atualizarGraficoTempos();
    const partes = r.resultados.map((x) => `${SERIES[x.metodo][0]}: ${x.status === "ok" ? fmtMs(x.mediana_ms) : "estourou 30 s"}`);
    msg.textContent = `${partes.join(" · ")}. Resultados iguais: ${r.equivalente ? "sim" : "não"}. Dica: reduza o limite de saltos para a distância real e veja o SQL puro se aproximar.`;
  } catch (e) { msg.textContent = "Erro: " + e.message; }
  btn.disabled = false; $("#comparar").disabled = false;
}

// ---------- inicialização ----------
async function iniciar() {
  criarGraficos();
  try {
    estado.meta = await api("metadados");
    const sel = $("#cidade");
    estado.meta.cidades.forEach((c) => { const o = document.createElement("option"); o.value = c.cidade; o.textContent = `${c.cidade} (${c.uf})`; sel.appendChild(o); });
    sel.value = estado.cidade;
    await carregarPontos();
    await novoPar(); // escolhe um par, e já consulta tudo
  } catch (e) { status("Erro ao iniciar: " + e.message + ". Os bancos estão ligados?", true); }
}
document.querySelectorAll("input[name=fonte]").forEach((r) => r.addEventListener("change", (e) => { estado.fonte = e.target.value; $("#campo-metodo").style.visibility = estado.fonte === "mysql" ? "visible" : "hidden"; atualizarTudo(); }));
$("#campo-metodo").style.visibility = "hidden";
$("#metodo-mysql").addEventListener("change", (e) => { estado.metodoMy = e.target.value; atualizarTudo(); });
$("#cidade").addEventListener("change", async (e) => { estado.cidade = e.target.value; estado.origem = estado.destino = null; estado.rota = null; await carregarPontos(); await atualizarIndicadores(); await atualizarPorTipo(); await novoPar(); });
$("#preset").addEventListener("change", (e) => { estado.preset = e.target.value; atualizarAlcance(); atualizarRota(); });
$("#k").addEventListener("input", (e) => { $("#k-valor").textContent = e.target.value; });
$("#k").addEventListener("change", (e) => { estado.k = Number(e.target.value); atualizarAlcance(); });
$("#limite").addEventListener("change", (e) => { estado.limite = Math.max(1, Math.min(400, Number(e.target.value) || 150)); atualizarRota(); });
$("#mapa").addEventListener("click", cliqueMapa);
$("#novo-par").addEventListener("click", novoPar);
$("#comparar").addEventListener("click", compararAgora);
$("#demo").addEventListener("click", demoRota);
$("#log").addEventListener("change", atualizarGraficoTempos);
window.addEventListener("resize", desenharMapa);
iniciar();
