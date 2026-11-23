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

// Números lidos dos resultados reais (rode entrega2\scripts\gerar-evidencias.ps1 antes de gerar o documento)
const ler = (a) => JSON.parse(fs.readFileSync(require("path").join(__dirname, "entrega2", a), "utf8").replace(/^﻿/, ""));
const r = ler("dados/resumo.json"), tc = ler("dados/tempos-carga.json"), n = ler("evidencias/numeros.json");
const d8 = n.demo_raio8, d25 = n.demo_raio25;
const f = (x) => Number(x).toLocaleString("pt-BR");
const s1 = (x) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ms = (x) => (x >= 1000 ? f(Math.round(x)) : s1(x));
const pct = (x) => Math.round((100 * x) / r.estradas) + "%";
const osmnx = (r.fonte.match(/OSMnx ([\d.]+)/) || [])[1];
const dataBr = r.extraido_em.split("-").reverse().join("/");
const iguais = ["intersecoes", "estradas", "mao_unica", "com_nome", "km_total", "mao_dupla_sem_volta"].every((k) => Number(n.mysql[k]) === Number(n.neo4j[k]));

const body = [
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: "Projeto 3 · Bancos de Dados NoSQL", font: FONT, size: 26, color: TEAL, bold: true })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Neo4j × MySQL em uma malha viária: problema, modelagem e dados", font: "Cambria", size: 50, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Entrega 2: Vantagens e desvantagens, definição do problema e modelagem", font: FONT, size: 30, color: "444444" })] }),
  p([b("Data da entrega: "), t("17/11/2026")]),
  p([b("Disciplina: "), t("____________________________")]),
  p([b("Equipe: "), t("____________________________")]),
  new Paragraph({ pageBreakBefore: true, children: [] }),

  h1("1. O que esta entrega cobre"),
  bullet([b("Principais vantagens e desvantagens "), t("do paradigma de grafos e do Neo4j, ligadas ao nosso problema (seção 2).")]),
  bullet([b("Definição do problema: "), t("cenário, perguntas que o sistema precisa responder e dados usados (seção 3).")]),
  bullet([b("Modelagem no relacional e no não relacional: "), t("MySQL e Neo4j, com as diferenças entre os dois (seção 4).")]),
  bullet([b("Apoio: "), t("carga dos dados, evidência do volume, CRUD equivalente e um exemplo funcionando (seções 5 a 8).")]),
  p([b("Mudança em relação à Entrega 1: "), t("trocamos o conjunto de dados. O roadNet-CA (SNAP) só trazia os identificadores das interseções. Passamos a usar a malha viária do OpenStreetMap, baixada com a biblioteca OSMnx, que traz nome e classificação da via, comprimento, mão única e coordenadas. Isso deixa o problema mais realista e dá os campos de que os filtros do dashboard (Entrega 4) vão precisar.")]),
  p("Todas as saídas apresentadas aqui foram geradas pelos scripts do projeto e estão salvas na pasta evidencias/."),

  h1("2. Principais vantagens e desvantagens"),
  h2("2.1 Vantagens"),
  table([2600, 6426], ["Vantagem", "O que significa no nosso problema"], [
    ["Travessias de vários saltos eficientes", "Alcance a partir de um ponto e menor caminho são travessias: o banco segue os relacionamentos de cada nó, sem JOIN a cada salto."],
    ["Modelo próximo do domínio", "Uma malha viária já é um grafo: interseção vira nó e trecho de via vira relacionamento. A consulta em Cypher descreve o caminho quase como um desenho."],
    ["Esquema flexível", "Uma propriedade nova (por exemplo, via bloqueada) é gravada só nos relacionamentos que precisam, sem alterar a estrutura do banco."],
    ["Transações ACID", "Mesma garantia do relacional para criar, alterar e remover interseções e vias."],
  ]),
  gap(),
  h2("2.2 Desvantagens"),
  table([2600, 6426], ["Desvantagem", "O que significa no nosso problema"], [
    ["Agregações em massa tendem a ser menos eficientes", "Perguntas como total de quilômetros por tipo de via ou por cidade são o terreno do relacional. O dashboard vai ter filtros desse tipo, e esperamos que o MySQL empate ou vença neles."],
    ["Escala horizontal limitada", "Na edição Community o banco roda em um único servidor. Para o nosso volume isso basta."],
    ["Clustering só na edição Enterprise", "Alta disponibilidade exigiria a versão paga."],
    ["Cypher é menos difundida que SQL", "Curva de aprendizado para a equipe e menos ferramentas prontas."],
  ]),
  gap(),
  p([b("Quando escolher: "), t("quando o valor está nas conexões e as consultas percorrem vários saltos. "), b("Quando evitar: "), t("quando os dados são tabulares e as consultas são sobretudo agregações e relatórios. As vantagens de desempenho acima são hipóteses da literatura: a Entrega 3 vai medi-las no nosso cenário.")]),

  h1("3. Definição do problema"),
  p([b("Cenário: "), t("rotas em uma malha viária urbana, como em um aplicativo de GPS ou de entregas. O sistema guarda as interseções e os trechos de via das capitais brasileiras e precisa responder a perguntas sobre como se deslocar por elas.")]),
  p([b("Perguntas que o sistema precisa responder:")]),
  bullet("Para onde dá para ir saindo de uma interseção, e por quais vias?"),
  bullet("Quais interseções ficam ao alcance de um ponto em até N trechos?"),
  bullet("Qual é o menor caminho entre dois pontos, respeitando a mão das vias?"),
  bullet("Quais vias atendem a um filtro: cidade, classificação (residencial, avenida, rodovia), nome, mão única?"),
  p([b("Por que é um bom problema para comparar os dois paradigmas: "), t("as três primeiras perguntas são travessias, em que o grafo deve ir bem. A última é filtro e agregação, em que o relacional deve ir bem. O mesmo conjunto de dados permite mostrar os dois lados.")]),
  p([b("Dados: "), t(`malha viária para automóveis (network_type "drive") de ${r.capitais} capitais brasileiras, extraída do OpenStreetMap com a biblioteca OSMnx ${osmnx} em ${dataBr}. Licença ODbL, © colaboradores do OpenStreetMap.`)]),
  table([4513, 4513], ["Item", "Quantidade"], [
    ["Interseções (nós)", f(r.intersecoes)],
    ["Trechos de via (arestas, um por sentido)", f(r.estradas)],
    ["Total de registros", f(r.registros)],
    ["Trechos de mão única", `${f(r.mao_unica)} (${pct(r.mao_unica)})`],
    ["Trechos com nome", `${f(r.com_nome)} (${pct(r.com_nome)})`],
    ["Trechos com velocidade máxima informada", `${f(r.com_velocidade_max)} (${pct(r.com_velocidade_max)})`],
    ["Extensão total", `${f(r.km_total)} km`],
  ]),
  gap(),
  p([b("Significado de \"registro\": "), t("uma interseção ou um trecho de via em um sentido. O total passa do mínimo de 1 milhão exigido no enunciado.")]),
  p([b("Maiores cidades do conjunto:")]),
  table([3600, 2713, 2713], ["Cidade", "Interseções", "Trechos de via"],
    [...r.por_cidade].sort((a, c) => c.intersecoes - a.intersecoes).slice(0, 6).map((c) => [`${c.cidade} (${c.uf})`, f(c.intersecoes), f(c.estradas)])),
  gap(),
  p("As capitais não são vizinhas entre si, então cada uma forma uma malha separada: as rotas são sempre dentro de uma cidade."),

  h1("4. Modelagem no relacional e no não relacional"),
  h2("4.1 MySQL (relacional)"),
  ...code([
    "interseccao                          estrada",
    "+--------------------+               +----------------------------------+",
    "| id      (PK)       | 1 -------- N  | origem   (PK, FK -> id)          |",
    "| osm_id             |               | destino  (PK, FK -> id)          |",
    "| lat, lon           |               | chave    (PK)                    |",
    "| cidade, uf         |               | nome, tipo                       |",
    "| ruas               |               | comprimento_m, mao_unica         |",
    "+--------------------+               | velocidade_max, faixas           |",
    "                                     | bloqueada (TINYINT, padrão 0)    |",
    "                                     +----------------------------------+",
    "índices: PK(origem, destino, chave), idx_destino(destino), idx_tipo(tipo), idx_cidade(cidade)",
  ]),
  gap(),
  h2("4.2 Neo4j (grafo)"),
  ...code([
    "(:Intersecao {id, osm_id, lat, lon, cidade, uf, ruas})",
    "   -[:LIGA_A {chave, nome, tipo, comprimento_m, mao_unica, velocidade_max, faixas, bloqueada}]->",
    "(:Intersecao {...})",
    "restrição de unicidade (e índice) em Intersecao.id",
  ]),
  gap(),
  h2("4.3 Diferenças entre os dois modelos"),
  table([2200, 3413, 3413], ["Ponto", "MySQL", "Neo4j"], [
    ["O trecho de via", "Linha da tabela estrada, ligada por duas chaves estrangeiras", "Relacionamento :LIGA_A, guardado como ponteiro entre os nós"],
    ["Achar vizinhos", "Busca no índice da PK (origem) e JOIN a cada salto", "Segue os relacionamentos do nó, sem JOIN"],
    ["Dados descritivos da via", "Colunas da tabela estrada; ausente vira NULL", "Propriedades do relacionamento; ausente simplesmente não existe"],
    ["Propriedade nova (bloqueada)", "ALTER TABLE (ADD COLUMN INSTANT) para toda a tabela", "Basta gravar a propriedade no relacionamento"],
    ["Integridade", "Chaves estrangeiras", "Todo relacionamento exige os dois nós"],
  ]),
  gap(),
  h2("4.4 Decisões de modelagem (valem para os dois bancos)"),
  bullet([b("Sentido: "), t("cada linha ou relacionamento é um trecho em um sentido. Via de mão dupla vira dois trechos; via de mão única, um só. Assim o menor caminho respeita a mão das vias.")]),
  bullet([b("Trechos paralelos: "), t("duas interseções podem ser ligadas por mais de uma via. O campo chave distingue esses trechos e entra na chave primária do MySQL.")]),
  bullet([b("Identificador: "), t("a interseção recebe um id sequencial, mais compacto, e mantém o identificador original do OpenStreetMap em osm_id.")]),

  h1("5. Dados e carga"),
  table([3000, 6026], ["Item", "Valor"], [
    ["Origem", `OpenStreetMap, via OSMnx ${osmnx}; ${r.capitais} capitais brasileiras; extração de ${dataBr}`],
    ["Preparo", "Script Python (scripts/extrair-osm.py) baixa cada capital, simplifica a malha para interseções e trechos e gera intersecoes.csv e estradas.csv, usados pelos dois bancos"],
    ["Registros", `${f(r.intersecoes)} interseções + ${f(r.estradas)} trechos de via = ${f(r.registros)}`],
    ["Carga MySQL", `LOAD DATA INFILE, ${s1(tc.mysql_carga)} s`],
    ["Carga Neo4j", `neo4j-admin database import (offline), ${s1(tc.neo4j_import)} s, mais ${s1(tc.neo4j_indice_unico)} s para criar a restrição de unicidade`],
  ]),
  gap(),
  p(`Ambiente: Intel Core Ultra 5 225H, 15,4 GB de RAM, Windows 11, Docker Desktop. MySQL ${n.mysql_versao} (buffer pool de 2 GB) e Neo4j ${n.neo4j_versao} Community (heap de 2 GB e cache de páginas de 2 GB). A carga do Neo4j é uma importação offline, o que é bem mais rápido que inserir por consultas. Os tempos de carga dos dois não são uma comparação de desempenho de consulta.`),

  h1("6. Evidência do volume e da integridade"),
  table([3600, 2713, 2713], ["Verificação", "MySQL", "Neo4j"], [
    ["Interseções", f(n.mysql.intersecoes), f(n.neo4j.intersecoes)],
    ["Trechos de via", f(n.mysql.estradas), f(n.neo4j.estradas)],
    ["Trechos de mão única", f(n.mysql.mao_unica), f(n.neo4j.mao_unica)],
    ["Trechos com nome", f(n.mysql.com_nome), f(n.neo4j.com_nome)],
    ["Extensão total (km)", f(n.mysql.km_total), f(n.neo4j.km_total)],
    ["Trechos sem interseção (órfãos)", f(n.mysql.orfas), "não se aplica (o relacionamento exige os dois nós)"],
    ["Mão dupla sem o trecho de volta", f(n.mysql.mao_dupla_sem_volta), f(n.neo4j.mao_dupla_sem_volta)],
    ["Tamanho no disco", `dados ${s1(n.mysql_dados_mb)} MB + índices ${s1(n.mysql_indices_mb)} MB: cerca de ${f(Math.round(n.mysql_dados_mb + n.mysql_indices_mb))} MB`, `armazenamento do banco: ${f(n.neo4j_mb)} MB (o log de transações não entra)`],
  ]),
  gap(),
  p((iguais ? "Os dois bancos têm exatamente os mesmos números. " : "ATENÇÃO: os números dos dois bancos não bateram; revisar a carga. ") + "Os tamanhos são de estruturas diferentes e não devem ser lidos como uma disputa de eficiência."),

  h1("7. CRUD equivalente"),
  p(`Executado com a interseção nova 5000000 ligada à interseção 0 (${d8.cidade}). Nos dois bancos a leitura devolveu os mesmos vizinhos (${n.vizinhos_da_0} e a nova 5000000) e, no fim, nenhum registro restou.`),
  table([1300, 3863, 3863], ["Operação", "MySQL", "Neo4j (Cypher)"], [
    ["Create", "INSERT INTO interseccao (id, osm_id, lat,\n  lon, cidade, uf, ruas)\nSELECT 5000000, 0, lat + 0.0005, lon,\n  cidade, uf, 1\n  FROM interseccao WHERE id = 0;\nINSERT INTO estrada (origem, destino, chave,\n  nome, tipo, comprimento_m, mao_unica)\nVALUES (5000000, 0, 0, 'Rua do Projeto 3',\n  'residential', 55.6, 0), (0, 5000000, ...);", "MATCH (m:Intersecao {id: 0})\nCREATE (n:Intersecao {id: 5000000,\n  lat: m.lat + 0.0005, lon: m.lon,\n  cidade: m.cidade, uf: m.uf, ...})\nCREATE (n)-[:LIGA_A {nome:\n  'Rua do Projeto 3', tipo: 'residential',\n  comprimento_m: 55.6, ...}]->(m),\n  (m)-[:LIGA_A {...}]->(n);"],
    ["Read", "SELECT destino, nome, tipo,\n  comprimento_m, mao_unica\n  FROM estrada WHERE origem = 0;", "MATCH (:Intersecao {id: 0})-[r:LIGA_A]->(v)\nRETURN v.id, r.nome, r.tipo,\n  r.comprimento_m, r.mao_unica;"],
    ["Update", "UPDATE estrada SET bloqueada = 1\n WHERE (origem = 0 AND destino = 5000000)\n    OR (origem = 5000000 AND destino = 0);", "MATCH (a:Intersecao {id: 0})-[r:LIGA_A]-\n      (b:Intersecao {id: 5000000})\nSET r.bloqueada = true;"],
    ["Delete", "DELETE FROM estrada\n WHERE origem = 5000000 OR destino = 5000000;\nDELETE FROM interseccao WHERE id = 5000000;", "MATCH (n:Intersecao {id: 5000000})\nDETACH DELETE n;"],
  ], true),
  gap(),
  p("Observação: no MySQL o Delete exige duas etapas por causa das chaves estrangeiras. No Neo4j, o DETACH DELETE remove o nó e seus relacionamentos de uma vez."),

  h1("8. Exemplo funcionando: roteamento de entregas"),
  p("Na Entrega 1 citamos o eBay Now, que usa o Neo4j para rotear entregas. Montamos um exemplo equivalente sobre a nossa malha viária: dado um depósito e várias paradas de entrega, o programa calcula o menor caminho entre cada par de pontos nos dois bancos (ida e volta, porque há vias de mão única), monta a rota pelo vizinho mais próximo e compara resultado e tempo."),
  ...[d8, d25].flatMap((d, i) => [
    p([b(`Execução ${i + 1}: `), t(`depósito ${d.deposito} (${d.cidade}) e ${d.paradas.length} paradas a até ${d.raio} trechos (${d.paradas.join(", ")}).`)]),
    table([2400, 1800, 4826], ["Banco", `Tempo (${d.pares} pares)`, "Rota"], [
      ["Neo4j", `${ms(d.neo4j_ms)} ms`, `${d.rota.join(" → ")} (${d.trechos} trechos)`],
      ["MySQL", `${ms(d.mysql_ms)} ms`, `${d.rota.join(" → ")} (${d.trechos} trechos)`],
    ]),
    gap(),
  ]),
  p(d8.matrizes_iguais && d25.matrizes_iguais ? "Nas duas execuções as matrizes de distância e as rotas foram idênticas nos dois bancos." : "ATENÇÃO: as matrizes de distância não foram idênticas nos dois bancos; revisar."),
  p([b("Como ler esses tempos: "), t("cada um é uma única execução, e não uma medição. Servem como indício, não como resultado. Há também uma diferença de método: no MySQL o menor caminho é uma consulta recursiva (CTE) que explora toda a região até o limite de saltos, sem parar quando acha o destino, enquanto o shortestPath do Neo4j é um algoritmo próprio de caminho mínimo. Essa diferença é, em si, uma característica do paradigma, mas a Entrega 3 vai medir com rigor: 10 execuções por consulta, medianas, cache controlado e também os casos em que o MySQL empata ou vence.")]),

  h1("9. Como reproduzir"),
  ...code(["cd entrega2", "npm install", ".\\scripts\\carregar.ps1", ".\\scripts\\testar.ps1"]),
  gap(),
  p("As instruções completas, as portas e as verificações estão em entrega2/README.md."),

  h1("10. Limitações e próximos passos"),
  bullet("O menor caminho do exemplo ainda é em número de trechos. Os dados já têm o comprimento de cada trecho; o caminho em quilômetros fica para as próximas entregas."),
  bullet(`Velocidade máxima e número de faixas só existem em parte das vias (velocidade em ${pct(r.com_velocidade_max)} dos trechos), porque dependem do que foi mapeado no OpenStreetMap.`),
  bullet("Os dados do OpenStreetMap mudam todo dia: uma nova extração dá números um pouco diferentes. Os números deste documento são os da extração indicada na seção 3."),
  bullet("A rota do exemplo usa a heurística do vizinho mais próximo, que não é a rota ótima. O foco aqui é mostrar o uso do grafo."),
  bullet("Entrega 3: experimentos com as consultas Q1 a Q4 do plano, com a metodologia rigorosa citada acima."),
  bullet("Entrega 4: dashboard com os dois bancos, filtros (cidade, tipo de via, nome) e comparação de tempos."),
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
