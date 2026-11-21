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
function guardarTempo(consulta, metodo, r, fundo = false) {
  ultimos[consulta][metodo] = r.status === "ok" ? r.ms : r.status === "timeout" ? 30000 : null;
  atualizarGraficoTempos();
  if (!fundo) agendarOutra();
}
// O gráfico de comparação mostra sempre os dois bancos: quando você consulta um, o outro é medido em segundo plano
// (uma execução de cada consulta, com os mesmos filtros). O menor caminho em SQL puro fica de fora porque pode levar até 30 s;
// ele aparece com "Comparar bancos agora" e "Demonstração: menor caminho".
let temporizadorOutra = null, ocupado = false;
function agendarOutra() { clearTimeout(temporizadorOutra); temporizadorOutra = setTimeout(() => medirOutra().catch(() => {}), 500); }
async function medirOutra() {
  if (ocupado) return;
  const v = estado.vivo, outra = estado.fonte === "neo4j" ? "mysql" : "neo4j";
  const mSimples = outra === "neo4j" ? "neo4j" : "mysql-cte", mTrav = outra === "neo4j" ? "neo4j" : "mysql-bfs";
  const tipos = (tiposAtuais() || []).join(",");
  const reg = async (consulta, metodo, rota, params) => { const r = await api(rota, params); if (v === estado.vivo && !ocupado) guardarTempo(consulta, metodo, r, true); };
  await reg("indicadores", mSimples, "indicadores", { fonte: outra, cidade: estado.cidade });
  await reg("porTipo", mSimples, "porTipo", { fonte: outra, cidade: estado.cidade });
  if (estado.origem == null) return;
  await reg("vizinhos", mSimples, "vizinhos", { fonte: outra, origem: estado.origem });
  await reg("alcance", mTrav, "alcance", { metodo: mTrav, origem: estado.origem, k: estado.k, tipos });
  if (outra === "mysql") await reg("alcance", "mysql-cte", "alcance", { metodo: "mysql-cte", origem: estado.origem, k: estado.k, tipos }); // SQL puro: rápido no alcance
  if (estado.destino != null) await reg("rota", mTrav, "rota", { metodo: mTrav, origem: estado.origem, destino: estado.destino, maxSaltos: estado.limite, tipos });
}

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
    label: m === "mysql-bfs" ? nome + " (só caminhos)" : nome, backgroundColor: cor(v), data: consultas.map((c) => ultimos[c][m] ?? null),
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

// ---------- mapa (zoom, arrastar e ruas da região visível) ----------
const vista = { z: 1, px: 0, py: 0 };               // zoom e deslocamento sobre a projeção base
const ruas = { seg: [], truncado: false, parcial: false };           // trechos de via carregados para a região visível
const ALTURA_MAX_RUAS = 0.25;                        // só carrega ruas quando a região visível tem menos de 0,1 grau de altura
let temporizadorRuas = null, geracaoRuas = 0, arrasto = null, houveArrasto = false, ultimaDica = 0;

function baseProj(cv) {
  const pts = estado.pontos; if (!pts.length) return null;
  let a = 90, b = -90, c = 180, d = -180;
  for (const [, lat, lon] of pts) { a = Math.min(a, lat); b = Math.max(b, lat); c = Math.min(c, lon); d = Math.max(d, lon); }
  const k = Math.cos(((a + b) / 2) * Math.PI / 180), W = cv.clientWidth, H = cv.clientHeight, m = 12;
  const esc = Math.min((W - 2 * m) / ((d - c) * k || 1), (H - 2 * m) / ((b - a) || 1));
  const ox = (W - (d - c) * k * esc) / 2, oy = (H - (b - a) * esc) / 2;
  return { W, H, xy: (lat, lon) => [ox + (lon - c) * k * esc, H - (oy + (lat - a) * esc)], inv: (x, y) => [a + (H - y - oy) / esc, c + (x - ox) / (k * esc)] };
}
function projecao(cv) {
  const B = baseProj(cv); if (!B) return null;
  return {
    W: B.W, H: B.H,
    xy: (lat, lon) => { const [x, y] = B.xy(lat, lon); return [x * vista.z + vista.px, y * vista.z + vista.py]; },
    inv: (X, Y) => B.inv((X - vista.px) / vista.z, (Y - vista.py) / vista.z),
    base: B,
  };
}
function limitesVisiveis(P) { const [latMax, lonMin] = P.inv(0, 0), [latMin, lonMax] = P.inv(P.W, P.H); return { latMin, latMax, lonMin, lonMax }; }

