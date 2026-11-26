# Logos

`hkmfinanz/` kommt unverändert aus dem Generator in `hkm-logos`, ohne `favicon.ico` (die App nutzt `favicon.svg`):

```bash
python3 tools/hkm_logo.py finanz --kuerzel F
```

Die Navigation und die Anmeldeseiten zeichnen das Logo aus denselben Pfaden (`apps/web/src/components/HkmLogo.tsx`), die App-Icons in `apps/web/public/` sind Kopien aus `hkmfinanz/app-icon/`. Ändert sich das Logo, beides neu aus dem Generator übernehmen, nichts von Hand nachzeichnen.
