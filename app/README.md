# Entregas 3 e 4 · Experimentos e dashboard (Neo4j × MySQL)

Esta pasta tem o **dashboard** (Entrega 4) e o programa dos **experimentos** (Entrega 3). Os dois usam o mesmo
módulo de consultas, [`lib/consultas.js`](lib/consultas.js), então o que o dashboard mostra é o que foi medido.

Os bancos são os da pasta [`../entrega2`](../entrega2/README.md) (malha viária das 27 capitais, OpenStreetMap).

---

## 1. Requisitos
- Os bancos carregados e ligados (veja `entrega2/README.md`): `.\scripts\carregar.ps1` na primeira vez, depois `docker compose up -d`
- Node.js 18 ou superior
- Portas: `5300` (dashboard), `3307` (MySQL) e `7687` (Neo4j)

## 2. Instalar e abrir o dashboard
```powershell
cd app
npm install
npm run dashboard
```
Abra http://localhost:5300. Ele não usa internet (o Chart.js está em `public/vendor`).

### O que cada parte faz
| Parte | O que mostra | Consulta nova quando… |
|---|---|---|
| Fonte de dados (MySQL / Neo4j) | De qual banco vêm os números | você troca a fonte |
| Método no MySQL | SQL puro (CTE recursiva) ou busca em níveis (aplicação + SQL) | você troca o método |
| Cidade | Uma das 27 capitais | você troca a cidade |
| Tipo de via | Todas, só principais, só locais, sem residenciais | você troca o filtro |
| Alcance (1 a 12) | Quantas interseções ficam a até k trechos da origem | você move o controle |
| Limite de saltos da rota | Até quantos trechos o menor caminho pode ter | você muda o valor |
| Mapa | Clique para escolher origem (verde) e destino (vermelho). **Role o mouse para aproximar e arraste para mover**: ao chegar perto aparecem as ruas, com o nome ao passar o mouse. Botões: + e − (zoom), ⤧ (ajustar à rota), ⌂ (cidade inteira), ⛶ (tela cheia, Esc sai) | você clica, aproxima ou move |
| Sugerir par de pontos | Sorteia um par curto, médio ou longo | você clica |
| Comparar bancos agora | Roda as 5 consultas nos dois bancos (1 aquecimento + 3 medidas) | você clica (pode levar de 30 a 60 s) |
| Demonstração: menor caminho | O mesmo par nos 3 métodos, com o limite de saltos escolhido | você clica |

Cada painel mostra o tempo da consulta em ms e o gráfico "Comparação de tempos" coloca os métodos lado a lado.

---

## 3. Como testar

### 3.1 O dashboard
1. Abra o dashboard. Em alguns segundos aparecem os indicadores de São Paulo, o mapa com uma rota verde → vermelha e os gráficos. O status no topo deve dizer "Pronto".
2. Troque a fonte para **MySQL**: os números dos indicadores e dos gráficos têm de ser os mesmos (122.710 interseções e 304.569 trechos em São Paulo).
3. Troque o tipo de via para "Só vias principais": o alcance diminui e a rota pode virar "Sem caminho".
4. Clique em **Comparar bancos agora**: o gráfico enche, e a mensagem final deve dizer "Resultados iguais nos bancos: sim".

### 3.2 A API (sem abrir o navegador)
```powershell
curl "http://localhost:5300/api/indicadores?fonte=neo4j&cidade=Recife"
curl "http://localhost:5300/api/indicadores?fonte=mysql&cidade=Recife"
curl "http://localhost:5300/api/par?cidade=Recife&saltos=30&semente=3"
```
As duas primeiras têm de devolver os mesmos números (19.710 interseções, 49.746 trechos).

### 3.3 Os experimentos
```powershell
npm run experimentos                         # tudo (leva algumas dezenas de minutos)
npm run experimentos -- --so E3,E4 --medidas 3   # teste rápido, só buscas e agregação
```
Opções: `--cidade "São Paulo"`, `--medidas 10`, `--timeout 30` (segundos), `--so E1,E2,E3,E4`.

