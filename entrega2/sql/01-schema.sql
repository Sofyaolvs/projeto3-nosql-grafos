-- Modelo relacional (MySQL 8.0): malha viária das 27 capitais brasileiras (OpenStreetMap via OSMnx)
CREATE TABLE interseccao (
  id     INT UNSIGNED NOT NULL,           -- id sequencial gerado na extração
  osm_id BIGINT UNSIGNED NOT NULL,        -- id do nó no OpenStreetMap
  lat    DECIMAL(10,7) NOT NULL,
  lon    DECIMAL(10,7) NOT NULL,
  cidade VARCHAR(40) NOT NULL,
  uf     CHAR(2) NOT NULL,
  ruas   TINYINT UNSIGNED NULL,           -- quantas ruas se encontram na interseção
  PRIMARY KEY (id),
  KEY idx_cidade (cidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada linha é um trecho de via em UM sentido (via de mão dupla = duas linhas; mão única = uma).
-- "chave" distingue trechos paralelos entre o mesmo par de interseções (a malha é um multigrafo).
-- PK (origem, destino, chave) já indexa a busca por origem; idx_destino cobre a busca por destino.
CREATE TABLE estrada (
  origem         INT UNSIGNED NOT NULL,
  destino        INT UNSIGNED NOT NULL,
  chave          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  nome           VARCHAR(200) NULL,
  tipo           VARCHAR(20) NOT NULL,    -- classificação da via no OSM (residential, primary, motorway...)
  comprimento_m  DECIMAL(8,1) NOT NULL,
  mao_unica      TINYINT(1) NOT NULL,
  velocidade_max SMALLINT UNSIGNED NULL,  -- km/h, quando informado no OSM
  faixas         TINYINT UNSIGNED NULL,
  PRIMARY KEY (origem, destino, chave),
  KEY idx_destino (destino),
  KEY idx_tipo (tipo),
  CONSTRAINT fk_estrada_origem  FOREIGN KEY (origem)  REFERENCES interseccao (id),
  CONSTRAINT fk_estrada_destino FOREIGN KEY (destino) REFERENCES interseccao (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
