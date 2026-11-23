-- Executar UMA vez, antes do CRUD: evolução de esquema usada no Update (interdição de via).
-- No MySQL isso é um ALTER TABLE (ADD COLUMN INSTANT no 8.0); no Neo4j basta gravar a propriedade.
ALTER TABLE estrada ADD COLUMN bloqueada TINYINT(1) NOT NULL DEFAULT 0, ALGORITHM=INSTANT;
