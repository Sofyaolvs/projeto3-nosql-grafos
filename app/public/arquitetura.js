// Página "Como foi feito": animação da busca em níveis e comparação dos três métodos, em um grafo de exemplo.
const $ = (s) => document.querySelector(s);
const NS = "http://www.w3.org/2000/svg";
const el = (tipo, attrs = {}, pai) => { const e = document.createElementNS(NS, tipo); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (pai) pai.appendChild(e); return e; };

// ---------- grafo de exemplo: 5 × 5 ruas, com algumas ruas cortadas e algumas de mão única ----------
const COLS = 5, LINS = 5, ORIGEM = 0;
const NOS = Array.from({ length: COLS * LINS }, (_, i) => ({ id: i, x: 50 + (i % COLS) * 80, y: 40 + Math.floor(i / COLS) * 62 }));
const CORTADAS = new Set(["7-8", "11-16", "13-18", "16-17", "2-7"]);
const UMA_MAO = { "6-7": [6, 7], "12-13": [12, 13], "16-21": [16, 21], "18-19": [19, 18], "3-4": [3, 4] }; // [de, para]
const ARESTAS = [];
for (let l = 0; l < LINS; l++) for (let c = 0; c < COLS; c++) {
  const i = l * COLS + c;
  for (const j of [c < COLS - 1 ? i + 1 : null, l < LINS - 1 ? i + COLS : null]) {
    if (j === null || CORTADAS.has(i + "-" + j)) continue;
    ARESTAS.push({ a: i, b: j, mao: UMA_MAO[i + "-" + j] || null });
  }
}
const ADJ = new Map(NOS.map((n) => [n.id, []]));
for (const e of ARESTAS) { if (e.mao) ADJ.get(e.mao[0]).push(e.mao[1]); else { ADJ.get(e.a).push(e.b); ADJ.get(e.b).push(e.a); } }
for (const v of ADJ.values()) v.sort((x, y) => x - y);

// busca em níveis: devolve um passo por nível, exatamente como o programa faz (uma consulta SQL por nível)
function passosBFS(destino) {
  const pai = new Map([[ORIGEM, null]]);
  let fronteira = [ORIGEM];
  const passos = [{ nivel: 0, consulta: null, linhas: [], novos: [ORIGEM], fronteira: [ORIGEM], visitados: [ORIGEM], pai: new Map(pai), fim: ORIGEM === destino }];
  while (fronteira.length && !pai.has(destino)) {
    const linhas = [];
    for (const o of fronteira) for (const d of ADJ.get(o)) linhas.push([o, d]);
    const novos = [];
    for (const [o, d] of linhas) if (!pai.has(d)) { pai.set(d, o); novos.push(d); }
    passos.push({ nivel: passos.length, consulta: fronteira, linhas, novos, fronteira: novos, visitados: [...pai.keys()], pai: new Map(pai), fim: pai.has(destino) });
    fronteira = novos;
  }
  const alcancou = pai.has(destino);
  const caminho = []; if (alcancou) for (let v = destino; v !== null; v = pai.get(v)) caminho.unshift(v);
  return { passos, caminho, alcancou };
}
// quantos nós a consulta recursiva toca até o limite de saltos (ela não para ao achar o destino)
function exploradosCTE(limite) {
  const prof = new Map([[ORIGEM, 0]]); let f = [ORIGEM];
  for (let d = 1; d <= limite && f.length; d++) { const n = []; for (const o of f) for (const x of ADJ.get(o)) if (!prof.has(x)) { prof.set(x, d); n.push(x); } f = n; }
  return prof;
}

// ---------- desenho ----------
function desenharGrafo(svg, { nos = new Map(), arestasAtivas = new Set(), arestasCaminho = new Set() } = {}) {
  svg.replaceChildren();
  const id = "m-" + svg.id;
  const defs = el("defs", {}, svg);
  const m = el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
  el("path", { d: "M0,0 L10,5 L0,10 z", class: "m-seta" }, m);
  const R = 12;
  for (const e of ARESTAS) {
    const [de, para] = e.mao || [e.a, e.b];
    const A = NOS[de], B = NOS[para];
    const chave = de + ">" + para, rev = para + ">" + de;
    const ativa = arestasAtivas.has(chave) || (!e.mao && arestasAtivas.has(rev));
    const caminho = arestasCaminho.has(chave) || (!e.mao && arestasCaminho.has(rev));
    let x2 = B.x, y2 = B.y;
    if (e.mao) { const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy); x2 = B.x - (dx / l) * (R + 3); y2 = B.y - (dy / l) * (R + 3); }
    const attrs = { x1: A.x, y1: A.y, x2, y2, class: "aresta" + (caminho ? " caminho" : ativa ? " ativa" : "") };
    if (e.mao) attrs["marker-end"] = `url(#${id})`;
    el("line", attrs, svg);
  }
  for (const n of NOS) {
    const cls = nos.get(n.id) || "";
    el("circle", { cx: n.x, cy: n.y, r: R, class: "no " + cls }, svg);
    el("text", { x: n.x, y: n.y + 4, "text-anchor": "middle", class: "no-rot" }, svg).textContent = n.id;
  }
}

