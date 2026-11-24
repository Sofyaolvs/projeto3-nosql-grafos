// Página de CRUD: roda a mesma operação nos dois bancos (um depois do outro) e mostra comando, resultado e tempo.
const $ = (s) => document.querySelector(s);
const BANCOS = ["neo4j", "mysql"];
const fmtMs = (ms) => (ms < 10 ? ms.toFixed(1) : ms < 1000 ? String(Math.round(ms)) : (ms / 1000).toFixed(1).replace(".", ","));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const param = () => ({ id: Number($("#id").value), origem: Number($("#origem").value), nome: $("#nome").value.trim() || "Rua do Projeto 3", comprimento: Number($("#comprimento").value) || 55.6 });

// comandos mostrados na tela (os mesmos de cypher/05-crud.cypher e sql/05-crud.sql)
const COMANDOS = {
  criar: (p) => ({
    neo4j: `MATCH (m:Intersecao {id: ${p.origem}})
CREATE (n:Intersecao {id: ${p.id}, ..., lat: m.lat + 0.0005})
CREATE (n)-[:LIGA_A {nome: '${p.nome}', ...}]->(m),
       (m)-[:LIGA_A {nome: '${p.nome}', ...}]->(n)`,
    mysql: `INSERT INTO interseccao (id, ...)
  SELECT ${p.id}, ... FROM interseccao WHERE id = ${p.origem};
INSERT INTO estrada (origem, destino, ...) VALUES
  (${p.id}, ${p.origem}, ..., '${p.nome}'),
  (${p.origem}, ${p.id}, ..., '${p.nome}');`,
  }),
  ler: (p) => ({
    neo4j: `MATCH (:Intersecao {id: ${p.origem}})-[r:LIGA_A]->(v)
RETURN v.id, r.nome, r.tipo, r.comprimento_m, r.mao_unica
ORDER BY v.id`,
    mysql: `SELECT destino, nome, tipo, comprimento_m, mao_unica
  FROM estrada WHERE origem = ${p.origem}
 ORDER BY destino, chave;`,
  }),
  bloquear: (p, v) => ({
    neo4j: `MATCH (a)-[r:LIGA_A]-(b:Intersecao {id: ${p.id}})
SET r.bloqueada = ${v}      // propriedade criada na hora, sem ALTER`,
    mysql: `-- só na 1ª vez: ALTER TABLE estrada ADD COLUMN bloqueada ...
UPDATE estrada SET bloqueada = ${v ? 1 : 0}
 WHERE origem = ${p.id} OR destino = ${p.id};`,
  }),
  apagar: (p) => ({
    neo4j: `MATCH (n:Intersecao {id: ${p.id}})
DETACH DELETE n             // nó + relacionamentos`,
    mysql: `DELETE FROM estrada WHERE origem = ${p.id} OR destino = ${p.id};
DELETE FROM interseccao WHERE id = ${p.id};   -- ordem exigida pela FK`,
  }),
};

function status(t, erro = false) { const s = $("#status"); s.textContent = t; s.classList.toggle("erro", erro); }
function travar(v) { document.querySelectorAll(".crud-acoes button").forEach((b) => { b.disabled = v; }); }
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function desenharTabela(banco, linhas) {
  $("#t-" + banco).innerHTML = linhas.length
    ? linhas.map((l) => `<tr${l.bloqueada ? ' class="bloq"' : ""}><td>${esc(l.destino)}</td><td>${esc(l.nome) || "(sem nome)"}</td><td>${esc(l.tipo)}</td><td>${esc(l.comprimento_m)}</td><td>${l.mao_unica ? "sim" : "não"}</td><td>${l.bloqueada ? "sim" : "não"}</td></tr>`).join("")
    : '<tr><td colspan="6">Nenhuma via.</td></tr>';
}

function historico(nome, r) {
  const tr = document.createElement("tr");
  const cel = (b) => (r[b].status === "ok" ? fmtMs(r[b].ms) : "erro");
  tr.innerHTML = `<td>${esc(nome)}</td><td>${cel("neo4j")}</td><td>${cel("mysql")}</td>`;
  $("#t-hist tbody").prepend(tr);
}

