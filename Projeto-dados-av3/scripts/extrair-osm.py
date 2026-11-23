# Baixa a malha viária (OpenStreetMap, via OSMnx) das 27 capitais brasileiras e gera os CSVs
# usados na carga dos dois bancos: dados/intersecoes.csv e dados/estradas.csv.
# Uso: python scripts/extrair-osm.py            (o carregar.ps1 cria o ambiente e chama este script)
# Cada capital fica salva em dados/partes/, então dá para interromper e continuar depois.
# Com --parcial, só junta nos CSVs as capitais que já foram baixadas.
import csv
import json
import re
import sys
import time
from datetime import date
from pathlib import Path

import osmnx as ox

DADOS = Path(__file__).resolve().parent.parent / "dados"
PARTES = DADOS / "partes"
PARTES.mkdir(parents=True, exist_ok=True)

ox.settings.use_cache = True
ox.settings.cache_folder = str(DADOS / "cache-osm")
ox.settings.log_console = False
# Capitais da Amazônia têm município enorme e quase vazio; pedaços maiores = menos idas ao servidor
ox.settings.max_query_area_size = 20_000 * 1_000_000  # 20 mil km² por consulta (padrão: 2,5 mil)

# Servidores públicos do Overpass (mesmos dados do OSM), usados em rodízio quando um falha
SERVIDORES = [
    "https://maps.mail.ru/osm/tools/overpass/api",
    "https://overpass-api.de/api",
    "https://overpass.private.coffee/api",
]

# (cidade, UF, consulta de geocodificação no Nominatim)
CAPITAIS = [
    ("São Paulo", "SP", "São Paulo, São Paulo, Brazil"),
    ("Rio de Janeiro", "RJ", "Rio de Janeiro, Rio de Janeiro, Brazil"),
    ("Brasília", "DF", "Distrito Federal, Brazil"),
    ("Salvador", "BA", "Salvador, Bahia, Brazil"),
    ("Fortaleza", "CE", "Fortaleza, Ceará, Brazil"),
    ("Belo Horizonte", "MG", "Belo Horizonte, Minas Gerais, Brazil"),
    ("Manaus", "AM", "Manaus, Amazonas, Brazil"),
    ("Curitiba", "PR", "Curitiba, Paraná, Brazil"),
    ("Recife", "PE", "Recife, Pernambuco, Brazil"),
    ("Goiânia", "GO", "Goiânia, Goiás, Brazil"),
    ("Belém", "PA", "Belém, Pará, Brazil"),
    ("Porto Alegre", "RS", "Porto Alegre, Rio Grande do Sul, Brazil"),
    ("São Luís", "MA", "São Luís, Maranhão, Brazil"),
    ("Maceió", "AL", "Maceió, Alagoas, Brazil"),
    ("Campo Grande", "MS", "Campo Grande, Mato Grosso do Sul, Brazil"),
    ("Natal", "RN", "Natal, Rio Grande do Norte, Brazil"),
    ("Teresina", "PI", "Teresina, Piauí, Brazil"),
    ("João Pessoa", "PB", "João Pessoa, Paraíba, Brazil"),
    ("Aracaju", "SE", "Aracaju, Sergipe, Brazil"),
    ("Cuiabá", "MT", "Cuiabá, Mato Grosso, Brazil"),
    ("Porto Velho", "RO", "Porto Velho, Rondônia, Brazil"),
    ("Florianópolis", "SC", "Florianópolis, Santa Catarina, Brazil"),
    ("Macapá", "AP", "Macapá, Amapá, Brazil"),
    ("Rio Branco", "AC", "Rio Branco, Acre, Brazil"),
    ("Vitória", "ES", "Vitória, Espírito Santo, Brazil"),
    ("Boa Vista", "RR", "Boa Vista, Roraima, Brazil"),
    ("Palmas", "TO", "Palmas, Tocantins, Brazil"),
]


def primeiro(v):
    """Depois da simplificação do OSMnx um atributo pode virar lista; fica o primeiro valor."""
    if isinstance(v, list):
        v = v[0] if v else None
    return v


def inteiro(v, minimo=False):
    """Extrai o número de '60', '40 mph', ['2', '3']...; vazio se não houver número."""
    valores = v if isinstance(v, list) else [v]
    nums = [int(m.group()) for x in valores if x is not None and (m := re.match(r"\d+", str(x)))]
    if not nums:
        return ""
    return min(nums) if minimo else nums[0]