// ---------- busca em níveis, passo a passo ----------
let busca = null, passoAtual = 0, temporizador = null;
const lista = (v) => (v.length ? v.join(", ") : "(vazia)");
function mostrarPasso() {
  const { passos, caminho, alcancou } = busca, p = passos[passoAtual], destino = busca.destino;
  const nos = new Map();
  for (const v of p.visitados) nos.set(v, "visitado");
  for (const v of p.fronteira) nos.set(v, "fronteira");
  nos.set(ORIGEM, "origem"); nos.set(destino, "destino");
  const ativas = new Set(p.linhas.map(([o, d]) => o + ">" + d));
  const camArestas = new Set();
  const terminou = passoAtual === passos.length - 1;
  if (terminou && alcancou) { caminho.forEach((v, i) => { if (i) { camArestas.add(caminho[i - 1] + ">" + v); nos.set(v, v === destino ? "destino" : v === ORIGEM ? "origem" : "caminho"); } }); }
  desenharGrafo($("#bfs-svg"), { nos, arestasAtivas: terminou && alcancou ? new Set() : ativas, arestasCaminho: camArestas });

  $("#bfs-nivel").textContent = p.nivel === 0 ? "Início: o programa guarda a origem como visitada." : `Nível ${p.nivel}: o programa envia a fronteira ao MySQL.`;
  $("#bfs-enviada").textContent = p.consulta ? lista(p.consulta) : "(ainda nada: só a origem foi marcada)";
  $("#bfs-fronteira").textContent = lista(p.fronteira);
  $("#bfs-visitados").textContent = lista(p.visitados) + `  (${p.visitados.length})`;
  $("#bfs-idas").textContent = `${p.nivel} ${p.nivel === 1 ? "ida e volta" : "idas e voltas"}`;
  $("#bfs-sql").textContent = p.consulta ? `SELECT DISTINCT origem, destino\n  FROM estrada\n WHERE origem IN (${p.consulta.join(", ")});` : "-- ainda não houve consulta";
  $("#bfs-linhas").textContent = p.consulta ? `${p.linhas.length} (${p.novos.length} destinos novos; o resto já estava visitado)` : "–";
  const res = $("#bfs-resultado");
  if (terminou) res.textContent = alcancou ? `Destino ${destino} encontrado no nível ${p.nivel}: caminho ${caminho.join(" → ")}, com ${caminho.length - 1} trechos, em ${p.nivel} consultas.` : `Sem caminho até ${destino} (a fronteira ficou vazia).`;
  else res.textContent = "";
  $("#bfs-voltar").disabled = passoAtual === 0;
  $("#bfs-proximo").disabled = terminou;
  if (terminou) pararAuto();
}
function iniciarBusca() {
  const destino = Number($("#bfs-destino").value);
  busca = { ...passosBFS(destino), destino }; passoAtual = 0; pararAuto(); mostrarPasso(); desenharComparacao();
}
function pararAuto() { clearInterval(temporizador); temporizador = null; $("#bfs-auto").textContent = "▶ Automático"; }
function alternarAuto() {
  if (temporizador) { pararAuto(); return; }
  if (passoAtual === busca.passos.length - 1) { passoAtual = 0; mostrarPasso(); }
  $("#bfs-auto").textContent = "❚❚ Pausar";
  temporizador = setInterval(() => { if (passoAtual < busca.passos.length - 1) { passoAtual++; mostrarPasso(); } else pararAuto(); }, 1100);
}

// ---------- os três métodos no mesmo par de pontos ----------
function desenharComparacao() {
  const { passos, caminho, alcancou, destino } = busca;
  const ultimo = passos[passos.length - 1];
  const LIMITE = 12, prof = exploradosCTE(LIMITE);
  // SQL puro: toca tudo o que está até o limite de saltos
  const nosC = new Map([...prof.keys()].map((v) => [v, "visitado"])); nosC.set(ORIGEM, "origem"); nosC.set(destino, "destino");
  desenharGrafo($("#mini-cte"), { nos: nosC });
  $("#txt-cte").textContent = `Percorre ${prof.size} de ${NOS.length} interseções até o limite de ${LIMITE} saltos, mesmo depois de achar o destino. Uma consulta, mas explora a região toda.`;
  // busca em níveis: para ao achar o destino
  const nosB = new Map(ultimo.visitados.map((v) => [v, "visitado"])); nosB.set(ORIGEM, "origem"); nosB.set(destino, "destino");
  desenharGrafo($("#mini-bfs"), { nos: nosB });
  $("#txt-bfs").textContent = `Percorre ${ultimo.visitados.length} interseções e para ao achar o destino, mas faz ${passos.length - 1} idas e voltas ao banco, uma por nível.`;
  // Neo4j: devolve o caminho
  const nosN = new Map(); const camA = new Set();
  if (alcancou) caminho.forEach((v, i) => { nosN.set(v, "caminho"); if (i) camA.add(caminho[i - 1] + ">" + v); });
  nosN.set(ORIGEM, "origem"); nosN.set(destino, "destino");
  desenharGrafo($("#mini-neo"), { nos: nosN, arestasCaminho: camA });
  $("#txt-neo").textContent = alcancou ? `Uma só consulta, e a busca roda dentro do banco. Devolve o caminho de ${caminho.length - 1} trechos.` : "Uma só consulta. Não há caminho até esse destino.";
}

function iniciar() {
  const sel = $("#bfs-destino");
  for (const n of NOS) if (n.id !== ORIGEM) { const o = document.createElement("option"); o.value = n.id; o.textContent = `Interseção ${n.id}`; sel.appendChild(o); }
  sel.value = "12"; // destino no centro: a busca em níveis para antes de percorrer tudo
  sel.addEventListener("change", iniciarBusca);
  $("#bfs-proximo").addEventListener("click", () => { if (passoAtual < busca.passos.length - 1) { passoAtual++; mostrarPasso(); } });
  $("#bfs-voltar").addEventListener("click", () => { pararAuto(); if (passoAtual > 0) { passoAtual--; mostrarPasso(); } });
  $("#bfs-reiniciar").addEventListener("click", () => { pararAuto(); passoAtual = 0; mostrarPasso(); });
  $("#bfs-auto").addEventListener("click", alternarAuto);
  iniciarBusca();
}
iniciar();
