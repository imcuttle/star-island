# 把 Ready Player Me 动作库（动捕，免费可用）的若干 GLB 动作合并成一个动作包 → assets/models/c/anim_f.js / anim_m.js
# 用法：python3 tools/pack_anims.py /tmp/rpm
#   目录结构：<dir>/feminine/*.glb、<dir>/masculine/*.glb（来自 github.com/readyplayerme/animation-library 的 glb 目录）
# · 节点的默认姿态换成 T-Pose 文件里的绑定姿态，运行时重定向到 VRM 时两边都是 T 姿态，关节扭转才对得上
# · 关键帧量化前先丢掉手指以外不需要的末端节点（HeadTop_End / Toe_End 等）
import json, struct, sys, os, base64

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/rpm'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'c')
# 规范动作名 → 文件（不带 .glb）
CLIPS = {
    'f': {'idle': 'F_Standing_Idle_Variations_002', 'idle2': 'F_Standing_Idle_001', 'walk': 'F_Walk_002', 'run': 'F_Jog_001', 'sprint': 'F_Run_001',
          'jump': 'F_Walk_Jump_001', 'dance': 'F_Dances_001', 'dance2': 'F_Dances_005'},
    'm': {'idle': 'M_Standing_Idle_Variations_002', 'idle2': 'M_Standing_Idle_001', 'walk': 'M_Walk_001', 'run': 'M_Jog_001', 'sprint': 'M_Run_001',
          'jump': 'M_Walk_Jump_001', 'dance': 'M_Dances_001', 'dance2': 'M_Dances_003'},
}
# 表情动作（动捕演员同一套，男女骨架各一份）：挑过画面后起的名字
EXPR = {'wave': 'M_Standing_Expressions_001', 'think': 'M_Standing_Expressions_002', 'no': 'M_Standing_Expressions_005', 'bow': 'M_Standing_Expressions_007',
        'cheer': 'M_Standing_Expressions_010', 'yes': 'M_Standing_Expressions_012', 'victory': 'M_Standing_Expressions_013'}
for g in CLIPS: CLIPS[g].update(EXPR)
EXTRA = json.load(open(os.path.join(SRC, 'extra.json'))) if os.path.exists(os.path.join(SRC, 'extra.json')) else {}
DIR = {'f': 'feminine', 'm': 'masculine'}
TPOSE = {'f': 'Feminine_TPose.glb', 'm': 'Masculine_TPose.glb'}


def read_glb(p):
    b = open(p, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    if off >= len(b): return j, b''
    bl = struct.unpack_from('<I', b, off)[0]
    return j, b[off + 8: off + 8 + bl]


def write_glb(j, bin_):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    return b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(bin_)) + b'BIN\0' + bin_


def pack(g):
    clips = dict(CLIPS[g]); clips.update(EXTRA.get(g, {}))
    tj, _ = read_glb(os.path.join(SRC, DIR[g], TPOSE[g]))
    rest = {n['name']: n for n in tj['nodes'] if 'name' in n}
    base = None; acc = []; views = []; anims = []; binb = b''
    for name, fn in clips.items():
        j, b = read_glb(os.path.join(SRC, DIR[g], fn + '.glb'))
        if base is None:
            base = {'asset': {'version': '2.0', 'generator': 'pack_anims'}, 'scene': 0, 'scenes': j['scenes'], 'nodes': j['nodes']}
            for n in base['nodes']:
                r = rest.get(n.get('name'))
                if r:
                    for k in ('rotation', 'translation', 'scale'):
                        if k in r: n[k] = r[k]
                        else: n.pop(k, None)
        else:
            assert [n.get('name') for n in j['nodes']] == [n.get('name') for n in base['nodes']], fn
        a = j['animations'][0]
        used = sorted({s['input'] for s in a['samplers']} | {s['output'] for s in a['samplers']})
        amap = {}
        for ai in used:
            A = dict(j['accessors'][ai]); v = j['bufferViews'][A['bufferView']]
            start = v.get('byteOffset', 0) + A.get('byteOffset', 0)
            comp = {5126: 4, 5123: 2, 5121: 1, 5122: 2, 5120: 1}[A['componentType']]
            ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[A['type']]
            ln = A['count'] * comp * ncomp
            binb += b'\0' * ((4 - len(binb) % 4) % 4)
            views.append({'buffer': 0, 'byteOffset': len(binb), 'byteLength': ln})
            binb += b[start:start + ln]
            A['bufferView'] = len(views) - 1; A.pop('byteOffset', None)
            amap[ai] = len(acc); acc.append(A)
        anims.append({'name': name, 'samplers': [dict(s, input=amap[s['input']], output=amap[s['output']]) for s in a['samplers']], 'channels': a['channels']})
    base.update({'accessors': acc, 'bufferViews': views, 'animations': anims, 'buffers': [{'byteLength': len(binb)}]})
    glb = write_glb(base, binb)
    key = 'anim_' + g
    with open(os.path.join(OUT, key + '.js'), 'w') as f:
        f.write('__CH(' + json.dumps(key) + ',"' + base64.b64encode(glb).decode() + '");')
    print(key, len(clips), 'clips', round(len(glb) / 1048576, 2), 'MB')


if __name__ == '__main__':
    for g in ('f', 'm'): pack(g)
