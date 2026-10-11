# 打包 VRoid / VRM 动漫角色 → assets/models/c/<key>.js（base64，和 pack_chars.cjs 同一格式）
# 用法：python3 tools/pack_vrm.py <素材目录> [key ...]   （目录下放 <文件>.vrm，映射见 LIST）
# 体积优化：贴图缩到 512（脸 1024）并转 WebP；只保留眨眼 / 笑 / 张嘴等少量表情 morph；清掉没人引用的数据
import json, struct, sys, os, io, base64
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/vrm'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'models', 'c')
LIST = {
    'vr_shino': 'Sendagaya_Shino.vrm', 'vr_shibu': 'Sendagaya_Shibu.vrm', 'vr_fumiriya': 'Sakurada_Fumiriya.vrm',
    'vr_vita': 'Vita.vrm', 'vr_vivi': 'Vivi.vrm', 'vr_victoria': 'Victoria_Rubin.vrm',
    'vr_hairm': 'HairSample_Male.vrm', 'vr_hairf': 'HairSample_Female.vrm',
    'vr_sample_a': 'A.vrm', 'vr_sample_b': 'B.vrm', 'vr_sample_c': 'AvatarSample_C.vrm',
    'vr_male': 'vroid-male-base.vrm',
    # VRoid 官方预设 AvatarSample_M（VRoidPreset 使用条款：可再分发、可改、免署名）
    'vr_sample_m': 'AvatarSample_M.vrm',
    # VRoid Hub · siroihakumai「Savi China」「Savi doctor」（许可：再分发 / 修改 / 商用均允许，免署名）
    'vr_savi_cn': 'Savi_China.vrm', 'vr_savi_doc': 'Savi_doctor.vrm',
}
KEEP_EXPR1 = {'happy', 'blink', 'blinkLeft', 'blinkRight', 'aa', 'sad', 'angry', 'relaxed', 'neutral'}
KEEP_EXPR = {'blink', 'blink_l', 'blink_r', 'joy', 'a', 'fun', 'sorrow', 'angry', 'neutral'}


def read_glb(p):
    b = open(p, 'rb').read()
    assert b[:4] == b'glTF'
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack_from('<I', b, off)[0]
    return j, b[off + 8: off + 8 + bl]


def write_glb(j, bin_):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    return b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(bin_)) + b'BIN\0' + bin_


def shrink(data, size):
    im = Image.open(io.BytesIO(data))
    im.load()
    has_a = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if has_a else 'RGB')
    if has_a and im.getextrema()[3][0] == 255:
        im = im.convert('RGB'); has_a = False
    if max(im.size) > size:
        im.thumbnail((size, size), Image.LANCZOS)
    o = io.BytesIO()
    im.save(o, 'WEBP', quality=84, method=6)
    return o.getvalue()


