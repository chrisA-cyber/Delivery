"""Build portable Roblox line art from the pinned Feather SVG sources. Requires fontTools."""
from pathlib import Path
from math import cos, sin, tau, hypot, ceil
from xml.etree import ElementTree
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parents[1]


class Outline(BasePen):
    def __init__(self):
        super().__init__(None)
        self.paths = []

    def _moveTo(self, point):
        self.paths.append([point])

    def _lineTo(self, point):
        self.paths[-1].append(point)

    def _curveToOne(self, a, b, end):
        start = self.paths[-1][-1]
        length = sum(hypot(q[0]-p[0], q[1]-p[1]) for p, q in zip((start, a, b), (a, b, end)))
        steps = max(2, ceil(length / 3))
        for i in range(1, steps + 1):
            t = i / steps
            u = 1 - t
            self._lineTo(tuple(u**3 * p + 3*u*u*t*x + 3*u*t*t*y + t**3*z for p,x,y,z in zip(start,a,b,end)))

    def _closePath(self):
        self._lineTo(self.paths[-1][0])


def paths(element):
    tag = element.tag.split("}")[-1]
    attrs = element.attrib
    if tag == "path":
        pen = Outline()
        parse_path(attrs["d"], pen)
        return pen.paths
    if tag == "line":
        return [[(float(attrs["x"+i]), float(attrs["y"+i])) for i in ("1", "2")]]
    if tag == "circle":
        x, y, r = (float(attrs[k]) for k in ("cx","cy","r"))
        n = max(8, ceil(tau*r/3))
        return [[(x+r*cos(tau*i/n),y+r*sin(tau*i/n)) for i in range(n+1)]]
    if tag in ("polyline", "polygon"):
        numbers=iter(map(float,attrs["points"].replace(",", " ").split()))
        points=list(zip(numbers,numbers))
        return [points + ([points[0]] if tag=="polygon" else [])]
    raise ValueError(tag)


result = ["--!strict", "-- Generated from the pinned Feather sources by tools/feather.py.", "return {"]
for source in sorted((ROOT/"third_party/feather/icons").glob("*.svg")):
    result.append(f'\t["{source.stem}"] = {{')
    for shape in ElementTree.parse(source).getroot():
        for stroke in paths(shape):
            coords = ", ".join(f"{n:.2f}".rstrip("0").rstrip(".") for p in stroke for n in p)
            result.append("\t\t{ " + coords + " },")
    result.append("\t},")
result.append("}")
(ROOT/"src/client/FeatherPaths.luau").write_text("\n".join(result)+"\n", encoding="utf-8")
