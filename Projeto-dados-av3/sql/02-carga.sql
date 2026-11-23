-- Carga em massa. Os arquivos ficam em /var/lib/mysql-files (montado de ./dados).
-- São os mesmos CSVs usados pelo Neo4j: a primeira linha é o cabeçalho e campo vazio vira NULL.
SET foreign_key_checks = 0;
SET unique_checks = 0;

LOAD DATA INFILE '/var/lib/mysql-files/intersecoes.csv'
INTO TABLE interseccao
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY ''
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(id, osm_id, lat, lon, cidade, uf, @ruas)
SET ruas = NULLIF(@ruas, '');

LOAD DATA INFILE '/var/lib/mysql-files/estradas.csv'
INTO TABLE estrada
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY ''
LINES TERMINATED BY '\n'
IGNORE 1 LINES
(origem, destino, chave, @nome, tipo, comprimento_m, @mao_unica, @velocidade, @faixas)
SET nome = NULLIF(@nome, ''),
    mao_unica = (@mao_unica = 'true'),
    velocidade_max = NULLIF(@velocidade, ''),
    faixas = NULLIF(@faixas, '');

SET unique_checks = 1;
SET foreign_key_checks = 1;
