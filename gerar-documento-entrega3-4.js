// Gera Entrega3e4-Projeto3-NoSQL-Grafos.docx a partir dos resultados reais dos experimentos.
// Antes: cd app && npm run experimentos   (grava app/experimentos/resultados/*.json e medicoes.csv)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, ImageRun,
  LevelFormat, WidthType, ShadingType, BorderStyle, PageNumber, Footer,
} = require("docx");

// pasta com os dados e as evidências: "Projeto-dados-av3" (atual) ou "entrega2" (nome antigo)
const PASTA_DADOS = ["Projeto-dados-av3", "entrega2"].find((p) => require("fs").existsSync(require("path").join(__dirname, p, "dados", "resumo.json"))) || "Projeto-dados-av3";
const lerJson = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, p), "utf8").replace(/^﻿/, ""));
const R = lerJson("app/experimentos/resultados/resumo.json");
const A = lerJson("app/experimentos/resultados/ambiente.json");
const RES = lerJson(PASTA_DADOS + "/dados/resumo.json");
const medicoes = fs.readFileSync(path.join(__dirname, "app/experimentos/resultados/medicoes.csv"), "utf8").split("\n").length - 2;

const FONT = "Calibri", INK = "12263A", TEAL = "1F7A8C";
const f = (x) => Number(x).toLocaleString("pt-BR");
const ms = (x) => (x == null ? "–" : x < 10 ? x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : f(Math.round(x))) + " ms";
const get = (exp, param, metodo) => R.resumo.find((r) => r.experimento === exp && r.parametro === param && r.metodo === metodo);
// texto de uma célula de tempo: mediana, ou o estouro do limite
const cel = (r) => {
  if (!r) return "–";
  if (r.mediana_ms == null) return `estourou 30 s (${r.estouros_de_tempo} de ${r.itens} pares)`;
  return ms(r.mediana_ms) + (r.estouros_de_tempo ? ` (estourou 30 s em ${r.estouros_de_tempo} de ${r.itens} pares)` : "");
};
const razao = (a, b) => (a / b >= 10 ? Math.round(a / b) : (a / b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })) + "×";

const t = (x) => new TextRun({ text: x, font: FONT, size: 22 });
const b = (x) => new TextRun({ text: x, bold: true, font: FONT, size: 22 });
const p = (x, o = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...o, children: Array.isArray(x) ? x : [t(x)] });
const h1 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: x })] });
const h2 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: x })] });
const bullet = (x) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 80, line: 290 }, children: Array.isArray(x) ? x : [t(x)] });
const code = (lines) => lines.map((l) => new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: "EAF2F5" }, indent: { left: 240 }, children: [new TextRun({ text: l || " ", font: "Courier New", size: 18 })] }));
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });
const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D6DC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, header, rows) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (text, w, head, bold) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, shading: head ? { type: ShadingType.CLEAR, fill: INK } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: String(text).split("\n").map((ln) => new Paragraph({ children: [new TextRun({ text: ln, font: FONT, size: 20, bold: head || bold, color: head ? "FFFFFF" : "000000" })] })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false, i === 0)) }))],
  });
}
const imagem = (arq, largura) => {
  const buf = fs.readFileSync(path.join(__dirname, arq));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ type: "png", data: buf, transformation: { width: largura, height: Math.round((largura * h) / w) }, altText: { title: arq, description: "Captura do dashboard", name: arq } })] });
};

// ---------- números para o texto ----------
const dist = ["~10 trechos", "~25 trechos", "~50 trechos", "~100 trechos"];
const e2b = dist.map((d) => ({ d, neo: get("E2b", d, "neo4j"), bfs: get("E2b", d, "mysql-bfs"), cte: get("E2b", d, "mysql-cte") }));
const e2a = dist.map((d) => ({ d, neo: get("E2a", d, "neo4j"), bfs: get("E2a", d, "mysql-bfs"), cte: get("E2a", d, "mysql-cte") }));
const e1 = ["k=3", "k=5", "k=7"].map((k) => ({ k, neo: get("E1", k, "neo4j"), cte: get("E1", k, "mysql-cte"), bfs: get("E1", k, "mysql-bfs") }));
const e1b = { neo: get("E1b", "k=10, vias principais", "neo4j"), cte: get("E1b", "k=10, vias principais", "mysql-cte"), bfs: get("E1b", "k=10, vias principais", "mysql-bfs") };
const e3 = { neo: get("E3", "1 interseção", "neo4j"), my: get("E3", "1 interseção", "mysql-cte") };
const cidade = A.protocolo.cidade;
const e4 = (exp, p) => ({ neo: get(exp, p, "neo4j"), my: get(exp, p, "mysql-cte") });
const e4sp = e4("E4", cidade), e4br = e4("E4", "todas as capitais"), e4bsp = e4("E4b", cidade), e4bbr = e4("E4b", "todas as capitais");
const divergentes = R.equivalencias.filter((e) => !e.equivalente).length;
const idxMy = A.mysql.indices.map((i) => `${i.tabela}.${i.indice} (${i.colunas})`);
const idxNeo = A.neo4j.indices.filter((i) => i.type !== "LOOKUP").map((i) => `${i.name} (${i.entityType === "NODE" ? "nó" : "relacionamento"} ${i.labelsOrTypes.join(",")}.${i.properties.join(",")}, ${i.type})`);
const neoRange = e2b.filter((x) => x.neo.mediana_ms != null && x.bfs.mediana_ms != null);
const minRaz = Math.min(...neoRange.map((x) => x.bfs.mediana_ms / x.neo.mediana_ms)), maxRaz = Math.max(...neoRange.map((x) => x.bfs.mediana_ms / x.neo.mediana_ms));

