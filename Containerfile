# Haben – App-Container. ERiC wird nicht mitgeliefert (Lizenz); Haben lädt es auf Wunsch nach /var/lib/haben/eric
# (Volume) oder es wird nach /opt/eric gemountet.
FROM docker.io/oven/bun:1.4.4-slim AS build
WORKDIR /app
COPY . .
# Installation, Bau und Bereinigung bleiben in einer Schicht: Der native Snapshotter des Lab-Builders kopiert
# sonst nach jedem Schritt auch den vollständigen Entwicklungsbaum. Quelländerungen installieren damit neu;
# ein frischer Build braucht dafür keine Zwischenkopie der Entwicklungsabhängigkeiten.
# Danach nur noch die Laufzeitabhängigkeiten; neu installieren statt entfernen, die Pakete liegen im Cache. Ohne
# Peer-Abhängigkeiten: Über sie kämen Build-Werkzeuge ins Image (vite, vitest, drizzle-kit, tsx, esbuild mit eigener
# Go-Laufzeit), die zur Laufzeit nicht laufen. Was die App als Peer braucht (react, zod, postgres …), steht in
# apps/web/package.json als direkte Abhängigkeit; der CI-Job container lädt die externen Module des Bundles.
# Der Befehl haben (Betriebsstatus) als eine Datei; Pakete aus node_modules bleiben außen vor und kommen zur Laufzeit
# aus apps/web/node_modules, so bleibt etwa die native Bibliothek von Typst nur einmal im Image
RUN bun install --frozen-lockfile \
 && bun run build \
 && bun build apps/web/src/server/modules/betrieb/cli.ts --target bun --packages external --outfile apps/web/.output/haben-cli.js \
 && rm -rf node_modules apps/web/node_modules packages/*/node_modules \
 && bun install --frozen-lockfile --production --omit=peer \
 && install -d -m 0755 /runtime /runtime/app /runtime/app/apps /runtime/app/apps/web \
      /runtime/usr /runtime/usr/local /runtime/usr/local/bin \
 && cp -a node_modules packages package.json /runtime/app/ \
 && cp -a apps/web/node_modules apps/web/.output apps/web/drizzle apps/web/src apps/web/package.json /runtime/app/apps/web/ \
 && cp -a /usr/local/bin/bun /runtime/usr/local/bin/bun \
 && cp -a deploy/entrypoint.sh /runtime/usr/local/bin/haben-entrypoint \
 && cp -a deploy/haben.sh /runtime/usr/local/bin/haben

# Laufzeit auf Wolfi statt Debian: glibc wie bisher (ERiC ist eine glibc-Bibliothek, Alpine mit musl ginge nicht),
# aber aktuelle Upstream-Versionen, vor allem von poppler, das jedes hochgeladene PDF liest. Wolfi ist rollend; der
# Digest hält den Build reproduzierbar, Renovate hebt ihn an.
FROM cgr.dev/chainguard/wolfi-base:latest@sha256:833c48f1faf32c90e6f9501a2410a9aa28ceb2c594102edd4470053c30efa089
# poppler-utils: pdftotext und pdftoppm für hochgeladene PDFs (Textebene, Seitenbilder für einen eigenen KI-Dienst),
# als eigener Prozess. font-liberation: ohne Schriften rendert pdftoppm nicht eingebettete Standardschriften wie
# Helvetica gar nicht. libgcc: libgcc_s braucht ERiC neben glibc (steckt schon in wolfi-base, hier ausdrücklich).
# Benutzer bun mit UID 1000 wie im Image von oven/bun, damit bestehende Volumes lesbar bleiben. Die Pakete kommen aus
# dem freien Wolfi-Repository; wolfi-base nennt in /etc/apk/repositories das von Chainguard, das eine Anmeldung verlangt.
RUN echo https://packages.wolfi.dev/os > /etc/apk/repositories \
 && apk add --no-cache poppler-utils font-liberation tzdata libgcc \
 && addgroup -g 1000 bun \
 && adduser -D -u 1000 -G bun -h /home/bun -s /bin/sh bun \
 && mkdir -p /var/lib/haben/eric-log /var/lib/haben/eric /var/lib/haben/belege \
 && chown -R bun:bun /var/lib/haben
ENV NODE_ENV=production \
    PORT=3000 \
    ERIC_WORKER_PATH=/app/packages/elster/src/worker.ts \
    HABEN_EINVOICE_DIR=/app/packages/einvoice \
    DOCUMENTS_DIR=/var/lib/haben/belege \
    ERIC_LOG_DIR=/var/lib/haben/eric-log \
    ERIC_DIR=/var/lib/haben/eric \
    XDG_CACHE_HOME=/tmp/.cache
# XDG_CACHE_HOME: Fontconfig (pdftoppm) braucht einen beschreibbaren Cache, auch bei schreibgeschütztem Dateisystem
WORKDIR /app
# Ein gemeinsamer Laufzeitbaum mit denselben Paketen, Quellen, Betreiberbefehlen und derselben Bun-Binärdatei
# wie in der Build-Stufe. Die Verzeichnisse darüber sind ausdrücklich 0755, damit USER bun sie lesen kann.
COPY --from=build /runtime/ /
# Commit des Builds (#887) für haben status und als OCI-Label, etwa --build-arg HABEN_COMMIT="$(git rev-parse HEAD)".
# Ohne Angabe leer. Erst hier, damit ein anderer Commit nur diese Schichten neu baut
ARG HABEN_COMMIT=""
LABEL org.opencontainers.image.revision="$HABEN_COMMIT"
ENV HABEN_COMMIT="$HABEN_COMMIT"
USER bun
EXPOSE 3000
# Ohne curl im Image: Bun hat fetch eingebaut. Die Startphase deckt die Migrationen ab.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["haben-entrypoint"]
