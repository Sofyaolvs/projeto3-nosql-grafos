// Consultas usadas pelos experimentos (Entrega 3) e pelo dashboard (Entrega 4).
// Cada consulta existe nos dois bancos e devolve o MESMO resultado lógico.
//
// Métodos:
//   "neo4j"      Cypher (travessia nativa; menor caminho com shortestPath)
//   "mysql-cte"  SQL puro: consulta recursiva (WITH RECURSIVE)
//   "mysql-bfs"  MySQL com busca em largura por níveis feita pela aplicação (uma consulta SQL por nível,
//                lista de visitados na aplicação). É o que um desenvolvedor SQL experiente faria, e serve
//                para a comparação não depender só da CTE recursiva.
const { neo, my, medir } = require("./db");

const METODOS = ["neo4j", "mysql-cte", "mysql-bfs"];
const TIMEOUT_MS = 60000;
const arr = (v) => (Array.isArray(v) && v.length ? v : null);

// ---------- alcance em até k trechos ----------
// resultado: porNivel[d-1] = quantas interseções são alcançadas primeiro com exatamente d trechos
async function alcance(metodo, { origem, k, tipos, timeoutMs = TIMEOUT_MS }) {
  tipos = arr(tipos);
  if (metodo === "neo4j") {
    return medir(async () => {
      const s = neo().session();
      try {
        const filtro = tipos ? "WHERE all(r IN rs WHERE r.tipo IN $tipos)" : "";
        const r = await s.run(
          `MATCH p = (a:Intersecao {id: $o})-[rs:LIGA_A*1..${Number(k)}]->(b:Intersecao) ${filtro}
           WITH b, min(length(p)) AS d WHERE b.id <> $o RETURN d, count(*) AS n ORDER BY d`,
          { o: origem, tipos }, { timeout: timeoutMs });
        const porNivel = Array(k).fill(0);
        for (const x of r.records) porNivel[x.get("d") - 1] = x.get("n");
        return { porNivel, total: porNivel.reduce((a, b) => a + b, 0) };
      } finally { await s.close(); }
    });
  }
  if (metodo === "mysql-cte") {
    return medir(async () => {
      const filtro = tipos ? "AND e.tipo IN (?)" : "";
      const params = [origem, k, ...(tipos ? [tipos] : []), origem];
      const [rows] = await my().query(
        `WITH RECURSIVE r (node, depth) AS (
           SELECT ?, 0
           UNION DISTINCT
           SELECT e.destino, r.depth + 1 FROM r JOIN estrada e ON e.origem = r.node
            WHERE r.depth < ? ${filtro}
         )
         SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ d, COUNT(*) AS n
           FROM (SELECT node, MIN(depth) AS d FROM r WHERE node <> ? GROUP BY node) t GROUP BY d ORDER BY d`, params);
      const porNivel = Array(k).fill(0);
      for (const x of rows) porNivel[x.d - 1] = Number(x.n);
      return { porNivel, total: porNivel.reduce((a, b) => a + b, 0) };
    });
  }
  if (metodo === "mysql-bfs") {
    return medir(async () => {
      const limite = Date.now() + timeoutMs;
      const visitado = new Set([origem]);
      let fronteira = [origem];
      const porNivel = [];
      for (let nivel = 1; nivel <= k; nivel++) {
        const novos = await expandir(fronteira, tipos, limite);
        const proxima = [];
        for (const v of novos) if (!visitado.has(v)) { visitado.add(v); proxima.push(v); }
        porNivel.push(proxima.length);
        fronteira = proxima;
        if (!fronteira.length) { while (porNivel.length < k) porNivel.push(0); break; }
      }
      return { porNivel, total: porNivel.reduce((a, b) => a + b, 0) };
    });
  }
  throw new Error("método desconhecido: " + metodo);
}

// vizinhos diretos de um conjunto de interseções (uma consulta SQL por lote de 5000)
async function expandir(ids, tipos, limite) {
  const out = [];
  for (let i = 0; i < ids.length; i += 5000) {
    if (Date.now() > limite) throw Object.assign(new Error("timeout"), { code: "ER_QUERY_TIMEOUT" });
    const lote = ids.slice(i, i + 5000);
    const [rows] = await my().query(
      `SELECT DISTINCT destino FROM estrada WHERE origem IN (?) ${tipos ? "AND tipo IN (?)" : ""}`,
      tipos ? [lote, tipos] : [lote]);
    for (const r of rows) out.push(r.destino);
  }
  return out;
}