Atenção:
- **Não use o computador de forma pesada durante a execução completa**, para não distorcer as medidas.
- O experimento E4 cria um índice **temporário** no MySQL (`idx_tipo_cobertura`) e o remove no fim. Se a execução for interrompida no meio, apague com
  `docker exec -e MYSQL_PWD=rotas12345 rotas-mysql mysql -uroot rotas -e "DROP INDEX idx_tipo_cobertura ON estrada"`.
- Cada execução completa **regrava** os arquivos de `experimentos/resultados/`.

Os resultados ficam em:
| Arquivo | Conteúdo |
|---|---|
| `experimentos/resultados/medicoes.csv` | Todas as medições, uma por linha |
| `experimentos/resultados/resumo.json` | Medianas, mínimos e máximos, equivalência por item e pares usados |
| `experimentos/resultados/ambiente.json` | Máquina, versões, índices e protocolo |
| `experimentos/resultados/execucao.log` | Saída do programa |

Para regerar o documento e os slides com os números novos:
```powershell
cd ..
node gerar-documento-entrega3-4.js     # Entrega3e4-Projeto3-NoSQL-Grafos.docx
node gerar-slides.js                   # Entrega1-Projeto3-NoSQL-Grafos.pptx (21 slides)
```

---

## 4. Como apresentar (entrega final: 20 minutos)

O enunciado sugere **8 minutos** de conceitos e comparação, **8** de demonstração (dashboard e benchmark) e **4** de conclusões e perguntas.
Os slides são os de `Entrega1-Projeto3-NoSQL-Grafos.pptx` (21 slides; o canto superior direito mostra a que entrega cada um pertence).

### Antes de começar (10 minutos antes)
1. Abra o Docker Desktop e rode `docker compose up -d` na pasta `entrega2`. Espere os dois contêineres ficarem saudáveis (cerca de 30 s).
2. Em `app`, rode `npm run dashboard` e abra http://localhost:5300.
3. **Aqueça os bancos:** clique em "Sugerir par de pontos" e depois em "Comparar bancos agora" uma vez. A primeira consulta de cada banco é mais lenta.
4. Deixe abertas: os slides, o dashboard e um terminal na pasta `app`. Feche programas pesados.
5. **Plano B** se algo falhar: os slides 17 e 18 têm os resultados, `docs/dashboard-completo.png` é uma captura do dashboard e `experimentos/resultados/` tem os dados.

### Roteiro
| Tempo | O que fazer | O que dizer |
|---|---|---|
| 0:00 a 3:00 | Slides 2 a 6 | Paradigma de grafos, Neo4j (adjacência sem índice), aplicações reais e comparação teórica com o relacional. |
| 3:00 a 8:00 | Slides 7 a 15 (ou os principais: 10, 11, 12 e 13) | O problema (rotas em malha viária), a troca do dataset para o OpenStreetMap, a modelagem nos dois bancos, 781.489 interseções e 1.970.520 trechos iguais nos dois, CRUD equivalente. |
| 8:00 a 9:30 | **Dashboard**: indicadores, troque a fonte MySQL ↔ Neo4j | Mesmos números nos dois bancos; cada painel mostra o tempo. |
| 9:30 a 11:00 | Troque o filtro de tipo de via e a cidade | Cada alteração executa uma nova consulta. |
| 11:00 a 14:00 | **Demonstração do ganho:** par "longo", depois **Demonstração: menor caminho** (limite 150) | O Neo4j responde em milissegundos; a busca em níveis do MySQL leva centenas de ms; a CTE estoura os 30 s (enquanto espera, explique por que ela não para ao achar o destino). Resultados iguais. |
| 14:00 a 15:00 | Mude o limite de saltos para a distância real e repita | Com limite justo, o SQL puro se aproxima: a vantagem vem de o Neo4j não precisar saber a distância. |
| 15:00 a 16:00 | Slides 17 e 18 | Os números medidos (10 execuções, medianas) e onde o MySQL ganha. |
| 16:00 a 20:00 | Slides 19 e 21 e perguntas | Conclusões abaixo. |

**Cuidado na demonstração:** a CTE do MySQL pode levar até 30 s por tentativa. O botão "Comparar bancos agora" pode levar de 30 a 60 s no total (a consulta recursiva roda até estourar). Fale enquanto espera.

