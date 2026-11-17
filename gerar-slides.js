const pptxgen = require("pptxgenjs");

const INK = "12263A", TEAL = "1F7A8C", AMBER = "F2A541", PALE = "EAF2F5", GRAY = "5B6B78", WHITE = "FFFFFF";
const HEAD = "Cambria", BODY = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625
pres.title = "Projeto 3 - NoSQL orientado a grafos - Entrega 1";
pres.author = "Equipe";

// Números lidos dos resultados reais (rode entrega2\scripts\gerar-evidencias.ps1 antes de gerar os slides)
const D = (() => {
  const fs = require("fs"), path = require("path");
  const ler = (a) => JSON.parse(fs.readFileSync(path.join(__dirname, "entrega2", a), "utf8").replace(/^﻿/, ""));
  const r = ler("dados/resumo.json"), tc = ler("dados/tempos-carga.json"), n = ler("evidencias/numeros.json");
  const f = (x) => Number(x).toLocaleString("pt-BR");
  const s1 = (x) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    r, tc, n, f, s1, d8: n.demo_raio8, d25: n.demo_raio25,
    ms: (x) => f(Math.round(x)),
    pct: (x) => Math.round((100 * x) / r.estradas) + "%",
    milhoes: s1(r.registros / 1e6),
    dataBr: r.extraido_em.split("-").reverse().join("/"),
    iguais: ["intersecoes", "estradas", "mao_unica", "com_nome", "km_total", "mao_dupla_sem_volta"].every((k) => Number(n.mysql[k]) === Number(n.neo4j[k])),
  };
})();

let n = 0;
function base(title, fonte, badge) {
  const s = pres.addSlide();
  n++;
  s.background = { color: WHITE };
  s.addText(title, { x: 0.5, y: 0.25, w: badge ? 7.5 : 9, h: 0.7, fontFace: HEAD, fontSize: 28, bold: true, color: INK, margin: 0, valign: "middle", isTextBox: true });
  s.addText(fonte || "Projeto 3 · NoSQL orientado a grafos · Entrega 1", { x: 0.5, y: 5.2, w: 8.3, h: 0.3, fontFace: BODY, fontSize: 10, color: GRAY, margin: 0, isTextBox: true });
  if (badge) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.2, y: 0.3, w: 1.3, h: 0.4, fill: { color: AMBER }, line: { color: AMBER }, rectRadius: 0.1 });
    s.addText(badge, { x: 8.2, y: 0.3, w: 1.3, h: 0.4, align: "center", valign: "middle", fontFace: BODY, fontSize: 13, bold: true, color: INK, margin: 0, isTextBox: true });
  }
  s.addText(String(n), { x: 9, y: 5.2, w: 0.5, h: 0.3, fontFace: BODY, fontSize: 10, color: GRAY, align: "right", margin: 0, isTextBox: true });
  return s;
}
function bullets(items) {
  return items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 5 } }));
}
function card(s, x, y, w, h, head, body, headColor = TEAL, bodySize = 13) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText(head, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35, fontFace: BODY, fontSize: 15, bold: true, color: headColor, margin: 0, isTextBox: true });
  s.addText(body, { x: x + 0.15, y: y + 0.46, w: w - 0.3, h: h - 0.54, fontFace: BODY, fontSize: bodySize, color: INK, margin: 0, valign: "top", isTextBox: true });
}
const th = (t, fill = TEAL) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: fill }, fontFace: BODY, fontSize: 12 } });
const td = (t, bold) => ({ text: t, options: { fontFace: BODY, fontSize: 12, color: INK, bold: !!bold } });
const tblOpts = { border: { type: "solid", color: "D5DEE3", pt: 0.5 } };

