# BibTeX Journal Abbreviator

A lightweight, fast, and privacy-preserving client-side web application that automatically replaces full journal names in `.bib` files with their official abbreviations.

## Features
* **Two Extensive Databases**: Choose between Web of Science (Clarivate) and ISO 4 (JabRef/LTWA) abbreviations, or run with a combined ISO-4 database and WoS fallback.
* **Capitalization Preservation**: Retains camel-case capitalization (like `CrystEngComm` or `ChemPhysChem`) for databases that store cased abbreviations.
* **Flexible Styles**: Formats abbreviations to standard ISO (Title Case, dots), WoS (ALL CAPS, dotless), or simple Title Case.
* **Interactive Diffs**: Select alternative match candidates dynamically in the case of multiple fuzzy-matching candidates.
* **100% Client-Side**: No data leaves your machine; your `.bib` files are parsed locally in the browser.

## Running Locally
To run the development server:
```bash
npm install
npm run dev
```

To build for production deployment:
```bash
npm run build
```

## Licenses

### Code License
The source code of this application is licensed under the [MIT License](LICENSE).

### Data Licenses
* **ISO 4 (JabRef/LTWA)** database: Sourced from the [JabRef journal abbreviations repository](https://abbrv.jabref.org/), licensed under the [Creative Commons CC0-1.0 Universal Public Domain Dedication](https://github.com/JabRef/abbrv.jabref.org/blob/main/LICENSE.md).
* **Web of Science (Clarivate)** database: Extracted from Web of Science help pages for academic/non-commercial reference purposes.