### Conclusões para dizer
- O paradigma de grafos compensou onde a pergunta é de **caminho**: o menor caminho sem saber a distância foi de 3,6× a 34× mais rápido que a melhor opção no MySQL (busca em níveis) e mais de mil vezes que o SQL puro.
- Em consultas pontuais (alcance curto, busca por chave) o **MySQL foi mais rápido** (cerca de 2×, poucos milissegundos), e na agregação o resultado dependeu do índice.
- A escolha depende do tipo de pergunta. Mesmos dados, mesmos índices e resultados iguais nos dois bancos.

### Perguntas que podem fazer
- **O NoSQL é sempre mais rápido?** Não. Nos nossos experimentos, o MySQL ganhou em consultas pequenas e, com índice de cobertura, na agregação grande. O Neo4j ganhou no menor caminho.
- **A comparação foi justa?** Mesmos dados, índices equivalentes (cidade e tipo de via), nenhum índice removido. Incluímos duas formas de fazer o menor caminho no MySQL (SQL puro e busca em níveis), e medimos a agregação também com um índice de cobertura para o MySQL.
- **Por que a CTE estoura os 30 s?** Ela não consegue parar ao achar o destino: explora toda a região até o limite de saltos. Com o limite igual à distância real (E2a) ela vai bem em caminhos curtos.
- **Por que o MySQL foi mais rápido nas consultas pequenas?** Busca por índice é muito barata, e uma malha viária tem poucas ruas por interseção. O Neo4j tem um custo fixo por consulta de alguns milissegundos. É uma hipótese coerente com os números, e não foi isolada com perfilamento.
- **Por que só São Paulo nos experimentos?** É a maior malha do conjunto. É uma limitação: o dashboard permite testar as outras cidades, mas as medições rigorosas são de uma cidade.
- **Os tempos do dashboard batem com os experimentos?** São da mesma ordem, mas o dashboard mostra execuções avulsas e os experimentos mostram medianas de 10 execuções.
- **Por que o menor caminho é em trechos, e não em km?** O Neo4j Community não traz o Dijkstra ponderado sem plugin, e a CTE do MySQL não faz isso de forma prática. O comprimento de cada trecho já está nos dados, e é um próximo passo.
- **As duas rotas (MySQL e Neo4j) têm os mesmos km?** O número de trechos é o mesmo; em empates o caminho pode ser outro e o total de km muda um pouco.

---

## 5. O que entregar (conforme o enunciado)
| Item | Onde está |
|---|---|
| Slides | `Entrega1-Projeto3-NoSQL-Grafos.pptx` (21 slides, Entregas 1 a 4) |
| Código-fonte | `app/` (dashboard, consultas, experimentos) e `entrega2/scripts/` |
| Instruções de execução | este README e `entrega2/README.md` |
| Modelos | `entrega2/sql/01-schema.sql`, `entrega2/cypher/` e os documentos das Entregas 2 e 3-4 |
| Scripts de criação e carga | `entrega2/scripts/carregar.ps1`, `entrega2/sql/02-carga.sql`, `entrega2/cypher/02-indices.cypher` |
| Consultas e seus índices | `app/lib/consultas.js` e a seção 2.2 do documento das Entregas 3 e 4 |
| Resultados brutos | `app/experimentos/resultados/medicoes.csv` e `resumo.json` |
| Evidências da massa de dados | `entrega2/evidencias/` e `entrega2/dados/resumo.json` |

## 6. Problemas comuns
| Sintoma | O que fazer |
|---|---|
| O dashboard diz "Erro ao iniciar… Os bancos estão ligados?" | Rode `docker compose up -d` em `entrega2` e espere cerca de 30 s. |
| `EADDRINUSE` na porta 5300 | Já há um dashboard aberto. Feche-o ou use `PORT=5301 npm run dashboard`. |
| Um dos bancos não responde | `docker ps` mostra se `rotas-mysql` e `rotas-neo4j` estão "healthy". |
| "Resultados iguais: NÃO" | Os bancos estão com cargas diferentes. Rode `entrega2\scripts\carregar.ps1` de novo. |
| Tempos muito diferentes dos do documento | Normal em outra máquina. As proporções entre os métodos é que devem se repetir. |
| A comparação demora | A CTE do MySQL pode levar até 30 s por consulta. É esperado. |
