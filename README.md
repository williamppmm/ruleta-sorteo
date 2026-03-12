# Ruleta Sorteo

Aplicacion de sorteo construida con React + Vite.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

El proyecto queda preparado para desplegarse en GitHub Pages desde el repositorio `williamppmm/ruleta-sorteo`.

Pasos en GitHub:

1. Ve a `Settings > Pages`.
2. En `Source`, selecciona `GitHub Actions`.
3. Haz push a `main`.
4. El workflow `.github/workflows/deploy-pages.yml` construira y publicara `dist/` automaticamente.

URL esperada:

`https://williamppmm.github.io/ruleta-sorteo/`

## Persistencia de datos

La app guarda los datos en `IndexedDB` del navegador del equipo que la usa.

Eso significa:

- cada equipo tiene sus propios datos locales;
- GitHub Pages solo publica la app;
- los datos no se comparten entre dispositivos.
