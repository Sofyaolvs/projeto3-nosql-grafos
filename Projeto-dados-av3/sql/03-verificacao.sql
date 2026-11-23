-- Evidência do volume e da integridade (MySQL)
SELECT COUNT(*) AS intersecoes FROM interseccao;
SELECT COUNT(*) AS estradas FROM estrada;
SELECT COUNT(*) AS mao_unica FROM estrada WHERE mao_unica = 1;
SELECT COUNT(*) AS com_nome FROM estrada WHERE nome IS NOT NULL;
SELECT ROUND(SUM(comprimento_m) / 1000) AS km_total FROM estrada;
-- integridade: estradas apontando para interseção inexistente (esperado 0)
SELECT COUNT(*) AS orfas FROM estrada e
  LEFT JOIN interseccao o ON o.id = e.origem
  LEFT JOIN interseccao d ON d.id = e.destino
 WHERE o.id IS NULL OR d.id IS NULL;
-- via de mão dupla tem o trecho de volta (esperado 0 sem volta)
SELECT COUNT(*) AS mao_dupla_sem_volta FROM estrada a
 WHERE a.mao_unica = 0
   AND NOT EXISTS (SELECT 1 FROM estrada b WHERE b.origem = a.destino AND b.destino = a.origem);
-- as 5 maiores cidades em número de interseções
SELECT cidade, COUNT(*) AS intersecoes FROM interseccao GROUP BY cidade ORDER BY intersecoes DESC, cidade LIMIT 5;
-- os 5 tipos de via mais comuns
SELECT tipo, COUNT(*) AS estradas FROM estrada GROUP BY tipo ORDER BY estradas DESC, tipo LIMIT 5;
-- tamanho ocupado
SELECT table_name AS tabela,
       ROUND(data_length/1024/1024, 1)  AS dados_mb,
       ROUND(index_length/1024/1024, 1) AS indices_mb,
       table_rows AS linhas_estimadas
  FROM information_schema.tables
 WHERE table_schema = 'rotas';
