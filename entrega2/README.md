# Projeto 3 · Entrega 2 · Neo4j × MySQL em uma malha viária

Cenário: rotas em uma malha viária (GPS). Dataset público SNAP `roadNet-CA` (Califórnia):
**1.965.206 interseções** e **2.766.607 estradas** (4.731.813 registros lógicos).
Cada estrada é guardada nos dois sentidos nos dois bancos, então há **5.533.214 relacionamentos/linhas**.

Esta pasta contém: modelos, scripts de instalação e carga, verificações do volume, CRUD equivalente,
um exemplo funcionando (roteamento de entregas, estilo eBay Now) e um guia de apresentação.

---

## 1. Requisitos
- Windows com PowerShell 5.1 ou superior
- Docker Desktop **aberto e em execução**
- Node.js 18 ou superior
- Cerca de 6 GB de RAM livre (MySQL com 2 GB de buffer, Neo4j com 2 GB de heap e 2 GB de cache)
- Portas livres: `3307` (MySQL), `7474` e `7687` (Neo4j)

## 2. Primeira vez: instalar e carregar
```powershell
cd entrega2
npm install
.\scripts\carregar.ps1
```
O script baixa o dataset (17,9 MB), gera os CSVs, baixa as imagens Docker, sobe os dois bancos e
carrega tudo. Na máquina de desenvolvimento levou poucos minutos, e a carga em si levou
31,9 s (MySQL) e 34,6 s + 6,2 s do índice (Neo4j). Os tempos ficam em `dados\tempos-carga.json`.

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
| 1. Volume | nos dois bancos: 1965206 interseções, 5533214 estradas (2 sentidos), 2766607 únicas; `sem_volta` = 0; no MySQL `orfas` = 0 |
| 2. CRUD | vizinhos da interseção 0: **1, 2, 469 e 5000000**; o update mostra `bloqueada` = 1 (MySQL) ou TRUE (Neo4j) nas duas estradas novas; `restantes` = 0 |
| 3. Exemplo | `Matrizes de distância idênticas nos dois bancos: SIM` e `Rotas idênticas: SIM` |

Se algo der diferente disso, o teste falhou. Veja a seção 7 (problemas comuns).

### 3.2 Testar na mão

**Neo4j no navegador** (bom para mostrar visualmente): abra http://localhost:7474, entre com `neo4j` / `rotas12345` e rode:
```cypher
MATCH (n:Intersecao) RETURN count(n);
MATCH p=(a:Intersecao {id: 0})-[:LIGA_A*1..3]->(b) RETURN p LIMIT 100;
```
A segunda consulta desenha o grafo ao redor da interseção 0. Aumente o `1..3` para ver uma área maior.

**MySQL no terminal:**
```powershell
docker exec -it -e MYSQL_PWD=rotas12345 rotas-mysql mysql -uroot rotas
```
```sql
SELECT COUNT(*) FROM interseccao;
SELECT COUNT(*) FROM estrada;
SELECT destino FROM estrada WHERE origem = 0;
```

**Neo4j no terminal:**
```powershell
docker exec -it rotas-neo4j cypher-shell -u neo4j -p rotas12345
```

