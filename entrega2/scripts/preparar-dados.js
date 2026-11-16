// Baixa o roadNet-CA (SNAP) e gera os CSVs usados na carga dos dois bancos.
// Uso: node scripts/preparar-dados.js
const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");
const readline = require("readline");

const DADOS = path.join(__dirname, "..", "dados");
fs.mkdirSync(DADOS, { recursive: true });
const URL = "https://snap.stanford.edu/data/roadNet-CA.txt.gz";
const GZ = path.join(DADOS, "roadNet-CA.txt.gz");

function baixar() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(GZ) && fs.statSync(GZ).size > 1e6) { console.log("Arquivo já baixado:", GZ); return resolve(); }
    console.log("Baixando", URL);
    https.get(URL, (res) => {
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      res.pipe(fs.createWriteStream(GZ)).on("finish", resolve).on("error", reject);
    }).on("error", reject);
  });
}

async function gerar() {
  const rl = readline.createInterface({ input: fs.createReadStream(GZ).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  const nos = new Set();
  const arestas = [];
  const pares = new Set(); // pares não ordenados, só para contar estradas únicas
  let comentarios = 0, linhas = 0, laços = 0;
  for await (const linha of rl) {
    if (linha.startsWith("#")) { comentarios++; continue; }
    if (!linha.trim()) continue;
    const [a, b] = linha.split(/\s+/).map(Number);
    linhas++;
    if (a === b) laços++;
    nos.add(a); nos.add(b);
    arestas.push([a, b]);
    pares.add(a < b ? a * 1e7 + b : b * 1e7 + a);
  }
  console.log({ comentarios, linhasDeArestas: linhas, nos: nos.size, estradasUnicas: pares.size, lacos: laços });

  // nós ordenados
  const ids = [...nos].sort((x, y) => x - y);
  fs.writeFileSync(path.join(DADOS, "nos.csv"), "id:ID\n" + ids.join("\n") + "\n");
  // arestas nos dois sentidos (o arquivo do SNAP já traz os dois; garantimos pares únicos direcionados)
  const dirigidas = new Set();
  for (const [a, b] of arestas) { dirigidas.add(a * 1e7 + b); dirigidas.add(b * 1e7 + a); }
  // ordenadas por (origem, destino): carga mais rápida no índice primário do MySQL
  const chaves = Float64Array.from(dirigidas).sort();
  const out = Array.from(chaves, (k) => Math.floor(k / 1e7) + "," + (k % 1e7));
  fs.writeFileSync(path.join(DADOS, "arestas.csv"), ":START_ID,:END_ID\n" + out.join("\n") + "\n");
  // versão sem cabeçalho para o MySQL (LOAD DATA)
  fs.writeFileSync(path.join(DADOS, "nos_mysql.csv"), ids.join("\n") + "\n");
  fs.writeFileSync(path.join(DADOS, "arestas_mysql.csv"), out.join("\n") + "\n");
  console.log({ relacionamentosDirigidos: out.length });
  fs.writeFileSync(path.join(DADOS, "resumo.json"), JSON.stringify({ fonte: URL, nos: ids.length, estradasUnicas: pares.size, relacionamentosDirigidos: out.length, linhasNoArquivo: linhas }, null, 2));
}

baixar().then(gerar).catch((e) => { console.error(e); process.exit(1); });