def pack(key, fn):
    j, bin_ = read_glb(os.path.join(SRC, fn))
    v1 = 'VRMC_vrm' in j['extensions']
    vrm = j['extensions']['VRMC_vrm' if v1 else 'VRM']
    views = [bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in j['bufferViews']]

    # 1) 表情：只留少量预设，重排 morph 索引（VRM0 blendShapeGroups 绑 mesh；VRM1 expressions 绑 node）
    if v1:
        node_mesh = {i: n['mesh'] for i, n in enumerate(j['nodes']) if 'mesh' in n}
        ex = vrm.setdefault('expressions', {}); ex.pop('custom', None)
        ex['preset'] = {k: v for k, v in ex.get('preset', {}).items() if k in KEEP_EXPR1}
        groups = [{'binds': [dict(b, mesh=node_mesh[b['node']]) for b in v.get('morphTargetBinds', []) if b['node'] in node_mesh], '_v': v} for v in ex['preset'].values()]
    else:
        groups = vrm.get('blendShapeMaster', {}).get('blendShapeGroups', [])
        groups = [g for g in groups if (g.get('presetName') or '').lower() in KEEP_EXPR]
        vrm['blendShapeMaster']['blendShapeGroups'] = groups
    used = {}
    for g in groups:
        for bd in g.get('binds', []):
            used.setdefault(bd['mesh'], set()).add(bd['index'])
    remap = {}
    for mi, m in enumerate(j['meshes']):
        keep = sorted(used.get(mi, set()))
        remap[mi] = {o: n for n, o in enumerate(keep)}
        for p in m['primitives']:
            if 'targets' in p:
                p['targets'] = [p['targets'][i] for i in keep if i < len(p['targets'])]
                if not p['targets']: del p['targets']
                ex = p.get('extras', {})
                if 'targetNames' in ex: ex['targetNames'] = [ex['targetNames'][i] for i in keep if i < len(ex['targetNames'])]
        if 'weights' in m: m['weights'] = [m['weights'][i] for i in keep if i < len(m['weights'])] or None
        if m.get('weights') is None: m.pop('weights', None)
        ex = m.get('extras', {})
        if 'targetNames' in ex: ex['targetNames'] = [ex['targetNames'][i] for i in keep if i < len(ex['targetNames'])]
    for g in groups:
        g['binds'] = [dict(bd, index=remap[bd['mesh']][bd['index']]) for bd in g.get('binds', []) if bd['index'] in remap.get(bd['mesh'], {})]
        if v1:
            g['_v']['morphTargetBinds'] = [{k: v for k, v in b.items() if k != 'mesh'} for b in g['binds']]

    # 2) 贴图：脸用 1024，其余 512，统一 WebP
    face_imgs = set()
    for mi, mat in enumerate(j['materials']):
        if 'Face' in mat.get('name', ''):
            t = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
            if t: face_imgs.add(j['textures'][t['index']]['source'])
    for ii, im in enumerate(j['images']):
        views[im['bufferView']] = shrink(views[im['bufferView']], 1024 if ii in face_imgs else 512)
        im['mimeType'] = 'image/webp'
    # MToon 的贴图也在 VRM.materialProperties 里，同一批 texture，不用改

    # 3) 清掉没用的 accessor / bufferView
    acc_used = set()
    for m in j['meshes']:
        for p in m['primitives']:
            acc_used.update(p['attributes'].values())
            if 'indices' in p: acc_used.add(p['indices'])
            for t in p.get('targets', []): acc_used.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: acc_used.add(s['inverseBindMatrices'])
    for a in j.get('animations', []):
        for s in a['samplers']: acc_used.update([s['input'], s['output']])
    acc_map = {o: n for n, o in enumerate(sorted(acc_used))}
    j['accessors'] = [j['accessors'][o] for o in sorted(acc_used)]
    fix = lambda i: acc_map[i]
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: fix(v) for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = fix(p['indices'])
            if 'targets' in p: p['targets'] = [{k: fix(v) for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = fix(s['inverseBindMatrices'])
    for a in j.get('animations', []):
        for s in a['samplers']: s['input'] = fix(s['input']); s['output'] = fix(s['output'])
    sp = [x for a in j['accessors'] if 'sparse' in a for x in (a['sparse']['indices'], a['sparse']['values'])]
    bv_used = sorted({a['bufferView'] for a in j['accessors'] if 'bufferView' in a} | {im['bufferView'] for im in j['images']} | {x['bufferView'] for x in sp})
    bv_map = {o: n for n, o in enumerate(bv_used)}
    out, nviews = b'', []
    for o in bv_used:
        v = dict(j['bufferViews'][o]); data = views[o]
        out += b'\0' * ((4 - len(out) % 4) % 4)
        v['byteOffset'] = len(out); v['byteLength'] = len(data); v['buffer'] = 0
        out += data; nviews.append(v)
    j['bufferViews'] = nviews
    for a in j['accessors']:
        if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
    for im in j['images']: im['bufferView'] = bv_map[im['bufferView']]
    for x in sp: x['bufferView'] = bv_map[x['bufferView']]
    j['buffers'] = [{'byteLength': len(out)}]
    glb = write_glb(j, out)
    with open(os.path.join(OUT, key + '.js'), 'w') as f:
        f.write('__CH(' + json.dumps(key) + ',"' + base64.b64encode(glb).decode() + '");')
    return len(glb)


if __name__ == '__main__':
    only = sys.argv[2:]
    tot = 0
    # 单独的索引文件（pack_chars.cjs 会整体重写 index.js，这里合并进 CHAR_INDEX）
    MALE = {'vr_fumiriya', 'vr_hairm', 'vr_sample_c', 'vr_male', 'vr_savi_cn', 'vr_savi_doc'}
    idx = {k: {'vrm': 1, 'g': 'm' if k in MALE else 'f'} for k in LIST}
    with open(os.path.join(OUT, 'vrm-index.js'), 'w') as f:
        f.write('window.CHAR_INDEX=Object.assign(window.CHAR_INDEX||{},' + json.dumps(idx, separators=(',', ':')) + ');')
    for k, fn in LIST.items():
        if only and k not in only: continue
        if not os.path.exists(os.path.join(SRC, fn)): print('skip', k); continue
        n = pack(k, fn); tot += n
        print(f'{k:14s} {n / 1048576:.2f} MB')
    print(f'total {tot / 1048576:.1f} MB')
