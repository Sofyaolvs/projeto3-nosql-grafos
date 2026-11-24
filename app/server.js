// Dashboard (Entrega 4): servidor HTTP sem dependências extras. Atende o frontend em /public e a API em /api.
// Uso: node server.js   (porta 5300; mude com PORT=...)
const http = require("http");
const fs = require("fs");
const path = require("path");
const C = require("./lib/consultas");
const CRUD = require("./lib/crud");
const { my, fechar } = require("./lib/db");

const PORTA = Number(process.env.PORT || 5300);
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const TIMEOUT_MS = 30000;

const metodoOk = (m) => (C.METODOS.includes(m) ? m : "neo4j");
const fonteOk = (f) => (f === "neo4j" ? "neo4j" : "mysql");
const inteiro = (v, padrao, min = 0, max = 1e9) => { const n = Number(v); return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const lista = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : null);

let cache = {}; // metadados raramente mudam
async function metadados() {
  if (!cache.meta) {
    const [cidades, tipos] = await Promise.all([C.cidades(), C.tiposDeVia()]);
    cache.meta = { cidades, tipos };
  }
  return cache.meta;
}

const rotas = {
  "/api/metadados": async () => metadados(),

  "/api/indicadores": async (q) => {
    const r = await C.indicadores(fonteOk(q.fonte), { cidade: q.cidade || "" });
    return r;
  },

  "/api/porTipo": async (q) => C.porTipo(fonteOk(q.fonte), { cidade: q.cidade || "" }),

  "/api/vizinhos": async (q) => C.vizinhos(fonteOk(q.fonte), { origem: inteiro(q.origem, 0) }),

  // alcance em até k trechos a partir de uma interseção
  "/api/alcance": async (q) => {
    const k = inteiro(q.k, 5, 1, 12);
    return { k, ...(await C.alcance(metodoOk(q.metodo), { origem: inteiro(q.origem, 0), k, tipos: lista(q.tipos), timeoutMs: TIMEOUT_MS })) };
  },

  // menor caminho (em trechos); devolve também os pontos para desenhar no mapa
  "/api/rota": async (q) => {
    const metodo = metodoOk(q.metodo);
    const maxSaltos = inteiro(q.maxSaltos, 150, 1, 400);
    const r = await C.menorCaminho(metodo, { origem: inteiro(q.origem, 0), destino: inteiro(q.destino, 0), maxSaltos, tipos: lista(q.tipos), timeoutMs: TIMEOUT_MS });
    if (r.status === "ok" && r.ids) { r.detalhe = await C.detalharRota(r.ids); }
    return { maxSaltos, metodo, ...r };
  },

  // roda a mesma consulta nos métodos pedidos e compara tempo e resultado
  "/api/comparar": async (q) => {
    const consulta = q.consulta;
    const metodos = (lista(q.metodos) || C.METODOS).filter((m) => C.METODOS.includes(m));
    const reps = inteiro(q.reps, 3, 1, 10);
    const saida = [];
    for (const m of metodos) {
      const tempos = []; let ultimo = null;
      const exec = () => {
        if (consulta === "alcance") return C.alcance(m, { origem: inteiro(q.origem, 0), k: inteiro(q.k, 5, 1, 12), tipos: lista(q.tipos), timeoutMs: TIMEOUT_MS });
        if (consulta === "rota") return C.menorCaminho(m, { origem: inteiro(q.origem, 0), destino: inteiro(q.destino, 0), maxSaltos: inteiro(q.maxSaltos, 150, 1, 400), tipos: lista(q.tipos), timeoutMs: TIMEOUT_MS });
        if (consulta === "porTipo") return C.porTipo(m === "neo4j" ? "neo4j" : "mysql", { cidade: q.cidade || "" });
        if (consulta === "indicadores") return C.indicadores(m === "neo4j" ? "neo4j" : "mysql", { cidade: q.cidade || "" });
        if (consulta === "vizinhos") return C.vizinhos(m === "neo4j" ? "neo4j" : "mysql", { origem: inteiro(q.origem, 0) });
        throw new Error("consulta desconhecida");
      };
      let status = "ok";
      const aquec = await exec(); // aquecimento (descartado das medianas)
      if (aquec.status !== "ok") { status = aquec.status; ultimo = aquec; } // estourou o limite: não repete
      else for (let i = 0; i < reps; i++) { ultimo = await exec(); if (ultimo.status !== "ok") { status = ultimo.status; break; } tempos.push(ultimo.ms); }
      tempos.sort((a, b) => a - b);
      const resumo = ultimo && ultimo.status === "ok"
        ? (consulta === "alcance" ? JSON.stringify(ultimo.porNivel) : consulta === "rota" ? String(ultimo.saltos) : consulta === "vizinhos" ? String(ultimo.linhas.length) : consulta === "porTipo" ? JSON.stringify(ultimo.linhas.map((x) => [x.tipo, x.trechos])) : JSON.stringify([ultimo.intersecoes, ultimo.trechos]))
        : null;
      saida.push({ metodo: m, status, mediana_ms: tempos.length ? tempos[tempos.length >> 1] : (ultimo ? ultimo.ms : null), medidas: tempos.length, resumo });
    }
    const ok = saida.filter((s) => s.status === "ok");
    return { consulta, reps, resultados: saida, equivalente: ok.length < 2 || ok.every((s) => s.resumo === ok[0].resumo) };
  },

  // pontos da cidade para o mapa (amostra regular, até `n`)
  "/api/pontos": async (q) => {
    const cidade = q.cidade; const n = inteiro(q.n, 4000, 100, 20000);
    const [[c]] = await my().query("SELECT COUNT(*) AS n FROM interseccao WHERE cidade = ?", [cidade]);
    const passo = Math.max(1, Math.floor(Number(c.n) / n));
    const [rows] = await my().query("SELECT id, lat, lon FROM interseccao WHERE cidade = ? AND MOD(id, ?) = 0", [cidade, passo]);
    return { total: Number(c.n), pontos: rows.map((r) => [r.id, Number(r.lat), Number(r.lon)]) };
  },

  // trechos de via dentro de uma região do mapa (para o zoom). Cada via de mão dupla aparece uma vez.
  "/api/ruas": async (q) => {
    const [a, b, c, d] = [q.minLat, q.maxLat, q.minLon, q.maxLon].map(Number);
    if ([a, b, c, d].some((x) => Number.isNaN(x))) return { status: "erro", erro: "limites inválidos" };
    const MAX = 25000;
    const consulta = (extra, params) => my().query(
      `SELECT o.lat AS olat, o.lon AS olon, d.lat AS dlat, d.lon AS dlon, e.nome, e.tipo, e.origem, e.destino
         FROM interseccao o JOIN estrada e ON e.origem = o.id JOIN interseccao d ON d.id = e.destino
        WHERE o.cidade = ? AND o.lat BETWEEN ? AND ? AND o.lon BETWEEN ? AND ? AND (e.mao_unica = 1 OR e.origem < e.destino) ${extra}
        LIMIT ?`, [q.cidade, a, b, c, d, ...params, MAX + 1]);
    let [rows] = await consulta("", []);
    let parcial = false;
    if (rows.length > MAX) { // muita rua na tela: manda só as vias principais (as locais aparecem ao aproximar)
      parcial = true;
      [rows] = await consulta("AND e.tipo NOT IN (?)", [["residential", "living_street", "unclassified", "service"]]);
    }
    return { status: "ok", parcial, truncado: rows.length > MAX,
      segmentos: rows.slice(0, MAX).map((r) => [Number(r.olat), Number(r.olon), Number(r.dlat), Number(r.dlon), r.nome, r.tipo, r.origem, r.destino]) };
  },

  // CRUD (página crud.html): cada operação roda no banco pedido em `fonte`
  "/api/crud/criar": async (q) => CRUD.criar(fonteOk(q.fonte), { id: inteiro(q.id, 0, 0), origem: inteiro(q.origem, 0), nome: String(q.nome || "Rua do Projeto 3").slice(0, 100), comprimento: Math.min(5000, Math.max(1, Number(q.comprimento) || 55.6)) }),
  "/api/crud/ler": async (q) => CRUD.ler(fonteOk(q.fonte), { id: inteiro(q.id, 0, 0) }),
  "/api/crud/bloquear": async (q) => CRUD.bloquear(fonteOk(q.fonte), { id: inteiro(q.id, 0, 0), bloqueada: q.bloqueada !== "0" }),
  "/api/crud/apagar": async (q) => CRUD.apagar(fonteOk(q.fonte), { id: inteiro(q.id, 0, 0) }),

  // sugere um par origem/destino com menor caminho perto de `saltos` trechos
  "/api/par": async (q) => {
    const par = await C.parPorDistancia(q.cidade, inteiro(q.saltos, 30, 3, 150), inteiro(q.semente, 1, 1, 1000), 40);
    if (!par) return { status: "erro", erro: "não achei um par com essa distância" };
    const [pts] = await my().query("SELECT id, lat, lon FROM interseccao WHERE id IN (?, ?)", [par.origem, par.destino]);
    return { status: "ok", ...par, pontos: pts.map((p) => [p.id, Number(p.lat), Number(p.lon)]) };
  },
};

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const enviarJson = (codigo, obj) => { res.writeHead(codigo, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
  try {
    if (url.pathname.startsWith("/api/")) {
      const h = rotas[url.pathname];
      if (!h) return enviarJson(404, { erro: "rota desconhecida" });
      return enviarJson(200, await h(Object.fromEntries(url.searchParams)));
    }
    let arq = path.normalize(path.join(PUBLIC, url.pathname === "/" ? "index.html" : url.pathname));
    if (!arq.startsWith(PUBLIC) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(arq)] || "application/octet-stream" });
    fs.createReadStream(arq).pipe(res);
  } catch (e) {
    console.error(url.pathname, e.message);
    enviarJson(500, { status: "erro", erro: e.message });
  }
});

servidor.listen(PORTA, () => console.log(`Dashboard em http://localhost:${PORTA}  (MySQL 127.0.0.1:3307, Neo4j bolt://localhost:7687)`));
process.on("SIGINT", async () => { await fechar(); process.exit(0); });
