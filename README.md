# Mužíčci

Puzzle inspirované Lemmings pro [games.davidpolesny.cz](https://games.davidpolesny.cz).

## Lokálně

Statický web — stačí servírovat root této složky:

```bash
npx --yes serve -p 4173
```

Pak otevři `http://localhost:4173/hry/muzici/`.

## Deploy

```bash
ssh aitrader@91.98.146.101 "mkdir -p /tmp/muzici-game /tmp/muzici-meta"
scp -r ./hry/muzici/* aitrader@91.98.146.101:/tmp/muzici-game/
scp ./index.html ./sitemap.xml aitrader@91.98.146.101:/tmp/muzici-meta/
scp ./hry/had/index.html aitrader@91.98.146.101:/tmp/muzici-meta/had.html
scp ./hry/arkanoid/index.html aitrader@91.98.146.101:/tmp/muzici-meta/arkanoid.html
ssh aitrader@91.98.146.101 'sudo mkdir -p /var/www/games.davidpolesny.cz/hry/muzici && sudo cp -a /tmp/muzici-game/. /var/www/games.davidpolesny.cz/hry/muzici/ && sudo cp /tmp/muzici-meta/index.html /tmp/muzici-meta/sitemap.xml /var/www/games.davidpolesny.cz/ && sudo cp /tmp/muzici-meta/had.html /var/www/games.davidpolesny.cz/hry/had/index.html && sudo cp /tmp/muzici-meta/arkanoid.html /var/www/games.davidpolesny.cz/hry/arkanoid/index.html'
```

## Ovládání

- **1–4** / klik na skill — Blokér, Stavař, Kopač, Razíc
- **Klik na mužíčka** — přiřadit vybranou schopnost
- **F** — rychlost 1× / 2× / 3×
- **Mezerník** — start / pauza / další úroveň
- **R** — restart úrovně