// ---------- menor caminho (em número de trechos) ----------
async function menorCaminho(metodo, { origem, destino, maxSaltos, tipos, timeoutMs = TIMEOUT_MS }) {
  tipos = arr(tipos);
  if (metodo === "neo4j") {
    return medir(async () => {
      const s = neo().session();
      try {
        const filtro = tipos ? "WHERE all(r IN rs WHERE r.tipo IN $tipos)" : "";
        const r = await s.run(
          `MATCH (a:Intersecao {id: $o}), (b:Intersecao {id: $d})
           MATCH p = shortestPath((a)-[rs:LIGA_A*..${Number(maxSaltos)}]->(b)) ${filtro}
           RETURN length(p) AS saltos, [n IN nodes(p) | n.id] AS ids`,
          { o: origem, d: destino, tipos }, { timeout: timeoutMs });
        if (!r.records.length) return { saltos: null, ids: null };
        return { saltos: r.records[0].get("saltos"), ids: r.records[0].get("ids") };
      } finally { await s.close(); }
    });
  }
  if (metodo === "mysql-cte") {
    return medir(async () => {
      const filtro = tipos ? "AND e.tipo IN (?)" : "";
      const params = [origem, maxSaltos, ...(tipos ? [tipos] : []), destino];
      const [rows] = await my().query(
        `WITH RECURSIVE r (node, depth) AS (
           SELECT ?, 0
           UNION DISTINCT
           SELECT e.destino, r.depth + 1 FROM r JOIN estrada e ON e.origem = r.node
            WHERE r.depth < ? ${filtro}
         )
         SELECT /*+ MAX_EXECUTION_TIME(${timeoutMs}) */ MIN(depth) AS d FROM r WHERE node = ?`, params);
      return { saltos: rows[0].d === null ? null : Number(rows[0].d), ids: null };
    });
  }
  if (metodo === "mysql-bfs") {
    return medir(async () => {
      const limite = Date.now() + timeoutMs;
      const pai = new Map([[origem, null]]);
      let fronteira = [origem];
      for (let nivel = 1; nivel <= maxSaltos && fronteira.length; nivel++) {
        const prox = [];
        for (let i = 0; i < fronteira.length; i += 5000) {
          if (Date.now() > limite) throw Object.assign(new Error("timeout"), { code: "ER_QUERY_TIMEOUT" });
          const lote = fronteira.slice(i, i + 5000);
          const [rows] = await my().query(
            `SELECT DISTINCT origem, destino FROM estrada WHERE origem IN (?) ${tipos ? "AND tipo IN (?)" : ""}`,
            tipos ? [lote, tipos] : [lote]);
          for (const r of rows) if (!pai.has(r.destino)) { pai.set(r.destino, r.origem); prox.push(r.destino); }
        }
        if (pai.has(destino)) {
          const ids = []; for (let v = destino; v !== null; v = pai.get(v)) ids.push(v); ids.reverse();
          return { saltos: ids.length - 1, ids };
        }
        fronteira = prox;
      }
      return { saltos: null, ids: null };
    });
  }
  throw new Error("método desconhecido: " + metodo);
}

// ---------- vizinhos diretos com os dados da via ----------
async function vizinhos(fonte, { origem }) {
  if (fonte === "neo4j") {
    return medir(async () => {
      const s = neo().session();
      try {
        const r = await s.run(
          `MATCH (:Intersecao {id: $o})-[r:LIGA_A]->(v)
           RETURN v.id AS destino, r.nome AS nome, r.tipo AS tipo, r.comprimento_m AS comprimento_m,
                  r.mao_unica AS mao_unica, r.velocidade_max AS velocidade_max, r.faixas AS faixas
           ORDER BY destino, r.chave`, { o: origem }, { timeout: TIMEOUT_MS });
        return { linhas: r.records.map((x) => x.toObject()) };
      } finally { await s.close(); }
    });
  }
  return medir(async () => {
    const [rows] = await my().query(
      `SELECT destino, nome, tipo, comprimento_m, (mao_unica = 1) AS mao_unica, velocidade_max, faixas
         FROM estrada WHERE origem = ? ORDER BY destino, chave`, [origem]);
    return { linhas: rows.map((x) => ({ ...x, mao_unica: !!x.mao_unica })) };
  });
}

