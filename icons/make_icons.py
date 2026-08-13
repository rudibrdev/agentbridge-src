#!/usr/bin/env python3
"""AgentBridge extension icons — pure Python stdlib PNG writer (no PIL).

Design: rounded-square background in strong blue #2563EB + white bridge/gateway
glyph (two vertical piers + an arch spanning between them). Geometric, flat,
no text. Anti-aliased via 4x supersampling + 4x4 block averaging.
"""

import math
import os
import struct
import zlib

BLUE = (37, 99, 235)        # #2563EB
WHITE = (255, 255, 255)
SS = 4                      # supersampling factor

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- shapes (unit coords 0..1)
def inside_rounded_rect(u, v):
    """Full-canvas rounded square, corner radius 22% of size."""
    half = 0.5
    radius = 0.22
    dx = abs(u - half)
    dy = abs(v - half)
    if dx <= half - radius or dy <= half - radius:
        return True
    if dx <= half and dy <= half:
        return (dx - (half - radius)) ** 2 + (dy - (half - radius)) ** 2 <= radius ** 2
    return False


def inside_glyph(u, v):
    """White bridge glyph: two piers + upper-half arch band between them."""
    cx = 0.5          # arch center x
    arch_y = 0.50     # springing line (arch base, pier tops)
    R = 0.26          # outer arch radius
    tw = 0.09         # arch band thickness
    pw = 0.13         # pier width
    bottom = 0.80     # pier bottoms
    lx = 0.24         # left pier outer edge (= arch left springing point)
    rx = 0.63         # right pier inner edge (= 0.76 - pw)
    if lx <= u <= lx + pw and arch_y <= v <= bottom:
        return True
    if rx <= u <= rx + pw and arch_y <= v <= bottom:
        return True
    if v <= arch_y:
        d = math.hypot(u - cx, v - arch_y)
        if R - tw <= d <= R:
            return True
    return False


# ---------------------------------------------------------------- render
def render(size):
    """Render one icon at `size` via 4x supersampling."""
    big = size * SS
    out = bytearray(size * size * 4)
    n = SS * SS
    for py in range(size):
        for px in range(size):
            r = g = b = a = 0
            for t in range(SS):
                for s in range(SS):
                    u = (px * SS + s + 0.5) / big
                    v = (py * SS + t + 0.5) / big
                    if inside_rounded_rect(u, v):
                        a += 255
                        if inside_glyph(u, v):
                            r += WHITE[0]
                            g += WHITE[1]
                            b += WHITE[2]
                        else:
                            r += BLUE[0]
                            g += BLUE[1]
                            b += BLUE[2]
            idx = (py * size + px) * 4
            out[idx] = round(r / n)
            out[idx + 1] = round(g / n)
            out[idx + 2] = round(b / n)
            out[idx + 3] = round(a / n)
    return bytes(out)


# ---------------------------------------------------------------- PNG writer
def png_chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, size, rgba):
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    raw = b"".join(b"\x00" + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    idat = zlib.compress(raw, 9)
    with open(path, "wb") as f:
        f.write(sig + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", idat) + png_chunk(b"IEND", b""))


# ---------------------------------------------------------------- validation
def validate(path, expect_size):
    """Read back a PNG: signature, IHDR dims, per-chunk CRC32, IDAT decompress."""
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "bad PNG signature"
    pos = 8
    w = h = bd = ct = None
    idat = b""
    crc_ok = True
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        stored = struct.unpack(">I", data[pos + 8 + ln:pos + 12 + ln])[0]
        if zlib.crc32(tag + chunk) & 0xFFFFFFFF != stored:
            crc_ok = False
        if tag == b"IHDR":
            w, h = struct.unpack(">II", chunk[:8])
            bd, ct = chunk[8], chunk[9]
        elif tag == b"IDAT":
            idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat)
    ok = (w == expect_size and h == expect_size and bd == 8 and ct == 6
          and len(raw) == h * (1 + w * 4) and crc_ok)
    print(f"VALIDATE {os.path.basename(path)}: {w}x{h} bitdepth={bd} colortype={ct} "
          f"crc={'OK' if crc_ok else 'BAD'} raw={len(raw)}B -> {'PASS' if ok else 'FAIL'}")
    return ok


# ---------------------------------------------------------------- main
def main():
    results = []
    for size in (16, 48, 128):
        path = os.path.join(HERE, f"icon{size}.png")
        write_png(path, size, render(size))
        print(f"wrote {path} ({os.path.getsize(path)} bytes)")
        results.append(validate(path, size))
    if not all(results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
