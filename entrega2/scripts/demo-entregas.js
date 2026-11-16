// Exemplo funcionando (estilo "eBay Now": roteamento de entregas) sobre a malha viária.
// Um depósito e N paradas de entrega. Para cada par de pontos calcula o menor caminho
// (em número de trechos) no Neo4j e no MySQL, monta a rota pelo vizinho mais próximo
// e compara o resultado e o tempo dos dois bancos.
// Uso: node scripts/demo-entregas.js [--deposito 0] [--paradas 6] [--raio 10] [--semente 1]
const neo4j = require("neo4j-driver");
const mysql = require("mysql2/promise");

const arg = (nome, padrao) => { const i = process.argv.indexOf("--" + nome); return i > 0 ? Number(process.argv[i + 1]) : padrao; };
const DEPOSITO = arg("deposito", 0);
const PARADAS = arg("paradas", 6);
const RAIO = arg("raio", 10);       // as paradas ficam a até RAIO trechos do depósito
const SEMENTE = arg("semente", 1);
const LIMITE = RAIO * 2;            // limite de saltos entre duas paradas (mesmo nos dois bancos)

function aleatorio(semente) { let s = semente >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

(async () => {
  const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "rotas12345"));
  const pool = await mysql.createPool({ host: "127.0.0.1", port: 3307, user: "root", password: "rotas12345", database: "rotas" });

  // 1) escolhe as paradas (determinístico pela semente) entre as interseções a até RAIO trechos do depósito
  const s0 = driver.session();
  const alc = await s0.run(
    `MATCH (d:Intersecao {id: $d})-[:LIGA_A*${RAIO}]->(s:Intersecao) RETURN DISTINCT s.id AS id ORDER BY id LIMIT 5000`, { d: neo4j.int(DEPOSITO) });
  await s0.close();
  const candidatos = alc.records.map((r) => r.get("id").toNumber()).filter((id) => id !== DEPOSITO);
  if (candidatos.length < PARADAS) throw new Error("poucos candidatos; aumente --raio");
  const rnd = aleatorio(SEMENTE);
  const paradas = [];
  while (paradas.length < PARADAS) { const c = candidatos[Math.floor(rnd() * candidatos.length)]; if (!paradas.includes(c)) paradas.push(c); }
  const pontos = [DEPOSITO, ...paradas];
  console.log(`Depósito ${DEPOSITO}; paradas: ${paradas.join(", ")} (a ${RAIO} trechos do depósito)\n`);

  // 2) distância entre dois pontos, em cada banco
  const distNeo = async (a, b) => {
    const s = driver.session();
    try {
      const r = await s.run(
        `MATCH (a:Intersecao {id: $a}), (b:Intersecao {id: $b})
         MATCH p = shortestPath((a)-[:LIGA_A*..${LIMITE}]->(b)) RETURN length(p) AS d`, { a: neo4j.int(a), b: neo4j.int(b) });
      return r.records.length ? r.records[0].get("d").toNumber() : null;
    } finally { await s.close(); }
  };
  const distSql = async (a, b) => {
    const [rows] = await pool.query(
      `WITH RECURSIVE r (node, depth) AS (
         SELECT ?, 0
         UNION DISTINCT
         SELECT e.destino, r.depth + 1 FROM r JOIN estrada e ON e.origem = r.node WHERE r.depth < ?
       ) SELECT MIN(depth) AS d FROM r WHERE node = ?`, [a, LIMITE, b]);
    return rows[0].d === null ? null : Number(rows[0].d);
  };

  async function matriz(fn) {
    const n = pontos.length, m = Array.from({ length: n }, () => Array(n).fill(0));
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = await fn(pontos[i], pontos[j]); m[i][j] = m[j][i] = d; }
    return { m, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
  }
  await distNeo(DEPOSITO, paradas[0]); await distSql(DEPOSITO, paradas[0]); // aquecimento
  const neo = await matriz(distNeo);
  const sql = await matriz(distSql);

  // 3) rota pelo vizinho mais próximo (ida e volta ao depósito)
  function rota(m) {
    const n = m.length, visitado = new Set([0]), ordem = [0]; let atual = 0, total = 0;
    while (visitado.size < n) {
      let melhor = -1;
      for (let j = 1; j < n; j++) if (!visitado.has(j) && m[atual][j] !== null && (melhor < 0 || m[atual][j] < m[atual][melhor])) melhor = j;
      if (melhor < 0) break;
      total += m[atual][melhor]; visitado.add(melhor); ordem.push(melhor); atual = melhor;
    }
    total += m[atual][0] ?? 0; ordem.push(0);
    return { ordem: ordem.map((i) => pontos[i]), total };
  }
  const rn = rota(neo.m), rs = rota(sql.m);

  console.log(`Pares calculados: ${(pontos.length * (pontos.length - 1)) / 2}`);
  console.log(`Neo4j : ${neo.ms.toFixed(1)} ms | rota ${rn.ordem.join(" -> ")} | ${rn.total} trechos`);
  console.log(`MySQL : ${sql.ms.toFixed(1)} ms | rota ${rs.ordem.join(" -> ")} | ${rs.total} trechos`);
  const igual = JSON.stringify(neo.m) === JSON.stringify(sql.m);
  console.log(`\nMatrizes de distância idênticas nos dois bancos: ${igual ? "SIM" : "NÃO"}`);
  console.log(`Rotas idênticas: ${JSON.stringify(rn) === JSON.stringify(rs) ? "SIM" : "NÃO"}`);
  await driver.close(); await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
