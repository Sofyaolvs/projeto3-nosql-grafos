# Testa tudo que a Entrega 2 entrega, em um comando.
# Uso (PowerShell, dentro de entrega2): .\scripts\testar.ps1
# Pode ser rodado quantas vezes quiser. Requer os bancos carregados (.\scripts\carregar.ps1).
$ErrorActionPreference = "Continue"
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
Set-Location (Join-Path $PSScriptRoot "..")
$senha = "rotas12345"
$falhas = 0

function Titulo($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function MySql($arquivo) { cmd /c "docker exec -i -e MYSQL_PWD=$senha rotas-mysql mysql -uroot rotas -t < $arquivo" }
function Neo($arquivo) { cmd /c "docker exec -i rotas-neo4j cypher-shell -u neo4j -p $senha --format plain < $arquivo" }

Titulo "0. Os dois contêineres estão no ar?"
foreach ($c in "rotas-mysql", "rotas-neo4j") {
  $s = docker inspect -f '{{.State.Health.Status}}' $c 2>$null
  if ($s -eq "healthy") { Write-Host "$c : OK" -ForegroundColor Green }
  else { Write-Host "$c : NÃO está saudável ($s). Rode: docker compose up -d   (ou .\scripts\carregar.ps1 na primeira vez)" -ForegroundColor Red; exit 1 }
}

Titulo "1. Volume e integridade: MySQL"
MySql sql\03-verificacao.sql
Titulo "1. Volume e integridade: Neo4j"
Neo cypher\03-verificacao.cypher
Write-Host "Esperado nos dois: 1965206 interseções, 5533214 estradas (2 sentidos), 2766607 únicas, 0 sem volta." -ForegroundColor Yellow

Titulo "2. CRUD: MySQL"
$tem = docker exec -e MYSQL_PWD=$senha rotas-mysql mysql -uroot rotas -N -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='rotas' AND table_name='estrada' AND column_name='bloqueada'"
if ($tem -ne "1") { Write-Host "(criando a coluna bloqueada, só na primeira vez)"; MySql sql\04-evolucao-esquema.sql }
MySql sql\05-crud.sql
Titulo "2. CRUD: Neo4j"
Neo cypher\05-crud.cypher
Write-Host "Esperado: vizinhos 1, 2, 469 e 5000000; update com bloqueada nas duas estradas; restantes = 0." -ForegroundColor Yellow

Titulo "3. Exemplo funcionando: roteamento de entregas"
node scripts\demo-entregas.js --deposito 0 --paradas 5 --raio 8
Write-Host "Esperado: 'Matrizes de distância idênticas: SIM' e 'Rotas idênticas: SIM'." -ForegroundColor Yellow
