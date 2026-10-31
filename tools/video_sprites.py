"""Cut hero sprite strips out of the source animation videos.
usage: python3 tools/video_sprites.py RUN_VIDEO ATTACK_VIDEO OUT_DIR"""
import sys, subprocess, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

FW, FH, BASE = 288, 144, 4     # frame size in texels, feet sit BASE texels above the bottom
CHAR_H = 68                    # standing height (texels) of the hero, hair to heel

# name: (video index, [times in seconds], fps, ground mode)
ANIMS = {
  'idle':    (0, [i / 6 for i in range(0, 22, 3)], 7, 'fixed'),
  'run':     (0, [22/6 + i / 12 for i in range(0, 16, 2)], 14, 'fixed'),
  'jump':    (0, [37/6, 38/6], 8, 'free'),
  'apex':    (0, [40/6], 1, 'free'),
  'fall':    (0, [42/6, 43/6], 8, 'free'),
  'land':    (0, [45/6, 47/6], 14, 'fixed'),
  'attack1': (1, [7/6 + i / 8 for i in range(6)], 20, 'fixed'),
  'attack2': (1, [16/6 + i * 7 / 36 for i in range(6)], 20, 'fixed'),
  'attack3': (1, [32/6 + i * 8 / 42 for i in range(8)], 16, 'fixed'),
}

def grab(video, t):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(720, 1280, 3).astype(np.int16)

def cutout(img):
    border = np.concatenate([img[:4].reshape(-1, 3), img[-4:].reshape(-1, 3), img[:, :4].reshape(-1, 3), img[:, -4:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.abs(img - bg).max(2)
    v, s = img.max(2), img.max(2) - img.min(2)
    # background-ish: near bg colour, or a desaturated soft shadow slightly darker than it
    bgish = (d < 22) | ((s < 14) & (v < bg.max() + 18) & (v > bg.max() - 34))
    lab, _ = ndimage.label(bgish)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgmask = np.isin(lab, edge[edge > 0])
    bgmask = ndimage.binary_opening(bgmask, iterations=1) | (bgmask & ndimage.binary_erosion(bgmask, iterations=2))
    alpha = (~bgmask).astype(np.uint8) * 255
    # drop specks
    lab2, n = ndimage.label(alpha > 0)
    if n:
        sizes = ndimage.sum(alpha > 0, lab2, range(1, n + 1))
        keep = np.isin(lab2, 1 + np.nonzero(sizes >= 60)[0])
        alpha[~keep] = 0
    return np.dstack([img.clip(0, 255).astype(np.uint8), alpha])

def anchor(rgba):
    a = rgba[..., 3] > 0
    rows = np.nonzero(a.any(1))[0]
    top, bot = rows[0], rows[-1]
    head = a[top:top + 60]               # the hair/head: steadiest horizontal anchor
    hx = np.nonzero(head.any(0))[0]
    return (hx[0] + hx[-1]) / 2, top, bot

def main(run, atk, out):
    vids = [run, atk]
    os.makedirs(out, exist_ok=True)
    # scale from the standing idle pose
    _, top, bot = anchor(cutout(grab(run, 0.0)))
    k = CHAR_H / (bot - top)
    meta = {}
    for name, (vi, times, fps, mode) in ANIMS.items():
        frames = [cutout(grab(vids[vi], t)) for t in times]
        anchors = [anchor(f) for f in frames]
        ground = max(b for _, _, b in anchors)
        sheet = Image.new('RGBA', (FW * len(frames), FH))
        for i, (f, (hx, top, bot)) in enumerate(zip(frames, anchors)):
            im = Image.fromarray(f, 'RGBA')
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            gy = (bot if mode == 'free' else ground) * k
            if mode == 'free':      # centre the airborne body on the frame's body box
                gy = (top + bot) / 2 * k + CHAR_H / 2
            dx = round(FW / 2 - hx * k + (6 if vi == 0 else 0))
            dy = round(FH - BASE - gy)
            cell = Image.new('RGBA', (FW, FH))
            cell.alpha_composite(im, (0, 0)) if False else cell.paste(im, (dx, dy), im)
            sheet.paste(cell, (i * FW, 0))
        sheet.save(f'{out}/{name}.png', optimize=True)
        meta[name] = {'frames': len(frames), 'fps': fps}
    json.dump({'fw': FW, 'fh': FH, 'anims': meta}, open(f'{out}/hero.json', 'w'), indent=1)

main(*sys.argv[1:4])
