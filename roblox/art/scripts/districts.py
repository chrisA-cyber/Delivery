"""Three original outdoor neighborhoods joined by Lantern Street and the Market Walk."""
import math
import random
from types import SimpleNamespace

# Tree canopies are layered smooth balls in two or three related tones.
CANOPY = {
    "green": ("LeafDeep", "Leaf", "LeafLight"),
    "blossom": ("Petal", "BlossomPale", "Mulberry"),
    "plum": ("Mulberry", "Petal", "BlossomPale"),
    "teal": ("PlaneShade", "PlaneLeaf", "LeafLight"),
}
ACTIVE_RINGS = []


def street_kit(piece, rod, disk, rot, sign):
    """Shared street furniture, foliage and interaction markers for every outdoor builder."""

    def local(x, z, heading):
        # Local +u runs across, +v is the facing direction (sin h, cos h).
        a = math.radians(heading)
        c, s = math.cos(a), math.sin(a)
        return lambda u, y, v: (x + u*c + v*s, y, z - u*s + v*c)

    def tree(x, z, s=1.0, kind="green", base=0.0, grate=False):
        r = random.Random(round(x*7919 + z*104729))
        deep, mid, light = CANOPY[kind]
        top = (x + r.uniform(-.45, .45)*s, base + 5.3*s, z + r.uniform(-.45, .45)*s)
        if grate:
            disk("TreeGrate", (3.4*s, .1, 3.4*s), (x, base + .07, z), "Black")
        rod("TreeTrunk", (x, base, z), top, .62*s, "Bark")
        spin = r.uniform(0, math.tau)
        for i, (mat, size, reach, lift) in enumerate(((deep, 4.7, 1.75, 6.2), (mid, 4.3, 1.9, 7.0),
                                                      (mid, 3.9, 1.5, 7.6), (light, 2.9, .45, 8.75))):
            a = spin + i*2.25
            cx, cz = top[0] + math.cos(a)*reach*s, top[2] + math.sin(a)*reach*s
            if i < 2:
                rod("TreeBough", (top[0], base + 4.0*s, top[2]), (cx, base + (lift - 1.0)*s, cz), .3*s, "Bark")
            piece("TreeCanopy", (size*s*1.08, size*s*.84, size*s), (cx, base + lift*s, cz), mat, "Ball")

    def lamp(x, z, h=7.0, base=0.0, basket=None, heading=0):
        disk("StreetLampFoot", (1.1, .42, 1.1), (x, base + .21, z), "Midnight")
        rod("StreetLampPole", (x, base, z), (x, base + h, z), .3, "Midnight")
        disk("StreetLampCollar", (.78, .24, .78), (x, base + h, z), "Champagne")
        piece("LampGlobe", (1.12, 1.12, 1.12), (x, base + h + .66, z), "Bulb", "Ball")
        disk("StreetLampCap", (1.25, .22, 1.25), (x, base + h + 1.27, z), "Copper")
        if basket:
            at = local(x, z, heading)
            rod("BasketBracket", (x, base + h - 1.3, z), at(0, base + h - 1.3, 1.25), .12, "Champagne")
            piece("FlowerBasket", (1.2, 1.2, 1.2), at(0, base + h - 2.05, 1.25), "Leaf", "Ball")
            piece("BasketBlooms", (1.0, .55, 1.0), at(0, base + h - 1.62, 1.25), basket, "Ball")

    def bench(x, z, heading, y=0.0, mat="Ochre"):
        # The sitter faces +v.
        at, turn = local(x, z, heading), rot(heading, "Y")
        piece("BenchBoard", (4.6, .26, 1.35), at(0, y + 1.42, 0), mat, rot=turn)
        piece("BenchBack", (4.6, .95, .22), at(0, y + 2.18, -.68), mat, rot=turn @ rot(-9, "X"))
        for k in (-1, 1):
            piece("BenchIron", (.24, 1.45, 1.35), at(k*1.95, y + .72, -.08), "Black", rot=turn)

    def planter(x, z, w, d, heading=0, blooms=None, mat="Brick", y=0.0):
        turn = rot(heading, "Y")
        piece("Planter", (w, .95, d), (x, y + .48, z), mat, rot=turn)
        piece("PlanterRim", (w + .26, .16, d + .26), (x, y + 1.0, z), "Limestone", rot=turn)
        piece("PlanterHedge", (w - .3, 1.05, d - .3), (x, y + 1.55, z), "LeafDeep", rot=turn)
        if blooms:
            at = local(x, z, heading)
            for k in ((-1, 1) if w > 3 else (0,)):
                piece("PlanterBlooms", (1.25, .7, 1.25), at(k*w*.25, y + 2.1, 0), blooms, "Ball")

    def litter_bin(x, z):
        rod("LitterBin", (x, 0, z), (x, 1.75, z), 1.05, "Midnight")
        disk("BinLid", (1.2, .2, 1.2), (x, 1.82, z), "Champagne")

    def post_box(x, z, heading=0):
        at = local(x, z, heading)
        rod("PostBox", (x, 0, z), (x, 3.0, z), 1.35, "PostRed")
        piece("PostBoxCap", (1.45, 1.45, 1.45), (x, 3.05, z), "PostRed", "Ball")
        piece("PostBoxSlot", (.8, .14, .1), at(0, 2.45, .68), "Black", rot=rot(heading, "Y"))

    def bike_rack(x, z, heading=0):
        at, turn = local(x, z, heading), rot(heading, "Y")
        for k in (-1, 1):
            rod("RackLeg", at(k*1.6, 0, 0), at(k*1.6, 1.6, 0), .16, "Champagne")
        rod("RackRail", at(-1.6, 1.6, 0), at(1.6, 1.6, 0), .16, "Champagne")
        for k in (-1, 1):
            piece("BikeWheel", (.12, 1.7, 1.7), at(k*.95, .85, .45), "Black", "Cylinder", turn @ rot(90, "Y"))
        rod("BikeFrame", at(-.95, .9, .45), at(.95, 1.45, .45), .14, "Cobalt")

    def active_ring(x, z, base=0.0, h=3.8, post=True, size=1.55):
        """A lit bulb ring on a brass post marks every place that does something."""
        if post:
            disk("ActiveRingFoot", (.9, .2, .9), (x, base + .1, z), "Champagne")
            rod("ActiveRingPost", (x, base, z), (x, base + h, z), .2, "Champagne")
        disk("ActiveRing", (size, .22, size), (x, base + h + .1, z), "Bulb")
        ACTIVE_RINGS.append((round(x, 2), round(base + h + .1, 2), round(z, 2)))

    def festoon(name, a, b, sag, count, mats, segments=4, bulb=.5):
        def p(t):
            return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t - sag*math.sin(math.pi*t), a[2] + (b[2]-a[2])*t)
        for i in range(segments):
            rod(name + "Cable", p(i/segments), p((i+1)/segments), .08, "Bakelite")
        for i in range(1, count + 1):
            q = p(i/(count + 1))
            piece(name, (bulb, bulb, bulb), (q[0], q[1] - .28, q[2]), mats[i % len(mats)], "Ball")

    def bunting(a, b, sag, count, mats):
        def p(t):
            return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t - sag*math.sin(math.pi*t), a[2] + (b[2]-a[2])*t)
        for i in range(3):
            rod("BuntingCord", p(i/3), p((i+1)/3), .07, "Cream")
        heading = math.degrees(math.atan2(-(b[2]-a[2]), b[0]-a[0]))
        for i in range(1, count + 1):
            q = p(i/(count + 1))
            piece("BuntingFlag", (.78, .78, .06), (q[0], q[1] - .5, q[2]), mats[i % len(mats)],
                  rot=rot(heading, "Y") @ rot(45, "Z"))

    return SimpleNamespace(local=local, tree=tree, lamp=lamp, bench=bench, planter=planter,
                           litter_bin=litter_bin, post_box=post_box, bike_rack=bike_rack,
                           active_ring=active_ring, festoon=festoon, bunting=bunting)