// 1. Capa
{
  const s = pres.addSlide(); n++;
  s.background = { color: INK };
  const pts = [[6.6, 1.0], [8.2, 0.7], [9.0, 2.0], [7.6, 2.5], [6.4, 2.9], [8.6, 3.6], [7.2, 4.2]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [3, 5], [4, 6], [6, 5], [0, 4]];
  edges.forEach(([a, b]) => {
    const [x1, y1] = pts[a], [x2, y2] = pts[b];
    s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipV: (x2 - x1) * (y2 - y1) < 0, line: { color: TEAL, width: 1.5 } });
  });
  pts.forEach(([x, y], i) => s.addShape(pres.shapes.OVAL, { x: x - 0.15, y: y - 0.15, w: 0.3, h: 0.3, fill: { color: i === 3 ? AMBER : TEAL }, line: { color: i === 3 ? AMBER : TEAL } }));
  s.addText("Bancos de dados NoSQL orientados a grafos", { x: 0.6, y: 1.2, w: 5.6, h: 1.6, fontFace: HEAD, fontSize: 34, bold: true, color: WHITE, margin: 0, valign: "top", isTextBox: true });
  s.addText(`Neo4j × MySQL em uma malha viária com ${D.milhoes} milhões de registros`, { x: 0.6, y: 3.0, w: 5.4, h: 0.8, fontFace: BODY, fontSize: 18, color: "CADCE3", margin: 0, valign: "top", isTextBox: true });
  s.addText("Projeto 3 · Entrega 1: Pesquisa e planejamento · 10/11", { x: 0.6, y: 4.6, w: 6, h: 0.4, fontFace: BODY, fontSize: 14, color: AMBER, margin: 0, isTextBox: true });
}

// 2. Paradigma + aplicações
{
  const s = base("O paradigma de grafos e onde é usado");
  s.addText(bullets([
    "Nós representam entidades; relacionamentos ligam os nós",
    "Nós e relacionamentos têm propriedades (property graph)",
    "O relacionamento é guardado, e não calculado em JOIN",
    "Consultas sobre conexões: \"quem chega em quem, em quantos saltos\"",
  ]), { x: 0.5, y: 1.2, w: 5.0, h: 2.5, fontFace: BODY, fontSize: 15, color: INK, valign: "top", margin: 0, isTextBox: true });
  const P = { a: [6.4, 1.7], b: [8.6, 1.4], c: [7.5, 3.0], d: [9.1, 3.3] };
  [["a", "b"], ["a", "c"], ["b", "c"], ["c", "d"]].forEach(([p, q]) => {
    const [x1, y1] = P[p], [x2, y2] = P[q];
    s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipV: (x2 - x1) * (y2 - y1) < 0, line: { color: GRAY, width: 2 } });
  });
  Object.entries(P).forEach(([k, [x, y]]) => {
    s.addShape(pres.shapes.OVAL, { x: x - 0.28, y: y - 0.28, w: 0.56, h: 0.56, fill: { color: TEAL }, line: { color: WHITE, width: 2 } });
    s.addText(k.toUpperCase(), { x: x - 0.28, y: y - 0.28, w: 0.56, h: 0.56, align: "center", valign: "middle", fontFace: BODY, fontSize: 14, bold: true, color: WHITE, margin: 0, isTextBox: true });
  });
  const apps = [["Rotas e logística", "Menor caminho e entregas"], ["Redes sociais", "Amigos de amigos"], ["Fraude", "Contas e transações ligadas"], ["Recomendação", "Quem comprou X, comprou Y"]];
  apps.forEach(([h, d], i) => card(s, 0.5 + i * 2.28, 3.85, 2.15, 1.2, h, d, TEAL, 12));
}