function infoMapa() {
  const el = $("#mapa-info"); if (!el) return;
  if (vista.z === 1) el.textContent = "Role o mouse para aproximar; arraste para mover";
  else if (ruas.seg.length) el.textContent = `${fmt(ruas.seg.length)} trechos de via na tela${ruas.parcial ? " (só as vias principais; aproxime para ver as ruas locais)" : ""}${ruas.truncado ? " (parcial)" : ""}`;
  else el.textContent = "Aproxime mais para ver as ruas";
}
function agendarRuas() { clearTimeout(temporizadorRuas); temporizadorRuas = setTimeout(carregarRuas, 220); }
async function carregarRuas() {
  const cv = $("#mapa"), P = projecao(cv); if (!P) return;
  const L = limitesVisiveis(P);
  if (L.latMax - L.latMin > ALTURA_MAX_RUAS) { ruas.seg = []; ruas.truncado = false; ruas.parcial = false; infoMapa(); desenharMapa(); return; }
  const g = ++geracaoRuas;
  const r = await api("ruas", { cidade: estado.cidade, minLat: L.latMin, maxLat: L.latMax, minLon: L.lonMin, maxLon: L.lonMax });
  if (g !== geracaoRuas || !r.segmentos) return;
  ruas.seg = r.segmentos; ruas.truncado = !!r.truncado; ruas.parcial = !!r.parcial; infoMapa(); desenharMapa();
}
function resetarVista() { vista.z = 1; vista.px = vista.py = 0; ruas.seg = []; ruas.truncado = false; ruas.parcial = false; infoMapa(); }
function zoomEm(x, y, f) {
  const nz = Math.max(1, Math.min(800, vista.z * f)), r = nz / vista.z;
  vista.px = x - (x - vista.px) * r; vista.py = y - (y - vista.py) * r; vista.z = nz;
  if (nz === 1) { vista.px = vista.py = 0; }
  infoMapa(); desenharMapa(); agendarRuas();
}
function ajustarRota() {
  const det = estado.rota && estado.rota.detalhe; const cv = $("#mapa"), B = baseProj(cv);
  if (!det || !B) return;
  const xs = det.pontos.map((p) => B.xy(p.lat, p.lon));
  const x1 = Math.min(...xs.map((q) => q[0])), x2 = Math.max(...xs.map((q) => q[0])), y1 = Math.min(...xs.map((q) => q[1])), y2 = Math.max(...xs.map((q) => q[1]));
  const m = 40, z = Math.max(1, Math.min(800, Math.min((B.W - 2 * m) / Math.max(x2 - x1, 1), (B.H - 2 * m) / Math.max(y2 - y1, 1))));
  vista.z = z; vista.px = B.W / 2 - ((x1 + x2) / 2) * z; vista.py = B.H / 2 - ((y1 + y2) / 2) * z;
  infoMapa(); desenharMapa(); agendarRuas();
}

