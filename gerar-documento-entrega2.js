const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType,
  LevelFormat, WidthType, ShadingType, BorderStyle, PageNumber, Footer,
} = require("docx");

const FONT = "Calibri", INK = "12263A", TEAL = "1F7A8C";
const t = (text) => new TextRun({ text, font: FONT, size: 22 });
const b = (text) => new TextRun({ text, bold: true, font: FONT, size: 22 });
const p = (x, o = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...o, children: Array.isArray(x) ? x : [t(x)] });
const h1 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: x })] });
const h2 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: x })] });
const bullet = (x) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 80, line: 290 }, children: Array.isArray(x) ? x : [t(x)] });
const code = (lines) => lines.map((l) => new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: "EAF2F5" }, indent: { left: 240 }, children: [new TextRun({ text: l || " ", font: "Courier New", size: 18 })] }));
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D6DC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, header, rows, mono = false) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (text, w, head, bold, isMono) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, fill: INK } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: String(text).split("\n").map((ln) => new Paragraph({ children: [new TextRun({ text: ln, font: isMono ? "Courier New" : FONT, size: isMono ? 17 : 20, bold: head || bold, color: head ? "FFFFFF" : "000000" })] })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false, i === 0 && !mono, mono && i > 0)) })),
    ],
  });
}

