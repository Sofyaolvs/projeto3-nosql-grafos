// CRUD equivalente (Neo4j). Usa a interseção 5000000 (nova) ligada à interseção 0 (existente).

// CREATE: nova interseção e estrada nos dois sentidos
MATCH (m:Intersecao {id: 0})
CREATE (n:Intersecao {id: 5000000})
CREATE (n)-[:LIGA_A]->(m), (m)-[:LIGA_A]->(n);

// READ: vizinhos diretos da interseção 0
MATCH (:Intersecao {id: 0})-[:LIGA_A]->(v) RETURN v.id AS destino ORDER BY destino;

// UPDATE: bloquear a estrada nova (propriedade criada na hora, sem ALTER de esquema)
MATCH (a:Intersecao {id: 0})-[r:LIGA_A]-(b:Intersecao {id: 5000000}) SET r.bloqueada = true;
MATCH (a:Intersecao)-[r:LIGA_A]->(b:Intersecao)
 WHERE a.id = 5000000 OR b.id = 5000000
RETURN a.id AS origem, b.id AS destino, r.bloqueada AS bloqueada;

// DELETE: DETACH remove a interseção e suas estradas em um comando
MATCH (n:Intersecao {id: 5000000}) DETACH DELETE n;
MATCH (n:Intersecao {id: 5000000}) RETURN count(n) AS restantes;