const CLASSE_VIA = { motorway: 0, trunk: 0, primary: 0, motorway_link: 0, trunk_link: 0, primary_link: 0, secondary: 1, secondary_link: 1, tertiary: 1, tertiary_link: 1 };
function desenharRuas(g, P) {
  const grupos = [[], [], []];
  for (const s of ruas.seg) grupos[CLASSE_VIA[s[5]] ?? 2].push(s);
  const estilo = [[cor("--texto"), 2.6, 1], [cor("--suave"), 1.6, 0.95], [cor("--suave"), 0.9, 0.7]];
  for (const i of [2, 1, 0]) {
    g.strokeStyle = estilo[i][0]; g.lineWidth = estilo[i][1]; g.globalAlpha = estilo[i][2]; g.beginPath();
    for (const s of grupos[i]) { const [x1, y1] = P.xy(s[0], s[1]), [x2, y2] = P.xy(s[2], s[3]); g.moveTo(x1, y1); g.lineTo(x2, y2); }
    g.stroke();
  }
  g.globalAlpha = 1;
}
function desenharMapa() {
  const cv = $("#mapa"), dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  const P = projecao(cv); if (!P) return;
  if (ruas.seg.length) desenharRuas(g, P);
  else {
    g.fillStyle = cor("--suave"); g.globalAlpha = 0.45;
    const t = Math.min(4, 1.4 + vista.z * 0.15);
    for (const [, lat, lon] of estado.pontos) { const [x, y] = P.xy(lat, lon); if (x < -5 || y < -5 || x > P.W + 5 || y > P.H + 5) continue; g.fillRect(x - t / 2, y - t / 2, t, t); }
    g.globalAlpha = 1;
  }
  const det = estado.rota && estado.rota.detalhe;
  if (det) {
    g.strokeStyle = cor(SERIES[estado.rota.metodo] ? SERIES[estado.rota.metodo][1] : "--neo"); g.lineWidth = 3.5; g.lineJoin = "round"; g.beginPath();
    det.pontos.forEach((p, i) => { const [x, y] = P.xy(p.lat, p.lon); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  const marca = (id, cl) => { const p = (estado.extra && estado.extra[id]) || estado.pontos.find((q) => q[0] === id); if (!p) return; const [x, y] = P.xy(p[1], p[2]); g.fillStyle = cl; g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke(); };
  if (estado.origem != null) marca(estado.origem, cor("--ok"));
  if (estado.destino != null) marca(estado.destino, cor("--erro"));
}

// interseção mais próxima do ponto (x0, y0) da tela: usa as ruas carregadas e, se não houver, a amostra de pontos
function pontoMaisProximo(P, x0, y0) {
  let melhor = null, dmin = 1e9;
  const testar = (id, lat, lon) => { const [x, y] = P.xy(lat, lon); const d = (x - x0) ** 2 + (y - y0) ** 2; if (d < dmin) { dmin = d; melhor = [id, lat, lon]; } };
  if (ruas.seg.length) { for (const s of ruas.seg) { testar(s[6], s[0], s[1]); testar(s[7], s[2], s[3]); } if (dmin <= 18 * 18) return melhor; melhor = null; dmin = 1e9; }
  for (const p of estado.pontos) testar(p[0], p[1], p[2]);
  return dmin <= 30 * 30 ? melhor : null;
}
function ruaSobMouse(P, x0, y0) {
  let melhor = null, dmin = 8 * 8;
  for (const s of ruas.seg) {
    const [x1, y1] = P.xy(s[0], s[1]), [x2, y2] = P.xy(s[2], s[3]);
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / l2));
    const d = (x0 - (x1 + t * dx)) ** 2 + (y0 - (y1 + t * dy)) ** 2;
    if (d < dmin) { dmin = d; melhor = s; }
  }
  return melhor;
}
function mostrarDica(ev) {
  if (arrasto) return;
  const agora = performance.now(); if (agora - ultimaDica < 40) return; ultimaDica = agora; // no máximo ~25 consultas por segundo
  const cv = $("#mapa"), dica = $("#dica-rua"), P = projecao(cv); if (!P) return;
  const r = cv.getBoundingClientRect(), x0 = ev.clientX - r.left, y0 = ev.clientY - r.top;
  const s = ruas.seg.length ? ruaSobMouse(P, x0, y0) : null;
  if (!s) { dica.hidden = true; return; }
  dica.textContent = `${s[4] || "(sem nome)"} · ${s[5]}`; dica.hidden = false;
  dica.style.left = Math.min(x0 + 12, cv.clientWidth - 200) + "px"; dica.style.top = Math.max(y0 - 28, 4) + "px";
}
let proximoClique = "origem";
function cliqueMapa(ev) {
  if (houveArrasto) { houveArrasto = false; return; }
  const cv = $("#mapa"), P = projecao(cv); if (!P) return;
  const r = cv.getBoundingClientRect();
  const melhor = pontoMaisProximo(P, ev.clientX - r.left, ev.clientY - r.top);
  if (!melhor) return;
  estado.extra = estado.extra || {}; estado.extra[melhor[0]] = melhor;
  if (proximoClique === "origem") { estado.origem = melhor[0]; estado.destino = null; estado.rota = null; proximoClique = "destino"; $("#rota-info").textContent = "Agora clique no destino."; desenharMapa(); atualizarAlcance(); atualizarVizinhos(); }
  else { estado.destino = melhor[0]; proximoClique = "origem"; atualizarRota(); }
}
function ligarMapa() {
  const cv = $("#mapa"), pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = pos(e); zoomEm(x, y, e.deltaY < 0 ? 1.3 : 1 / 1.3); }, { passive: false });
  cv.addEventListener("mousedown", (e) => { arrasto = { x: e.clientX, y: e.clientY, px: vista.px, py: vista.py, moveu: false }; });
  window.addEventListener("mousemove", (e) => {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) arrasto.moveu = true;
    if (arrasto.moveu) { vista.px = arrasto.px + dx; vista.py = arrasto.py + dy; $("#dica-rua").hidden = true; desenharMapa(); agendarRuas(); }
  });
  window.addEventListener("mouseup", () => { if (arrasto) { houveArrasto = arrasto.moveu; arrasto = null; } });
  cv.addEventListener("mousemove", mostrarDica);
  cv.addEventListener("mouseleave", () => { $("#dica-rua").hidden = true; });
  cv.addEventListener("click", cliqueMapa);
  const centro = () => [cv.clientWidth / 2, cv.clientHeight / 2];
  $("#zoom-mais").addEventListener("click", () => zoomEm(...centro(), 1.8));
  $("#zoom-menos").addEventListener("click", () => zoomEm(...centro(), 1 / 1.8));
  $("#zoom-tudo").addEventListener("click", () => { resetarVista(); desenharMapa(); });
  $("#zoom-rota").addEventListener("click", ajustarRota);
  const alternarCheia = () => { $(".mapa-caixa").classList.toggle("cheia"); setTimeout(() => { desenharMapa(); agendarRuas(); }, 60); };
  $("#tela-cheia").addEventListener("click", alternarCheia);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && $(".mapa-caixa").classList.contains("cheia")) alternarCheia(); });
}

