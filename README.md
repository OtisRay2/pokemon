# Pokémon app met Solid Linked Data

Een simpele statische Pokédex die draait op GitHub Pages.

## Features

- Pokémon zoeken via [PokéAPI](https://pokeapi.co)
- Inloggen met een Solid OIDC provider
- Favorieten als linked data opslaan in je eigen POD (`public/pokemon/favorites.ttl`)
- Deploy via GitHub Actions naar GitHub Pages

## Lokaal starten

```bash
python3 -m http.server 8080
```

Open daarna `http://localhost:8080`.

## GitHub Pages activeren

1. Push naar branch `main`.
2. Zorg dat in repo settings onder **Pages** de source op **GitHub Actions** staat.
3. De workflow `.github/workflows/deploy-pages.yml` publiceert de site automatisch.

## Solid tips

- Gebruik `https://solidcommunity.net` als issuer (Solid Community Server).
- Controleer dat je POD een `public/` container heeft en schrijfbaar is.
