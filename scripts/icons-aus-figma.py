#!/usr/bin/env python3
"""Wandelt die aus Figma exportierten SVGs in src/ui/icons/iconData.ts um.

Die Pfade bleiben unveraendert. Ersetzt werden nur die fest eingetragenen
Farben durch currentColor, damit ein Icon in allen Farbvarianten aus Figma
(weiss, dunkel auf blauem Chip, aktiv/inaktiv in der Tab-Leiste) dieselbe
Quelle nutzt. Die Varianten wurden vorher auf identische Form geprueft.

Aufruf: python3 -I scripts/icons-aus-figma.py <ordner-mit-svgs>
"""
import re
import sys
from pathlib import Path

ZUORDNUNG = {
    'einkauf': 'pot-einkauf.svg',
    'drogen': 'pot-drogen.svg',
    'lifestyle': 'pot-lifestyle.svg',
    'sonstiges': 'pot-sonstiges.svg',
    'wallet': 'wallet.svg',
    'repeat': 'repeat.svg',
    'plus': 'plus.svg',
    'close': 'close.svg',
    'delete': 'delete.svg',
    'wohnen': 'kat-wohnen.svg',
    'versicherungen': 'kat-versicherungen.svg',
    'abos': 'kat-abos.svg',
    'mobilitaet': 'kat-mobilitaet.svg',
    'neueKategorie': 'neue-kategorie.svg',
    'chevronDown': 'chevron-down.svg',
}

FARBEN = re.compile(r'(stroke|fill)="(white|#[0-9A-Fa-f]{3,6})"')


def umwandeln(svg: str) -> tuple[str, int, int, str]:
    view = re.search(r'viewBox="([^"]+)"', svg).group(1)
    breite = int(float(re.search(r'\swidth="([\d.]+)"', svg).group(1)))
    hoehe = int(float(re.search(r'\sheight="([\d.]+)"', svg).group(1)))
    inhalt = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    inhalt = FARBEN.sub(r'\1="currentColor"', inhalt)
    inhalt = re.sub(r'\s(id|style)="[^"]*"', '', inhalt)
    inhalt = re.sub(r'\s+', ' ', inhalt).strip()
    inhalt = inhalt.replace('> <', '><')
    return view, breite, hoehe, inhalt


def main() -> None:
    quelle = Path(sys.argv[1])
    zeilen = [
        '// Automatisch erzeugt aus den Figma-Exporten (scripts/icons-aus-figma.py).',
        '// Pfade unveraendert, nur feste Farben durch currentColor ersetzt.',
        '',
        'export interface IconDaten {',
        '  viewBox: string;',
        '  breite: number;',
        '  hoehe: number;',
        '  inhalt: string;',
        '}',
        '',
        'export const ICONS = {',
    ]
    for name, datei in ZUORDNUNG.items():
        view, b, h, inhalt = umwandeln((quelle / datei).read_text(encoding='utf-8'))
        inhalt_js = inhalt.replace('\\', '\\\\').replace("'", "\\'")
        zeilen.append(f"  {name}: {{ viewBox: '{view}', breite: {b}, hoehe: {h}, inhalt: '{inhalt_js}' }},")
    zeilen += ['} satisfies Record<string, IconDaten>;', '', 'export type IconName = keyof typeof ICONS;', '']
    ziel = Path('src/ui/icons/iconData.ts')
    ziel.write_text('\n'.join(zeilen), encoding='utf-8')
    print(f'{len(ZUORDNUNG)} Icons nach {ziel} geschrieben')


if __name__ == '__main__':
    main()
