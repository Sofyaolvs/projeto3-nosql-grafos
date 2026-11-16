-- Carga em massa. Os arquivos ficam em /var/lib/mysql-files (montado de ./dados).
SET foreign_key_checks = 0;
SET unique_checks = 0;

LOAD DATA INFILE '/var/lib/mysql-files/nos_mysql.csv'
INTO TABLE interseccao
FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n'
(id);

LOAD DATA INFILE '/var/lib/mysql-files/arestas_mysql.csv'
INTO TABLE estrada
FIELDS TERMINATED BY ',' LINES TERMINATED BY '\n'
(origem, destino);

SET unique_checks = 1;
SET foreign_key_checks = 1;