// 3. Neo4j + arquitetura
{
  const s = base("Neo4j: visão geral e arquitetura", "Licenciamento: neo4j.com/licensing · Download: neo4j.com/download");
  const boxes = ["Cliente (Cypher, Bolt/HTTP)", "Processador de consultas", "Cache de páginas (RAM)", "Armazenamento nativo de grafo"];
  boxes.forEach((h, i) => {
    const x = 0.5 + i * 2.35;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.2, w: 2.0, h: 0.85, fill: { color: i === 3 ? TEAL : PALE }, line: { color: i === 3 ? TEAL : PALE }, rectRadius: 0.08 });
    s.addText(h, { x: x + 0.1, y: 1.2, w: 1.8, h: 0.85, fontFace: BODY, fontSize: 13, bold: true, color: i === 3 ? WHITE : INK, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) s.addShape(pres.shapes.LINE, { x: x + 2.0, y: 1.62, w: 0.35, h: 0, line: { color: GRAY, width: 2, endArrowType: "triangle" } });
  });
  s.addText(bullets([
    "SGBD de grafos nativo, da Neo4j, Inc.",
    "Linguagem Cypher e transações ACID",
    "Community: gratuita, GPLv3",
    "Enterprise: licença comercial",
    "Usaremos a imagem Docker oficial",
  ]), { x: 0.5, y: 2.35, w: 4.4, h: 2.7, fontFace: BODY, fontSize: 14, color: INK, valign: "top", margin: 0, isTextBox: true });
  card(s, 5.2, 2.35, 4.3, 2.6, "Adjacência sem índice", "Cada nó guarda referências diretas aos seus relacionamentos. Seguir uma aresta não exige índice nem JOIN. O custo da travessia cresce com o trecho do grafo visitado, e não com o tamanho total da base.", TEAL, 13);
}

// 4. Escalabilidade + prós e contras
{
  const s = base("Escalabilidade, vantagens e desvantagens");
  card(s, 0.5, 1.2, 4.35, 1.8, "Community (a que vamos usar)", "Instância única. Escala na vertical: mais RAM para o cache, SSD e CPU. Sem clustering.", TEAL, 13);
  card(s, 5.15, 1.2, 4.35, 1.8, "Enterprise", "Cluster com alta disponibilidade, réplicas de leitura e backup online. Licença comercial.", AMBER, 13);
  card(s, 0.5, 3.2, 4.35, 1.85, "Vantagens", "Travessias de vários saltos eficientes. Consultas legíveis e próximas do domínio. Esquema flexível e ACID.", TEAL, 13);
  card(s, 5.15, 3.2, 4.35, 1.85, "Desvantagens", "Agregações em massa menos eficientes. Escala horizontal limitada. Cypher menos difundida que SQL.", "B5532A", 13);
}

// 5. Casos reais
{
  const s = base("Aplicações reais no mercado", "Fonte: estudos de caso da Neo4j (neo4j.com/case-studies). Números autodeclarados, não verificados de forma independente.");
  s.addTable([
    [th("Organização"), th("Uso"), th("Resultado declarado")],
    [td("Empresa global de entregas (não nomeada)"), td("Roteamento e rastreio em tempo real"), td("Cerca de 5 milhões de encomendas por dia")],
    [td("eBay"), td("Roteamento de entregas (eBay Now)"), td("Caso publicado pela Neo4j")],
    [td("Walmart"), td("Recomendações em tempo real"), td("Caso publicado pela Neo4j")],
    [td("BNP Paribas Personal Finance"), td("Detecção de fraude"), td("Redução de 20% em fraudes")],
  ], { x: 0.5, y: 1.3, w: 9, colW: [2.9, 3.4, 2.7], rowH: 0.6, ...tblOpts });
}

// 6. Comparação
{
  const s = base("Grafo × relacional: comparação teórica");
  const rows = [
    ["Modelo de dados", "Nós, relacionamentos, propriedades", "Tabelas, linhas e colunas"],
    ["Associações", "Relacionamento armazenado", "Chave estrangeira e JOIN"],
    ["Consulta", "Cypher", "SQL"],
    ["Consistência", "ACID", "ACID"],
    ["Índices", "Para achar o nó inicial", "Em todo o acesso"],
    ["Escala", "Vertical (Community)", "Vertical, réplicas"],
    ["Melhor para", "Conexões profundas", "Dados tabulares, agregações"],
  ];
  s.addTable([[th("", INK), th("Neo4j (grafo)", INK), th("MySQL (relacional)", INK)], ...rows.map(([a, b, c]) => [td(a, true), td(b), td(c)])],
    { x: 0.5, y: 1.2, w: 9, colW: [2.2, 3.4, 3.4], rowH: 0.45, ...tblOpts });
}

