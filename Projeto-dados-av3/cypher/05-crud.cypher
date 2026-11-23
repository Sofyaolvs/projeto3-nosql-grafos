// CRUD equivalente (Neo4j). Usa a interseção 5000000 (nova) ligada à interseção 0 (existente).

// CREATE: nova interseção e uma via de mão dupla (um trecho em cada sentido)
MATCH (m:Intersecao {id: 0})
CREATE (n:Intersecao {id: 5000000, osm_id: 0, lat: m.lat + 0.0005, lon: m.lon, cidade: m.cidade, uf: m.uf, ruas: 1})
CREATE (n)-[:LIGA_A {chave: 0, nome: 'Rua do Projeto 3', tipo: 'residential', comprimento_m: 55.6, mao_unica: false}]->(m),
       (m)-[:LIGA_A {chave: 0, nome: 'Rua do Projeto 3', tipo: 'residential', comprimento_m: 55.6, mao_unica: false}]->(n);

// READ: para onde dá para ir saindo da interseção 0, com os dados da via
MATCH (:Intersecao {id: 0})-[r:LIGA_A]->(v)
RETURN v.id AS destino, r.nome AS nome, r.tipo AS tipo, r.comprimento_m AS comprimento_m, r.mao_unica AS mao_unica
ORDER BY destino, r.chave;

// UPDATE: bloquear a estrada nova (propriedade criada na hora, sem ALTER de esquema)
MATCH (a:Intersecao {id: 0})-[r:LIGA_A]-(b:Intersecao {id: 5000000}) SET r.bloqueada = true;
MATCH (a:Intersecao)-[r:LIGA_A]->(b:Intersecao)
 WHERE a.id = 5000000 OR b.id = 5000000
RETURN a.id AS origem, b.id AS destino, r.nome AS nome, r.bloqueada AS bloqueada;

// DELETE: DETACH remove a interseção e suas estradas em um comando
MATCH (n:Intersecao {id: 5000000}) DETACH DELETE n;
MATCH (n:Intersecao {id: 5000000}) RETURN count(n) AS restantes;
