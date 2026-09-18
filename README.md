# CS2 Stratbook Desktop

Native Desktop-Hülle auf Electron-Basis für das persönliche CS2-Stratbook.

## Enthalten

- 7 Maps
- 196 Taktiken
- T / CT / Favoriten
- Map-, Bereichs- und Rundentyp-Filter
- Suche
- Detailansicht und Quick Call
- Import derselben JSON-StratPacks wie in der Android-App
- Offline-Nutzung

## Windows-Build

GitHub Actions baut nach jedem Push auf `main` automatisch:

- `CS2-Stratbook-Setup-1.0.0-x64.exe` – normaler Installer
- `CS2-Stratbook-1.0.0-x64.exe` – portable Version

Die Dateien stehen beim erfolgreichen Workflow unter **Actions → Build Windows App → Artifacts → CS2-Stratbook-Windows** bereit.

## Hinweis zur Windows-Warnung

Die App ist privat und nicht mit einem kostenpflichtigen Code-Signing-Zertifikat signiert. Windows SmartScreen kann deshalb beim ersten Start „Unbekannter Herausgeber“ anzeigen. Das ist unabhängig vom Inhalt der App.
