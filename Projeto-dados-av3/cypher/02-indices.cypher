// Índices equivalentes aos do MySQL (idx_cidade em interseccao e idx_tipo em estrada),
// para as consultas filtradas por cidade e por tipo de via serem comparadas em igualdade de condições.
// (A unicidade de Intersecao.id já é criada pelo carregar.ps1.)
CREATE INDEX intersecao_cidade IF NOT EXISTS FOR (i:Intersecao) ON (i.cidade);
CREATE INDEX liga_a_tipo IF NOT EXISTS FOR ()-[r:LIGA_A]-() ON (r.tipo);
CALL db.awaitIndexes(600);