def baixar(indice, cidade, uf, consulta):
    arq_nos = PARTES / f"{indice:02d}-{uf}-nos.csv"
    arq_est = PARTES / f"{indice:02d}-{uf}-estradas.csv"
    if arq_nos.exists() and arq_est.exists():
        print(f"[{indice + 1}/{len(CAPITAIS)}] {cidade}: já baixada")
        return
    t0 = time.time()
    G = ox.graph_from_place(consulta, network_type="drive")
    tmp_nos, tmp_est = arq_nos.with_suffix(".tmp"), arq_est.with_suffix(".tmp")
    with open(tmp_nos, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for osm_id, d in G.nodes(data=True):
            w.writerow([osm_id, f"{d['y']:.7f}", f"{d['x']:.7f}", d.get("street_count", "")])
    with open(tmp_est, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for u, v, k, d in G.edges(keys=True, data=True):
            nome = primeiro(d.get("name")) or ""
            w.writerow([
                u, v, k,
                " ".join(str(nome).split())[:200],
                primeiro(d.get("highway")) or "",
                f"{float(d['length']):.1f}",
                "true" if d.get("oneway") else "false",
                inteiro(d.get("maxspeed")),
                inteiro(d.get("lanes"), minimo=True),
            ])
    tmp_nos.replace(arq_nos)
    tmp_est.replace(arq_est)
    print(f"[{indice + 1}/{len(CAPITAIS)}] {cidade}: {G.number_of_nodes()} interseções, "
          f"{G.number_of_edges()} estradas, {time.time() - t0:.0f} s", flush=True)


def consolidar(capitais):
    """Junta as partes, troca o id do OSM por um id sequencial e grava os CSVs finais."""
    ids = {}  # osm_id -> id sequencial
    por_cidade = []
    with open(DADOS / "intersecoes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["id:ID", "osm_id:long", "lat:double", "lon:double", "cidade", "uf", "ruas:int"])
        for i, cidade, uf in capitais:
            antes = len(ids)
            with open(PARTES / f"{i:02d}-{uf}-nos.csv", newline="", encoding="utf-8") as p:
                for osm_id, lat, lon, ruas in sorted(csv.reader(p), key=lambda r: int(r[0])):
                    if osm_id in ids:
                        continue
                    ids[osm_id] = len(ids)
                    w.writerow([ids[osm_id], osm_id, lat, lon, cidade, uf, ruas])
            por_cidade.append({"cidade": cidade, "uf": uf, "intersecoes": len(ids) - antes, "estradas": 0})

    estradas, vistas = [], set()
    for n, (i, cidade, uf) in enumerate(capitais):
        with open(PARTES / f"{i:02d}-{uf}-estradas.csv", newline="", encoding="utf-8") as p:
            for u, v, k, *resto in csv.reader(p):
                chave = (ids[u], ids[v], int(k))
                if chave in vistas:
                    continue
                vistas.add(chave)
                estradas.append((*chave, *resto))
                por_cidade[n]["estradas"] += 1
    estradas.sort(key=lambda e: e[:3])  # ordem da chave primária: carga mais rápida no MySQL
    with open(DADOS / "estradas.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow([":START_ID", ":END_ID", "chave:int", "nome", "tipo", "comprimento_m:double",
                    "mao_unica:boolean", "velocidade_max:int", "faixas:int"])
        w.writerows(estradas)

    resumo = {
        "fonte": "OpenStreetMap via OSMnx " + ox.__version__ + " (network_type=drive), " + str(len(capitais)) + " capitais brasileiras",
        "licenca": "© colaboradores do OpenStreetMap, ODbL",
        "extraido_em": date.today().isoformat(),
        "capitais": len(capitais),
        "intersecoes": len(ids),
        "estradas": len(estradas),
        "registros": len(ids) + len(estradas),
        "mao_unica": sum(1 for e in estradas if e[6] == "true"),
        "com_nome": sum(1 for e in estradas if e[3]),
        "com_velocidade_max": sum(1 for e in estradas if e[7] != ""),
        "km_total": round(sum(float(e[5]) for e in estradas) / 1000),
        "por_cidade": por_cidade,
    }
    (DADOS / "resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2), encoding="utf-8")
    print({k: v for k, v in resumo.items() if k != "por_cidade"})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    todas = [(i, cidade, uf) for i, (cidade, uf, _) in enumerate(CAPITAIS)]
    if "--parcial" in sys.argv:  # só junta as capitais que já foram baixadas, sem baixar mais nada
        consolidar([c for c in todas if (PARTES / f"{c[0]:02d}-{c[2]}-estradas.csv").exists()])
        sys.exit()
    falhas = 0  # total de trocas de servidor até agora
    # --reverso: baixa do fim da lista para o começo e não consolida. Serve para rodar um segundo
    # processo em paralelo; cada um pula as capitais que o outro já gravou em dados/partes.
    reverso = "--reverso" in sys.argv
    ordem = list(enumerate(CAPITAIS))
    for i, (cidade, uf, consulta) in (reversed(ordem) if reverso else ordem):
        for tentativa in range(1, 9):
            # o servidor público principal vive lotado: a cada falha troca para o próximo espelho
            # (e continua no que funcionou para as próximas capitais)
            ox.settings.overpass_url = SERVIDORES[(falhas + tentativa - 1) % len(SERVIDORES)]
            ox.settings.overpass_rate_limit = ox.settings.overpass_url.startswith("https://overpass-api.de")
            try:
                baixar(i, cidade, uf, consulta)
                falhas += tentativa - 1
                break
            except Exception as e:  # Overpass ocupado, queda de rede etc.
                print(f"{cidade}: tentativa {tentativa} falhou ({str(e).splitlines()[0]})", flush=True)
                if tentativa == 8:
                    raise
                time.sleep(min(20 * 2 ** (tentativa - 1), 600))  # espera 20 s, 40 s, 80 s... até 10 min
    if not reverso:
        consolidar(todas)