const body = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: "Projeto 3 · Bancos de Dados NoSQL", font: FONT, size: 26, color: TEAL, bold: true })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Neo4j × MySQL em uma malha viária: modelagem, carga e CRUD", font: "Cambria", size: 50, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Entrega 2: Modelagem e dados", font: FONT, size: 30, color: "444444" })] }),
  p([b("Data da entrega: "), t("17/11/2026")]),
  p([b("Disciplina: "), t("____________________________")]),
  p([b("Equipe: "), t("____________________________")]),
  new Paragraph({ pageBreakBefore: true, children: [] }),

  h1("1. O que foi feito"),
  bullet("Modelos relacional (MySQL) e de grafo (Neo4j) do mesmo cenário, com diagramas."),
  bullet("Scripts automatizados de instalação, geração dos arquivos e carga dos dois bancos."),
  bullet("Evidência do volume: contagens iguais nos dois bancos, integridade e tamanho ocupado."),
  bullet("CRUD equivalente nos dois bancos, executado de verdade."),
  bullet("Exemplo funcionando de roteamento de entregas, no estilo do caso eBay Now citado na Entrega 1."),
  p("Todas as saídas apresentadas aqui foram geradas pelos scripts do projeto e estão salvas na pasta evidencias/."),

  h1("2. Modelos de dados"),
  h2("2.1 MySQL (relacional)"),
  ...code([
    "interseccao                        estrada",
    "+-------------+                    +------------------------------+",
    "| id  (PK)    | 1 ------------ N   | origem  (PK, FK -> id)       |",
    "+-------------+                    | destino (PK, FK -> id)       |",
    "                                   | bloqueada (TINYINT, padrão 0)|",
    "                                   +------------------------------+",
    "índices: PK(origem, destino) e idx_destino(destino)",
  ]),
  gap(),
  h2("2.2 Neo4j (grafo)"),
  ...code([
    "(:Intersecao {id})  -[:LIGA_A {bloqueada}]->  (:Intersecao {id})",
    "restrição de unicidade (e índice) em Intersecao.id",
  ]),
  gap(),
  h2("2.3 Por que os modelos são diferentes"),
  table([2200, 3413, 3413], ["Ponto", "MySQL", "Neo4j"], [
    ["A estrada", "Linha da tabela estrada, ligada por duas chaves estrangeiras", "Relacionamento :LIGA_A, guardado como ponteiro entre os nós"],
    ["Achar vizinhos", "Busca no índice da PK (origem) e JOIN a cada salto", "Segue os relacionamentos do nó, sem JOIN"],
    ["Propriedade nova (bloqueada)", "ALTER TABLE (ADD COLUMN INSTANT) para toda a tabela", "Basta gravar a propriedade no relacionamento"],
    ["Integridade", "Chaves estrangeiras", "Todo relacionamento exige os dois nós"],
  ]),
  gap(),
  p("As estradas do dataset são não direcionadas. Nos dois bancos cada estrada foi guardada nos dois sentidos, para o mesmo resultado lógico."),

  h1("3. Dados e carga"),
  table([3000, 6026], ["Item", "Valor"], [
    ["Origem", "SNAP roadNet-CA (rede viária da Califórnia), snap.stanford.edu/data/roadNet-CA.html"],
    ["Arquivo", "roadNet-CA.txt.gz, 17,9 MB; 5.533.214 linhas de arestas, 4 de comentário"],
    ["Registro", "Uma interseção ou uma estrada"],
    ["Registros lógicos", "1.965.206 interseções + 2.766.607 estradas = 4.731.813"],
    ["Linhas/relacionamentos guardados", "5.533.214 (cada estrada nos dois sentidos)"],
    ["Preparo", "Script Node gera nos.csv e arestas.csv (e as versões do MySQL), ordenados e sem duplicatas"],
    ["Carga MySQL", "LOAD DATA INFILE, 31,9 s"],
    ["Carga Neo4j", "neo4j-admin database import (offline), 34,6 s, mais 6,2 s para criar a restrição de unicidade"],
  ]),
  gap(),
  p("Ambiente: Intel Core Ultra 5 225H, 15,4 GB de RAM, Windows 11, Docker Desktop. MySQL 8.0.46 (buffer pool de 2 GB) e Neo4j 5.26.33 Community (heap de 2 GB e cache de páginas de 2 GB). A carga do Neo4j é uma importação offline, o que é bem mais rápido que inserir por consultas. Os tempos de carga dos dois não são uma comparação de desempenho de consulta."),

  h1("4. Evidência do volume e da integridade"),
  table([3600, 2713, 2713], ["Verificação", "MySQL", "Neo4j"], [
    ["Interseções", "1.965.206", "1.965.206"],
    ["Estradas (dois sentidos)", "5.533.214", "5.533.214"],
    ["Estradas únicas (a < b)", "2.766.607", "2.766.607"],
    ["Estradas sem interseção (órfãs)", "0", "não se aplica (o relacionamento exige os dois nós)"],
    ["Estradas sem a volta", "0", "0"],
    ["Tamanho no disco", "dados 151,7 MB + índices 140,7 MB (estrada) e 45,6 MB (interseccao): cerca de 338 MB", "armazenamento do banco: 386 MB (o log de transações, 258 MB, não entra)"],
  ]),
  gap(),
  p("Os dois bancos têm exatamente os mesmos números. Os tamanhos são de estruturas diferentes e não devem ser lidos como uma disputa de eficiência."),

  h1("5. CRUD equivalente"),
  p("Executado com a interseção nova 5000000 ligada à interseção 0. Nos dois bancos a leitura devolveu os mesmos vizinhos (1, 2, 469 e 5000000) e, no fim, nenhum registro restou."),
  table([1300, 3863, 3863], ["Operação", "MySQL", "Neo4j (Cypher)"], [
    ["Create", "INSERT INTO interseccao (id) VALUES (5000000);\nINSERT INTO estrada (origem, destino)\n  VALUES (5000000, 0), (0, 5000000);", "MATCH (m:Intersecao {id: 0})\nCREATE (n:Intersecao {id: 5000000})\nCREATE (n)-[:LIGA_A]->(m),\n       (m)-[:LIGA_A]->(n);"],
    ["Read", "SELECT destino FROM estrada\n WHERE origem = 0;", "MATCH (:Intersecao {id: 0})-[:LIGA_A]->(v)\nRETURN v.id;"],
    ["Update", "UPDATE estrada SET bloqueada = 1\n WHERE (origem = 0 AND destino = 5000000)\n    OR (origem = 5000000 AND destino = 0);", "MATCH (a:Intersecao {id: 0})-[r:LIGA_A]-\n      (b:Intersecao {id: 5000000})\nSET r.bloqueada = true;"],
    ["Delete", "DELETE FROM estrada\n WHERE origem = 5000000 OR destino = 5000000;\nDELETE FROM interseccao WHERE id = 5000000;", "MATCH (n:Intersecao {id: 5000000})\nDETACH DELETE n;"],
  ], true),
  gap(),
  p("Observação: no MySQL o Delete exige duas etapas por causa das chaves estrangeiras. No Neo4j, o DETACH DELETE remove o nó e seus relacionamentos de uma vez."),

  h1("6. Exemplo funcionando: roteamento de entregas"),
  p("Na Entrega 1 citamos o eBay Now, que usa o Neo4j para rotear entregas. Montamos um exemplo equivalente sobre a nossa malha viária: dado um depósito e várias paradas de entrega, o programa calcula o menor caminho entre cada par de pontos nos dois bancos, monta a rota pelo vizinho mais próximo (ida e volta ao depósito) e compara resultado e tempo."),
  p([b("Execução 1: "), t("depósito 0 e 5 paradas a até 8 trechos (193, 383, 424, 35695 e 92).")]),
  table([2400, 1800, 4826], ["Banco", "Tempo (15 pares)", "Rota"], [
    ["Neo4j", "82,2 ms", "0 → 383 → 193 → 424 → 35695 → 92 → 0 (43 trechos)"],
    ["MySQL", "78,7 ms", "0 → 383 → 193 → 424 → 35695 → 92 → 0 (43 trechos)"],
  ]),
  gap(),
  p([b("Execução 2: "), t("depósito 0 e 6 paradas a até 25 trechos (2870, 34893, 41759, 39254, 33306 e 41695).")]),
  table([2400, 1800, 4826], ["Banco", "Tempo (21 pares)", "Rota"], [
    ["Neo4j", "121,4 ms", "0 → 41759 → 2870 → 34893 → 39254 → 33306 → 41695 → 0 (145 trechos)"],
    ["MySQL", "28.741 ms", "0 → 41759 → 2870 → 34893 → 39254 → 33306 → 41695 → 0 (145 trechos)"],
  ]),
  gap(),
  p("Nas duas execuções as matrizes de distância e as rotas foram idênticas nos dois bancos."),
  p([b("Como ler esses tempos: "), t("cada um é uma única execução, e não uma medição. Servem como indício, não como resultado. Há também uma diferença de método: no MySQL o menor caminho é uma consulta recursiva (CTE) que explora toda a região até o limite de saltos, sem parar quando acha o destino, enquanto o shortestPath do Neo4j é um algoritmo próprio de caminho mínimo. Essa diferença é, em si, uma característica do paradigma, mas a Entrega 3 vai medir com rigor: 10 execuções por consulta, medianas, cache controlado e também os casos em que o MySQL empata ou vence.")]),

  h1("7. Como reproduzir"),
  ...code(["cd entrega2", "npm install", ".\\scripts\\carregar.ps1", "node scripts\\demo-entregas.js --deposito 0 --paradas 5 --raio 8"]),
  gap(),
  p("As instruções completas, as portas e as verificações estão em entrega2/README.md."),

  h1("8. Limitações e próximos passos"),
  bullet("O dataset não tem distância nem coordenadas: o menor caminho é em número de trechos."),
  bullet("A rota do exemplo usa a heurística do vizinho mais próximo, que não é a rota ótima. O foco aqui é mostrar o uso do grafo."),
  bullet("Entrega 3: experimentos com as consultas Q1 a Q4 do plano, com a metodologia rigorosa citada acima."),
  bullet("Entrega 4: dashboard com os dois bancos, filtros e comparação de tempos."),
  bullet("O professor ainda precisa validar o Neo4j como SGBD do projeto, e a confirmação das datas das entregas segue pendente."),
];

const doc = new Document({
  creator: "Equipe", title: "Projeto 3 - Entrega 2 - Neo4j x MySQL",
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
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Projeto 3 · NoSQL orientado a grafos · Entrega 2 · página ", font: FONT, size: 18, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "666666" })] })] }) },
    children: body,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("Entrega2-Projeto3-NoSQL-Grafos.docx", buf); console.log("ok"); });
