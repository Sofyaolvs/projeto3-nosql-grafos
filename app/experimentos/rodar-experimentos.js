// Experimentos da Entrega 3: Neo4j x MySQL.
// Uso: node experimentos/rodar-experimentos.js [--cidade "São Paulo"] [--medidas 10] [--timeout 30] [--so E1,E2]
//
// Protocolo (igual para todas as consultas):
//  - os bancos já estão carregados e com os índices documentados;
//  - cada método faz 1 execução de aquecimento (descartada das medianas, mas registrada);
//  - depois, N execuções medidas (padrão 10), intercaladas entre os métodos para a deriva do computador pesar igual;
//  - o tempo vai de antes de enviar a consulta até ter o resultado inteiro na aplicação (mesma régua nos dois bancos);
//  - todas as medidas são com o cache aquecido (o conjunto cabe na memória dos dois);
//  - se um método estoura o limite de tempo no aquecimento, registra "timeout" e não repete aquele item;
//  - o resultado de cada método é comparado com o dos outros (equivalência lógica).
const fs = require("fs");
const os = require("os");
const path = require("path");
const C = require("../lib/consultas");
const { neo, my, fechar } = require("../lib/db");

const arg = (n, p) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : p; };
const CIDADE = arg("cidade", "São Paulo");
const MEDIDAS = Number(arg("medidas", 10));
const TIMEOUT = Number(arg("timeout", 30)) * 1000;
const SO = arg("so", "") ? arg("so", "").split(",") : null;
const SAIDA = path.join(__dirname, "resultados");
fs.mkdirSync(SAIDA, { recursive: true });

const PRINCIPAIS = ["motorway", "trunk", "primary", "secondary"];
const mediana = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x) => Math.round(x * 100) / 100;

const linhas = []; // medições brutas
const equivalencias = []; // uma por item
const itensLog = [];

// roda um item (uma consulta com seus parâmetros) em todos os métodos
async function rodarItem({ exp, consulta, parametro, item, metodos, executar, assinatura }) {
  const vivo = new Set(metodos);
  const ultima = {};
  // aquecimento
  for (const m of metodos) {
    const r = await executar(m);
    linhas.push({ experimento: exp, consulta, parametro, item, metodo: m, execucao: 0, tipo: "aquecimento", ms: r1(r.ms), status: r.status });
    if (r.status !== "ok") vivo.delete(m); else ultima[m] = assinatura(r);
  }
  // medidas, intercaladas
  for (let e = 1; e <= MEDIDAS; e++) {
    for (const m of metodos) {
      if (!vivo.has(m)) continue;
      const r = await executar(m);
      linhas.push({ experimento: exp, consulta, parametro, item, metodo: m, execucao: e, tipo: "medida", ms: r1(r.ms), status: r.status });
      if (r.status === "ok") ultima[m] = assinatura(r); else vivo.delete(m);
    }
  }
  const sigs = Object.entries(ultima);
  const iguais = sigs.length < 2 || sigs.every(([, s]) => s === sigs[0][1]);
  equivalencias.push({ experimento: exp, consulta, parametro, item, equivalente: iguais, metodos_comparados: sigs.map(([m]) => m), assinaturas: iguais ? undefined : Object.fromEntries(sigs) });
  const med = metodos.map((m) => {
    const v = linhas.filter((l) => l.experimento === exp && l.parametro === parametro && l.item === item && l.metodo === m && l.tipo === "medida" && l.status === "ok").map((l) => l.ms);
    return `${m}=${v.length ? r1(mediana(v)) + "ms" : "timeout"}`;
  });
  console.log(`  ${exp} ${parametro} item ${item}: ${med.join("  ")}${iguais ? "" : "  [RESULTADOS DIFERENTES]"}`);
}

