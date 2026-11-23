# Projeto 3 · Entrega 2 · Neo4j × MySQL em uma malha viária

Cenário: rotas em uma malha viária urbana (GPS, entregas). Os dados são a malha viária das capitais
brasileiras, extraída do **OpenStreetMap com a biblioteca OSMnx**: cada interseção tem cidade, UF e
coordenadas, e cada trecho de via tem nome, classificação, comprimento, mão única e, quando mapeado,
velocidade máxima e número de faixas.

Os totais da extração em uso (interseções, trechos, registros, por cidade) ficam em
[`dados/resumo.json`](dados/resumo.json). O enunciado pede no mínimo 1 milhão de registros; a extração passa disso.

> Na Entrega 1 o dataset era o SNAP `roadNet-CA`, que só tinha os identificadores das interseções.
> A troca foi feita para ter dados descritivos, que os filtros do dashboard (Entrega 4) vão usar.

Esta pasta contém: modelos, scripts de extração, instalação e carga, verificações do volume, CRUD equivalente,
um exemplo funcionando (roteamento de entregas, estilo eBay Now) e um guia de apresentação.

---

## 1. Requisitos
- Windows com PowerShell 5.1 ou superior
- Docker Desktop **aberto e em execução**
- Node.js 18 ou superior
- Python 3.10 ou superior (**só** para extrair os dados do OpenStreetMap; veja a seção 2)
- Cerca de 6 GB de RAM livre (MySQL com 2 GB de buffer, Neo4j com 2 GB de heap e 2 GB de cache)
- Portas livres: `3307` (MySQL), `7474` e `7687` (Neo4j)

## 2. Primeira vez: instalar e carregar
```powershell
cd entrega2
npm install
.\scripts\carregar.ps1
```
O script sobe os dois bancos e carrega os dois a partir dos mesmos arquivos, `dados\intersecoes.csv` e `dados\estradas.csv`.
A carga em si leva menos de um minuto em cada banco; os tempos ficam em `dados\tempos-carga.json`.

**De onde vêm os CSVs.** Eles não ficam no Git (são grandes). Há dois caminhos:
- **Recomendado para a equipe:** copiar `intersecoes.csv`, `estradas.csv` e `resumo.json` de quem já extraiu para a pasta `dados\`.
  Assim todos usam exatamente os mesmos dados e não é preciso ter Python.
- **Extrair do zero:** se os CSVs não existirem, o `carregar.ps1` cria um ambiente Python (`.venv`), instala o OSMnx
  e roda `scripts\extrair-osm.py`. A extração baixa uma capital por vez de servidores públicos do OpenStreetMap (Overpass)
  e **pode levar de uma a algumas horas**, dependendo da lotação deles. Se cair no meio, rode de novo: continua de onde parou.
  Como o OpenStreetMap muda todo dia, uma extração nova dá números um pouco diferentes dos documentados.

Para juntar só as capitais já baixadas, sem esperar o resto: `.\.venv\Scripts\python.exe scripts\extrair-osm.py --parcial`.

Se o PowerShell reclamar de política de execução, rode:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\carregar.ps1
```

| Serviço | Endereço | Usuário | Senha |
|---|---|---|---|
| MySQL | `127.0.0.1:3307`, banco `rotas` | `root` | `rotas12345` |
| Neo4j Browser | http://localhost:7474 (conectar em `bolt://localhost:7687`) | `neo4j` | `rotas12345` |

(Senhas de uso local apenas, definidas em `docker-compose.yml`.)

---

## 3. Como testar

### 3.1 Teste completo em um comando
```powershell
.\scripts\testar.ps1
```
Pode rodar quantas vezes quiser. Ele confere os contêineres, o volume, a integridade, o CRUD e o exemplo de rotas.
O que você deve ver:

| Etapa | Resultado esperado |
|---|---|
| 0. Contêineres | `rotas-mysql : OK` e `rotas-neo4j : OK` |
| 1. Volume | os mesmos totais nos dois bancos, iguais aos de `dados\resumo.json` (o próprio teste imprime a linha "Esperado"); `orfas` = 0 e `mao_dupla_sem_volta` = 0 |
| 2. CRUD | a mesma lista de vizinhos da interseção 0 nos dois bancos, terminando na nova **5000000** (Rua do Projeto 3); o update mostra `bloqueada` = 1 (MySQL) ou TRUE (Neo4j) nas duas estradas novas; `restantes` = 0 |
| 3. Exemplo | `Matrizes de distância idênticas nos dois bancos: SIM` e `Rotas idênticas: SIM` |