function comparar(res) {
  const [a, b] = BANCOS.map((x) => res[x].linhas);
  if (!a || !b) return;
  const chave = (l) => `${l.destino}|${l.nome}|${l.tipo}|${l.comprimento_m}|${l.mao_unica}|${l.bloqueada}`;
  const sa = a.map(chave).join("\n"), sb = b.map(chave).join("\n");
  const el = $("#igual");
  el.textContent = sa === sb ? `✔ Os dois bancos devolveram o mesmo resultado (${a.length} vias).` : "✘ Os resultados diferem entre os bancos.";
  el.style.color = sa === sb ? "var(--ok)" : "var(--erro)";
}

// roda uma operação nos dois bancos, um depois do outro (mede cada um sem interferência)
async function operar(op, rotulo, extra = {}) {
  const p = param();
  if (!extra.semMarcar) marcar(op, extra.v);
  const cmds = COMANDOS[op](p, extra.v);
  const res = {};
  for (const b of BANCOS) {
    $("#cmd-" + b).textContent = cmds[b];
    const qs = new URLSearchParams({ fonte: b, id: p.id, origem: p.origem, nome: p.nome, comprimento: p.comprimento, ...(extra.v === undefined ? {} : { bloqueada: extra.v ? "1" : "0" }) });
    let r;
    try { r = await (await fetch(`/api/crud/${op}?${qs}`, { method: "POST" })).json(); }
    catch (e) { r = { status: "erro", ms: 0, erro: e.message }; }
    res[b] = r;
    const ms = $("#ms-" + b);
    ms.className = "ms " + (r.status === "ok" ? (b === "neo4j" ? "neo" : "sql") : "erro");
    ms.textContent = r.status === "ok" ? fmtMs(r.ms) + " ms" : "erro";
    const msg = $("#msg-" + b);
    msg.textContent = r.status === "ok" ? (r.mensagem || `${r.linhas.length} vias encontradas.`) : r.erro || "erro";
    msg.style.color = r.status === "ok" ? "" : "var(--erro)";
    if (op === "ler" && r.status === "ok") desenharTabela(b, r.linhas);
    if (op === "apagar" && r.status === "ok") desenharTabela(b, []);
  }
  historico(rotulo, res);
  if (op === "ler") comparar(res);
  const falhou = BANCOS.filter((b) => res[b].status !== "ok");
  status(falhou.length ? `${rotulo}: erro em ${falhou.join(" e ")}.` : `${rotulo}: concluído nos dois bancos.`, falhou.length > 0);
  return res;
}

// deixa colorido só o botão da operação em andamento
function marcar(op, v) {
  const id = op === "bloquear" ? (v ? "b-bloquear" : "b-desbloquear") : "b-" + op;
  document.querySelectorAll(".crud-acoes button").forEach((b) => b.classList.toggle("ativo", b.id === id));
}

async function executar(fn) { travar(true); try { await fn(); } finally { travar(false); } }

$("#b-criar").onclick = () => executar(() => operar("criar", "Create"));
$("#b-ler").onclick = () => executar(() => operar("ler", "Read"));
$("#b-bloquear").onclick = () => executar(async () => { await operar("bloquear", "Update (bloquear)", { v: true }); await operar("ler", "Read", { semMarcar: true }); });
$("#b-desbloquear").onclick = () => executar(async () => { await operar("bloquear", "Update (desbloquear)", { v: false }); await operar("ler", "Read", { semMarcar: true }); });
$("#b-apagar").onclick = () => executar(async () => { await operar("apagar", "Delete"); await operar("ler", "Read", { semMarcar: true }); });
$("#b-tudo").onclick = () => executar(async () => {
  const passos = [["criar", "Create"], ["ler", "Read"], ["bloquear", "Update (bloquear)", { v: true }], ["ler", "Read"], ["apagar", "Delete"], ["ler", "Read"]];
  for (const [op, rot, ex] of passos) { await operar(op, rot, ex); await pausa(1400); }
});