// ---------- agregações (por tipo de via) ----------
async function porTipo(fonte, { cidade }) {
  if (fonte === "neo4j") {
    return medir(async () => {
      const s = neo().session();
      try {
        const r = cidade
          ? await s.run(`MATCH (i:Intersecao {cidade: $c})-[r:LIGA_A]->() RETURN r.tipo AS tipo, count(*) AS trechos, sum(r.comprimento_m) / 1000.0 AS km ORDER BY trechos DESC, tipo`, { c: cidade }, { timeout: TIMEOUT_MS })
          : await s.run(`MATCH ()-[r:LIGA_A]->() RETURN r.tipo AS tipo, count(*) AS trechos, sum(r.comprimento_m) / 1000.0 AS km ORDER BY trechos DESC, tipo`, {}, { timeout: TIMEOUT_MS });
        return { linhas: r.records.map((x) => ({ tipo: x.get("tipo"), trechos: x.get("trechos"), km: Math.round(x.get("km") * 10) / 10 })) };
      } finally { await s.close(); }
    });
  }
  return medir(async () => {
    const [rows] = cidade
      ? await my().query(`SELECT /*+ MAX_EXECUTION_TIME(${TIMEOUT_MS}) */ e.tipo, COUNT(*) AS trechos, SUM(e.comprimento_m) / 1000 AS km FROM estrada e JOIN interseccao i ON i.id = e.origem WHERE i.cidade = ? GROUP BY e.tipo ORDER BY trechos DESC, e.tipo`, [cidade])
      : await my().query(`SELECT /*+ MAX_EXECUTION_TIME(${TIMEOUT_MS}) */ tipo, COUNT(*) AS trechos, SUM(comprimento_m) / 1000 AS km FROM estrada GROUP BY tipo ORDER BY trechos DESC, tipo`);
    return { linhas: rows.map((x) => ({ tipo: x.tipo, trechos: Number(x.trechos), km: Math.round(Number(x.km) * 10) / 10 })) };
  });
}

// ---------- indicadores gerais (por cidade, ou Brasil todo se cidade for vazio) ----------
async function indicadores(fonte, { cidade }) {
  if (fonte === "neo4j") {
    return medir(async () => {
      const s = neo().session();
      try {
        const a = cidade
          ? await s.run(`MATCH (i:Intersecao {cidade: $c}) RETURN count(i) AS n`, { c: cidade }, { timeout: TIMEOUT_MS })
          : await s.run(`MATCH (i:Intersecao) RETURN count(i) AS n`, {}, { timeout: TIMEOUT_MS });
        const b = cidade
          ? await s.run(`MATCH (i:Intersecao {cidade: $c})-[r:LIGA_A]->() RETURN count(r) AS t, sum(r.comprimento_m) / 1000.0 AS km, sum(CASE WHEN r.mao_unica THEN 1 ELSE 0 END) AS mu`, { c: cidade }, { timeout: TIMEOUT_MS })
          : await s.run(`MATCH ()-[r:LIGA_A]->() RETURN count(r) AS t, sum(r.comprimento_m) / 1000.0 AS km, sum(CASE WHEN r.mao_unica THEN 1 ELSE 0 END) AS mu`, {}, { timeout: TIMEOUT_MS });
        const x = b.records[0];
        return { intersecoes: a.records[0].get("n"), trechos: x.get("t"), km: Math.round(x.get("km")), mao_unica: x.get("mu") };
      } finally { await s.close(); }
    });
  }
  return medir(async () => {
    const [[a]] = cidade
      ? await my().query(`SELECT COUNT(*) AS n FROM interseccao WHERE cidade = ?`, [cidade])
      : await my().query(`SELECT COUNT(*) AS n FROM interseccao`);
    const [[b]] = cidade
      ? await my().query(`SELECT /*+ MAX_EXECUTION_TIME(${TIMEOUT_MS}) */ COUNT(*) AS t, SUM(e.comprimento_m) / 1000 AS km, SUM(e.mao_unica) AS mu FROM estrada e JOIN interseccao i ON i.id = e.origem WHERE i.cidade = ?`, [cidade])
      : await my().query(`SELECT /*+ MAX_EXECUTION_TIME(${TIMEOUT_MS}) */ COUNT(*) AS t, SUM(comprimento_m) / 1000 AS km, SUM(mao_unica) AS mu FROM estrada`);
    return { intersecoes: Number(a.n), trechos: Number(b.t), km: Math.round(Number(b.km)), mao_unica: Number(b.mu) };
  });
}