def build_districts(group, piece, rod, disk, rot, anchor, sign):
    kit = street_kit(piece, rod, disk, rot, sign)

    def slab(name, size, pos, material):
        piece(name, size, pos, material, solid=True)

    def post(name, x, z, height, material, width=.4, base=0):
        slab(name, (width,height,width), (x,base+height/2,z), material)

    def lantern(x, z, h=7.2, base=0, basket=None, heading=0):
        kit.lamp(x, z, h, base, basket, heading)

    lift = [0]

    def flat_path(name, a, b, width, material, kerb=False):
        # Each overlapping segment sits a hair higher so junctions never shimmer.
        dx,dz=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dz)
        heading=math.degrees(math.atan2(dx,dz))
        lift[0]=(lift[0]+1)%9
        piece(name,(width,.12,length),((a[0]+b[0])/2,lift[0]*.004,(a[1]+b[1])/2),
              material,rot=rot(heading,"Y"),solid=True)
        if kerb and length>9:
            ux,uz=dx/length,dz/length
            for side in (-1,1):
                ox,oz=uz*side*(width/2+.12),-ux*side*(width/2+.12)
                rod("PathKerb",(a[0]+ux*4.2+ox,.07,a[1]+uz*4.2+oz),(b[0]-ux*4.2+ox,.07,b[1]-uz*4.2+oz),
                    .26,"Limestone",.2,"Block")

    def notice(name,text,x,z,facing,w=12,back="Midnight",base=0):
        post("NoticeStanchion",x,z,3.5,"Copper",.36,base)
        sign(name,facing,text,(x,base+4.37,z),w,1.79,back)

    group("LanternStreet")
    # One continuous tram street: smooth roadway, pavements and kerbs where the frontage leaves room.
    slab("StreetBed",(198.5,.20,13),(25.25,-.02,74.5),"Roadway")
    for side in (-1,1):
        piece("StreetRail",(222,.11,.18),(0,.10,74.5+side*2.08),"Champagne")
        flat_path("MarketWalk",(side*32,96),(side*32,153),9.2,"Paver")
    flat_path("MarketCrosswalk",(-36,151),(36,151),9.6,"Paver")
    for name,x0,x1,z0,z1 in [("StreetPavement",72.5,112,66.1,70.35),("StreetPavement",96.8,112,78.65,82.4)]:
        slab(name,(x1-x0,.2,z1-z0),((x0+x1)/2,.1,(z0+z1)/2),"Paver")
        kz=z1+.12 if z1<74 else z0-.12
        slab("StreetKerb",(x1-x0,.3,.26),((x0+x1)/2,.15,kz),"Limestone")
    # Zebra crossings at both plaza corners and at the Clock Court mouth.
    for cx in (-30.8,30.8,99):
        for i in range(7):
            piece("CrosswalkBar",(4.4,.04,.8),(cx,.1,68.9+i*1.85),"Cream")
    # Lamps pair across the street and carry festoons of bulbs above the streetcar's 6.9-stud envelope.
    for x in (-94,-77,78,94,104,116):
        for z,heading in ((68.6,180),(80.7,0)):
            lantern(x,z,7.2,0,"Petal" if (x+z)%2 else "BlossomPale",heading)
        if x>0:
            kit.festoon("FestoonLamp",(x,8.6,68.6),(x,8.6,80.7),.65,5,("Bulb","Bulb","RoseCove"),3)
    for x in (-32,32):
        for z in (106,125,145):
            lantern(x+(-5.6 if x<0 else 5.6),z,7.2,0,"Petal",90 if x<0 else -90)
    for x,z,h,label in [(-76,65,90,"WATERFRONT PIER"),(76,65,-90,"SIGNAL PARK")]:
        notice("DistrictSign",label,x,z,h,12.1)
    # Pavement furniture east of the plaza: news, post, bins, a bench and a bike rack.
    kit.bench(107.5,81.6,180)
    kit.litter_bin(101.6,81.7)
    kit.litter_bin(-82.6,69.4)
    kit.post_box(-74.9,68.9,0)
    kit.bench(-86,69.2,0,0,"Ochre")
    kit.bike_rack(108.2,67.3,0)
    pt=kit.local(80.6,64.7,0)
    piece("NewsKiosk",(3.4,2.8,2.0),pt(0,1.4,0),"Cobalt",solid=True)
    piece("NewsKioskRoof",(4.2,.3,2.8),pt(0,2.95,.15),"Champagne")
    for k in (-1,1):
        piece("NewspaperStack",(1.25,.5,.8),pt(k*.8,1.55,1.2),"Cream")
    sign("NewsBoard",0,"LATE EDITION",pt(0,3.6,.2),3.6,.75,"Lacquer")
    # Fingerpost on the south pavement points walkers down into Clock Court.
    piece("CourtFingerpost",(.32,6.6,.32),(104.2,3.3,81.9),"Copper",solid=True)
    for heading in (-90,90):
        sign("CourtPointer",heading,"CLOCK COURT  ·  NIGHT MARKET",(104.2,5.8,85.2),6.9,1.15,"Cobalt")
    piece("PointerTip",(.36,.82,.82),(104.2,5.8,88.9),"Cobalt",rot=rot(45,"X"))
    piece("FingerFinial",(.6,.6,.6),(104.2,6.75,81.9),"Champagne","Ball")

    group("BroadcastPier")
    slab("WharfApron",(62,.30,54),(-105,-.09,77),"DeckPlank")
    slab("PierDeck",(17,.62,61),(-141,-.25,76),"DeckPlank")
    slab("LighthouseJetty",(36,.62,10.0),(-150,-.25,108),"DeckPlank")
    slab("HarborBed",(50,1,150),(-160,-9.5,78),"Sand")
    piece("HarborSurface",(1200,.18,1500),(-731,-1.21,76),"Harbor")
    for z in range(48,105,3):
        piece("PlankSeal",(17,.04,.12),(-141,.079,z),"Ochre")
    for side in (-1,1):
        xs=-141+side*8.06
        # The inside edge is open into the wharf. Sea access has openings beside the slip and landing.
        for z1,z2 in ([(47,60),(60,72),(93,103)] if side<0 else [(46,57)]):
            post("MooringBollard",xs,z1,2.75,"Ochre",.5)
            post("MooringBollard",xs,z2,2.75,"Ochre",.5)
            rod("WharfRope",(xs,2.26,z1),(xs,1.86,(z1+z2)/2),.13,"Sand")
            rod("WharfRope",(xs,1.86,(z1+z2)/2),(xs,2.26,z2),.13,"Sand")
    for z in (47.6,93.6):
        disk("RopeCoil",(1.5,.34,1.5),(-148.3,.2,z),"Sand")
    piece("Slipway",(19,.42,6),(-138,-2.05,116),"DeckPlank",rot=rot(13.0,"Z"),solid=True)
    anchor("VenuePier",(-122,3.05,74),122)
    # Small reel dial leaves a clear sightline over the water to the flashing buoy.
    slab("ReelBody",(2.37,2.07,2.7),(-124.2,1.10,77.3),"Cobalt")
    piece("ReelDial",(1.49,.29,1.49),(-124.2,2.27,77.3),"Champagne","Ball")
    piece("ReelNeedle",(.17,.22,.99),(-124.2,2.43,77.32),"Lacquer",rot=rot(28,"Y"))
    kit.active_ring(-120.7,78.5)
    notice("WharfSign","BUOY WATCH",-121.8,68.25,0,10.0)
    disk("BuoyCollar",(4.1,1.41,4.1),(-146,-.62,89),"Cream")
    disk("BuoyStripe",(3.32,.49,3.32),(-146,.09,89),"Lacquer")
    disk("BuoyTower",(1.68,1.1,1.68),(-146,.75,89),"Copper")
    piece("BuoyLamp",(1.27,.64,1.27),(-146,1.42,89),"Bulb","Ball")
    # A riveted harbor derrick, trolley and suspended shipping crate.
    cx,cz=-128,58
    disk("CraneTurntable",(7.5,1.67,7.5),(cx,.87,cz),"Midnight",True)
    slab("CraneTower",(3.5,13.5,3.5),(cx,8.08,cz),"Ochre")
    slab("CraneCab",(5.96,4.48,4.63),(cx,16.24,cz),"Cobalt")
    piece("CraneWindows",(5.64,2.66,.19),(cx,16.50,cz+2.36),"WarmWindow")
    for y in (3,6,9,12):
        for d in (-1,1):
            rod("DerrickLace",(cx+d*1.85,y,cz+1.81),(cx-d*1.85,y+3,cz+1.81),.20,"Champagne")
    for z in (cz-1.12,cz+1.12):
        rod("CraneBoom",(cx-1,17.7,z),(cx-19,20.7,z),.58,"Ochre")
        rod("CraneJib",(cx-1,21.4,z),(cx-19,20.7,z),.40,"Champagne")
        for i in range(5):
            x=cx-1-i*3.35
            rod("JibLace",(x,17.84+i*.57,z),(x-2.95,21.35-i*.12,z),.20,"Champagne")
    rod("HoistCable",(cx-18,20.5,cz),(cx-18,5.1,cz),.13,"Black")
    slab("HoistCrate",(3.67,2.81,3.36),(cx-18,3.67,cz),"Ochre")
    for i in (-1,1):
        piece("ShippingBand",(.20,2.88,3.41),(cx-18+i*.93,3.67,cz),"Cream")
    # Cargo waiting under the derrick, and a bait-and-tea kiosk facing the boardwalk.
    for i,(x,y,z,w,h) in enumerate([(-121.6,.95,62.4,2.6,1.9),(-118.9,.8,62.9,2.2,1.6),(-120.5,2.6,62.6,2.0,1.5)]):
        slab("CargoCrate",(w,h,w),(x,y,z),"CrateWood")
    rod("Barrel",(-116.9,0,63.2),(-116.9,1.9,63.2),1.3,"Copper")
    kx,kz=-119.6,57.6
    slab("BaitKiosk",(4.2,3.1,3.0),(kx,1.55,kz),"Harbor")
    for i in range(5):
        piece("KioskAwning",(.86,.2,1.9),(kx-1.72+i*.86,3.25,kz+1.95),"Cream" if i%2 else "Lacquer",rot=rot(-14,"X"))
    piece("KioskRoof",(4.6,.35,3.4),(kx,3.35,kz),"RoofTile")
    piece("KioskHatch",(3.0,1.2,.12),(kx,2.0,kz+1.52),"WarmWindow")
    piece("KioskCounter",(3.6,.2,.7),(kx,1.35,kz+1.8),"Ochre")
    sign("KioskSign",0,"BAIT  &  TEA",(kx,4.1,kz+.6),3.9,.8,"Midnight")
    # White-and-coral coastal beacon, functional jetty and wheelhouse.
    lx,lz=-159,108
    disk("BeaconFoundation",(7.15,.79,7.15),(lx,.45,lz),"Limestone",True)
    for y,diam,mat in [(2.4,5.59,"Cream"),(5.67,5.16,"Brick"),(8.94,4.72,"Cream"),(12.2,4.28,"Brick")]:
        disk("LighthouseTower",(diam,3.27,diam),(lx,y,lz),mat,True)
    disk("LighthouseGallery",(5.73,.40,5.73),(lx,14.06,lz),"Midnight")
    disk("LighthouseLens",(3.27,2.01,3.27),(lx,15.26,lz),"Bulb")
    disk("LighthouseRoof",(5.7,.53,5.70),(lx,16.59,lz),"Cobalt")
    piece("LighthouseFinial",(.72,1.51,.72),(lx,17.48,lz),"Champagne","Ball")
    for j in range(6):
        a=math.tau*j/6
        rod("LensFrame",(lx+1.89*math.cos(a),14.3,lz+1.89*math.sin(a)),
            (lx+1.89*math.cos(a),16.42,lz+1.89*math.sin(a)),.17,"Brass")
    # Jetty rails with lifebuoys and a pair of fishing rods; the slip end stays open.
    for z,face in ((103.25,180),(112.75,0)):
        rod("JettyRail",(-167.5,2.6,z),(-151.5,2.6,z),.16,"Champagne")
        for x in (-167.5,-159.5,-151.5):
            rod("JettyRailPost",(x,0,z),(x,2.6,z),.2,"Champagne")
        piece("Lifebuoy",(.32,1.55,1.55),(-163.5,1.6,z),"Cream","Cylinder",rot(90+face,"Y"))
        piece("LifebuoyBand",(.36,.62,.62),(-163.5,1.6,z),"Lacquer","Cylinder",rot(90+face,"Y"))
    for x in (-156.4,-154.6):
        rod("FishingRod",(x,.05,104.2),(x+1.2,5.6,101.0),.1,"Rosewood")
        rod("FishingLine",(x+1.2,5.6,101.0),(x+1.6,-1.0,99.4),.035,"Cream")
    disk("BaitBucket",(1.0,.9,1.0),(-153.2,.45,104.6),"Cobalt")
    # Pilings out on the water are where the gulls land.
    for x,z in [(-152.3,48.5),(-152.5,64.5),(-152.2,86.5),(-169.6,113.6)]:
        rod("GullPiling",(x,-2.5,z),(x,2.2,z),.75,"Rosewood")
        disk("PilingCap",(.9,.16,.9),(x,2.25,z),"Limestone")
    for x,z in [(-131,51),(-132,99),(-112,90),(-96,57),(-151,110)]:
        lantern(x,z)
    # Moored motor launch with raised cabin, striped canvas and navigation light.
    x,z=-159,69
    piece("LaunchHull",(6.55,2.47,15.7),(x,-.50,z),"Cobalt","Ball")
    piece("LaunchGunwale",(6.47,.56,14.9),(x,.46,z),"Cream","Ball")
    piece("LaunchDeck",(5.55,.46,12.62),(x,.83,z),"Ochre","Ball")
    piece("Wheelhouse",(4.50,2.49,5.3),(x,2.18,z+.94),"Cream")
    piece("HelmGlass",(4.13,1.12,.19),(x,2.48,z+3.65),"EveningPane")
    for side in (-1,1):
        piece("PortGlass",(.17,1.13,4.46),(x+side*2.31,2.49,z+.92),"EveningPane")
    piece("LaunchRoof",(5.10,.31,5.89),(x,3.59,z+.94),"IvoryCanvas")
    rod("BoatAerial",(x,3.72,z+.94),(x,5.74,z+.94),.14,"Champagne")
    piece("PortBeacon",(.45,.41,.45),(x,5.85,z+.94),"RoseCove","Ball")
    # Two little rowing boats moored off the west bollards.
    for bx,bz,hull,yaw in [(-153.6,53.5,"Lacquer",4),(-153.8,98.0,"Harbor",-6)]:
        turn=rot(yaw,"Y")
        piece("RowboatHull",(2.9,1.3,7.4),(bx,-1.55,bz),hull,"Ball",turn)
        piece("RowboatRim",(2.75,.22,6.9),(bx,-.98,bz),"Cream","Ball",turn)
        for dz in (-1.3,1.4):
            piece("RowboatThwart",(2.4,.16,.55),(bx,-1.02,bz+dz),"Ochre",rot=turn)
        rod("Oar",(bx-.9,-.85,bz-2.2),(bx+.7,-.8,bz+2.4),.14,"Ochre")

    group("SignalPark")
    slab("ParkMeadow",(93,.25,101),(120,-.075,77),"Meadow")
    for a,b in [((120,74),(109,55)),((109,55),(140,67)),((140,67),(116,96)),
                ((116,96),(120,74)),((116,96),(88,108)),((116,96),(126.4,90.4))]:
        flat_path("GardenWalk",a,b,6.2,"Paver",kerb=True)
    anchor("ParkArrival",(99,3.05,80),-110.73)
    # Signal Run starts and finishes beside the bandstand, under its own chequered arch.
    anchor("VenuePark",(126.6,3.05,90.6),-110)
    kit.active_ring(128.3,88.3)
    for i,(x,z,heading) in enumerate([(109,55,38),(140,67,-70),(116,96,0)],1):
        anchor("ParkGate"+str(i),(x,3.05,z),heading)
        th=math.radians(heading)
        def at(u,y,depth=0):
            return (x+u*math.cos(th)+depth*math.sin(th),y,z-u*math.sin(th)+depth*math.cos(th))
        for side in (-1,1):
            px,_,pz=at(side*5.5,0)
            post("SignalPost",px,pz,7.7,"Brass",.42)
            piece("SignalPennant",(1.18,2.05,.20),at(side*5.50,5.94),"BlueCove" if i==1 else "RoseCove" if i==2 else "Bulb",rot=rot(heading,"Y"))
        rod("SignalArch",at(-5.5,7.67),at(5.5,7.67),.32,"Champagne")
        sign("GateNumber",heading,"0"+str(i),at(0,8.22),2.1,1.29,"Midnight")
    start=kit.local(122.2,92.7,-118.7)
    for k in (-1,1):
        px,_,pz=start(k*4.6,0,0)
        post("StartPost",px,pz,9.0,"Brass",.55)
        piece("LampStartPost",(.8,.8,.8),(px,9.4,pz),"Bulb","Ball")
    rod("StartBeam",start(-4.6,9.0,0),start(4.6,9.0,0),.4,"Champagne")
    sign("SignalRunStart",-118.7,"SIGNAL RUN  ·  START",start(0,7.75,0),8.0,1.45,"Cobalt")
    sign("SignalRunFinish",61.3,"FINISH  ·  BANDSTAND",start(0,7.75,-.04),8.0,1.45,"Midnight")
    for i in range(8):
        piece("ChequerFlag",(.98,.62,.5),start((i-3.5)*1.0,6.62,0),"Cream" if i%2 else "Ink",rot=rot(-118.7,"Y"))
    # Eight-spoke canopy stands in a clearing away from all three running lines.
    x,z=136,94
    disk("BandstandPad",(17,.34,17),(x,.16,z),"Limestone",True)
    disk("BandstandInlay",(15.76,.12,15.76),(x,.38,z),"Ochre",True)
    for j in range(8):
        a,b=math.tau*j/8,math.tau*(j+1)/8
        px,pz=x+7.*math.cos(a),z+7.*math.sin(a)
        qx,qz=x+7.*math.cos(b),z+7.*math.sin(b)
        post("BandstandColumn",px,pz,7.8,"Champagne",.36,.40)
        rod("BandstandValance",(px,8.27,pz),(qx,8.27,qz),.52,"Cobalt")
        rod("RoofSpoke",(px,8.33,pz),(x,11.32,z),.31,"Champagne")
        m=(a+b)/2
        piece("LampBandstand",(.62,.62,.62),(x+6.55*math.cos(m),7.72,z+6.55*math.sin(m)),"Bulb","Ball")
    disk("BandstandCanopy",(16.44,.49,16.44),(x,8.48,z),"Cobalt")
    for j in range(4):
        size=12.24-j*2.31
        disk("TieredCanopy",(size,.67,size),(x,8.99+j*.56,z),"Cobalt")
    piece("BandstandFinial",(.76,2.34,.76),(x,11.71,z),"Bulb","Ball")
    rod("PendantChain",(x,8.2,z),(x,7.2,z),.1,"Champagne")
    piece("LampBandstandPendant",(1.1,1.1,1.1),(x,6.75,z),"Bulb","Ball")
    # Fountain at the street's east end closes the Lantern Street vista.
    fx,fz=120,74
    disk("FountainSquare",(16,.1,16),(fx,.1,fz),"Paver",True)
    disk("FountainBasin",(7.6,.95,7.6),(fx,.5,fz),"Limestone",True)
    disk("FountainWater",(6.7,.1,6.7),(fx,.95,fz),"Harbor")
    rod("FountainStem",(fx,.9,fz),(fx,3.2,fz),.9,"Champagne")
    disk("FountainBowl",(3.3,.45,3.3),(fx,3.3,fz),"Limestone")
    disk("FountainBowlWater",(2.8,.08,2.8),(fx,3.52,fz),"Harbor")
    piece("FountainJet",(.7,1.5,.7),(fx,4.3,fz),"Powder","Ball")
    for j in range(4):
        a=math.tau*j/4+math.pi/4
        rod("FountainSpray",(fx+.9*math.cos(a),3.9,fz+.9*math.sin(a)),(fx+2.7*math.cos(a),1.05,fz+2.7*math.sin(a)),
            .16,"Powder")
    for bx,bz,h in [(120,64.8,0),(129.4,74,-90)]:
        kit.bench(bx,bz,h)
    # Layered trees in three greens and two blossoms frame the meadow without blocking the run.
    for i,(x,z,s,kind) in enumerate([(83,47,1.15,"green"),(95,39,1.3,"teal"),(109,36,1.1,"blossom"),(124,41,1.35,"green"),
                                     (146,43,1.15,"plum"),(156,55,1.3,"green"),(160,78,1.2,"teal"),(152,104,1.3,"blossom"),
                                     (136,112,1.25,"green"),(115,116,1.1,"blossom"),(96,105,1.2,"green"),(81,110,1.3,"teal"),
                                     (150,30,1.2,"green"),(163,92,1.05,"blossom"),(101,58,.85,"blossom"),(147,82,.95,"green")]):
        kit.tree(x,z,s,kind)
    for x,z,h in [(95,62,90),(103,91,-90),(129,107,180),(148,92,-90)]:
        kit.bench(x,z,h)
    for x,z in [(107,43),(152,70),(106,105),(91.45,79.95),(126.5,101.5),(144.5,85)]:
        lantern(x,z,7.2,0,"Petal" if x>120 else None,0)
    for x,z,bloom in [(104.5,63,"Petal"),(132,54,"BlossomPale"),(108,107,"Ochre")]:
        disk("FlowerBedKerb",(5.4,.4,5.4),(x,.2,z),"Limestone",True)
        disk("FlowerBedSoil",(4.8,.3,4.8),(x,.35,z),"Leaf")
        for j,mat in enumerate((bloom,"Petal","BlossomPale")):
            a=math.tau*j/3
            piece("FlowerBedBloom",(1.6,.9,1.6),(x+1.1*math.cos(a),.85,z+1.1*math.sin(a)),mat,"Ball")
    notice("ParkGateSign","SIGNAL PARK",92,68,0,11.80,"Cobalt")
    # The east boundary wall becomes a planted garden wall with a row of house fronts behind it.
    for i,(z0,z1,h) in enumerate([(30,44,3.4),(47,60,4.2),(63,76,3.0),(79,93,4.4),(96,108,3.6),(111,124,4.0)]):
        piece("IvyWall",(.5,h,z1-z0),(167.85,h/2,(z0+z1)/2),"LeafDeep")
        piece("IvyCrown",(1.4,1.3,(z1-z0)*.8),(167.9,h+.15,(z0+z1)/2),"Leaf","Ball")
    z=28.5
    for i,(w,h,wall,roof) in enumerate([(11,13,"Plaster","RoofTile"),(9,16,"Powder","Tile"),(12,14,"Ochre","RoofTile"),
                                       (10,18,"Plaster","Tile"),(12,13.5,"Petal","RoofTile"),(9,17,"Limestone","Tile"),
                                       (11,15,"Harbor","RoofTile"),(12,13,"Plaster","RoofTile")]):
        cz=z+w/2
        z+=w+1.2
        piece("HouseFront",(8,h,w),(174.5,h/2-1.2,cz),wall)
        gable=i%2==0
        if gable:
            piece("HouseRoof",(8.4,w/1.414,w/1.414),(174.5,h-1.2,cz),roof,rot=rot(45,"X"))
        else:
            piece("HouseRoof",(6.1,6.1,w+.6),(174.5,h-1.2,cz),roof,rot=rot(45,"Z"))
        if gable:
            piece("HouseEaves",(8.6,.35,w+.6),(174.5,h-1.0,cz),roof)
        for row in range(2):
            for col in (-1,1):
                lit=(i+row+col)%3==0
                piece("HouseWindow",(.2,2.0,1.6),(170.42,h-4.6-row*3.6,cz+col*w*.24),"WarmWindow" if lit else "EveningPane")
        piece("HouseChimney",(1.1,2.6,1.1),(176.0,h+1.0,cz+w*.3),"Brick")

    group("NightMarket")
    slab("MarketPaving",(86,.24,61),(0,-.06,177),"Brick")
    flat_path("MarketSpine",(0,147),(0,209),13.4,"Limestone")
    for z in (159,181,196):
        flat_path("StallRow",(-38,z),(38,z),6.4,"Paver")
    anchor("VenueMarket",(0,3.05,171),90)
    anchor("MarketPaper",(-15,3.05,162),90)
    anchor("MarketRibbon",(16,3.05,182),-90)
    for x in (-19.25,19.25):
        post("ArcadeGateway",x,149,12.65,"Brick",1.32)
        disk("MarketColumnShoe",(2.25,.55,2.25),(x,.33,149),"Champagne",True)
        piece("MarketLantern",(1.68,1.76,1.68),(x,13.54,149),"Bulb","Ball")
        for y in (4.2,8.4):
            piece("ColumnBand",(1.5,.28,1.5),(x,y,149),"Champagne")
    rod("MarketSpan",(-19.25,12.22,149),(19.25,12.22,149),.51,"Champagne")
    sign("MarketArch",180,"N I G H T   M A R K E T",(0,13.43,149),19.32,2.22,"Lacquer")
    sign("MarketArchReverse",0,"L A N T E R N   S T R E E T",(0,13.43,149.41),19.32,2.22,"Midnight")
    # A bulb crown and neon coves make the arch the brightest thing at the end of both walks.
    for z,off in ((148.45,-1),(149.96,1)):
        piece("ArchCove",(19.6,.16,.14),(0,12.2,z),"RoseCove")
    for i in range(11):
        piece("LampArchBulb",(.62,.62,.62),(-9.6+i*1.92,14.85,149.2),"Bulb","Ball")
    for i in range(7):
        a=math.radians(20+i*23.3)
        rod("ArchSunburst",(0,14.8,149.2),(4.2*math.cos(a),14.8+3.0*math.sin(a),149.2),.22,"Champagne")
    piece("LampArchStar",(1.3,1.3,1.3),(0,15.1,149.2),"Bulb","Ball")
    # Wing gateways greet walkers arriving down each Market Walk.
    for side in (-1,1):
        cx=side*32
        for k in (-1,1):
            post("WingGatePost",cx+k*4.95,147.4,9.2,"Brick",.8)
            piece("LampWingPost",(.85,.85,.85),(cx+k*4.95,9.65,147.4),"Bulb","Ball")
        rod("WingGateSpan",(cx-4.95,8.9,147.4),(cx+4.95,8.9,147.4),.32,"Champagne")
        sign("MarketArch",180,"NIGHT MARKET",(cx,7.75,147.4),8.6,1.45,"Lacquer")
        sign("MarketArchReverse",0,"MARKET WALK",(cx,7.75,147.62),8.6,1.45,"Midnight")
    # Six stalls with six silhouettes. Only the two lit-ring stalls are interactive.
    def stall_base(x,z,side,awning,title,goods,crown=False):
        facing=90 if side<0 else -90
        slab("StallFloor",(9.2,.34,10.0),(x,.18,z),"DeckPlank")
        slab("MerchantCounter",(2.30,2.50,8.60),(x-side*2.85,1.63,z),"Ochre")
        piece("CounterRunner",(2.40,.13,8.69),(x-side*2.85,2.94,z),awning)
        for j in range(5):
            gx,gz=x-side*(2.60+(j%2)*.33),z+(j-2)*1.33
            if goods=="paper":
                piece("PaperReam",(1.54,.26,1.05),(gx,3.16,gz),"Cream",rot=rot(4*j,"Y"))
                piece("PaperFoil",(1.4,.18,.98),(gx,3.40,gz),"Powder" if j%2 else "Petal",rot=rot(5*j,"Y"))
            elif goods=="ribbon":
                disk("RibbonSpool",(1.0,.8,1.0),(gx,3.43,gz),["Petal","Cobalt","Ochre"][j%3])
                disk("RibbonFlange",(1.11,.11,1.11),(gx,3.88,gz),"Cream")
            elif goods=="buckets":
                disk("FlowerBucket",(1.1,.8,1.1),(gx,3.4,gz),"Champagne")
                piece("Bouquet",(1.3,1.1,1.3),(gx,4.25,gz),["Petal","BlossomPale","Ochre"][j%3],"Ball")
            else:
                piece("DisplayGoods",(1.28,.88+(j%2)*.27,1.04),(gx,3.46,gz),goods,"Ball")
        sign("MerchantName",facing,title,(x-side*4.88,4.99,z),8.4,1.12,"Midnight")
        if not crown:
            for dz in (-4.35,4.35):
                rod("SignPost",(x-side*4.88,.34,z+dz),(x-side*4.88,5.6,z+dz),.2,"Champagne")
        piece("LampStall",(.75,.95,.75),(x-side*4.3,5.85 if not crown else 5.75,z-3.6),"Bulb","Ball")
        return facing
    def awning_stall(x,z,side,awning,title,goods):
        stall_base(x,z,side,awning,title,goods,True)
        for dx in (-3.95,3.95):
            for dz in (-4.42,4.42):
                post("StallUpright",x+dx,z+dz,6.43,"Ochre",.31,.34)
        for j in range(5):
            shade=awning if j%2==0 else "IvoryCanvas"
            piece("MarketAwning",(9.95,.31,2.0),(x,6.75,z+(j-2)*2.0),shade,rot=rot(side*9,"Z"))
            piece("AwningScallop",(.42,.91,1.98),(x-side*4.88,5.58,z+(j-2)*2.0),shade,"Ball")
        # Interactive stalls wear a lit crown board above the awning.
        piece("StallCrown",(.4,1.9,7.6),(x+side*.2,8.6,z),"Lacquer",rot=rot(side*9,"Z"))
        for j in range(5):
            piece("LampStallCrown",(.5,.5,.5),(x-side*.15,9.75,z+(j-2)*1.7),"Bulb","Ball")
        if side>0:
            streams=("Petal","Cobalt","Ochre")
            for j,mat in enumerate(streams):
                piece("RibbonStreamer",(.08,3.1,.42),(x-side*4.6,4.3,z-2.1+j*2.1),mat)
    def parasol_stall(x,z,side,awning,title,goods):
        stall_base(x,z,side,awning,title,goods)
        rod("ParasolPole",(x,.3,z),(x,7.6,z),.3,"Champagne")
        disk("ParasolCanopy",(10.6,.5,10.6),(x,7.25,z),awning)
        disk("ParasolTier",(6.4,.6,6.4),(x,7.75,z),"IvoryCanvas")
        disk("ParasolSkirt",(11.0,.28,11.0),(x,6.95,z),"Cream")
        piece("ParasolFinial",(.8,.8,.8),(x,8.35,z),"Champagne","Ball")
    def cart_stall(x,z,side,awning,title,goods):
        stall_base(x,z,side,awning,title,goods)
        for dz in (-3.0,3.0):
            piece("CartWheel",(.32,2.9,2.9),(x-side*4.3,1.45,z+dz),"Rosewood","Cylinder")
        rod("CartShaft",(x+side*1.2,1.4,z-3.6),(x+side*4.4,.4,z-4.4),.22,"Ochre")
        rod("CartShaft",(x+side*1.2,1.4,z+3.6),(x+side*4.4,.4,z+4.4),.22,"Ochre")
        for dz in (-3.9,3.9):
            post("CartPole",x-side*1.4,z+dz,6.6,"Ochre",.26,.34)
        piece("CartCanopy",(5.2,.3,9.4),(x-side*1.6,7.0,z),awning,rot=rot(-side*7,"Z"))
        for j in range(3):
            slab("PlumCrate",(1.7,.9,1.7),(x+side*.6,.8,z-2.5+j*2.5),"CrateWood")
            piece("CratePlums",(1.5,.5,1.5),(x+side*.6,1.35,z-2.5+j*2.5),"Mulberry","Ball")
    def tent_stall(x,z,side,awning,title,goods):
        stall_base(x,z,side,awning,title,goods)
        for dz in (-4.6,4.6):
            post("TentPole",x,z+dz,8.6,"Champagne",.28,.34)
        for k in (-1,1):
            piece("TentRoof",(5.6,.22,9.8),(x+k*2.35,7.35,z),awning if k<0 else "IvoryCanvas",rot=rot(k*-32,"Z"))
        rod("TentRidge",(x,8.9,z-4.9),(x,8.9,z+4.9),.22,"Champagne")
    def kiosk_stall(x,z,side,awning,title,goods):
        stall_base(x,z,side,awning,title,goods)
        slab("SodaKiosk",(4.4,5.6,8.4),(x+side*1.6,3.1,z),awning)
        piece("KioskTop",(5.4,.4,9.4),(x+side*1.2,6.1,z),"Cream")
        piece("SodaWindow",(.14,1.8,6.0),(x-side*.62,4.6,z),"WarmWindow")
        rod("GiantBottle",(x+side*1.6,6.3,z),(x+side*1.6,9.2,z),1.5,"ApricotPane")
        piece("BottleShoulder",(1.5,1.5,1.5),(x+side*1.6,9.3,z),"ApricotPane","Ball")
        rod("BottleNeck",(x+side*1.6,9.6,z),(x+side*1.6,10.9,z),.6,"ApricotPane")
        disk("BottleCap",(.8,.3,.8),(x+side*1.6,11.0,z),"PostRed")
    awning_stall(-23,162,-1,"Petal","PAPER MILL","paper")
    awning_stall(24,182,1,"Cobalt","SATIN RIBBON","ribbon")
    kit.active_ring(-17.2,156.6)
    kit.active_ring(18.2,187.4)
    parasol_stall(24,161,1,"Ochre","HONEY BUNS","Ochre")
    cart_stall(-25,181,-1,"Midnight","PLUM ORCHARD","Mulberry")
    tent_stall(-23,198,-1,"Cobalt","FRESH BOUQUETS","buckets")
    kiosk_stall(24,198,1,"Brick","PEACH SODA","ApricotPane")
    slab("WrapCounter",(3.46,2.45,6.79),(-5.67,1.31,171),"Lacquer")
    piece("WrapTop",(3.60,.23,6.90),(-5.67,2.65,171),"Champagne")
    for j,mat in enumerate(("Cobalt","Ochre","Petal")):
        piece("WrappedParcel",(1.44,.82,1.35),(-5.80,3.17,171+(j-1)*1.79),mat)
        piece("ParcelTie",(.24,.91,1.41),(-5.80,3.20,171+(j-1)*1.79),"Cream")
    kit.active_ring(-5.67,176.1)
    notice("WrapSign","WRAP COUNTER",-6.3,165.0,90,8.25,"Lacquer")
    # Festoons run across the market and criss-cross between the poles overhead.
    rows=(155,174,192,205)
    for z in rows:
        for side in (-1,1):
            post("FestivalPole",side*31.3,z,11.6,"Copper",.40)
        kit.festoon("FestoonLamp",(-31.3,11.53,z),(31.3,11.53,z),2.27,9,("Bulb","RoseCove","BlueCove"),4,.62)
    for z0,z1 in zip(rows,rows[1:]):
        kit.festoon("FestoonLamp",(-31.3,11.4,z0),(31.3,11.4,z1),1.6,7,("Bulb","Bulb","RoseCove"),4,.5)
        if z0!=174:
            kit.festoon("FestoonLamp",(31.3,11.4,z0),(-31.3,11.4,z1),1.6,7,("Bulb","BlueCove","Bulb"),4,.5)
    for i,(x,z) in enumerate([(-41,147),(41,147),(-41,166),(41,175),(-39,199),(40,206)]):
        kit.tree(x,z,1.25,"blossom" if i%2==0 else "green")
    for x,z in [(-11,155.9),(11,155.9),(-35,186),(34,166)]:
        lantern(x,z)
