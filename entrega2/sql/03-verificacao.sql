-- Evidência do volume e da integridade (MySQL)
SELECT COUNT(*) AS intersecoes FROM interseccao;
SELECT COUNT(*) AS estradas_dirigidas FROM estrada;
-- estradas únicas (par não ordenado): deve ser a metade das dirigidas
SELECT COUNT(*) AS estradas_unicas FROM estrada WHERE origem < destino;
-- integridade: estradas apontando para interseção inexistente (esperado 0)
SELECT COUNT(*) AS orfas FROM estrada e
  LEFT JOIN interseccao o ON o.id = e.origem
  LEFT JOIN interseccao d ON d.id = e.destino
 WHERE o.id IS NULL OR d.id IS NULL;
-- simetria: toda estrada tem a sua volta (esperado 0 sem volta)
SELECT COUNT(*) AS sem_volta FROM estrada a
  LEFT JOIN estrada b ON b.origem = a.destino AND b.destino = a.origem
 WHERE b.origem IS NULL;
-- tamanho ocupado
SELECT table_name AS tabela,
       ROUND(data_length/1024/1024, 1)  AS dados_mb,
       ROUND(index_length/1024/1024, 1) AS indices_mb,
       table_rows AS linhas_estimadas
  FROM information_schema.tables
 WHERE table_schema = 'rotas';
