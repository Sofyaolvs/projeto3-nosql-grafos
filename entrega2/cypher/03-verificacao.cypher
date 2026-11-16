// Evidência do volume e da integridade (Neo4j)
MATCH (n:Intersecao) RETURN count(n) AS intersecoes;
MATCH ()-[r:LIGA_A]->() RETURN count(r) AS estradas_dirigidas;
MATCH (a:Intersecao)-[r:LIGA_A]->(b:Intersecao) WHERE a.id < b.id RETURN count(r) AS estradas_unicas;
// simetria: toda estrada tem a sua volta (esperado 0 sem volta)
MATCH (a)-[:LIGA_A]->(b) WHERE NOT (b)-[:LIGA_A]->(a) RETURN count(*) AS sem_volta;
// tipo do identificador (esperado INTEGER)
MATCH (n:Intersecao) RETURN valueType(n.id) AS tipo LIMIT 1;