// 7. Cenário + modelagem
{
  const s = base("Cenário e modelagem", `Dataset atualizado na Entrega 2: OpenStreetMap via OSMnx, ${D.r.capitais} capitais brasileiras (antes: SNAP roadNet-CA). Detalhes nos slides 10 e 11.`);
  const st = [[D.f(D.r.intersecoes), "interseções (nós)"], [D.f(D.r.estradas), "trechos de via (arestas)"], [D.f(D.r.registros), "registros no total"]];
  st.forEach(([num, lab], i) => {
    const x = 0.5 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.15, w: 2.9, h: 1.1, fill: { color: i === 2 ? INK : PALE }, line: { color: i === 2 ? INK : PALE }, rectRadius: 0.08 });
    s.addText(num, { x, y: 1.2, w: 2.9, h: 0.6, align: "center", valign: "middle", fontFace: HEAD, fontSize: 26, bold: true, color: i === 2 ? AMBER : TEAL, margin: 0, isTextBox: true });
    s.addText(lab, { x, y: 1.8, w: 2.9, h: 0.35, align: "center", fontFace: BODY, fontSize: 13, color: i === 2 ? WHITE : GRAY, margin: 0, isTextBox: true });
  });
  s.addText("Malha viária das capitais brasileiras: o alcance em vários saltos e o menor caminho são travessias.", { x: 0.5, y: 2.45, w: 9, h: 0.4, fontFace: BODY, fontSize: 14, color: INK, margin: 0, isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 3.0, w: 4.35, h: 1.95, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText("MySQL", { x: 0.65, y: 3.05, w: 4, h: 0.3, fontFace: BODY, fontSize: 14, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText("interseccao(id PK, cidade, lat, lon...)\nestrada(origem FK, destino FK,\n  nome, tipo, comprimento_m...)\nÍndices em origem e destino", { x: 0.65, y: 3.4, w: 4.1, h: 1.45, fontFace: "Courier New", fontSize: 12, color: INK, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.15, y: 3.0, w: 4.35, h: 1.95, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText("Neo4j", { x: 5.3, y: 3.05, w: 4, h: 0.3, fontFace: BODY, fontSize: 14, bold: true, color: TEAL, margin: 0, isTextBox: true });
  s.addText("(:Intersecao {id, cidade, lat, lon...})\n  -[:LIGA_A {nome, tipo...}]->\n(:Intersecao {...})\nÍndice único em id", { x: 5.3, y: 3.4, w: 4.1, h: 1.45, fontFace: "Courier New", fontSize: 12, color: INK, margin: 0, valign: "top", isTextBox: true });
}

// 8. Experimentos + plano
{
  const s = base("Experimentos e plano de implementação", "Hipóteses: ainda não medimos nada. Datas de 17/11 a 24/11: confirmar com o professor qual entrega cai em qual dia.");
  s.addTable([
    [th("Consulta"), th("Hipótese a testar")],
    [td("Q1. Alcance em k saltos (k de 2 a 5)"), td("Grafo ganha, e a diferença cresce com k")],
    [td("Q2. Menor caminho entre dois pontos"), td("Grafo ganha; no SQL, CTE recursiva")],
    [td("Q3. Vizinhos diretos de um nó"), td("Empate ou relacional melhor")],
    [td("Q4. Contagem de nós por grau"), td("Relacional tende a ganhar")],
  ], { x: 0.5, y: 1.15, w: 9, colW: [4.5, 4.5], rowH: 0.4, ...tblOpts });
  s.addText("10 execuções por consulta, comparando medianas.", { x: 0.5, y: 3.25, w: 9, h: 0.3, fontFace: BODY, fontSize: 13, color: GRAY, margin: 0, isTextBox: true });
  const steps = [["10/11", "Entrega 1", "Pesquisa e plano"], ["17/11", "Entrega 2", "Problema, modelagem e dados"], ["19/11", "Entrega 3", "Experimentos"], ["24/11", "Entrega 4", "Dashboard e apresentação"]];
  steps.forEach(([d, h, t], i) => {
    const x = 0.5 + i * 2.28;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.7, w: 2.15, h: 1.3, fill: { color: i === 0 ? AMBER : PALE }, line: { color: i === 0 ? AMBER : PALE }, rectRadius: 0.08 });
    s.addText(d, { x: x + 0.12, y: 3.75, w: 1.9, h: 0.35, fontFace: BODY, fontSize: 16, bold: true, color: INK, margin: 0, isTextBox: true });
    s.addText(h, { x: x + 0.12, y: 4.1, w: 1.9, h: 0.3, fontFace: BODY, fontSize: 13, bold: true, color: i === 0 ? INK : TEAL, margin: 0, isTextBox: true });
    s.addText(t, { x: x + 0.12, y: 4.4, w: 1.9, h: 0.55, fontFace: BODY, fontSize: 12, color: INK, margin: 0, valign: "top", isTextBox: true });
  });
}

const E2 = "Entrega 2";
const mono = (t) => ({ text: t, options: { fontFace: "Courier New", fontSize: 11, color: INK } });

// 9. Vantagens e desvantagens no nosso problema
{
  const s = base("Principais vantagens e desvantagens", "Vantagens de desempenho são hipóteses da literatura; a Entrega 3 mede no nosso cenário.", E2);
  s.addTable([
    [th("Vantagens do grafo (Neo4j)"), th("No nosso problema")],
    [td("Travessias de vários saltos eficientes", true), td("Alcance e menor caminho seguem os relacionamentos, sem JOIN a cada salto")],
    [td("Modelo próximo do domínio", true), td("A malha viária já é um grafo: interseção é nó, trecho de via é relacionamento")],
    [td("Esquema flexível e ACID", true), td("Propriedade nova (via bloqueada) sem alterar a estrutura do banco")],
  ], { x: 0.5, y: 1.1, w: 9, colW: [3.4, 5.6], rowH: 0.42, ...tblOpts });
  s.addTable([
    [th("Desvantagens", "B5532A"), th("No nosso problema", "B5532A")],
    [td("Agregações em massa menos eficientes", true), td("Totais por tipo de via ou por cidade são o terreno do relacional")],
    [td("Escala horizontal limitada", true), td("Community roda em um servidor; cluster só na edição Enterprise")],
    [td("Cypher menos difundida que SQL", true), td("Curva de aprendizado e menos ferramentas prontas")],
  ], { x: 0.5, y: 3.05, w: 9, colW: [3.4, 5.6], rowH: 0.42, ...tblOpts });
}

// 10. Definição do problema
{
  const s = base("Definição do problema", `Dados: OpenStreetMap via OSMnx (${D.r.capitais} capitais, extração de ${D.dataBr}), licença ODbL. Substitui o roadNet-CA da Entrega 1, que não tinha dados descritivos.`, E2);
  s.addText("Rotas em uma malha viária urbana, como em um aplicativo de GPS ou de entregas.", { x: 0.5, y: 1.05, w: 9, h: 0.4, fontFace: BODY, fontSize: 15, bold: true, color: TEAL, margin: 0, isTextBox: true });
  const st = [[D.f(D.r.intersecoes), "interseções (nós)"], [D.f(D.r.estradas), "trechos de via (arestas)"], [D.f(D.r.registros), "registros no total"]];
  st.forEach(([num, lab], i) => {
    const x = 0.5 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: 2.9, h: 1.0, fill: { color: i === 2 ? INK : PALE }, line: { color: i === 2 ? INK : PALE }, rectRadius: 0.08 });
    s.addText(num, { x, y: 1.58, w: 2.9, h: 0.55, align: "center", valign: "middle", fontFace: HEAD, fontSize: 26, bold: true, color: i === 2 ? AMBER : TEAL, margin: 0, isTextBox: true });
    s.addText(lab, { x, y: 2.13, w: 2.9, h: 0.35, align: "center", fontFace: BODY, fontSize: 13, color: i === 2 ? WHITE : GRAY, margin: 0, isTextBox: true });
  });
  s.addText("Perguntas que o sistema precisa responder", { x: 0.5, y: 2.75, w: 9, h: 0.35, fontFace: BODY, fontSize: 14, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText(bullets([
    "Para onde dá para ir saindo de uma interseção, e por quais vias?",
    "O que fica ao alcance de um ponto em até N trechos?",
    "Qual é o menor caminho entre dois pontos, respeitando a mão das vias?",
    "Quais vias atendem a um filtro: cidade, tipo de via, nome, mão única?",
  ]), { x: 0.5, y: 3.1, w: 9, h: 1.5, fontFace: BODY, fontSize: 13, color: INK, valign: "top", margin: 0, isTextBox: true });
  s.addText("As três primeiras são travessias (terreno do grafo); a última é filtro e agregação (terreno do relacional).", { x: 0.5, y: 4.65, w: 9, h: 0.4, fontFace: BODY, fontSize: 13, italic: true, color: GRAY, margin: 0, isTextBox: true });
}

// 11. Modelagem
{
  const s = base("Modelagem: relacional × grafo", "Evolução de esquema no MySQL: coluna bloqueada (ADD COLUMN INSTANT). No Neo4j basta gravar a propriedade.", E2);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.1, w: 4.35, h: 2.55, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText("MySQL (relacional)", { x: 0.65, y: 1.15, w: 4, h: 0.3, fontFace: BODY, fontSize: 14, bold: true, color: INK, margin: 0, isTextBox: true });
  s.addText("interseccao(id PK, osm_id, lat, lon,\n  cidade, uf, ruas)\n\nestrada(\n  origem  PK, FK -> id,\n  destino PK, FK -> id,\n  chave   PK,\n  nome, tipo, comprimento_m, mao_unica,\n  velocidade_max, faixas, bloqueada)\n\nÍndices: destino, tipo, cidade", { x: 0.65, y: 1.48, w: 4.15, h: 2.15, fontFace: "Courier New", fontSize: 10, color: INK, margin: 0, valign: "top", isTextBox: true });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.15, y: 1.1, w: 4.35, h: 2.55, fill: { color: PALE }, line: { color: PALE }, rectRadius: 0.08 });
  s.addText("Neo4j (grafo)", { x: 5.3, y: 1.15, w: 4, h: 0.3, fontFace: BODY, fontSize: 14, bold: true, color: TEAL, margin: 0, isTextBox: true });
  s.addText("(:Intersecao {id, osm_id, lat, lon,\n   cidade, uf, ruas})\n\n  -[:LIGA_A {chave, nome, tipo,\n     comprimento_m, mao_unica,\n     velocidade_max, faixas,\n     bloqueada}]->\n\n(:Intersecao {...})\n\nUnicidade e índice em id", { x: 5.3, y: 1.48, w: 4.15, h: 2.15, fontFace: "Courier New", fontSize: 10, color: INK, margin: 0, valign: "top", isTextBox: true });
  s.addText(bullets([
    "Trecho de via: linha com duas chaves estrangeiras × relacionamento direto entre nós",
    "Vizinhos: busca no índice e JOIN a cada salto × seguir os relacionamentos",
    "Um registro por sentido: mão dupla vira dois trechos, mão única vira um",
  ]), { x: 0.5, y: 3.8, w: 9, h: 1.25, fontFace: BODY, fontSize: 13, color: INK, valign: "top", margin: 0, isTextBox: true });
}

// 12. Dados e carga
{
  const s = base("Dados e carga", `Ambiente: Intel Core Ultra 5 225H, 15,4 GB de RAM, MySQL ${D.n.mysql_versao} e Neo4j ${D.n.neo4j_versao} Community, em Docker.`, E2);
  const st = [[D.f(D.r.km_total) + " km", "de vias mapeadas"], [D.pct(D.r.com_nome), "dos trechos com nome"], [D.pct(D.r.mao_unica), "dos trechos em mão única"]];
  st.forEach(([num, lab], i) => {
    const x = 0.5 + i * 3.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.15, w: 2.9, h: 1.1, fill: { color: i === 0 ? INK : PALE }, line: { color: i === 0 ? INK : PALE }, rectRadius: 0.08 });
    s.addText(num, { x, y: 1.2, w: 2.9, h: 0.6, align: "center", valign: "middle", fontFace: HEAD, fontSize: 26, bold: true, color: i === 0 ? AMBER : TEAL, margin: 0, isTextBox: true });
    s.addText(lab, { x, y: 1.8, w: 2.9, h: 0.35, align: "center", fontFace: BODY, fontSize: 13, color: i === 0 ? WHITE : GRAY, margin: 0, isTextBox: true });
  });
  s.addTable([
    [th("Etapa"), th("Como"), th("Tempo")],
    [td("Extração"), td("Script Python com OSMnx baixa cada capital e gera os CSVs"), td("feita uma vez")],
    [td("Carga no MySQL"), td("LOAD DATA INFILE"), td(D.s1(D.tc.mysql_carga) + " s")],
    [td("Carga no Neo4j"), td("neo4j-admin import (offline) + índice único"), td(`${D.s1(D.tc.neo4j_import)} s + ${D.s1(D.tc.neo4j_indice_unico)} s`)],
  ], { x: 0.5, y: 2.55, w: 9, colW: [2.3, 5.0, 1.7], rowH: 0.45, ...tblOpts });
  s.addText("Os dois bancos são carregados dos mesmos arquivos, com um comando: .\\scripts\\carregar.ps1", { x: 0.5, y: 4.55, w: 9, h: 0.4, fontFace: BODY, fontSize: 14, color: INK, margin: 0, isTextBox: true });
}

