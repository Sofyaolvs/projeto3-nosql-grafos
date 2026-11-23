// Evidência do volume e da integridade (Neo4j)
MATCH (n:Intersecao) RETURN count(n) AS intersecoes;
MATCH ()-[r:LIGA_A]->() RETURN count(r) AS estradas;
MATCH ()-[r:LIGA_A]->() WHERE r.mao_unica RETURN count(r) AS mao_unica;
MATCH ()-[r:LIGA_A]->() WHERE r.nome IS NOT NULL RETURN count(r) AS com_nome;
MATCH ()-[r:LIGA_A]->() RETURN round(sum(r.comprimento_m) / 1000) AS km_total;
// via de mão dupla tem o trecho de volta (esperado 0 sem volta)
MATCH (a)-[r:LIGA_A]->(b) WHERE NOT r.mao_unica AND NOT (b)-[:LIGA_A]->(a) RETURN count(r) AS mao_dupla_sem_volta;
// as 5 maiores cidades em número de interseções
MATCH (n:Intersecao) RETURN n.cidade AS cidade, count(n) AS intersecoes ORDER BY intersecoes DESC, cidade LIMIT 5;
// os 5 tipos de via mais comuns
MATCH ()-[r:LIGA_A]->() RETURN r.tipo AS tipo, count(r) AS estradas ORDER BY estradas DESC, tipo LIMIT 5;
// tipo do identificador (esperado INTEGER)
MATCH (n:Intersecao) RETURN valueType(n.id) AS tipo LIMIT 1;
