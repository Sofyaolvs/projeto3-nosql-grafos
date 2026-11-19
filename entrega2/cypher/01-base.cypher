// Aviso: Executar apenas uma vez antes da carga de dados

// PK: Garante a unicidade da interseção
CREATE CONSTRAINT constraint_interseccao_id IF NOT EXISTS 
FOR (i:Interseccao) REQUIRE i.id IS UNIQUE;

// Índices secundários de nós (filtros geográficos e mapeamento)
CREATE INDEX index_interseccao_cidade IF NOT EXISTS 
FOR (i:Interseccao) ON (i.cidade);

CREATE INDEX index_interseccao_osm_id IF NOT EXISTS 
FOR (i:Interseccao) ON (i.osm_id);

// Índice de relacionamento (filtro por tipo de via)
CREATE INDEX index_estrada_tipo IF NOT EXISTS 
FOR ()-[e:ESTRADA]-() ON (e.tipo);