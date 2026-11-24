// CRUD equivalente nos dois bancos (página "CRUD" do dashboard). Mesmas operações de
// sql/05-crud.sql e cypher/05-crud.cypher, mas chamadas pela aplicação.
//
// Proteção: todas as escritas só mexem em interseções com id >= ID_MINIMO (a massa de dados real vai
// até ~781 mil). Assim, o dashboard nunca altera nem apaga a malha usada nos experimentos.
const { neo, my, medir } = require("./db");

const ID_MINIMO = 5000000;

function validarId(id) {
  if (!Number.isInteger(id) || id < ID_MINIMO) {
    throw new Error(`Por segurança, o CRUD só altera interseções com id a partir de ${ID_MINIMO.toLocaleString("pt-BR")}.`);
  }
}

// ---------- CREATE: nova interseção + via de mão dupla ligando-a a uma interseção existente ----------
function criar(fonte, { id, origem, nome, comprimento }) {
  return medir(async () => {
    validarId(id);
    if (fonte === "neo4j") {
      const s = neo().session();
      try {
        const existe = await s.run("MATCH (n:Intersecao {id: $id}) RETURN count(n) AS n", { id });
        if (existe.records[0].get("n") > 0) throw new Error(`A interseção ${id} já existe. Apague antes de criar de novo.`);
        const r = await s.run(
          `MATCH (m:Intersecao {id: $origem})
           CREATE (n:Intersecao {id: $id, osm_id: 0, lat: m.lat + 0.0005, lon: m.lon, cidade: m.cidade, uf: m.uf, ruas: 1})
           CREATE (n)-[:LIGA_A {chave: 0, nome: $nome, tipo: 'residential', comprimento_m: $comp, mao_unica: false}]->(m),
                  (m)-[:LIGA_A {chave: 0, nome: $nome, tipo: 'residential', comprimento_m: $comp, mao_unica: false}]->(n)
           RETURN n.id AS id`, { id, origem, nome, comp: comprimento });
        if (!r.records.length) throw new Error(`A interseção de origem ${origem} não existe.`);
        return { mensagem: `Criados 1 nó e 2 relacionamentos (${nome}), ligando ${id} a ${origem}.` };
      } finally { await s.close(); }
    }
    const con = await my().getConnection();
    try {
      await con.beginTransaction();
      const [ja] = await con.query("SELECT 1 FROM interseccao WHERE id = ?", [id]);
      if (ja.length) throw new Error(`A interseção ${id} já existe. Apague antes de criar de novo.`);
      const [ins] = await con.query(
        "INSERT INTO interseccao (id, osm_id, lat, lon, cidade, uf, ruas) SELECT ?, 0, lat + 0.0005, lon, cidade, uf, 1 FROM interseccao WHERE id = ?",
        [id, origem]);
      if (!ins.affectedRows) throw new Error(`A interseção de origem ${origem} não existe.`);
      await con.query(
        "INSERT INTO estrada (origem, destino, chave, nome, tipo, comprimento_m, mao_unica) VALUES (?, ?, 0, ?, 'residential', ?, 0), (?, ?, 0, ?, 'residential', ?, 0)",
        [id, origem, nome, comprimento, origem, id, nome, comprimento]);
      await con.commit();
      return { mensagem: `Inseridas 1 linha em interseccao e 2 em estrada (${nome}), ligando ${id} a ${origem}.` };
    } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
  });
}

// ---------- READ: para onde dá para ir saindo de uma interseção ----------
async function colunaBloqueadaExiste() {
  const [r] = await my().query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'rotas' AND table_name = 'estrada' AND column_name = 'bloqueada'");
  return r.length > 0;
}

