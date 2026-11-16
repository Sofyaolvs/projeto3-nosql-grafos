# Instala e carrega os dois bancos com a malha viária roadNet-CA.
# Uso (PowerShell, dentro de entrega2): .\scripts\carregar.ps1
# Requisitos: Docker Desktop em execução e Node.js.
$ErrorActionPreference = "Continue"  # docker escreve progresso em stderr; erros são checados por $LASTEXITCODE
Set-Location (Join-Path $PSScriptRoot "..")
$tempos = [ordered]@{}
$senha = "rotas12345"

function Medir($nome, [scriptblock]$bloco) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & $bloco
  $sw.Stop()
  $tempos[$nome] = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  Write-Host ("{0}: {1} s" -f $nome, $tempos[$nome])
}
function EsperarSaudavel($container) {
  for ($i = 0; $i -lt 90; $i++) {
    $s = docker inspect -f '{{.State.Health.Status}}' $container 2>$null
    if ($s -eq "healthy") { return }
    Start-Sleep -Seconds 4
  }
  throw "$container não ficou saudável"
}

if (-not (Test-Path "dados\arestas_mysql.csv")) { Medir "preparar_dados" { node scripts/preparar-dados.js } }

# ---- MySQL ----
docker compose up -d mysql
EsperarSaudavel "rotas-mysql"
docker exec -e MYSQL_PWD=$senha rotas-mysql mysql -uroot rotas -e "SET foreign_key_checks=0; TRUNCATE TABLE estrada; TRUNCATE TABLE interseccao; SET foreign_key_checks=1;"
Medir "mysql_carga" {
  Get-Content sql\02-carga.sql -Raw | docker exec -i -e MYSQL_PWD=$senha rotas-mysql mysql -uroot rotas
  if ($LASTEXITCODE -ne 0) { throw "carga MySQL falhou" }
}

# ---- Neo4j (importação offline, depois sobe o servidor) ----
docker compose stop neo4j | Out-Null
Medir "neo4j_import" {
  docker compose run --rm --no-deps --entrypoint neo4j-admin neo4j database import full neo4j `
    --overwrite-destination --id-type=integer `
    --nodes=Intersecao=/import/nos.csv `
    --relationships=LIGA_A=/import/arestas.csv
  if ($LASTEXITCODE -ne 0) { throw "neo4j-admin import falhou" }
}
docker compose up -d neo4j
EsperarSaudavel "rotas-neo4j"
Medir "neo4j_indice_unico" {
  docker exec rotas-neo4j cypher-shell -u neo4j -p $senha "CREATE CONSTRAINT intersecao_id IF NOT EXISTS FOR (i:Intersecao) REQUIRE i.id IS UNIQUE;"
  if ($LASTEXITCODE -ne 0) { throw "constraint falhou" }
  docker exec rotas-neo4j cypher-shell -u neo4j -p $senha "CALL db.awaitIndexes(600);"
}

$tempos | ConvertTo-Json | Set-Content dados\tempos-carga.json -Encoding utf8
Write-Host "Carga concluída. Tempos em dados\tempos-carga.json"