// 13. Evidência
{
  const s = base("Evidência do volume", "Saídas reais em entrega2/evidencias. Os tamanhos são de estruturas diferentes, não uma disputa de eficiência.", E2);
  const m = D.n.mysql, g = D.n.neo4j;
  s.addTable([
    [th("Verificação", INK), th("MySQL", INK), th("Neo4j", INK)],
    [td("Interseções", true), td(D.f(m.intersecoes)), td(D.f(g.intersecoes))],
    [td("Trechos de via", true), td(D.f(m.estradas)), td(D.f(g.estradas))],
    [td("Trechos de mão única", true), td(D.f(m.mao_unica)), td(D.f(g.mao_unica))],
    [td("Extensão total (km)", true), td(D.f(m.km_total)), td(D.f(g.km_total))],
    [td("Órfãos / mão dupla sem volta", true), td(`${m.orfas} / ${m.mao_dupla_sem_volta}`), td(`n/a / ${g.mao_dupla_sem_volta}`)],
    [td("Tamanho no disco", true), td(`cerca de ${D.f(Math.round(D.n.mysql_dados_mb + D.n.mysql_indices_mb))} MB`), td(`${D.f(D.n.neo4j_mb)} MB`)],
  ], { x: 0.5, y: 1.15, w: 9, colW: [3.4, 2.8, 2.8], rowH: 0.44, ...tblOpts });
  s.addText(D.iguais ? "Os dois bancos têm exatamente os mesmos números." : "ATENÇÃO: os números dos dois bancos não bateram.", { x: 0.5, y: 4.5, w: 9, h: 0.4, fontFace: BODY, fontSize: 15, bold: true, color: TEAL, margin: 0, isTextBox: true });
}

