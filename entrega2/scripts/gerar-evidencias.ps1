# Regera a pasta evidencias\ a partir dos bancos carregados (saídas reais das verificações, do CRUD e do exemplo).
# Uso (PowerShell, dentro de entrega2): .\scripts\gerar-evidencias.ps1
# O documento e os slides da Entrega 2 leem evidencias\numeros.json, dados\resumo.json e dados\tempos-carga.json.
$ErrorActionPreference = "Continue"
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Set-Location (Join-Path $PSScriptRoot "..")
$senha = "rotas12345"
$utf8 = New-Object System.Text.UTF8Encoding $false

function Salvar($arquivo, $linhas) { [IO.File]::WriteAllLines((Join-Path (Get-Location) "evidencias\$arquivo"), [string[]]$linhas, $utf8) }
function MySql($arquivo) { cmd /c "docker exec -i -e MYSQL_PWD=$senha rotas-mysql mysql -uroot --default-character-set=utf8mb4 rotas -t < $arquivo" }
function Neo($arquivo) { cmd /c "docker exec -i rotas-neo4j cypher-shell -u neo4j -p $senha --format plain < $arquivo" }
function MySqlValor($sql) { docker exec -e MYSQL_PWD=$senha rotas-mysql mysql -uroot rotas -N -e $sql }

Salvar "verificacao-mysql.txt" (MySql sql\03-verificacao.sql)
Salvar "verificacao-neo4j.txt" (Neo cypher\03-verificacao.cypher)

$tem = MySqlValor "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='rotas' AND table_name='estrada' AND column_name='bloqueada'"
if ($tem -ne "1") { MySql sql\04-evolucao-esquema.sql | Out-Null }
Salvar "crud-mysql.txt" (MySql sql\05-crud.sql)
Salvar "crud-neo4j.txt" (Neo cypher\05-crud.cypher)

Salvar "demo-entregas.txt" (node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8 --json evidencias\demo-raio8.json)
Salvar "demo-entregas-raio25.txt" (node scripts\demo-entregas.js --deposito 0 --paradas 6 --raio 25 --semente 3 --json evidencias\demo-raio25.json)

# tamanhos e versões
MySqlValor "ANALYZE TABLE interseccao, estrada" | Out-Null
$t = (MySqlValor "SELECT ROUND(SUM(data_length)/1024/1024,1), ROUND(SUM(index_length)/1024/1024,1) FROM information_schema.tables WHERE table_schema='rotas'") -split "\s+"
$neoMb = [int]((docker exec rotas-neo4j du -sm /data/databases/neo4j) -split "\s+")[0]
$vMysql = MySqlValor "SELECT VERSION()"
$vNeo = (docker exec rotas-neo4j cypher-shell -u neo4j -p $senha --format plain "CALL dbms.components() YIELD versions RETURN versions[0]")[1].Trim('"')
$vizinhos = MySqlValor "SELECT GROUP_CONCAT(DISTINCT destino ORDER BY destino SEPARATOR ', ') FROM estrada WHERE origem = 0"
Salvar "tamanho-e-versoes.txt" @(
  "MySQL $vMysql : dados $($t[0]) MB + índices $($t[1]) MB",
  "Neo4j $vNeo Community: armazenamento do banco $neoMb MB (/data/databases/neo4j; o log de transações não entra)"
)
# os mesmos totais lidos de cada banco, para o documento comparar lado a lado
$m = (MySqlValor "SELECT (SELECT COUNT(*) FROM interseccao), COUNT(*), SUM(mao_unica), COUNT(nome), ROUND(SUM(comprimento_m)/1000), (SELECT COUNT(*) FROM estrada e LEFT JOIN interseccao o ON o.id = e.origem LEFT JOIN interseccao d ON d.id = e.destino WHERE o.id IS NULL OR d.id IS NULL), (SELECT COUNT(*) FROM estrada a WHERE a.mao_unica = 0 AND NOT EXISTS (SELECT 1 FROM estrada b WHERE b.origem = a.destino AND b.destino = a.origem)) FROM estrada") -split "\s+"
$g = (docker exec rotas-neo4j cypher-shell -u neo4j -p $senha --format plain "MATCH (n:Intersecao) WITH count(n) AS i MATCH (a)-[r:LIGA_A]->(b) RETURN i, count(r), sum(CASE WHEN r.mao_unica THEN 1 ELSE 0 END), count(r.nome), toInteger(round(sum(r.comprimento_m)/1000)), sum(CASE WHEN NOT r.mao_unica AND NOT (b)-[:LIGA_A]->(a) THEN 1 ELSE 0 END)")[1] -split ",\s*"
$numeros = [ordered]@{
  mysql = [ordered]@{ intersecoes = [long]$m[0]; estradas = [long]$m[1]; mao_unica = [long]$m[2]; com_nome = [long]$m[3]; km_total = [long]$m[4]; orfas = [long]$m[5]; mao_dupla_sem_volta = [long]$m[6] }
  neo4j = [ordered]@{ intersecoes = [long]$g[0]; estradas = [long]$g[1]; mao_unica = [long]$g[2]; com_nome = [long]$g[3]; km_total = [long]$g[4]; mao_dupla_sem_volta = [long]$g[5] }
  mysql_dados_mb = [double]$t[0]; mysql_indices_mb = [double]$t[1]; neo4j_mb = $neoMb
  mysql_versao = $vMysql; neo4j_versao = $vNeo; vizinhos_da_0 = $vizinhos
  demo_raio8 = Get-Content evidencias\demo-raio8.json -Raw -Encoding utf8 | ConvertFrom-Json
  demo_raio25 = Get-Content evidencias\demo-raio25.json -Raw -Encoding utf8 | ConvertFrom-Json
}
[IO.File]::WriteAllText((Join-Path (Get-Location) "evidencias\numeros.json"), ($numeros | ConvertTo-Json -Depth 5), $utf8)
Remove-Item evidencias\demo-raio8.json, evidencias\demo-raio25.json
Write-Host "Evidências regeradas em evidencias\"