Se algo der diferente disso, o teste falhou. Veja a seção 7 (problemas comuns).

### 3.2 Testar na mão

**Neo4j no navegador** (bom para mostrar visualmente): abra http://localhost:7474, entre com `neo4j` / `rotas12345` e rode:
```cypher
MATCH (n:Intersecao) RETURN n.cidade, count(n) ORDER BY count(n) DESC;
MATCH p=(a:Intersecao {id: 0})-[:LIGA_A*1..3]->(b) RETURN p LIMIT 100;
```
A segunda consulta desenha o grafo ao redor da interseção 0 (São Paulo). Clique em um relacionamento para ver nome e tipo da via.
Aumente o `1..3` para ver uma área maior.

**MySQL no terminal:**
```powershell
docker exec -it -e MYSQL_PWD=rotas12345 rotas-mysql mysql -uroot --default-character-set=utf8mb4 rotas
```
```sql
SELECT cidade, COUNT(*) FROM interseccao GROUP BY cidade ORDER BY 2 DESC;
SELECT tipo, COUNT(*), ROUND(SUM(comprimento_m)/1000) AS km FROM estrada GROUP BY tipo ORDER BY 2 DESC;
SELECT destino, nome, tipo, comprimento_m FROM estrada WHERE origem = 0;
```

**Neo4j no terminal:**
```powershell
docker exec -it rotas-neo4j cypher-shell -u neo4j -p rotas12345
```

