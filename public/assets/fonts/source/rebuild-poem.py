"""Build a fixed-text WOFF2 from the unchanged, unmodified TW-Kai Regular (全字庫正楷體).

Requires: fonttools[woff]. The source TTF can be supplied as the first argument;
otherwise this script downloads the documented mirror of the source version beside itself.
No outline thinning, scaling, or synthetic weight is applied.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
import hashlib
import json
import sys
import urllib.request

here = Path(__file__).resolve().parent
source_url = 'https://raw.githubusercontent.com/XiaoPanPanKevinPan/fontCollection/main/TW-Kai-98_1.ttf'
official_url = 'https://www.cns11643.gov.tw/'
source = Path(sys.argv[1]) if len(sys.argv) > 1 else here / 'TW-Kai-98_1.ttf'
if not source.exists():
    urllib.request.urlretrieve(source_url, source)
expected_sha256 = 'e11dbe9fbb1e84e9ba2c941a5c605fd1fd7660e18c3fcf51c28be79087ab27c9'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected_sha256, 'Source font version mismatch'
original = TTFont(source)
font = TTFont(source)
text = (here / 'characters-poem.txt').read_text()
required = sorted({ord(c) for c in text if not c.isspace()} | {32, 0x3000})
missing = sorted(set(required) - original.getBestCmap().keys())
assert not missing, ''.join(chr(c) for c in missing)
options = subset.Options()
options.layout_features = ['*']
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=required)
subsetter.subset(font)
family = 'Jinling Poem Kai'
names = {1:family, 2:'Regular', 3:'JinlingPoemKai-BookSubset-TWKai-11109.01',
         4:family + ' Regular', 6:'JinlingPoemKai-Regular',
         16:family, 17:'Regular', 21:family, 22:'Regular'}
font['name'].names = [n for n in font['name'].names if n.nameID not in names]
for name_id, value in names.items():
    font['name'].setName(value, name_id, 3, 1, 0x409)
font.flavor = 'woff2'
output = here.parent / 'jinling-poem-kai.woff2'
font.save(output)
check = TTFont(output)
cmap = check.getBestCmap()
glyphs = check.getGlyphSet()
original_glyphs = original.getGlyphSet()
original_cmap = original.getBestCmap()
cjk = [cp for cp in required if 0x3400 <= cp <= 0x9fff]
for cp in cjk:
    assert cp in cmap, chr(cp)
    bounds = BoundsPen(glyphs)
    glyphs[cmap[cp]].draw(bounds)
    assert bounds.bounds is not None, chr(cp)
    expected = DecomposingRecordingPen(original_glyphs)
    actual = DecomposingRecordingPen(glyphs)
    original_glyphs[original_cmap[cp]].draw(expected)
    glyphs[cmap[cp]].draw(actual)
    assert expected.value == actual.value, 'Changed outline: ' + chr(cp)
report = {
    'font': output.name, 'family':family, 'upstreamFamily': original['name'].getDebugName(1),
    'upstreamVersion':original['name'].getDebugName(5), 'weight':check['OS/2'].usWeightClass,
    'coveredCJK':len(cjk), 'missingOrBlankCJK':[], 'allRequiredOutlinesMatchOriginal':True,
    'bytes':output.stat().st_size, 'originalSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'sourceURL':source_url, 'officialProjectURL':official_url, 'licenseURL':'https://www.cns11643.gov.tw/pageView.jsp?ID=59', 'modifications':['fixed-character subset','WOFF2 conversion','family-name change']
}
(here / 'poem-font-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
