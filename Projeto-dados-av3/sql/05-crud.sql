-- CRUD equivalente (MySQL). Usa a interseção 5000000 (nova) ligada à interseção 0 (existente).
-- Pré-requisito: sql/04-evolucao-esquema.sql (coluna "bloqueada").

-- CREATE: nova interseção e uma via de mão dupla (um trecho em cada sentido)
INSERT INTO interseccao (id, osm_id, lat, lon, cidade, uf, ruas)
SELECT 5000000, 0, lat + 0.0005, lon, cidade, uf, 1 FROM interseccao WHERE id = 0;
INSERT INTO estrada (origem, destino, chave, nome, tipo, comprimento_m, mao_unica) VALUES
  (5000000, 0, 0, 'Rua do Projeto 3', 'residential', 55.6, 0),
  (0, 5000000, 0, 'Rua do Projeto 3', 'residential', 55.6, 0);

-- READ: para onde dá para ir saindo da interseção 0, com os dados da via
SELECT destino, nome, tipo, comprimento_m, mao_unica FROM estrada WHERE origem = 0 ORDER BY destino, chave;

-- UPDATE: bloquear a estrada nova (interdição de via)
UPDATE estrada SET bloqueada = 1
 WHERE (origem = 0 AND destino = 5000000) OR (origem = 5000000 AND destino = 0);
SELECT origem, destino, nome, bloqueada FROM estrada WHERE origem = 5000000 OR destino = 5000000;

-- DELETE: remove as estradas e depois a interseção (a chave estrangeira exige essa ordem)
DELETE FROM estrada WHERE origem = 5000000 OR destino = 5000000;
DELETE FROM interseccao WHERE id = 5000000;
SELECT COUNT(*) AS restantes FROM interseccao WHERE id = 5000000;