// 14. CRUD
{
  const s = base("CRUD equivalente", `Nova interseção 5000000 ligada à interseção 0 (${D.d8.cidade}). A leitura devolveu os mesmos vizinhos nos dois bancos (${D.n.vizinhos_da_0} e 5000000).`, E2);
  s.addTable([
    [th("", INK), th("MySQL", INK), th("Neo4j (Cypher)", INK)],
    [td("Create", true), mono("INSERT INTO interseccao (id, lat, lon, cidade, ...) ...;\nINSERT INTO estrada (origem, destino, nome, tipo, ...) VALUES (5000000,0,...), (0,5000000,...);"), mono("MATCH (m:Intersecao {id: 0})\nCREATE (n:Intersecao {id: 5000000, ...}),\n  (n)-[:LIGA_A {nome: ..., tipo: ...}]->(m), (m)-[:LIGA_A {...}]->(n)")],
    [td("Read", true), mono("SELECT destino, nome, tipo, comprimento_m FROM estrada WHERE origem = 0;"), mono("MATCH (:Intersecao {id: 0})-[r:LIGA_A]->(v) RETURN v.id, r.nome, r.tipo")],
    [td("Update", true), mono("UPDATE estrada SET bloqueada = 1 WHERE ...;"), mono("MATCH (a)-[r:LIGA_A]-(b) SET r.bloqueada = true")],
    [td("Delete", true), mono("DELETE FROM estrada WHERE ...;\nDELETE FROM interseccao WHERE id = 5000000;"), mono("MATCH (n:Intersecao {id: 5000000}) DETACH DELETE n")],
  ], { x: 0.5, y: 1.1, w: 9, colW: [0.9, 4.5, 3.6], rowH: 0.6, ...tblOpts });
}

