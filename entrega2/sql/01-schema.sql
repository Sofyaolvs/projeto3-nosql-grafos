-- Modelo relacional (MySQL 8.0): malha viária roadNet-CA
CREATE TABLE interseccao (
  id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Cada estrada é guardada nos dois sentidos (mesmo resultado lógico do grafo).
-- PK (origem, destino) já indexa a busca por origem; idx_destino cobre a busca por destino.
CREATE TABLE estrada (
  origem  INT UNSIGNED NOT NULL,
  destino INT UNSIGNED NOT NULL,
  PRIMARY KEY (origem, destino),
  KEY idx_destino (destino),
  CONSTRAINT fk_estrada_origem  FOREIGN KEY (origem)  REFERENCES interseccao (id),
  CONSTRAINT fk_estrada_destino FOREIGN KEY (destino) REFERENCES interseccao (id)
) ENGINE=InnoDB;
