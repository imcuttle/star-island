#!/bin/sh
# 扫描代码中用到的 emoji，补齐 Twemoji SVG 与 Fluent 3D（webp），并重写 js/emoji-manifest.js
# 依赖: node, python3 + Pillow；Fluent 索引缓存在 /tmp/gh_tree.json 与 /tmp/fmeta（缺失时只补 Twemoji）
cd "$(dirname "$0")/.."
node -e "
const fs=require('fs');const src=fs.readdirSync('js').filter(f=>f.endsWith('.js')&&!/manifest/.test(f)).map(f=>fs.readFileSync('js/'+f,'utf8')).join('\n');
const seg=new Intl.Segmenter('en',{granularity:'grapheme'});const set=new Set();
for(const {segment:s} of seg.segment(src)){ if(/\p{Extended_Pictographic}|\u20e3/u.test(s)) set.add(s); }
fs.writeFileSync('/tmp/emojis.json',JSON.stringify([...set]));"
python3 - <<'P'
import json,os,urllib.parse,urllib.request,io
from PIL import Image
em=json.load(open('/tmp/emojis.json'))
def code(s):
    cps=[format(ord(c),'x') for c in s]
    return '-'.join(cps if '200d' in cps else [c for c in cps if c!='fe0f'])
glyph={}
try:
    t=json.load(open('/tmp/gh_tree.json'))['tree']
    ms=[x['path'] for x in t if x['path'].endswith('metadata.json') and x['path'].count('/')==2]
    paths=[x['path'] for x in t if '/3D/' in x['path'] and x['path'].endswith('.png')]
    byf={}
    for q in paths:
        f=q.split('/')[1]
        if '/Default/' in q or f not in byf: byf[f]=q
    for i,p in enumerate(ms):
        try: m=json.load(open('/tmp/fmeta/%d.json'%i))
        except: continue
        f=p.split('/')[1]
        if f in byf: glyph[m.get('glyph','').replace('\ufe0f','')]=byf[f]
except Exception as e: print('no fluent index', e)
for e in em:
    c=code(e)
    tw='assets/emoji/tw/%s.svg'%c
    if not os.path.exists(tw):
        try: open(tw,'wb').write(urllib.request.urlopen('https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/%s.svg'%c,timeout=30).read()); print('tw',e)
        except Exception as ex: print('tw miss',e,ex)
    d3='assets/emoji/3d/%s.webp'%c
    p=glyph.get(e.replace('\ufe0f',''))
    if not os.path.exists(d3) and p:
        try:
            data=urllib.request.urlopen('https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/'+urllib.parse.quote(p),timeout=60).read()
            im=Image.open(io.BytesIO(data)).convert('RGBA'); im.thumbnail((160,160),Image.LANCZOS); im.save(d3,'WEBP',quality=88,method=6); print('3d',e)
        except Exception as ex: print('3d miss',e,ex)
# 像素画风：3D 表情缩小到 22px 并减色
os.makedirs('assets/emoji/px', exist_ok=True)
for f in os.listdir('assets/emoji/3d'):
    out='assets/emoji/px/'+f[:-5]+'.png'
    if f.endswith('.webp') and not os.path.exists(out):
        im=Image.open('assets/emoji/3d/'+f).convert('RGBA'); im=im.resize((22,22),Image.BOX)
        a=im.split()[3].point(lambda v:255 if v>110 else 0)
        rgb=im.convert('RGB').quantize(colors=20,method=Image.MEDIANCUT).convert('RGB')
        rgb.putalpha(a); rgb.save(out,optimize=True)
tw={f[:-4]:1 for f in os.listdir('assets/emoji/tw') if f.endswith('.svg')}
px={f[:-4]:1 for f in os.listdir('assets/emoji/px') if f.endswith('.png')}
d3={f[:-5]:1 for f in os.listdir('assets/emoji/3d') if f.endswith('.webp')}
open('js/emoji-manifest.js','w').write('window.EMOJITW='+json.dumps(tw,separators=(',',':'))+';window.EMOJI3D='+json.dumps(d3,separators=(',',':'))+';window.EMOJIPX='+json.dumps(px,separators=(',',':'))+';')
print(len(tw),len(d3))
P