// 15. Exemplo funcionando
{
  const s = base("Exemplo: roteamento de entregas", "Cada tempo é uma única execução, e não uma medição. A Entrega 3 mede com 10 execuções e medianas. Código: scripts/demo-entregas.js", E2);
  s.addText(`Estilo eBay Now: um depósito em ${D.d8.cidade} e várias paradas. O programa calcula o menor caminho entre cada par nos dois bancos e monta a rota pelo vizinho mais próximo.`, { x: 0.5, y: 1.1, w: 9, h: 0.75, fontFace: BODY, fontSize: 14, color: INK, margin: 0, valign: "top", isTextBox: true });
  const linha = (d) => [td(`${d.paradas.length} paradas a até ${d.raio} trechos`), td(D.ms(d.neo4j_ms) + " ms"), td(D.ms(d.mysql_ms) + " ms"), td(`Rota de ${d.trechos} trechos, ${d.matrizes_iguais ? "idêntica" : "DIFERENTE"}`)];
  s.addTable([
    [th("Execução"), th("Neo4j"), th("MySQL"), th("Resultado")],
    linha(D.d8), linha(D.d25),
  ], { x: 0.5, y: 2.0, w: 9, colW: [3.0, 1.4, 1.6, 3.0], rowH: 0.5, ...tblOpts });
  s.addText(bullets([
    "Perto do depósito, os dois ficam na mesma ordem de grandeza; com o alcance maior, a diferença aparece",
    "No MySQL, o menor caminho é uma consulta recursiva que explora toda a região até o limite",
  ]), { x: 0.5, y: 3.7, w: 9, h: 1.3, fontFace: BODY, fontSize: 14, color: INK, valign: "top", margin: 0, isTextBox: true });
}

pres.writeFile({ fileName: "Entrega1-Projeto3-NoSQL-Grafos.pptx" }).then((f) => console.log("ok", f));