async function ambiente() {
  const [[v]] = await my().query("SELECT VERSION() AS v");
  const [idx] = await my().query("SELECT table_name AS tabela, index_name AS indice, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS colunas FROM information_schema.statistics WHERE table_schema = 'rotas' GROUP BY table_name, index_name ORDER BY table_name, index_name");
  const [tam] = await my().query("SELECT table_name AS tabela, ROUND(data_length/1024/1024,1) AS dados_mb, ROUND(index_length/1024/1024,1) AS indices_mb FROM information_schema.tables WHERE table_schema='rotas'");
  const [[bp]] = await my().query("SELECT @@innodb_buffer_pool_size/1024/1024 AS mb");
  const s = neo().session();
  const nv = await s.run("CALL dbms.components() YIELD name, versions, edition RETURN name, versions[0] AS versao, edition");
  const ni = await s.run("SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties, state RETURN name, type, entityType, labelsOrTypes, properties, state");
  const nc = await s.run("MATCH (n:Intersecao) RETURN count(n) AS n");
  const nr = await s.run("MATCH ()-[r:LIGA_A]->() RETURN count(r) AS n");
  await s.close();
  return {
    data: new Date().toISOString(),
    maquina: { cpu: os.cpus()[0].model, nucleos: os.cpus().length, ram_gb: Math.round(os.totalmem() / 2 ** 30 * 10) / 10, so: `${os.type()} ${os.release()}`, node: process.version },
    configuracao: { mysql_buffer_pool_mb: Number(bp.mb), neo4j_heap: "2G", neo4j_pagecache: "2G", execucao: "Docker Desktop, bancos na mesma máquina que o programa de teste" },
    mysql: { versao: v.v, indices: idx, tamanho: tam },
    neo4j: { versao: nv.records[0].get("versao"), edicao: nv.records[0].get("edition"), indices: ni.records.map((r) => r.toObject()) },
    volume: { intersecoes: nc.records[0].get("n"), trechos: nr.records[0].get("n") },
    protocolo: { cidade: CIDADE, aquecimento_por_metodo: 1, medidas_por_item: MEDIDAS, limite_de_tempo_s: TIMEOUT / 1000, cache: "aquecido", filtro_vias_principais: PRINCIPAIS },
  };
}

