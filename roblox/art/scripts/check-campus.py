"""Check the shipped plaza paths against the collidable solids in the actual Rojo model.

Each body uses nine vertical probes. Sloped and rotated parts are evaluated in their own
local space. Curved colliders use their enclosing oriented boxes, a conservative bound.
Studio runtime rigs, imported avatars, dynamic props and real movement are tested separately.
"""
import json
import math
from pathlib import Path

ART = Path(__file__).resolve().parents[1]
STEP = .25
FOOTPRINT = ((0,0),(-1,0),(1,0),(0,-1),(0,1),(-.70,-.70),(.70,-.70),(-.70,.70),(.70,.70))

def vertical_span(part, x, z):
    # Position is p=(x,y,z). Its i-th local coordinate is dot(column_i, p - translation).
    cf,size=part["CFrame"],part["Size"]
    low,high=-float("inf"),float("inf")
    for axis in range(3):
        slope=cf[6+axis]
        bias=cf[3+axis]*(x-cf[0])+cf[9+axis]*(z-cf[2])-slope*cf[1]
        half=size[axis]/2
        if abs(slope)<1e-7:
            if abs(bias)>half: return None
        else:
            t0,t1=(-half-bias)/slope,(half-bias)/slope
            low=max(low,min(t0,t1)); high=min(high,max(t0,t1))
            if low>high: return None
    return low,high