function ler(fonte, { id }) {
  return medir(async () => {
    if (fonte === "neo4j") {
      const s = neo().session();
      try {
        const r = await s.run(
          `MATCH (:Intersecao {id: $id})-[r:LIGA_A]->(v)
           RETURN v.id AS destino, r.nome AS nome, r.tipo AS tipo, r.comprimento_m AS comprimento_m,
                  r.mao_unica AS mao_unica, coalesce(r.bloqueada, false) AS bloqueada
           ORDER BY destino, r.chave`, { id });
        return { linhas: r.records.map((x) => x.toObject()) };
      } finally { await s.close(); }
    }
    const tem = await colunaBloqueadaExiste();
    const [rows] = await my().query(
      `SELECT destino, nome, tipo, comprimento_m, (mao_unica = 1) AS mao_unica, ${tem ? "(bloqueada = 1)" : "0"} AS bloqueada
         FROM estrada WHERE origem = ? ORDER BY destino, chave`, [id]);
    return { linhas: rows.map((x) => ({ ...x, mao_unica: !!x.mao_unica, bloqueada: !!x.bloqueada })) };
  });
}

// ---------- UPDATE: bloquear / desbloquear as vias que tocam a interseção nova ----------
function bloquear(fonte, { id, bloqueada }) {
  return medir(async () => {
    validarId(id);
    if (fonte === "neo4j") {
      const s = neo().session();
      try {
        // propriedade criada na hora: não há ALTER de esquema
        const r = await s.run(
          "MATCH (a:Intersecao)-[r:LIGA_A]-(b:Intersecao {id: $id}) SET r.bloqueada = $v RETURN count(DISTINCT r) AS n", { id, v: bloqueada });
        const n = r.records[0].get("n");
        if (!n) throw new Error(`Não há vias ligadas à interseção ${id}. Crie-a primeiro.`);
        return { mensagem: `${n} relacionamentos atualizados (bloqueada = ${bloqueada}). Nenhuma alteração de esquema foi necessária.` };
      } finally { await s.close(); }
    }
    let alter = "";
    if (!(await colunaBloqueadaExiste())) {
      const t0 = process.hrtime.bigint();
      await my().query("ALTER TABLE estrada ADD COLUMN bloqueada TINYINT(1) NOT NULL DEFAULT 0, ALGORITHM=INSTANT");
      alter = ` Foi preciso um ALTER TABLE para criar a coluna (${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(0)} ms, só na 1ª vez).`;
    }
    const [r] = await my().query("UPDATE estrada SET bloqueada = ? WHERE origem = ? OR destino = ?", [bloqueada ? 1 : 0, id, id]);
    if (!r.affectedRows && !r.matchedRows && !r.changedRows) {
      const [ex] = await my().query("SELECT 1 FROM estrada WHERE origem = ? OR destino = ? LIMIT 1", [id, id]);
      if (!ex.length) throw new Error(`Não há vias ligadas à interseção ${id}. Crie-a primeiro.`);
    }
    return { mensagem: `${r.affectedRows} linhas atualizadas (bloqueada = ${bloqueada ? 1 : 0}).${alter}` };
  });
}

// ---------- DELETE: remove a interseção e as vias ligadas a ela ----------
function apagar(fonte, { id }) {
  return medir(async () => {
    validarId(id);
    if (fonte === "neo4j") {
      const s = neo().session();
      try {
        const r = await s.run("MATCH (n:Intersecao {id: $id}) DETACH DELETE n RETURN count(n) AS n", { id });
        const n = r.records[0].get("n");
        return { mensagem: n ? "DETACH DELETE removeu o nó e todos os seus relacionamentos em um comando." : `A interseção ${id} não existe (nada a apagar).` };
      } finally { await s.close(); }
    }
    const con = await my().getConnection();
    try {
      await con.beginTransaction();
      const [e] = await con.query("DELETE FROM estrada WHERE origem = ? OR destino = ?", [id, id]); // a FK exige essa ordem
      const [i] = await con.query("DELETE FROM interseccao WHERE id = ?", [id]);
      await con.commit();
      return { mensagem: i.affectedRows ? `Apagadas ${e.affectedRows} linhas de estrada e 1 de interseccao (nessa ordem, por causa da chave estrangeira).` : `A interseção ${id} não existe (nada a apagar).` };
    } catch (err) { await con.rollback(); throw err; } finally { con.release(); }
  });
}

module.exports = { ID_MINIMO, criar, ler, bloquear, apagar };
