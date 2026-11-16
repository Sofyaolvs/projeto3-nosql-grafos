-- CRUD equivalente (MySQL). Usa a interseção 5000000 (nova) ligada à interseção 0 (existente).
-- Pré-requisito: sql/04-evolucao-esquema.sql (coluna "bloqueada").

-- CREATE: nova interseção e estrada nos dois sentidos
INSERT INTO interseccao (id) VALUES (5000000);
INSERT INTO estrada (origem, destino) VALUES (5000000, 0), (0, 5000000);

-- READ: vizinhos diretos da interseção 0
SELECT destino FROM estrada WHERE origem = 0 ORDER BY destino;

-- UPDATE: bloquear a estrada nova (interdição de via)
UPDATE estrada SET bloqueada = 1
 WHERE (origem = 0 AND destino = 5000000) OR (origem = 5000000 AND destino = 0);
SELECT origem, destino, bloqueada FROM estrada WHERE origem = 5000000 OR destino = 5000000;

-- DELETE: remove as estradas e depois a interseção (a chave estrangeira exige essa ordem)
DELETE FROM estrada WHERE origem = 5000000 OR destino = 5000000;
DELETE FROM interseccao WHERE id = 5000000;
SELECT COUNT(*) AS restantes FROM interseccao WHERE id = 5000000;