(async () => {
  console.log(`Experimentos: cidade=${CIDADE}, ${MEDIDAS} medidas por item, limite ${TIMEOUT / 1000} s\n`);
  const amb = await ambiente();
  fs.writeFileSync(path.join(SAIDA, "ambiente.json"), JSON.stringify(amb, null, 2));
  const quer = (e) => !SO || SO.includes(e);
  const todos = C.METODOS;

  // E1: alcance em até k trechos (travessia a partir de um ponto)
  if (quer("E1")) {
    const origens = await C.sortearOrigens(CIDADE, 5, "e1");
    for (const k of [3, 5, 7]) {
      origens.forEach(() => {});
      for (let i = 0; i < origens.length; i++) {
        await rodarItem({ exp: "E1", consulta: "Alcance em até k trechos", parametro: `k=${k}`, item: i + 1, metodos: todos,
          executar: (m) => C.alcance(m, { origem: origens[i], k, timeoutMs: TIMEOUT }),
          assinatura: (r) => JSON.stringify(r.porNivel) });
      }
    }
    // mesma consulta só por vias principais (o filtro "tipo de via" do dashboard)
    for (let i = 0; i < origens.length; i++) {
      await rodarItem({ exp: "E1b", consulta: "Alcance em até k trechos, só vias principais", parametro: "k=10, vias principais", item: i + 1, metodos: todos,
        executar: (m) => C.alcance(m, { origem: origens[i], k: 10, tipos: PRINCIPAIS, timeoutMs: TIMEOUT }),
        assinatura: (r) => JSON.stringify(r.porNivel) });
    }
  }

  // E2: menor caminho entre dois pontos da mesma cidade
  if (quer("E2")) {
    for (const alvo of [10, 25, 50, 100]) {
      for (let i = 0; i < 5; i++) {
        const par = await C.parPorDistancia(CIDADE, alvo, i + 1);
        if (!par) { console.log(`  E2: sem par para ${alvo} trechos (item ${i + 1})`); continue; }
        itensLog.push({ exp: "E2", alvo, item: i + 1, ...par });
        // E2a: o limite de saltos é a própria distância real. Favorece o MySQL: a CTE não explora além do necessário,
        //      mas só é possível porque a distância já era conhecida.
        await rodarItem({ exp: "E2a", consulta: "Menor caminho, limite = distância real", parametro: `~${alvo} trechos`, item: i + 1, metodos: todos,
          executar: (m) => C.menorCaminho(m, { origem: par.origem, destino: par.destino, maxSaltos: par.saltos, timeoutMs: TIMEOUT }),
          assinatura: (r) => String(r.saltos) });
        // E2b: limite de 150 saltos (a aplicação não sabe a distância). A CTE explora tudo até o limite; o shortestPath
        //      do Neo4j e a busca em níveis param ao achar o destino.
        await rodarItem({ exp: "E2b", consulta: "Menor caminho, limite = 150 (distância desconhecida)", parametro: `~${alvo} trechos`, item: i + 1, metodos: todos,
          executar: (m) => C.menorCaminho(m, { origem: par.origem, destino: par.destino, maxSaltos: 150, timeoutMs: TIMEOUT }),
          assinatura: (r) => String(r.saltos) });
      }
    }
  }

  // E3: vizinhos diretos de uma interseção, com os dados das vias (busca por chave)
  if (quer("E3")) {
    const origens = await C.sortearOrigens(CIDADE, 5, "e3");
    for (let i = 0; i < origens.length; i++) {
      await rodarItem({ exp: "E3", consulta: "Vizinhos diretos com dados da via", parametro: "1 interseção", item: i + 1, metodos: ["neo4j", "mysql-cte"],
        executar: (m) => C.vizinhos(m === "neo4j" ? "neo4j" : "mysql", { origem: origens[i] }),
        assinatura: (r) => JSON.stringify(r.linhas.map((x) => [x.destino, x.nome, x.tipo, x.comprimento_m]).sort()) });
    }
  }

  // E4: agregação (trechos e km por tipo de via): varre muitos trechos, sem navegar entre eles
  if (quer("E4")) {
    const alvos = [[`${CIDADE}`, CIDADE], ["todas as capitais", ""]];
    const rodarE4 = async (exp, consulta) => {
      for (const [nome, cidade] of alvos) {
        await rodarItem({ exp, consulta, parametro: nome, item: 1, metodos: ["neo4j", "mysql-cte"],
          executar: (m) => C.porTipo(m === "neo4j" ? "neo4j" : "mysql", { cidade }),
          assinatura: (r) => JSON.stringify(r.linhas.map((x) => [x.tipo, x.trechos, Math.round(x.km)])) });
      }
    };
    await rodarE4("E4", "Trechos e km por tipo de via (índices do esquema)");
    // E4b: o MySQL ganha um índice de cobertura (tipo, comprimento_m), que um DBA criaria para essa agregação.
    // O índice é criado só para a medição e removido em seguida (o banco volta ao esquema da equipe).
    console.log("  E4b: criando o índice de cobertura no MySQL (temporário)...");
    await my().query("CREATE INDEX idx_tipo_cobertura ON estrada (tipo, comprimento_m)");
    try { await rodarE4("E4b", "Trechos e km por tipo de via (MySQL com índice de cobertura)"); }
    finally { await my().query("DROP INDEX idx_tipo_cobertura ON estrada"); console.log("  E4b: índice temporário removido."); }
  }

  // resumo: mediana de todas as medidas do grupo (consulta, parâmetro, método)
  const grupos = new Map();
  for (const l of linhas) {
    const k = [l.experimento, l.consulta, l.parametro, l.metodo].join("|");
    if (!grupos.has(k)) grupos.set(k, { experimento: l.experimento, consulta: l.consulta, parametro: l.parametro, metodo: l.metodo, tempos: [], aquecimento: [], timeouts: 0, itens: new Set() });
    const g = grupos.get(k); g.itens.add(l.item);
    if (l.tipo === "aquecimento") { if (l.status === "ok") g.aquecimento.push(l.ms); else g.timeouts++; }
    else if (l.status === "ok") g.tempos.push(l.ms); else g.timeouts++;
  }
  const resumo = [...grupos.values()].map((g) => ({
    experimento: g.experimento, consulta: g.consulta, parametro: g.parametro, metodo: g.metodo, itens: g.itens.size,
    medidas: g.tempos.length, mediana_ms: g.tempos.length ? r1(mediana(g.tempos)) : null,
    minimo_ms: g.tempos.length ? r1(Math.min(...g.tempos)) : null, maximo_ms: g.tempos.length ? r1(Math.max(...g.tempos)) : null,
    primeira_execucao_mediana_ms: g.aquecimento.length ? r1(mediana(g.aquecimento)) : null, estouros_de_tempo: g.timeouts,
  }));
  fs.writeFileSync(path.join(SAIDA, "resumo.json"), JSON.stringify({ resumo, equivalencias, pares_e2: itensLog }, null, 2));
  const cab = "experimento,consulta,parametro,item,metodo,execucao,tipo,ms,status";
  fs.writeFileSync(path.join(SAIDA, "medicoes.csv"), "﻿" + cab + "\n" + linhas.map((l) => [l.experimento, `"${l.consulta}"`, `"${l.parametro}"`, l.item, l.metodo, l.execucao, l.tipo, l.ms, l.status].join(",")).join("\n") + "\n");
  const difs = equivalencias.filter((e) => !e.equivalente).length;
  console.log(`\nConcluído: ${linhas.length} medições gravadas em experimentos/resultados/. Itens com resultados diferentes entre métodos: ${difs}.`);
  await fechar();
})().catch(async (e) => { console.error(e); await fechar(); process.exit(1); });