async function carregarPontos() {
  const r = await api("pontos", { cidade: estado.cidade, n: 5000 });
  estado.pontos = r.pontos; resetarVista(); desenharMapa();
}
async function novoPar() {
  const btn = $("#novo-par"); btn.disabled = true; status("Procurando um par de pontos…");
  const r = await api("par", { cidade: estado.cidade, saltos: $("#dist-par").value, semente: Math.floor(Math.random() * 900) + 1 });
  btn.disabled = false;
  if (r.status !== "ok") { status(r.erro || "não achei par", true); return; }
  estado.extra = estado.extra || {}; r.pontos.forEach((p) => (estado.extra[p[0]] = p));
  estado.origem = r.origem; estado.destino = r.destino; estado.rota = null; proximoClique = "origem";
  await atualizarTudo();
  if (vista.z > 1) ajustarRota();
}

// ---------- comparação entre os bancos ----------
async function compararAgora() {
  const btn = $("#comparar"); ocupado = true; btn.disabled = true; $("#demo").disabled = true;
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
  ocupado = false; btn.disabled = false; $("#demo").disabled = false;
}
async function demoRota() {
  if (estado.origem == null || estado.destino == null) { $("#comp-msg").textContent = "Escolha origem e destino no mapa primeiro."; return; }
  const btn = $("#demo"); ocupado = true; btn.disabled = true; $("#comparar").disabled = true;
  const msg = $("#comp-msg"); msg.textContent = `Menor caminho com limite de ${estado.limite} saltos nos três métodos… (o SQL puro pode levar até 30 s)`;
  try {
    const r = await api("comparar", { consulta: "rota", metodos: "neo4j,mysql-bfs,mysql-cte", reps: 3, origem: estado.origem, destino: estado.destino, maxSaltos: estado.limite, tipos: (tiposAtuais() || []).join(",") });
    for (const x of r.resultados) ultimos.rota[x.metodo] = x.status === "ok" ? x.mediana_ms : x.status === "timeout" ? 30000 : null;
    atualizarGraficoTempos();
    const partes = r.resultados.map((x) => `${SERIES[x.metodo][0]}: ${x.status === "ok" ? fmtMs(x.mediana_ms) : "estourou 30 s"}`);
    msg.textContent = `${partes.join(" · ")}. Resultados iguais: ${r.equivalente ? "sim" : "não"}. Dica: reduza o limite de saltos para a distância real e veja o SQL puro se aproximar.`;
  } catch (e) { msg.textContent = "Erro: " + e.message; }
  ocupado = false; btn.disabled = false; $("#comparar").disabled = false;
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
ligarMapa();
$("#novo-par").addEventListener("click", novoPar);
$("#comparar").addEventListener("click", compararAgora);
$("#demo").addEventListener("click", demoRota);
$("#log").addEventListener("change", atualizarGraficoTempos);
window.addEventListener("resize", desenharMapa);
iniciar();
