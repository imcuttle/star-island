"""用 edge-tts 预生成语音包。用法: python3 tools/gen_voice.py /tmp/voice_all.json
列表元素形如 "zh|文本" 或 "en|text"；输出 assets/voice/*.mp3 和 js/voice-manifest.js
"""
import asyncio, hashlib, json, os, sys
import edge_tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'assets', 'voice')
# 晓伊（活泼女孩，略升调更像小女孩）+ Emma（开朗的美式英语女声）；换音色时改 VER，文件名随之变化
# 音量：晓伊原声偏小，+60% 后响度约 -17.7 LUFS，和 Emma（-17.4）一致，峰值不削波
VER = 'v3'
VOICES = {'zh': ('zh-CN-XiaoyiNeural', '-6%', '+15Hz', '+60%'), 'en': ('en-US-EmmaNeural', '-10%', '+0Hz', '+0%')}
os.makedirs(OUT, exist_ok=True)


def fid(key):
    return hashlib.md5((VER + '|' + key).encode('utf-8')).hexdigest()[:10]


async def one(key, sem, stats):
    lang, text = key.split('|', 1)
    if text.startswith('#'):  # 数字拼接片段
        text = text[1:]
    path = os.path.join(OUT, fid(key) + '.mp3')
    if os.path.exists(path) and os.path.getsize(path) > 500:
        stats['skip'] += 1
        return True
    voice, rate, pitch, volume = VOICES[lang]
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume).save(path)
                if os.path.getsize(path) > 500:
                    stats['ok'] += 1
                    if stats['ok'] % 200 == 0:
                        print('done', stats['ok'], flush=True)
                    return True
            except Exception as e:  # 网络抖动重试
                await asyncio.sleep(1.5 * (attempt + 1))
        stats['fail'] += 1
        if os.path.exists(path):
            os.remove(path)
        return False


async def main():
    keys = json.load(open(sys.argv[1], encoding='utf-8'))
    sem = asyncio.Semaphore(12)
    stats = {'ok': 0, 'skip': 0, 'fail': 0}
    await asyncio.gather(*[one(k, sem, stats) for k in keys])
    manifest = {k: fid(k) for k in keys if os.path.exists(os.path.join(OUT, fid(k) + '.mp3'))}
    with open(os.path.join(ROOT, 'js', 'voice-manifest.js'), 'w', encoding='utf-8') as f:
        f.write('window.VOICE=' + json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + ';')
    print(stats, 'manifest', len(manifest))

asyncio.run(main())