**Só a verificação ou só o CRUD** (arquivos em `sql\` e `cypher\`):
```powershell
cmd /c "docker exec -i -e MYSQL_PWD=rotas12345 rotas-mysql mysql -uroot rotas -t < sql\03-verificacao.sql"
cmd /c "docker exec -i rotas-neo4j cypher-shell -u neo4j -p rotas12345 --format plain < cypher\03-verificacao.cypher"
```
O CRUD é `sql\05-crud.sql` e `cypher\05-crud.cypher`. Antes do `05-crud.sql` rode **uma vez** `sql\04-evolucao-esquema.sql`
(cria a coluna `bloqueada`; o `testar.ps1` já faz isso sozinho).

### 3.3 Exemplo de roteamento de entregas
```powershell
node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8
```
Escolhe um depósito e N paradas a até `--raio` trechos dele, calcula o menor caminho entre cada par
nos dois bancos, monta a rota pelo vizinho mais próximo e compara resultado e tempo.
Parâmetros: `--deposito` (id da interseção), `--paradas` (quantas), `--raio`, `--semente` (muda o sorteio das paradas).

- **Raio pequeno (8):** os dois bancos respondem em dezenas a poucas centenas de milissegundos. Os tempos variam de uma execução para outra.
- **Raio grande (25):** o Neo4j respondeu em cerca de 0,1 s e o MySQL em cerca de 29 s na nossa execução. **Cuidado:** pode levar quase 30 segundos no MySQL.
  ```powershell
  node scripts\demo-entregas.js --deposito 0 --paradas 6 --raio 25 --semente 3
  ```
- Esses tempos são de **uma execução**, não uma medição. A medição rigorosa é a Entrega 3.

### 3.4 Ligar, desligar e recomeçar
```powershell
docker compose stop          # desliga e guarda os dados
docker compose up -d         # liga de novo (depois espere uns 30 s)
docker compose down -v       # APAGA os dados dos dois bancos (precisa rodar carregar.ps1 de novo)
```

---

## 4. Como apresentar

A Entrega 2 é parcial: um integrante apresenta o progresso. O enunciado não define o tempo da parcial,
então o roteiro abaixo é de cerca de **8 minutos** (reduza cortando o item 5 ou 6 se o tempo for menor).
Os slides são os de número **9 a 13** (etiqueta "Entrega 2") de `Entrega1-Projeto3-NoSQL-Grafos.pptx`.

### Antes de começar (5 minutos antes)
1. Abra o Docker Desktop e confirme que os contêineres `rotas-mysql` e `rotas-neo4j` estão ligados (`docker compose up -d`).
2. Rode `.\scripts\testar.ps1` **uma vez**: confirma que está tudo certo e aquece o cache dos bancos.
3. Deixe abertas: os slides, um terminal na pasta `entrega2`, e o Neo4j Browser (http://localhost:7474, já logado).
4. Feche programas pesados. O MySQL e o Neo4j usam cerca de 6 GB.
5. Plano B: se o Docker falhar, mostre as saídas reais salvas em `evidencias\` e os slides.

### Roteiro
| Tempo | O que fazer | O que dizer |
|---|---|---|
| 0:30 | Recapitular o cenário (slide 7 ou 8) | Malha viária da Califórnia, 4,7 milhões de registros, Neo4j contra MySQL. |
| 1:00 | **Slide 9** (modelos) | No MySQL, estrada é uma linha com duas chaves estrangeiras e cada salto é um JOIN. No Neo4j, é um relacionamento que liga os nós diretamente. |
| 1:30 | **Slides 10 e 11** + ao vivo: `SELECT COUNT(*) FROM interseccao;` e `MATCH (n:Intersecao) RETURN count(n);` | Mesmo conjunto de dados nos dois: 1.965.206 interseções e 5.533.214 relacionamentos, 0 órfãs. A carga foi automatizada em um comando. |
| 1:00 | **Slide 12** (CRUD) + ao vivo: `.\scripts\testar.ps1` (parte do CRUD) | As quatro operações dão o mesmo resultado nos dois bancos. No Delete, o Neo4j faz tudo com DETACH DELETE e o MySQL precisa de duas etapas por causa das chaves estrangeiras. |
| 2:30 | **Slide 13** (exemplo) + ao vivo: `node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8` e depois a versão com `--raio 25` | É o caso do eBay Now: roteirizar entregas. Rotas idênticas nos dois. Perto do depósito empatam; com alcance maior o Neo4j se distancia. Enquanto o MySQL roda (cerca de 30 s), explique a consulta recursiva. |
| 0:30 | Fechamento | Isso ainda não é uma medição: cada tempo é uma execução. Na Entrega 3 vamos medir com 10 execuções e medianas, e mostrar também onde o MySQL empata ou vence. |

Dica visual: no Neo4j Browser, rode `MATCH p=(a:Intersecao {id: 0})-[:LIGA_A*1..3]->(b) RETURN p LIMIT 100;`
enquanto fala do modelo. O desenho do grafo ajuda quem está assistindo.

### Perguntas que podem fazer
- **Por que o MySQL ficou tão mais lento no raio 25?** O menor caminho no MySQL é uma consulta recursiva (CTE) que explora toda a região até o limite de saltos, sem parar quando acha o destino. O Neo4j tem um algoritmo próprio de caminho mínimo. Isso é característico do paradigma, mas é uma diferença de método e por isso a Entrega 3 vai medir com rigor.
- **Isso prova que o Neo4j é mais rápido?** Não. São execuções únicas. Perto do depósito os dois empataram. A prova (ou não) vem da Entrega 3.
- **A comparação é justa?** O MySQL tem índice em origem (chave primária) e em destino, e os dois têm a mesma quantidade de memória. Ainda assim, um ponto a melhorar: na Entrega 3 vale testar também uma versão mais enxuta da consulta no MySQL.
- **Por que os dois sentidos?** O dataset é não direcionado. Guardar os dois sentidos nos dois bancos mantém o mesmo resultado lógico.
- **A carga do Neo4j é justa com a do MySQL?** Não é uma comparação de desempenho: o Neo4j usou importação offline (`neo4j-admin`), que é mais rápida que inserir por consultas.
- **Por que não tem distância em km?** O roadNet-CA não traz distância nem coordenadas. O menor caminho é em número de trechos.
- **Qual o próximo passo?** Entrega 3: experimentos (Q1 a Q4) com metodologia rigorosa. Entrega 4: dashboard com os dois bancos.

---

## 5. Estrutura de pastas
- `docker-compose.yml`: MySQL 8.0 e Neo4j 5 Community
- `scripts/`: `carregar.ps1` (instala e carrega), `testar.ps1` (teste completo), `preparar-dados.js` (baixa e gera os CSVs), `demo-entregas.js` (exemplo de rotas)
- `sql/`: esquema, carga, verificação, evolução de esquema e CRUD do MySQL
- `cypher/`: verificação e CRUD do Neo4j
- `evidencias/`: saídas reais das verificações, do CRUD e do exemplo
- `dados/`: dataset original, CSVs gerados e tempos de carga

## 6. Ambiente usado nos números deste projeto
Intel Core Ultra 5 225H, 15,4 GB de RAM, Windows 11, Docker Desktop. MySQL 8.0.46 e Neo4j 5.26.33 Community.

## 7. Problemas comuns
| Sintoma | O que fazer |
|---|---|
| `failed to connect to the docker API` | O Docker Desktop não está aberto. Abra, espere iniciar e tente de novo. |
| `testar.ps1` diz "NÃO está saudável" | Rode `docker compose up -d` e espere cerca de 30 s. Na primeira vez, use `.\scripts\carregar.ps1`. |
| Porta já em uso (3307, 7474 ou 7687) | Feche o programa que usa a porta, ou troque a porta em `docker-compose.yml` e nos scripts. |
| Lentidão ou o Docker fecha sozinho | Falta memória. Feche outros programas ou reduza os valores de memória em `docker-compose.yml`. |
| `poucos candidatos; aumente --raio` | Use um `--raio` maior ou outro `--deposito`. |
| Erro de política de execução do PowerShell | Use `powershell -ExecutionPolicy Bypass -File .\scripts\NOME.ps1`. |

## 8. Limitações
- Sem distância nem coordenadas: o menor caminho é em número de trechos.
- A rota do exemplo usa o vizinho mais próximo, que não é a rota ótima.
- Os tempos do exemplo são de uma execução e não valem como medição.
- O professor ainda precisa validar o Neo4j como SGBD do projeto.