def main():
    doc=json.loads((ART/"ShowSet.model.json").read_text(encoding="utf-8"))
    objects=[(p["Name"], p["Properties"]) for room in doc["Children"] for p in room["Children"]]
    solids=[(name,p) for name,p in objects if p.get("CanCollide")]
    bounds={}
    for name,p in solids:
        c,h=p["CFrame"],[x/2 for x in p["Size"]]
        dx=sum(abs(c[3+j])*h[j] for j in range(3))
        dz=sum(abs(c[9+j])*h[j] for j in range(3))
        bounds[id(p)]=(c[0]-dx,c[0]+dx,c[2]-dz,c[2]+dz)
    def hits(x,z):
        spans=[]
        for name,p in solids:
            xmin,xmax,zmin,zmax=bounds[id(p)]
            if not (xmin-.001<=x<=xmax+.001 and zmin-.001<=z<=zmax+.001): continue
            span=vertical_span(p,x,z)
            if span: spans.append((name,span[0],span[1]))
        return spans
    def inspect(point, previous):
        x,z=point
        spans=hits(x,z)
        top=max((hi for _,lo,hi in spans if hi<=previous+.63),default=None)
        if top is None or previous-top>.7:
            raise RuntimeError(f"Missing continuous floor at ({x:.1f}, {z:.1f})")
        clearance=999
        for dx,dz in FOOTPRINT:
            spans=hits(x+dx,z+dz)
            substantial=[(name,lo,hi) for name,lo,hi in spans if hi>top+.57]
            ceiling=min((max(0,lo-top) for name,lo,hi in substantial),default=999)
            clearance=min(clearance,ceiling)
            if ceiling<5.15:
                raise RuntimeError(f"Body occlusion at ({x:.1f}, {z:.1f}) by {substantial}")
        return top, clearance
    def route(name, points, start=0):
        previous=start
        maxrise,lowest,count=0,999,0
        for (ax,az),(bx,bz) in zip(points,points[1:]):
            steps=max(1,math.ceil(math.hypot(bx-ax,bz-az)/STEP))
            for i in range(steps+1):
                t=i/steps
                y,height=inspect((ax+(bx-ax)*t,az+(bz-az)*t),previous)
                maxrise=max(maxrise,abs(y-previous)); lowest=min(lowest,height)
                previous=y
                count+=1
        headroom=f"{lowest:.2f}" if lowest<999 else "open sky"
        print(f"PASS {name:<24} {count:>4} stations; largest floor step {maxrise:.2f}; overhead clearance {headroom}.")
        return count
    routes={
      "Live Theatre": [(0,62),(0,24)],
      "Studio B": [(0,62),(0,53),(-51,53)],
      "Writers' Loft": [(0,62),(0,78.5),(-12,78.5),(-12,89),(-51,89)],
      "Costume Atelier": [(0,62),(0,78.5),(12,78.5),(12,89),(51,89)],
      "Prop Warehouse": [(0,62),(0,53),(51,53)],
      "Rooftop ramp": [(0,62),(0,84),(0,108),(0,118)],
      "Prop Bell": [(51,53),(42,53),(42,47)],
      "Prop Lantern": [(51,53),(60,53),(60,47)],
      "Prop Hat": [(51,53),(60,53),(60,61)],
      "Waterfront Pier": [(0,62), (0,74.5),(-122,74.5),(-122,74)],
      "Dockside Post": [(-122,74),(-87,74),(-87,65),(-87,56),(-87,54.65)],
      "Needle Drop Records": [(99,80),(99,74.5),(85,74.5),(85,82),(85,90),(85,92.25)],
      "Copper Kettle Bakehouse": [(-31,100),(-31,121),(-43,121),(-52,121),(-53.65,121)],
      "Pocket Print Gallery": [(31,148),(31,130),(43,130),(52,130),(54.34,130)],
      "Clock Court passage": [(99,91),(99,115),(82,125),(82,150),(32,151)],
      "Clock Court bells": [(82,125),(88,125.45),(89,125.45),(89,128.45),(89,131.45)],
      "Park gateway": [(99,80),(102,80),(109,80),(119,76),(120,74)],
      "Signal Park": [(0,62), (0,74.5),(120,74.5),(120,74)],
      "Night Market via west": [(0,62),(0,74.5),(-30.8,74.5),(-30.8,151),(0,151),(0,171)],
      "Night Market via east": [(0,62),(0,74.5),(29.1,74.5),(29.1,80),(31.6,82),(31.6,92),(30.8,94),(30.8,151),(0,151),(0,171)],
      "Signal running loop": [(120,74),(109,55),(140,67),(116,96),(120,74)],
      "Paper stall": [(0,171),(0,161),(-15,161),(-15,162)],
      "Ribbon stall": [(0,171),(16,171),(16,182)],
      "Coastal lighthouse": [(-122,74),(-140,74),(-140,108),(-154,108)],
      "Loft reading landing": [(-51,89),(-51,81.28),(-60.62,81.28),(-60.62,97)],
    }
    total=sum(route(name,pts) for name,pts in routes.items())
    arrivals={name for name,_ in objects if name.startswith("Venue") or name.startswith("ParkGate") and name[-1].isdigit() or name in ("PropBell","PropLantern","PropHat","MarketPaper","MarketRibbon","ParkArrival")}
    assert len(arrivals)==23, f"Expected twenty-three actor and collection anchors, found {arrivals}"
    for name in sorted(arrivals):
        matches=[p for key,p in objects if key==name]
        assert len(matches)==1 and not matches[0]['CanCollide'], f"Anchor must be unique and noncollidable: {name}"
        x,y,z=matches[0]["CFrame"][:3]
        floor,_=inspect((x,z),y-3)
        assert 2.6<=y-floor<=3.3, f"Unsafe arrival height at {name}: {y-floor:.2f}"
        print(f"PASS {name:<24} arrives {y-floor:.2f} studs above its supporting floor.")

    arrival=next(p for name,p in objects if name=="ParkArrival")
    c=arrival["CFrame"]
    toward=(136-c[0],94-c[2])
    assert ((-c[5])*toward[0]+(-c[11])*toward[1])/math.hypot(*toward)>.999, "Park arrival should face the bandstand"
    sea=next(p for name,p in objects if name=="HarborSurface")
    scenery=[p for name,p in objects if name in ("DistantBoulevard","OuterTenement","OuterBalcony","OuterWindows")]
    for x,z in [(-155,96),(-180,60),(-192,94),(-200,130),(-260,95),(-404,119),(-640,92)]:
        assert vertical_span(sea,x,z), f"Visible water stops short of offshore sightline at {(x,z)}"
        assert not any(vertical_span(p,x,z) for p in scenery), f"Skyline obscures harbor water at {(x,z)}"
    print("PASS bandstand arrival sightline and seven offshore water/horizon samples.")
    tram_count=0
    for i in range(445):
        x=-111+i*.5
        for j in range(17):
            z=70.5+j*.5
            for name,lo,hi in hits(x,z):
                assert not (hi>.44 and lo<6.90), f"Static obstacle in tram clearance at {x}, {z}: {name}, {lo}–{hi}"
            tram_count+=1
    print(f"PASS streetcar envelope: {tram_count} positions, 222 × 8 studs, overhead clearance 6.9 studs.")
    print(f"{len(routes)} walkable corridors; {total} sampled stations; {len(arrivals)} collision-clear anchors.")
if __name__=="__main__":
    main()