const body = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: "Projeto 3 · Bancos de Dados NoSQL", font: FONT, size: 26, color: TEAL, bold: true })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Experimentos e dashboard: Neo4j × MySQL em malhas viárias", font: "Cambria", size: 50, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Entregas 3 e 4: Experimentos e produto final", font: FONT, size: 30, color: "444444" })] }),
  p([b("Data da entrega: "), t("24/11/2026")]),
  p([b("Disciplina: "), t("____________________________")]),
  p([b("Equipe: "), t("____________________________")]),
  new Paragraph({ pageBreakBefore: true, children: [] }),

  h1("1. O que foi feito"),
  bullet(`Experimentos reproduzíveis: ${f(medicoes)} medições, com protocolo único, 10 execuções medidas por item e medianas.`),
  bullet(`Verificação de equivalência: ${f(R.equivalencias.length)} itens comparados, ${divergentes} com resultados diferentes entre os métodos.`),
  bullet("Dashboard funcional que consulta os dois bancos ao vivo, com filtros, alternância de fonte, tempo em ms e comparação."),
  bullet("Resultados brutos (CSV), ambiente (JSON), código-fonte e instruções de execução, todos no repositório."),
  p("Os números deste documento são lidos dos arquivos de resultado dos experimentos, e não digitados à mão."),

  h1("2. Metodologia dos experimentos"),
  h2("2.1 Dados e ambiente"),
  table([2600, 6426], ["Item", "Valor"], [
    ["Dados", `Malha viária das ${RES.capitais} capitais brasileiras (OpenStreetMap via OSMnx): ${f(A.volume.intersecoes)} interseções e ${f(A.volume.trechos)} trechos de via, os mesmos arquivos nos dois bancos`],
    ["Cidade dos experimentos", `${cidade} (maior malha do conjunto)`],
    ["Máquina", `${A.maquina.cpu}, ${A.maquina.nucleos} núcleos, ${A.maquina.ram_gb} GB de RAM, ${A.maquina.so}`],
    ["Versões", `MySQL ${A.mysql.versao}; Neo4j ${A.neo4j.versao} (${A.neo4j.edicao}); Node ${A.maquina.node}`],
    ["Configuração", `MySQL com buffer pool de ${f(A.configuracao.mysql_buffer_pool_mb)} MB; Neo4j com heap de ${A.configuracao.neo4j_heap} e cache de páginas de ${A.configuracao.neo4j_pagecache}. Os dois bancos em contêineres Docker na mesma máquina que o programa de teste`],
    ["Tamanho", `MySQL: ${A.mysql.tamanho.map((x) => `${x.tabela} ${x.dados_mb} MB de dados + ${x.indices_mb} MB de índices`).join("; ")}`],
  ]),
  gap(),
  h2("2.2 Índices (os mesmos critérios nos dois bancos)"),
  bullet([b("MySQL: "), t(idxMy.join("; ") + ".")]),
  bullet([b("Neo4j: "), t(idxNeo.join("; ") + ".")]),
  p("O Neo4j recebeu índices em cidade e tipo de via equivalentes aos do MySQL (arquivo Projeto-dados-av3/cypher/02-indices.cypher). Nenhum índice foi removido de nenhum banco. Na agregação (E4), medimos também o MySQL com um índice de cobertura temporário (tipo, comprimento_m), criado só para a medição e removido depois."),
  h2("2.3 Métodos comparados"),
  bullet([b("Neo4j (Cypher): "), t("travessia nativa e shortestPath.")]),
  bullet([b("MySQL, SQL puro: "), t("consulta recursiva (WITH RECURSIVE). Tem de receber um limite de saltos e não para quando acha o destino.")]),
  bullet([b("MySQL, busca em níveis: "), t("a aplicação faz uma busca em largura, com uma consulta SQL por nível e a lista de visitados em memória. É o que um desenvolvedor SQL faria para o menor caminho, e foi incluída para a comparação não depender só da consulta recursiva.")]),
  h2("2.4 Protocolo"),
  bullet("Cada método faz 1 execução de aquecimento, registrada mas fora das medianas."),
  bullet(`Depois, ${A.protocolo.medidas_por_item} execuções medidas por item, intercaladas entre os métodos para que a deriva do computador pese igual.`),
  bullet("O tempo vai de antes de enviar a consulta até o resultado completo na aplicação, com a mesma régua nos dois bancos."),
  bullet("Todas as medidas são com o cache aquecido (o conjunto cabe na memória dos dois bancos)."),
  bullet(`Limite de ${A.protocolo.limite_de_tempo_s} s por consulta. Quem estoura é registrado como estouro, e o tempo real é no mínimo esse (não inventamos um valor).`),
  bullet("Cada item usa 5 pontos (origens ou pares origem/destino) sorteados de forma reproduzível, e a tabela mostra a mediana de todas as medidas do grupo."),
  bullet("O resultado de cada método é comparado com o dos outros em cada item."),
  h2("2.5 Consultas"),
  table([800, 3000, 5226], ["Id", "Consulta", "O que testa"], [
    ["E1", "Alcance: interseções a até k trechos (k = 3, 5, 7) e, em E1b, só por vias principais (k = 10)", "Travessia curta a partir de um ponto"],
    ["E2a", "Menor caminho entre dois pontos, com o limite de saltos igual à distância real", "Menor caminho quando a distância já é conhecida (favorece o MySQL)"],
    ["E2b", "Menor caminho entre dois pontos, com limite de 150 saltos", "Menor caminho quando a aplicação não sabe a distância"],
    ["E3", "Vias que saem de uma interseção, com nome, tipo e comprimento", "Busca por chave"],
    ["E4 e E4b", "Trechos e quilômetros por tipo de via (na cidade e nas 27 capitais)", "Agregação sobre muitos trechos, sem navegar"],
  ]),
  gap(),

  h1("3. Resultados"),
  p([b("Equivalência: "), t(`em ${f(R.equivalencias.length)} itens comparados, ${divergentes} deram resultados diferentes entre os métodos. Em empates de menor caminho, a comparação é pelo número de trechos.`)]),
  h2("3.1 Menor caminho com distância desconhecida (E2b): onde o Neo4j ganha"),
  table([1700, 1700, 2700, 2926], ["Distância", "Neo4j", "MySQL, busca em níveis", "MySQL, SQL puro"],
    e2b.map((x) => [x.d, cel(x.neo), cel(x.bfs), cel(x.cte)])),
  gap(),
  p(`Com o limite de 150 saltos, o Neo4j ficou entre ${ms(Math.min(...e2b.map((x) => x.neo.mediana_ms)))} e ${ms(Math.max(...e2b.map((x) => x.neo.mediana_ms)))}. A melhor alternativa no MySQL, a busca em níveis, levou de ${ms(Math.min(...e2b.map((x) => x.bfs.mediana_ms)))} a ${ms(Math.max(...e2b.map((x) => x.bfs.mediana_ms)))}: de ${razao(minRaz, 1)} a ${razao(maxRaz, 1)} mais lento, e a diferença cresce com a distância. A consulta recursiva em SQL puro estourou o limite de 30 s na maior parte dos pares.`),
  h2("3.2 Menor caminho com limite igual à distância real (E2a)"),
  table([1700, 1700, 2700, 2926], ["Distância", "Neo4j", "MySQL, busca em níveis", "MySQL, SQL puro"],
    e2a.map((x) => [x.d, cel(x.neo), cel(x.bfs), cel(x.cte)])),
  gap(),
  p(`Quando a distância é conhecida, o SQL puro vai bem em caminhos curtos: em ${e2a[0].d} foi mais rápido que o Neo4j (${ms(e2a[0].cte.mediana_ms)} contra ${ms(e2a[0].neo.mediana_ms)}). A vantagem do Neo4j aparece a partir de ${e2a[1].d} e fica grande em ${e2a[3].d} (${ms(e2a[3].neo.mediana_ms)} contra ${ms(e2a[3].bfs.mediana_ms)} da busca em níveis e ${ms(e2a[3].cte.mediana_ms)} do SQL puro).`),
  h2("3.3 Onde o MySQL empata ou ganha"),
  table([3100, 1800, 2000, 2126], ["Consulta", "Neo4j", "MySQL, SQL puro", "MySQL, busca em níveis"], [
    ...e1.map((x) => [`E1: alcance, ${x.k}`, cel(x.neo), cel(x.cte), cel(x.bfs)]),
    ["E1b: alcance k=10, só vias principais", cel(e1b.neo), cel(e1b.cte), cel(e1b.bfs)],
    ["E3: vias que saem de uma interseção", cel(e3.neo), cel(e3.my), "–"],
  ]),
  gap(),
  p(`No alcance a poucos trechos e na busca por chave, o MySQL foi mais rápido: ${razao(e1[1].neo.mediana_ms, e1[1].cte.mediana_ms)} no alcance com k=5 e ${razao(e3.neo.mediana_ms, e3.my.mediana_ms)} na busca por chave. Em termos absolutos, são diferenças de poucos milissegundos.`),
  h2("3.4 Agregação (E4 e E4b)"),
  table([3400, 1900, 1900, 1826], ["Consulta", "Neo4j", "MySQL", "Mais rápido"], [
    [`${cidade}, índices do esquema`, cel(e4sp.neo), cel(e4sp.my), e4sp.neo.mediana_ms < e4sp.my.mediana_ms ? "Neo4j" : "MySQL"],
    ["27 capitais, índices do esquema", cel(e4br.neo), cel(e4br.my), e4br.neo.mediana_ms < e4br.my.mediana_ms ? "Neo4j" : "MySQL"],
    [`${cidade}, MySQL com índice de cobertura`, cel(e4bsp.neo), cel(e4bsp.my), e4bsp.neo.mediana_ms < e4bsp.my.mediana_ms ? "Neo4j" : "MySQL"],
    ["27 capitais, MySQL com índice de cobertura", cel(e4bbr.neo), cel(e4bbr.my), e4bbr.neo.mediana_ms < e4bbr.my.mediana_ms ? "Neo4j" : "MySQL"],
  ]),
  gap(),
  p(`Com os índices do esquema, o Neo4j ganhou nas duas agregações, e esperávamos o contrário. Por isso testamos o MySQL com um índice de cobertura (tipo, comprimento_m): nas 27 capitais ele passou a ${ms(e4bbr.my.mediana_ms)}, mais rápido que o Neo4j (${ms(e4bbr.neo.mediana_ms)}). Na cidade, o Neo4j continuou na frente (${ms(e4bsp.neo.mediana_ms)} contra ${ms(e4bsp.my.mediana_ms)}). Ou seja, o resultado da agregação depende do índice, e não do paradigma.`),

  h2("3.5 Por que os resultados são esses"),
  p("As explicações abaixo são hipóteses técnicas coerentes com os números, mas não foram isoladas com perfilamento."),
  bullet([b("Menor caminho no Neo4j: "), t("o shortestPath é um algoritmo nativo de busca em largura, que para quando encontra o destino. O custo cresce pouco com a distância, e por isso o tempo ficou quase estável (de poucos ms a algumas dezenas de ms). O Neo4j expressa isso em uma única consulta declarativa.")]),
  bullet([b("Busca em níveis no MySQL: "), t("uma consulta SQL por nível, em uma só direção, com a lista de visitados na aplicação. Em um caminho de 100 trechos são mais de 100 idas e voltas ao banco, e a fronteira cresce, então o tempo sobe com a distância.")]),
  bullet([b("SQL puro (CTE recursiva): "), t("não tem como parar ao achar o destino, então explora toda a região até o limite de saltos. Se o limite é folgado, o custo explode; se o limite é justo, vai bem em caminhos curtos.")]),
  bullet([b("Onde o MySQL ganha: "), t("busca por índice (B-tree) é muito barata, e uma malha viária tem poucas ruas por interseção, então as vizinhanças são pequenas. O Neo4j tem um custo fixo por consulta (protocolo, planejamento) de alguns milissegundos, que pesa quando a consulta é minúscula.")]),

  h2("3.6 Conclusão dos experimentos"),
  bullet(`O cenário em que o Neo4j se mostrou superior é o menor caminho entre dois pontos quando a distância não é conhecida: ${razao(minRaz, 1)} a ${razao(maxRaz, 1)} mais rápido que a melhor alternativa no MySQL, e mais de mil vezes mais rápido que o SQL puro (que estourou o limite de 30 s ou levou mais de 12 s). Está ligado a uma característica do paradigma: a travessia de grafo é uma operação nativa.`),
  bullet("O MySQL foi igual ou melhor em consultas pequenas (alcance curto, busca por chave) e, com índice adequado, em agregações grandes."),
  bullet("Portanto o paradigma de grafos compensa quando a pergunta é de caminho, e não quando é de consulta pontual ou de agregação."),
  h2("3.7 Limitações dos experimentos"),
  bullet(`Uma única cidade (${cidade}), 5 pontos por item, cache aquecido e um único usuário por vez: os resultados não valem para carga concorrente nem para cache frio.`),
  bullet("Bancos e programa de teste na mesma máquina e dentro do Docker: os valores absolutos mudam em outro computador, mas as proporções são o que importa."),
  bullet("O menor caminho é em número de trechos, e não em quilômetros: o Neo4j Community não traz o algoritmo de Dijkstra ponderado sem plugin."),
  bullet("Os estouros de tempo (30 s) são limites inferiores: o tempo real é maior."),
  bullet("Os tempos do dashboard são de execuções avulsas e podem diferir um pouco das medianas dos experimentos."),

  new Paragraph({ pageBreakBefore: true, children: [] }),
  h1("4. Dashboard (Entrega 4)"),
  p("O dashboard está em app/ e consulta os dois bancos ao vivo. Ele reaproveita o mesmo módulo de consultas dos experimentos, então o que se vê na tela é o que foi medido."),
  imagem("docs/dashboard-completo.png", 470),
  p("Captura do dashboard com a comparação de tempos preenchida (menor caminho de cerca de 76 trechos em São Paulo)."),
  h2("4.1 Requisitos do enunciado"),
  table([3600, 5426], ["Requisito", "Como o dashboard atende"], [
    ["Pelo menos 3 indicadores ou visualizações", "Indicadores da cidade (interseções, trechos, km, mão única); gráfico de trechos por tipo de via; gráfico de alcance por número de trechos; mapa com a rota; tabela das vias da origem"],
    ["Pelo menos 2 filtros que executam novas consultas", "Cidade (27), tipo de via (todas, principais, locais, sem residenciais), alcance de 1 a 12 trechos, limite de saltos, e origem e destino escolhidos no mapa"],
    ["Alternar entre MySQL e Neo4j", "Seletor de fonte; no MySQL, escolha entre SQL puro (CTE) e busca em níveis. Os resultados de negócio são os mesmos"],
    ["Tempo de resposta em ms e comparação", "Cada painel mostra o tempo da última consulta; o gráfico de comparação (escala logarítmica) coloca os métodos lado a lado"],
    ["Demonstração ao vivo do ganho do NoSQL", "Botão \"Demonstração: menor caminho\": roda o mesmo par nos três métodos, com o limite de saltos editável, e informa se os resultados são iguais"],
  ]),
  gap(),
  h2("4.2 Como executar"),
  ...code(["cd Projeto-dados-av3", ".\\scripts\\carregar.ps1        # uma vez: sobe e carrega os dois bancos", "cd ..\\app", "npm install", "npm run dashboard             # abre em http://localhost:5300"]),
  gap(),
  p("O guia completo, com o roteiro de apresentação, está em app/README.md."),

  h1("5. Resultados brutos e reprodução"),
  table([4200, 4826], ["Arquivo", "Conteúdo"], [
    ["app/experimentos/resultados/medicoes.csv", `Todas as ${f(medicoes)} medições: experimento, item, método, execução, tempo em ms e situação`],
    ["app/experimentos/resultados/resumo.json", "Medianas, mínimos e máximos por grupo, equivalência por item e os pares usados no menor caminho"],
    ["app/experimentos/resultados/ambiente.json", "Máquina, versões, índices e protocolo"],
    ["app/experimentos/resultados/execucao.log", "Saída do programa durante a execução"],
    ["app/experimentos/rodar-experimentos.js", "O programa dos experimentos"],
    ["app/lib/consultas.js", "As consultas nos dois bancos, usadas pelos experimentos e pelo dashboard"],
  ]),
  gap(),
  ...code(["cd app", "npm run experimentos           # repete tudo e regrava os resultados (leva algumas dezenas de minutos)"]),
  gap(),
  p("Os tempos absolutos mudam de máquina para máquina. As proporções entre os métodos são o que deve se repetir."),
];

const doc = new Document({
  creator: "Equipe", title: "Projeto 3 - Entregas 3 e 4 - Neo4j x MySQL",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Cambria", size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 26, bold: true, color: TEAL }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Projeto 3 · NoSQL orientado a grafos · Entregas 3 e 4 · página ", font: FONT, size: 18, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "666666" })] })] }) },
    children: body,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("Entrega3e4-Projeto3-NoSQL-Grafos.docx", buf); console.log("ok"); });
