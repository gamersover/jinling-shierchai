# SPDX-License-Identifier: GPL-2.0-or-later
"""Jinling Yan Light: I.Ngaan 1.004 with modestly reduced stroke weight for this book.

Run: python rebuild-yan.py from any directory (fonttools[woff] and FreeType required).
Requires fonttools[woff] and FreeType (macOS default path below, or FREETYPE_LIB).
The derived web font retains the original advance widths. Negative strength is
applied to 26.6 fixed-point outline coordinates, then compensated by -s/2 in
both axes to retain the design origin. Glyph hints are removed because the
outline has changed. Originals, GPL notices and this script are corresponding
source materials when distributing derived fonts.
"""
from pathlib import Path
from array import array
import ctypes as C
import hashlib
import json
import os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'I.Ngaan.ttf'
CHARS = HERE / 'characters.txt'

class Vector(C.Structure):
    _fields_ = [('x', C.c_long), ('y', C.c_long)]

class Outline(C.Structure):
    _fields_ = [('n_contours', C.c_short), ('n_points', C.c_short),
                ('points', C.POINTER(Vector)), ('tags', C.POINTER(C.c_ubyte)),
                ('contours', C.POINTER(C.c_short)), ('flags', C.c_int)]

ft = C.CDLL(os.environ.get('FREETYPE_LIB', '/opt/homebrew/lib/libfreetype.6.dylib'))
ft.FT_Outline_EmboldenXY.argtypes = [C.POINTER(Outline), C.c_long, C.c_long]
ft.FT_Outline_EmboldenXY.restype = C.c_int
ft.FT_Outline_Check.argtypes = [C.POINTER(Outline)]
ft.FT_Outline_Check.restype = C.c_int

def make_outline(glyph, scale=64):
    points = (Vector * len(glyph.coordinates))(*[Vector(round(x*scale), round(y*scale)) for x,y in glyph.coordinates])
    tags = (C.c_ubyte * len(glyph.flags))(*[flag & 1 for flag in glyph.flags])
    contours = (C.c_short * len(glyph.endPtsOfContours))(*glyph.endPtsOfContours)
    outline = Outline(len(contours), len(points), points, tags, contours, 0)
    return outline, (points, tags, contours)

def ink_area(font, name):
    gs = font.getGlyphSet(); pen = AreaPen(gs); gs[name].draw(pen)
    return abs(pen.value)

def bounds(font, name):
    gs = font.getGlyphSet(); pen = BoundsPen(gs); gs[name].draw(pen)
    return pen.bounds

def contour_areas(glyph):
    # Polygon signed area is only a degeneration diagnostic, not exact Bezier ink.
    values=[]; start=0
    for end in glyph.endPtsOfContours:
        p=list(glyph.coordinates[start:end+1]); start=end+1
        values.append(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1]))/2)
    return values

def build(strength):
    font=TTFont(SOURCE); text=CHARS.read_text()
    opts=subset.Options(); opts.layout_features=['*']; opts.name_IDs=['*']
    opts.name_legacy=True; opts.name_languages=['*']; opts.hinting=False
    sub=subset.Subsetter(options=opts); sub.populate(text=text); sub.subset(font)
    cmap=font.getBestCmap(); rows=[]
    for char in sorted(set(text)):
        if char.isspace(): continue
        name=cmap[ord(char)]; glyph=font['glyf'][name]
        assert not glyph.isComposite(), name
        original_bounds=bounds(font,name); original_area=ink_area(font,name)
        original_contours=contour_areas(glyph)
        old_advance,old_lsb=font['hmtx'][name]; old_xmin=glyph.xMin
        outline, owners=make_outline(glyph)
        assert ft.FT_Outline_Check(C.byref(outline))==0, char
        err=ft.FT_Outline_EmboldenXY(C.byref(outline), strength*64, strength*64)
        assert err==0,(char,err)
        assert ft.FT_Outline_Check(C.byref(outline))==0,char
        shift=-strength/2
        glyph.coordinates=GlyphCoordinates([(round(p.x/64+shift),round(p.y/64+shift)) for p in owners[0]])
        glyph.recalcBounds(font['glyf'])
        font['hmtx'][name]=(old_advance,old_lsb+glyph.xMin-old_xmin)
        new_bounds=bounds(font,name); new_area=ink_area(font,name)
        after_contours=contour_areas(glyph)
        flips=[i for i,(a,b) in enumerate(zip(original_contours,after_contours)) if a*b<0]
        zero=[i for i,a in enumerate(after_contours) if abs(a)<0.5]
        assert new_bounds is not None and new_area>0,char
        assert new_bounds[0]<new_bounds[2] and new_bounds[1]<new_bounds[3],char
        assert all(-32768<=v<=32767 for p in glyph.coordinates for v in p),char
        rows.append({'character':char,'glyph':name,'beforeBounds':original_bounds,'afterBounds':new_bounds,
                     'beforeInkArea':original_area,'afterInkArea':new_area,'inkReductionPct':round((1-new_area/original_area)*100,3),
                     'advanceWidthUnchanged':font['hmtx'][name][0]==old_advance,
                     'contourCount':glyph.numberOfContours,'pointCount':len(glyph.coordinates),
                     'flippedContourIndices':flips,'zeroAreaContourIndices':zero})
    family='Jinling Yan Light'
    names={1:family,2:'Regular',3:family.replace(' ','')+'-Book-3.0',4:family+' Regular',6:family.replace(' ','')+'-Regular',16:family,17:'Regular',21:family,22:'Regular'}
    font['name'].names=[n for n in font['name'].names if n.nameID not in names]
    for i,v in names.items(): font['name'].setName(v,i,3,1,0x409)
    font['OS/2'].usWeightClass=400
    output=HERE.parent/'jinling-yan-light.woff2'
    font.flavor='woff2'; font.save(output)
    # Reopen compressed output and validate the 233 actually required characters.
    check=TTFont(output); checked=check.getBestCmap()
    empty=[]; missing=[]
    for char in sorted(set(text)):
        if char.isspace():continue
        if ord(char) not in checked:missing.append(char)
        elif bounds(check,checked[ord(char)]) is None:empty.append(char)
    summary={'strengthFontUnits':strength,'unitsPerEm':font['head'].unitsPerEm,
             'family':family,'charactersChecked':len(rows),'missing':missing,'empty':empty,
             'invalidBounds':[],'unchangedAdvanceWidths':all(r['advanceWidthUnchanged'] for r in rows),
             'meanInkReductionPct':round(sum(r['inkReductionPct'] for r in rows)/len(rows),3),
             'minimumInkReductionPct':min(r['inkReductionPct'] for r in rows),
             'maximumInkReductionPct':max(r['inkReductionPct'] for r in rows),
             'contourSignFlips':[r['character'] for r in rows if r['flippedContourIndices']],
             'zeroAreaContours':[r['character'] for r in rows if r['zeroAreaContourIndices']],
             'woff2Bytes':output.stat().st_size}
    (HERE/'glyph-check.json').write_text(json.dumps({'summary':summary,'glyphs':rows},ensure_ascii=False,indent=2))
    return summary

if __name__=='__main__':
    summaries=[build(-8)]
    report={'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'candidates':summaries,
            'limitations':'Outline validation and nonzero signed area do not prove absence of tiny self-intersections, lost hairlines or disconnected strokes. Visually inspect actual 17px, 30px and 36px rendering before use.'}
    (HERE/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
