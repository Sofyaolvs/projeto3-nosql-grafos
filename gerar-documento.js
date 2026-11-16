const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType,
  LevelFormat, WidthType, ShadingType, BorderStyle, PageNumber, Footer, TableOfContents,
} = require("docx");

const FONT = "Calibri";
const INK = "12263A", TEAL = "1F7A8C";

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 300 }, ...opts, children: Array.isArray(text) ? text : [new TextRun({ text, font: FONT, size: 22 })] });
const b = (text) => new TextRun({ text, bold: true, font: FONT, size: 22 });
const t = (text) => new TextRun({ text, font: FONT, size: 22 });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text })] });
const bullet = (text) => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 80, line: 290 }, children: Array.isArray(text) ? text : [t(text)] });
const code = (lines) => lines.map((l) => new Paragraph({ spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: "EAF2F5" }, indent: { left: 240 }, children: [new TextRun({ text: l || " ", font: "Courier New", size: 19 })] }));

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D6DC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, header, rows) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (text, w, head, bold) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, fill: INK } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 20, bold: head || bold, color: head ? "FFFFFF" : "000000" })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false, i === 0)) })),
    ],
  });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

const body = [
  // Capa
  new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: "Projeto 3 · Bancos de Dados NoSQL", font: FONT, size: 26, color: TEAL, bold: true })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Bancos de dados orientados a grafos: Neo4j × MySQL em uma malha viária", font: "Cambria", size: 52, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Entrega 1: Pesquisa e planejamento", font: FONT, size: 30, color: "444444" })] }),
  p([b("Data da entrega: "), t("10/11/2026")]),
  p([b("Paradigma sorteado: "), t("orientado a grafos")]),
  p([b("SGBD escolhido: "), t("Neo4j (sujeito à validação do professor)")]),
  p([b("Banco relacional de comparação: "), t("MySQL")]),
  p([b("Disciplina: "), t("____________________________")]),
  p([b("Equipe: "), t("____________________________")]),
  new Paragraph({ pageBreakBefore: true, children: [] }),

  h1("1. Objetivo desta entrega"),
  p("Este documento cobre o conteúdo mínimo da Entrega 1 do Projeto 3: o paradigma, o SGBD, a arquitetura, o cenário, a comparação teórica inicial e o plano de implementação. Os experimentos ainda não foram executados. Quando o texto menciona resultados esperados, são hipóteses a testar, e não medições."),

  h1("2. O paradigma orientado a grafos"),
  h2("2.1 Descrição e características"),
  p("Em um banco de dados orientado a grafos, os dados são guardados como nós e relacionamentos. O modelo mais usado é o property graph (grafo de propriedades):"),
  bullet([b("Nós "), t("representam entidades, como uma interseção de ruas ou uma pessoa. Podem ter rótulos e propriedades.")]),
  bullet([b("Relacionamentos "), t("ligam dois nós, têm um tipo e um sentido, e também podem ter propriedades.")]),
  bullet("O relacionamento é um dado guardado, e não algo calculado por um JOIN no momento da consulta."),
  bullet("As consultas descrevem padrões de conexão, como \"quais nós eu alcanço a partir deste em até três saltos\"."),
  h2("2.2 Principais tipos de aplicações"),
  bullet([b("Rotas e logística: "), t("menor caminho, roteamento e rastreio de entregas.")]),
  bullet([b("Redes sociais: "), t("amigos de amigos, influência e comunidades.")]),
  bullet([b("Detecção de fraude: "), t("anéis de contas e transações ligadas.")]),
  bullet([b("Recomendação: "), t("\"quem comprou X também comprou Y\".")]),
  bullet([b("Grafos de conhecimento: "), t("entidades e relações para busca e IA.")]),
  bullet([b("Infraestrutura de TI: "), t("dependências entre serviços e análise de impacto.")]),

  h1("3. Visão geral do Neo4j"),
  bullet("SGBD de grafos nativo, desenvolvido pela Neo4j, Inc."),
  bullet("Linguagem de consulta Cypher, cuja sintaxe desenha o padrão do grafo."),
  bullet("Transações ACID."),
  bullet("Download: neo4j.com/download. Também há imagem Docker oficial, que será usada no projeto."),
  bullet([b("Licenciamento: "), t("a edição Community é gratuita, sob GPLv3. A edição Enterprise tem licença comercial. O Neo4j Desktop inclui uma licença de desenvolvimento gratuita da Enterprise. Para qualquer uso além do acadêmico, convém conferir os termos oficiais em neo4j.com/licensing.")]),
  p("Exemplo de consulta em Cypher, que conta as interseções alcançáveis em até 3 trechos a partir de uma interseção:"),
  ...code(["MATCH (a:Intersecao {id: 1})-[:LIGA_A*1..3]->(b)", "RETURN count(DISTINCT b)"]),
  gap(),

  h1("4. Arquitetura"),
  p("De forma simplificada, o Neo4j tem as camadas a seguir."),
  bullet([b("Cliente: "), t("envia consultas em Cypher pelo protocolo Bolt ou por HTTP.")]),
  bullet([b("Processador de consultas: "), t("o planejador escolhe o plano de execução e o executor o roda.")]),
  bullet([b("Cache de páginas: "), t("mantém em memória as partes do grafo em uso.")]),
  bullet([b("Armazenamento nativo: "), t("guarda nós, relacionamentos e propriedades em estruturas próprias para grafos.")]),
  bullet([b("Log de transações: "), t("garante a durabilidade.")]),
  p([b("Adjacência sem índice. "), t("Cada nó guarda referências diretas aos seus relacionamentos. Seguir uma aresta não exige procurar em índice nem fazer JOIN. Por isso, o custo de uma travessia cresce com o trecho do grafo visitado, e não com o tamanho total da base. Os índices continuam úteis, mas só para achar o nó inicial (por exemplo, pelo id).")]),

  h1("5. Escalabilidade"),
  bullet([b("Community (a que será usada): "), t("instância única. Escala na vertical, com mais RAM para o cache de páginas, SSD e mais CPU. Não tem clustering.")]),
  bullet([b("Enterprise: "), t("cluster com alta disponibilidade e réplicas de leitura, além de backup online. Licença comercial.")]),
  p("Particionar um grafo é difícil, porque uma travessia pode cruzar partições. Por isso, o ganho típico do Neo4j depende de manter o grafo inteiro, ou a maior parte dele, no cache de uma máquina. Esse é um ponto que será observado nos experimentos."),

  h1("6. Aplicações reais no mercado"),
  table([2700, 3300, 3026], ["Organização", "Uso", "Resultado declarado"], [
    ["Empresa global de entregas (não nomeada)", "Roteamento e rastreio de encomendas em tempo real", "Cerca de 5 milhões de encomendas por dia"],
    ["eBay", "Roteamento de entregas (eBay Now)", "Caso publicado pela Neo4j"],
    ["Walmart", "Recomendações em tempo real", "Caso publicado pela Neo4j"],
    ["BNP Paribas Personal Finance", "Detecção de fraude", "Redução de 20% em fraudes"],
  ]),
  gap(),
  p("Fonte: estudos de caso da própria Neo4j (neo4j.com/case-studies). Os números são autodeclarados pelo fornecedor e não foram verificados de forma independente."),

  h1("7. Vantagens e desvantagens"),
  h2("Vantagens"),
  bullet("Travessias de vários saltos eficientes."),
  bullet("Modelo próximo do domínio, com consultas legíveis."),
  bullet("Esquema flexível."),
  bullet("Transações ACID."),
  h2("Desvantagens"),
  bullet("Agregações em massa tendem a ser menos eficientes que em bancos relacionais ou colunares."),
  bullet("Escala horizontal limitada."),
  bullet("Clustering só na edição Enterprise."),
  bullet("Cypher é menos difundida que SQL."),
  p([b("Quando escolher: "), t("quando o valor está nas conexões e as consultas percorrem vários saltos. "), b("Quando evitar: "), t("quando os dados são tabulares e as consultas são sobretudo agregações e relatórios.")]),

  h1("8. Comparação teórica: grafo × relacional"),
  table([2000, 3513, 3513], ["Aspecto", "Neo4j (grafo)", "MySQL (relacional)"], [
    ["Modelo de dados", "Nós, relacionamentos e propriedades", "Tabelas, linhas e colunas"],
    ["Relações / associações", "Relacionamento armazenado e direto", "Chave estrangeira e JOIN"],
    ["Linguagem de consulta", "Cypher", "SQL"],
    ["Consistência e transações", "ACID", "ACID"],
    ["Índices", "Usados para achar o nó inicial", "Usados em todo o acesso"],
    ["Escalabilidade", "Vertical na Community; cluster na Enterprise", "Vertical, com réplicas de leitura"],
    ["Melhor cenário", "Conexões profundas, rotas e redes", "Dados tabulares e agregações"],
  ]),
  gap(),

  h1("9. Cenário e dataset"),
  p([b("Cenário: "), t("rotas em uma malha viária (GPS). Interseções e fins de estrada são nós, e as estradas são as ligações entre eles. O cenário é adequado ao paradigma porque as perguntas centrais, como o alcance em vários saltos e o menor caminho, são travessias.")]),
  p([b("Dataset: "), t("roadNet-CA, rede viária da Califórnia, publicado pelo SNAP (Stanford) em snap.stanford.edu/data/roadNet-CA.html. Fonte citada na página: Leskovec, Lang, Dasgupta e Mahoney (2009).")]),
  table([4513, 4513], ["Item", "Quantidade"], [
    ["Interseções (nós)", "1.965.206"],
    ["Estradas (arestas)", "2.766.607"],
    ["Total de registros lógicos", "4.731.813"],
  ]),
  gap(),
  p([b("Significado de \"registro\": "), t("uma interseção ou uma estrada. O total passa do mínimo de 1 milhão exigido no enunciado.")]),
  p([b("Limitação conhecida: "), t("o dataset não traz distância nem coordenadas. O menor caminho será medido em número de trechos, e não em quilômetros.")]),

  h1("10. Modelagem prevista"),
  h2("MySQL"),
  ...code(["interseccao(id PK)", "estrada(origem FK -> interseccao, destino FK -> interseccao)", "índices em estrada(origem) e estrada(destino)"]),
  gap(),
  h2("Neo4j"),
  ...code(["(:Intersecao {id}) -[:LIGA_A]-> (:Intersecao {id})", "índice único em Intersecao.id"]),
  gap(),
  p("As estradas do dataset são não direcionadas. Os dois bancos vão guardar os dois sentidos, para manter o mesmo resultado lógico. Os diagramas completos e os scripts ficam para a Entrega 2."),

  h1("11. Plano dos experimentos"),
  table([3500, 1700, 3826], ["Consulta", "O que mede", "Hipótese a testar"], [
    ["Q1. Alcance em k saltos (k de 2 a 5)", "Travessia", "Grafo ganha, e a diferença cresce com k"],
    ["Q2. Menor caminho entre dois pontos", "Caminho", "Grafo ganha; no SQL, usa CTE recursiva"],
    ["Q3. Vizinhos diretos de um nó", "Busca por chave", "Empate ou relacional melhor"],
    ["Q4. Contagem de nós por grau", "Agregação global", "Relacional tende a ganhar"],
  ]),
  gap(),
  p("Método: cada consulta será executada ao menos 10 vezes, comparando as medianas. Serão registrados o hardware, as versões dos SGBDs, os índices, o tamanho da massa, os filtros e o estado do cache (consulta fria ou aquecida). O relacional terá índices adequados em origem e destino, para a comparação ser justa."),
  p("Os itens acima são hipóteses. As medições ainda não foram feitas. Se o grafo não ganhar no cenário escolhido, o resultado será documentado e o experimento refinado de forma justificada, sem fabricar medições. Os casos em que o relacional tiver desempenho igual ou melhor também serão apresentados."),

  h1("12. Plano de implementação"),
  bullet([b("Infraestrutura: "), t("Docker com Neo4j Community e MySQL, com scripts de instalação e de carga.")]),
  bullet([b("Carga: "), t("o mesmo arquivo do dataset alimenta os dois bancos, nos dois sentidos de cada estrada.")]),
  bullet([b("CRUD: "), t("operações equivalentes de criação, leitura, atualização e exclusão nos dois bancos.")]),
  bullet([b("Dashboard: "), t("backend e frontend que consultam os dois bancos, com filtros, alternância entre as fontes e tempo de resposta em ms.")]),
  table([1500, 2000, 5526], ["Data", "Entrega", "Conteúdo previsto"], [
    ["10/11", "Entrega 1", "Pesquisa e planejamento (este documento)"],
    ["17/11", "Entrega 2", "Modelos, scripts de carga, evidência do volume e CRUD"],
    ["19/11", "Entrega 3", "Experimentos, metodologia e análise"],
    ["24/11", "Entrega 4", "Dashboard, demonstração ao vivo e apresentação final"],
  ]),
  gap(),
  p("Observação: a tabela de entregáveis do enunciado lista as datas 17/11, 19/11 e 24/11, mas não ficou claro qual entrega cai em qual dia. A distribuição acima é uma suposição e deve ser confirmada com o professor."),

  h1("13. Riscos e pontos em aberto"),
  bullet("O professor precisa validar o Neo4j como SGBD do projeto."),
  bullet("Carga e consultas com quase 5 milhões de registros em um notebook podem ser lentas. Qualquer redução abaixo de 1 milhão depende de aprovação prévia do professor."),
  bullet("Consultas recursivas no MySQL (CTE recursiva, disponível a partir do MySQL 8.0) com k alto podem demorar demais. Será preciso definir um tempo limite e registrá-lo."),
  bullet("A falta de distância e de coordenadas limita o menor caminho a número de trechos."),
  bullet("Os números dos casos de mercado vêm do fornecedor e não foram verificados."),

  h1("14. Fontes"),
  bullet("SNAP, roadNet-CA: snap.stanford.edu/data/roadNet-CA.html"),
  bullet("Neo4j, licenciamento: neo4j.com/licensing"),
  bullet("Neo4j, estudos de caso: neo4j.com/case-studies"),
  bullet("Neo4j, manual de operações: neo4j.com/docs/operations-manual"),
];

const doc = new Document({
  creator: "Equipe",
  title: "Projeto 3 - NoSQL orientado a grafos - Entrega 1",
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
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Projeto 3 · NoSQL orientado a grafos · Entrega 1 · página ", font: FONT, size: 18, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "666666" })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("Entrega1-Projeto3-NoSQL-Grafos.docx", buf); console.log("ok"); });
