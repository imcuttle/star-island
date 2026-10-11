"""按代码里用到的字符子集化字体 → assets/font/*.woff
字体源缓存在 ~/.cache/star-island-fonts（缺失时自动下载，均为 SIL OFL 授权）"""
import os, re, glob, subprocess, urllib.request, zipfile, io
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.expanduser('~/.cache/star-island-fonts'); os.makedirs(CACHE, exist_ok=True)
SRC = {
  'zcool': ('ZCOOLKuaiLe-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'),
  'ink': ('MaShanZheng-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/mashanzheng/MaShanZheng-Regular.ttf'),
  'hand': ('LongCang-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/longcang/LongCang-Regular.ttf'),
  'handlatin': ('Gaegu-Bold.ttf', 'https://github.com/google/fonts/raw/main/ofl/gaegu/Gaegu-Bold.ttf'),
  'pixel': ('fusion-pixel-12px-proportional-zh_hans.ttf', 'https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.09.25/fusion-pixel-font-12px-proportional-ttf-v2026.09.25.zip'),
}
for f in ['/tmp/zk.ttf:ZCOOLKuaiLe-Regular.ttf', '/tmp/msz.ttf:MaShanZheng-Regular.ttf', '/tmp/fpx/fusion-pixel-12px-proportional-zh_hans.ttf:fusion-pixel-12px-proportional-zh_hans.ttf']:
    a, b = f.split(':')
    if os.path.exists(a) and not os.path.exists(os.path.join(CACHE, b)): open(os.path.join(CACHE, b), 'wb').write(open(a, 'rb').read())
for name, (fn, url) in SRC.items():
    p = os.path.join(CACHE, fn)
    if os.path.exists(p): continue
    data = urllib.request.urlopen(url, timeout=300).read()
    if url.endswith('.zip'): data = zipfile.ZipFile(io.BytesIO(data)).read(fn)
    open(p, 'wb').write(data)
text = ''.join(open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(ROOT, 'js', '*.js')) if 'vendor' not in f and 'manifest' not in f)
chars = set(c for c in text if ord(c) > 0x2e80) | set('，。！？：；“”（）《》、…—·0123456789')
ascii_ = ''.join(chr(i) for i in range(32, 127))
open('/tmp/si_chars.txt', 'w', encoding='utf-8').write(''.join(sorted(chars)) + ascii_)
for name, (fn, _) in SRC.items():
    out = os.path.join(ROOT, 'assets', 'font', name + '.woff')
    subprocess.run(['python3', '-m', 'fontTools.subset', os.path.join(CACHE, fn), '--text-file=/tmp/si_chars.txt', '--flavor=woff', '--output-file=' + out, '--layout-features=*'], check=True)
    print(name, os.path.getsize(out) // 1024, 'KB')