**Só a verificação ou só o CRUD** (arquivos em `sql\` e `cypher\`):
```powershell
cmd /c "docker exec -i -e MYSQL_PWD=rotas12345 rotas-mysql mysql -uroot --default-character-set=utf8mb4 rotas -t < sql\03-verificacao.sql"
cmd /c "docker exec -i rotas-neo4j cypher-shell -u neo4j -p rotas12345 --format plain < cypher\03-verificacao.cypher"
```
O CRUD é `sql\05-crud.sql` e `cypher\05-crud.cypher`. Antes do `05-crud.sql` rode **uma vez** `sql\04-evolucao-esquema.sql`
(cria a coluna `bloqueada`; o `testar.ps1` já faz isso sozinho).

### 3.3 Exemplo de roteamento de entregas
```powershell
node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8
```
Escolhe um depósito e N paradas a até `--raio` trechos dele, calcula o menor caminho entre cada par
nos dois bancos (ida e volta, porque há vias de mão única), monta a rota pelo vizinho mais próximo e compara resultado e tempo.
Parâmetros: `--deposito` (id da interseção), `--paradas` (quantas), `--raio`, `--semente` (muda o sorteio das paradas).
A interseção 0 fica em São Paulo, na Avenida Doutora Ruth Cardoso (Marginal Pinheiros).

- **Raio pequeno (8):** os dois bancos respondem em uma a poucas centenas de milissegundos. Os tempos variam de uma execução para outra.
- **Raio grande (25):** o Neo4j respondeu em cerca de 0,2 a 0,3 s e o MySQL em 22 a 31 s nas nossas execuções. **Cuidado:** pode levar cerca de 30 segundos no MySQL.
  ```powershell
  node scripts\demo-entregas.js --deposito 0 --paradas 6 --raio 25 --semente 3
  ```
- Esses tempos são de **execuções únicas**, não uma medição. A medição rigorosa é a Entrega 3.

### 3.4 Ligar, desligar e recomeçar
```powershell
docker compose stop          # desliga e guarda os dados
docker compose up -d         # liga de novo (depois espere uns 30 s)
docker compose down -v       # APAGA os dados dos dois bancos (precisa rodar carregar.ps1 de novo)
```

### 3.5 Regerar evidências, documento e slides
Depois de uma carga nova (por exemplo, com mais capitais), os números dos documentos se atualizam sozinhos:
```powershell
.\scripts\gerar-evidencias.ps1          # regrava a pasta evidencias\ com as saídas reais
cd ..
node gerar-documento-entrega2.js        # Entrega2-Projeto3-NoSQL-Grafos.docx
node gerar-slides.js                    # Entrega1-Projeto3-NoSQL-Grafos.pptx
```

---

## 4. Como apresentar

A entrega do dia 17/11 pede: **principais vantagens e desvantagens**, **definição do problema** e
**modelagem no relacional e no não relacional**. Um integrante apresenta. O enunciado não define o tempo,
então o roteiro abaixo é de cerca de **8 minutos** (reduza cortando as duas últimas linhas se o tempo for menor).
Os slides são os de número **9 a 15** (etiqueta "Entrega 2") de `Entrega1-Projeto3-NoSQL-Grafos.pptx`.

### Antes de começar (5 minutos antes)
1. Abra o Docker Desktop e confirme que os contêineres `rotas-mysql` e `rotas-neo4j` estão ligados (`docker compose up -d`).
2. Rode `.\scripts\testar.ps1` **uma vez**: confirma que está tudo certo e aquece o cache dos bancos.
3. Deixe abertas: os slides, um terminal na pasta `entrega2`, e o Neo4j Browser (http://localhost:7474, já logado).
4. Feche programas pesados. O MySQL e o Neo4j usam cerca de 6 GB.
5. Plano B: se o Docker falhar, mostre as saídas reais salvas em `evidencias\` e os slides.

### Roteiro
| Tempo | O que fazer | O que dizer |
|---|---|---|
| 1:30 | **Slide 9** (vantagens e desvantagens) | O grafo é bom em travessias e próximo do domínio; perde em agregações em massa e em escala horizontal. Cada ponto está ligado ao nosso problema. São hipóteses: a Entrega 3 mede. |
| 1:30 | **Slide 10** (definição do problema) | Rotas em malha viária urbana. Quatro perguntas: três são travessias, uma é filtro. Trocamos o roadNet-CA pelo OpenStreetMap para ter nome, tipo de via, comprimento e cidade. |
| 2:00 | **Slide 11** (modelagem) + no Neo4j Browser a consulta do desenho (abaixo) | No MySQL, o trecho de via é uma linha com duas chaves estrangeiras e cada salto é um JOIN. No Neo4j, é um relacionamento que liga os nós diretamente. Os mesmos campos nos dois. |
| 1:00 | **Slides 12 e 13** (dados e evidência) | Mesmos arquivos nos dois bancos, mesmos totais, 0 órfãos. A carga é um comando. |
| 0:30 | **Slide 14** (CRUD) | As quatro operações dão o mesmo resultado. No Delete, o Neo4j usa DETACH DELETE e o MySQL precisa de duas etapas por causa das chaves estrangeiras. |
| 1:30 | **Slide 15** (exemplo) + ao vivo: `node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8` | É o caso do eBay Now: roteirizar entregas. Rotas idênticas nos dois. Com alcance maior o Neo4j se distancia, mas isso ainda não é uma medição. |

Dica visual: no Neo4j Browser, rode `MATCH p=(a:Intersecao {id: 0})-[:LIGA_A*1..3]->(b) RETURN p LIMIT 100;`
enquanto fala do modelo. O desenho do grafo ajuda quem está assistindo.

### Perguntas que podem fazer
- **Por que trocaram de dataset?** O roadNet-CA só tinha números de interseção. O OpenStreetMap traz nome, classificação, comprimento, mão única e coordenadas, o que deixa o problema mais realista e permite os filtros do dashboard.
- **Por que capitais, e não um estado inteiro?** Uma cidade sozinha não chega a 1 milhão de registros, e um estado inteiro é pesado demais para baixar com o OSMnx. As capitais passam do mínimo com folga e ainda dão um filtro natural por cidade.
- **As cidades estão ligadas entre si?** Não. Cada capital é uma malha separada; as rotas são dentro de uma cidade.
- **Por que o MySQL ficou tão mais lento no raio 25?** O menor caminho no MySQL é uma consulta recursiva (CTE) que explora toda a região até o limite de saltos, sem parar quando acha o destino. O Neo4j tem um algoritmo próprio de caminho mínimo. Isso é característico do paradigma, mas é uma diferença de método e por isso a Entrega 3 vai medir com rigor.
- **Isso prova que o Neo4j é mais rápido?** Não. São execuções únicas. Perto do depósito os dois ficaram próximos. A prova (ou não) vem da Entrega 3.
- **A comparação é justa?** O MySQL tem índice em origem (chave primária) e em destino, e os dois têm a mesma quantidade de memória. Ainda assim, um ponto a melhorar: na Entrega 3 vale testar também uma versão mais enxuta da consulta no MySQL.
- **Como tratam mão única?** Cada registro é um trecho em um sentido. Mão dupla vira dois trechos, mão única vira um. O menor caminho respeita isso nos dois bancos.
- **A carga do Neo4j é justa com a do MySQL?** Não é uma comparação de desempenho: o Neo4j usou importação offline (`neo4j-admin`), que é mais rápida que inserir por consultas.
- **Por que o menor caminho não é em km?** Os dados já têm o comprimento de cada trecho, mas o exemplo ainda conta trechos. Caminho em quilômetros fica para as próximas entregas.
- **Qual o próximo passo?** Entrega 3: experimentos (Q1 a Q4) com metodologia rigorosa. Entrega 4: dashboard com os dois bancos.

---

## 5. Estrutura de pastas
- `docker-compose.yml`: MySQL 8.0 e Neo4j 5 Community
- `scripts/`: `extrair-osm.py` (baixa a malha com o OSMnx e gera os CSVs), `carregar.ps1` (instala e carrega), `testar.ps1` (teste completo), `gerar-evidencias.ps1` (regrava as evidências), `demo-entregas.js` (exemplo de rotas)
- `requirements.txt`: dependência Python da extração (OSMnx)
- `sql/`: esquema, carga, verificação, evolução de esquema e CRUD do MySQL
- `cypher/`: verificação e CRUD do Neo4j
- `evidencias/`: saídas reais das verificações, do CRUD e do exemplo, e `numeros.json` (lido pelo documento e pelos slides)
- `dados/`: CSVs gerados, partes por capital, cache da extração, `resumo.json` e tempos de carga

## 6. Ambiente usado nos números deste projeto
Intel Core Ultra 5 225H, 15,4 GB de RAM, Windows 11, Docker Desktop. MySQL 8.0.46 e Neo4j 5.26.33 Community. Extração com OSMnx 2.1.2.

## 7. Problemas comuns
| Sintoma | O que fazer |
|---|---|
| `failed to connect to the docker API` | O Docker Desktop não está aberto. Abra, espere iniciar e tente de novo. |
| `testar.ps1` diz "NÃO está saudável" | Rode `docker compose up -d` e espere cerca de 30 s. Na primeira vez, use `.\scripts\carregar.ps1`. |
| Totais diferentes dos de `resumo.json` | Os bancos estão com uma carga antiga. Rode `.\scripts\carregar.ps1` de novo. |
| Extração para com erro 502, 504 ou timeout | Os servidores públicos do Overpass estão lotados. Rode de novo mais tarde: continua de onde parou. |
| Porta já em uso (3307, 7474 ou 7687) | Feche o programa que usa a porta, ou troque a porta em `docker-compose.yml` e nos scripts. |
| Lentidão ou o Docker fecha sozinho | Falta memória. Feche outros programas ou reduza os valores de memória em `docker-compose.yml`. |
| `poucos candidatos; aumente --raio` | Use um `--raio` maior ou outro `--deposito`. |
| Erro de política de execução do PowerShell | Use `powershell -ExecutionPolicy Bypass -File .\scripts\NOME.ps1`. |

## 8. Limitações
- O menor caminho do exemplo é em número de trechos, não em quilômetros (o comprimento já está nos dados).
- Velocidade máxima e número de faixas só existem em parte das vias, conforme o que foi mapeado no OpenStreetMap.
- As capitais são malhas separadas: não há rota entre cidades.
- A rota do exemplo usa o vizinho mais próximo, que não é a rota ótima.
- Os tempos do exemplo são de uma execução e não valem como medição.
- O professor ainda precisa validar o Neo4j como SGBD do projeto.

Dados: © colaboradores do OpenStreetMap, licença ODbL.