// ---------- apoio (não entram nas medições) ----------
async function cidades() {
  const [rows] = await my().query(`SELECT cidade, uf, COUNT(*) AS intersecoes FROM interseccao GROUP BY cidade, uf ORDER BY intersecoes DESC`);
  return rows.map((r) => ({ cidade: r.cidade, uf: r.uf, intersecoes: Number(r.intersecoes) }));
}
async function tiposDeVia() {
  const [rows] = await my().query(`SELECT tipo, COUNT(*) AS n FROM estrada GROUP BY tipo ORDER BY n DESC`);
  return rows.map((r) => ({ tipo: r.tipo, trechos: Number(r.n) }));
}
// coordenadas, nomes de rua e comprimento de um caminho (lista de ids)
async function detalharRota(ids) {
  if (!ids || ids.length < 1) return null;
  const [pts] = await my().query(`SELECT id, lat, lon FROM interseccao WHERE id IN (?)`, [ids]);
  const pos = new Map(pts.map((p) => [p.id, [Number(p.lat), Number(p.lon)]]));
  let metros = 0; const ruas = [];
  if (ids.length > 1) {
    const pares = ids.slice(0, -1).map((o, i) => [o, ids[i + 1]]);
    const [rows] = await my().query(`SELECT origem, destino, MIN(comprimento_m) AS m, MIN(nome) AS nome FROM estrada WHERE (origem, destino) IN (?) GROUP BY origem, destino`, [pares]);
    const mapa = new Map(rows.map((r) => [r.origem + ">" + r.destino, r]));
    for (const [o, d] of pares) {
      const r = mapa.get(o + ">" + d); if (!r) continue;
      metros += Number(r.m);
      if (r.nome && ruas[ruas.length - 1] !== r.nome) ruas.push(r.nome);
    }
  }
  return { pontos: ids.map((id) => ({ id, lat: pos.get(id)?.[0], lon: pos.get(id)?.[1] })), metros: Math.round(metros), ruas };
}

// sorteia interseções de uma cidade de forma reproduzível (mesma semente, mesmo resultado)
async function sortearOrigens(cidade, n, semente) {
  const [rows] = await my().query(`SELECT id FROM interseccao WHERE cidade = ? ORDER BY MD5(CONCAT(id, ?)) LIMIT ?`, [cidade, String(semente), n]);
  return rows.map((r) => r.id);
}
// acha um par origem/destino cujo menor caminho tenha cerca de `alvo` trechos (tolerância de 25%).
// Distâncias curtas: caminha por trilhas de tamanho fixo a partir de uma origem sorteada.
// Distâncias longas: sorteia pares da cidade e mede a distância real com shortestPath (limite de 20 s por consulta).
async function parPorDistancia(cidade, alvo, semente, tentativas = 60) {
  const origens = await sortearOrigens(cidade, tentativas * 2, "par" + semente + "-" + alvo);
  let melhor = null;
  const aceita = (par) => { if (!melhor || Math.abs(par.saltos - alvo) < Math.abs(melhor.saltos - alvo)) melhor = par; return Math.abs(par.saltos - alvo) <= alvo * 0.25; };
  const s = neo().session();
  try {
    for (let i = 0; i < tentativas; i++) {
      const o = origens[i];
      if (alvo <= 40) {
        const L = Math.max(2, Math.round(alvo * 1.3));
        const fim = await s.run(`MATCH (a:Intersecao {id: $o})-[:LIGA_A*${L}]->(b:Intersecao) RETURN b.id AS id LIMIT 10`, { o }, { timeout: 20000 }).catch(() => ({ records: [] }));
        for (const x of fim.records) {
          const d = x.get("id"); if (d === o) continue;
          const r = await s.run(`MATCH (a:Intersecao {id: $o}), (b:Intersecao {id: $d}) MATCH p = shortestPath((a)-[:LIGA_A*..${L * 2}]->(b)) RETURN length(p) AS n`, { o, d }, { timeout: 20000 }).catch(() => ({ records: [] }));
          if (r.records.length && aceita({ origem: o, destino: d, saltos: r.records[0].get("n") })) return melhor;
        }
      } else {
        const d = origens[tentativas + i];
        const r = await s.run(`MATCH (a:Intersecao {id: $o}), (b:Intersecao {id: $d}) MATCH p = shortestPath((a)-[:LIGA_A*..400]->(b)) RETURN length(p) AS n`, { o, d }, { timeout: 20000 }).catch(() => ({ records: [] }));
        if (r.records.length && aceita({ origem: o, destino: d, saltos: r.records[0].get("n") })) return melhor;
      }
    }
  } finally { await s.close(); }
  return melhor;
}

module.exports = { METODOS, alcance, menorCaminho, vizinhos, porTipo, indicadores, cidades, tiposDeVia, detalharRota, sortearOrigens, parPorDistancia };
