Font rebuilding materials

Jinling Yan Light derives from I.Ngaan 1.004.
Copyright: Dr. Hann-Tzong Wang, 1999–2004; Ichiten Fonts Project, 2013–14.
GNU GPL 2.0 or later; see ../YAN-LICENSE.txt, ../GPL-2.0.txt and ../GPL-3.0.txt.
I.Ngaan.ttf is the unmodified original source font. characters.txt and rebuild-yan.py reproduce the web subset with -8 font-unit outline thinning and unchanged advance widths.
Install fonttools[woff] and FreeType; run python3 rebuild-yan.py.
Set FREETYPE_LIB if the FreeType library is not at /opt/homebrew/lib/libfreetype.6.dylib.

Jinling Poem Kai uses unmodified TW-Kai Regular Version 11109.01 outlines.
Copyright (c) 2022 Ministry of Digital Affairs.
SIL Open Font License 1.1; see ../TW-Kai-OFL.txt.
Install fonttools[woff]; run python3 rebuild-poem.py [path/to/TW-Kai-98_1.ttf].
Without the source TTF argument, the recipe downloads the mirror and verifies its exact SHA256.
characters-poem.txt contains the fixed characters required by this book.

The website does not execute these scripts; it serves the already built WOFF2 fonts.
