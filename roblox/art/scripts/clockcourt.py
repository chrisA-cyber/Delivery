"""Clock Court, a cobbled outdoor audience square between record row and the east market gate."""

import math

from districts import street_kit


def build_clock_court(group, piece, rod, disk, rotate, anchor, sign):
    kit = street_kit(piece, rod, disk, rotate, sign)
    group("ClockCourt")
    path = [(99, 82.5), (99, 115), (82, 125), (82, 150), (32, 151)]

    def path_strip(name, a, b, width, height, material):
        dx, dz = b[0] - a[0], b[1] - a[1]
        piece(name, (width, .08, math.hypot(dx, dz) + .2),
              ((a[0] + b[0]) / 2, height, (a[1] + b[1]) / 2),
              material, rot=rotate(math.degrees(math.atan2(dx, dz)), "Y"))

    # The whole court is cobbled; the walking line keeps its limestone flags.
    piece("CourtCobbles", (44, .1, 58), (82, .02, 127), "Cobble", solid=True)
    for a, b in zip(path, path[1:]):
        path_strip("CourtWalkEdge", a, b, 8.4, .065, "Stone")
        path_strip("CourtWalk", a, b, 7.4, .12, "Limestone")
        disk("TurningSquare", (8.45, .16, 8.45), (b[0], .065, b[1]), "Stone")
        disk("TurningInlay", (7.42, .12, 7.42), (b[0], .134, b[1]), "Limestone")

    # A mosaic turning circle with an inlaid brass clock rose.
    disk("CourtPlinth", (25.2, .26, 25.2), (90.5, .08, 128.2), "Brick", True)
    disk("CourtMosaicEdge", (22.5, .10, 22.5), (90.5, .25, 128.2), "Champagne")
    disk("CourtMosaic", (21.2, .08, 21.2), (90.5, .32, 128.2), "Tile")
    for index in range(12):
        angle = math.tau * index / 12
        piece("MosaicHour", (.38, .045, 1.3),
              (90.5 + 9.28 * math.sin(angle), .38, 128.2 + 9.28 * math.cos(angle)),
              "Limestone", rot=rotate(math.degrees(angle), "Y"))
    for index in range(8):
        angle = math.tau * index / 8 + math.pi / 8
        reach = 8.4 if index % 2 else 6.6
        rod("ClockRose", (90.5 + 4.2 * math.sin(angle), .37, 128.2 + 4.2 * math.cos(angle)),
            (90.5 + reach * math.sin(angle), .37, 128.2 + reach * math.cos(angle)),
            .5 if index % 2 else .35, "Champagne" if index % 2 else "Petal", .05, "Block")

    # A street clock with glazed lantern and four clock faces stands off the walking spine.
    x, z = 94.4, 128.8
    for name, size, y, mat in [
            ("ClockStep", (6.4, .46, 6.4), .59, "Limestone"),
            ("ClockLowerCourse", (5.52, .53, 5.52), 1.08, "Stone"),
            ("ClockPiers", (4.95, 8, 4.95), 5.25, "Brick"),
            ("ClockWaist", (5.67, .48, 5.67), 9.45, "Limestone"),
            ("ClockGlasshouse", (5.30, 5.38, 5.30), 12.22, "Midnight"),
            ("ClockCornice", (6.33, .57, 6.33), 15.14, "Champagne"),
            ("ClockCap", (6.54, .76, 6.54), 15.7, "Cobalt"),
            ("ClockLanternBase", (3.3, .45, 3.3), 16.25, "Copper"),
            ("ClockLantern", (2.45, 1.85, 2.45), 17.36, "Bulb"),
            ("ClockLanternTop", (3.1, .44, 3.1), 18.5, "Midnight")]:
        piece(name, size, (x, y, z), mat, solid=name in ("ClockStep", "ClockPiers"))
    for sx in (-1, 1):
        for sz in (-1, 1):
            piece("ClockQuoin", (.52, 7.95, .52), (x + 2.45*sx, 5.23, z + 2.45*sz), "Limestone")
            piece("LanternUpright", (.18, 2.07, .18), (x + 1.25*sx, 17.34, z + 1.25*sz), "Bakelite")
    rod("VaneSpindle", (x, 18.7, z), (x, 21.0, z), .16, "Brass")
    piece("VaneArrow", (2.6,.24,.21), (x,20.15,z), "Champagne")
    piece("VaneTail", (.83,.72,.14), (x-.88,20.25,z), "Copper")
    for heading in (0, 90, 180, 270):
        angle = math.radians(heading)
        front = math.sin(angle), math.cos(angle)
        across = math.cos(angle), -math.sin(angle)

        def face_point(u, y, depth):
            return (x + across[0]*u + front[0]*depth, y, z + across[1]*u + front[1]*depth)

        center = face_point(0, 12.29, 2.72)
        piece("ClockRim", (.24, 4.55, 4.55), center, "Champagne", "Cylinder", rotate(heading-90, "Y"))
        piece("ClockFace", (.12, 4.14, 4.14), face_point(0,12.29,2.88), "Cream", "Cylinder", rotate(heading-90, "Y"))
        for index in range(12):
            tick = math.tau * index / 12
            piece("MinuteIndex", (.13,.39 if index%3 else .53,.095),
                  face_point(1.73*math.sin(tick),12.29+1.73*math.cos(tick),2.99),
                  "Bakelite", rot=rotate(heading,"Y") @ rotate(-math.degrees(tick),"Z"))
        anchor("ClockAxis" + str(heading), face_point(0,12.29,3.07), heading)
        for name, length, initial, mat in (("HourHand", 1.05, 50, "Midnight"), ("MinuteHand", 1.55, 280, "Lacquer")):
            theta=math.radians(initial)
            piece(name+str(heading), (.16 if name=="HourHand" else .11,length,.09),
                  face_point(math.sin(theta)*length/2,12.29+math.cos(theta)*length/2,3.08 if name=="HourHand" else 3.14),
                  mat, rot=rotate(heading,"Y") @ rotate(-initial,"Z"))
        piece("ClockPin", (.31,.31,.20), face_point(0,12.29,3.22), "Brass", "Ball")
        piece("GlassTile", (2.9,3.64,.17), face_point(0,5.54,2.52), "EveningPane", rot=rotate(heading,"Y"))
        for u in (-.95,0,.95):
            piece("GlazeBar", (.11,3.72,.15), face_point(u,5.54,2.64), "Champagne", rot=rotate(heading,"Y"))

    # Visitors ring these three hanging chimes from the foot of the tower. A lit collar marks each pull.
    for i, name in enumerate(("Low", "Middle", "High")):
        zz = z - 3.35 + i * 3.0
        xx = x - 4.3
        rod("ChimeBracket", (x-2.1,5.5,zz), (xx,5.55,zz), .15,"Brass")
        rod("ChimeChain",(xx,5.55,zz),(xx,4.79,zz),.09,"Bakelite")
        height = 1.06 - .1*i
        disk("ChimeBell"+name,(1.02,height,1.02),(xx,4.61-height/2,zz),"Brass")
        disk("ChimeSkirt",(1.43,.19,1.43),(xx,4.61-height,zz),"Champagne")
        rod("ChimePull",(xx,4.61-height,zz),(xx,2.1,zz),.10,"Copper")
        piece("ChimeHandle"+name,(.43,.42,.43),(xx,2.00,zz),("Cobalt","Lacquer","Ochre")[i],"Ball")
        kit.active_ring(xx, zz, 0, 2.62, post=False, size=1.0)
    sign("CarillonPlate", -90, "CLOCK COURT  /  THREE STREET BELLS", (x-2.57,7.94,z), 4.78, 1.38, "Midnight")

    # Wayfinding: a lit gate at the Lantern Street mouth, the lane fingerpost, and a two-faced
    # fingerpost at the market end that reads to walkers arriving from the Night Market.
    for k in (-1, 1):
        piece("CourtGatePost", (.75, 8.6, .75), (99 + k*3.1, 4.3, 89.6), "Brick", solid=True)
        piece("LampCourtGate", (.9, .9, .9), (99 + k*3.1, 9.05, 89.6), "Bulb", "Ball")
    rod("CourtGateSpan", (95.9, 8.4, 89.6), (102.1, 8.4, 89.6), .3, "Champagne")
    sign("CourtGateSign", 180, "CLOCK COURT", (99, 9.5, 89.6), 5.4, 1.25, "Cobalt")
    sign("CourtGateSign", 0, "LANTERN STREET", (99, 9.5, 89.66), 5.4, 1.25, "Midnight")
    piece("GateClockRim", (.3, 1.9, 1.9), (99, 11.15, 89.63), "Champagne", "Cylinder", rotate(90, "Y"))
    piece("GateClockFace", (.4, 1.55, 1.55), (99, 11.15, 89.63), "Cream", "Cylinder", rotate(90, "Y"))
    for xx, zz, signs in [(101.8, 100, ((180, "CLOCK COURT   •   MARKET WALK"),)),
                          (68, 147.2, ((-90, "CLOCK COURT  ·  BELLS & RELAY"), (90, "NIGHT MARKET  ·  MARKET WALK")))]:
        piece("Fingerpost", (.29,6.45,.29), (xx,3.25,zz), "Copper", solid=True)
        for heading, label in signs:
            sign("CourtFinger", heading, label, (xx,5.55,zz), 6.2, 1.33, "Cobalt")
        for side in (-1,1):
            piece("FingerRivet", (.14,.14,.14), (xx + side*.20,4.60,zz), "Champagne","Ball")

    # The outdoor audience: a relay board on the gallery's back wall, facing tiered benches.
    turn = rotate(90, "Y")
    piece("RelayFrame", (14.7, 6.7, .5), (63.87, 7.2, 130), "Champagne", rot=turn)
    piece("CourtRelayBoard", (14, 6, .2), (64.24, 7.2, 130), "Ink", rot=turn)
    piece("RelaySill", (15.0, .32, .9), (64.3, 3.72, 130), "Champagne", rot=turn)
    piece("RelayHood", (15.4, .36, 1.3), (64.45, 10.52, 130), "Copper", rot=turn)
    piece("RelayCove", (14.6, .12, .12), (64.95, 10.28, 130), "RoseCove", rot=turn)
    sign("RelayHeader", 90, "LIVE FROM THE THEATRE", (63.95, 11.75, 130), 9.0, .95, "Lacquer")
    piece("RelayWainscot", (.12, 3.4, 14.6), (63.68, 1.75, 130), "Cobalt")
    # Ivy, a painted strip and lit upper windows soften the rest of the gallery's back wall.
    for zz in (121.0, 139.0):
        piece("GalleryIvy", (.4, 8.6, 3.2), (63.8, 4.3, zz), "LeafDeep")
        piece("GalleryIvyCrown", (1.3, 2.6, 3.8), (63.85, 8.9, zz), "Leaf", "Ball")
        piece("LitWindowGallery", (.14, 2.4, 2.6), (62.96, 13.6, zz + (3.5 if zz < 130 else -3.5)), "WarmWindow")
        piece("GalleryBackSill", (.5, .22, 3.0), (63.1, 12.3, zz + (3.5 if zz < 130 else -3.5)), "Limestone")
    piece("CourtTerrace", (4.6, 1.0, 19.0), (75.7, .5, 130), "Stone", solid=True)
    piece("TerraceCoping", (4.8, .14, 19.2), (75.7, 1.02, 130), "Limestone")
    for sx in (72.8, 78.6):
        piece("TerraceStep", (1.2, .55, 19.0), (sx, .275, 130), "Stone", solid=True)
    for i, zz in enumerate((124.0, 130.0, 136.0)):
        kit.bench(70.3, zz, -90, 0, "Ochre")
        anchor("CourtSeat" + str(701 + i), (70.3, 1.6, zz), 90)
        kit.bench(75.9, zz, -90, 1.0, "Rosewood")
        anchor("CourtSeat" + str(711 + i), (75.9, 2.6, zz), 90)
    for xx, zz in ((79.4, 117.5), (79.4, 142.5), (102.6, 141.5), (104.5, 120.5)):
        kit.lamp(xx, zz, 7.0, 0, "Petal", 0)

    # Layered trees, wrought iron tree grates and slatted benches edge the square.
    for xx, zz, kind, s in ((71, 117.5, "teal", 1.15), (101.3, 134.6, "green", 1.2),
                            (90.3, 142, "blossom", 1.05), (65, 144, "green", 1.15)):
        kit.tree(xx, zz, s, kind, 0, True)
    for xx,zz,heading in ((85.3,138,0),(73.6,144.1,0),(98.5,118.3,90)):
        angle = math.radians(heading)
        def benchpoint(u,y,v):
            return (xx+math.cos(angle)*u+math.sin(angle)*v,y,zz-math.sin(angle)*u+math.cos(angle)*v)
        for off in (-2.15,2.15):
            piece("CourtBenchFoot",(.33,1.60,1.50),benchpoint(off,.84,0),"Midnight",rot=rotate(heading,"Y"))
        for off in (-.50,0,.50):
            piece("CourtBenchSlat",(5.13,.20,.41),benchpoint(0,1.55,off),"Ochre",rot=rotate(heading,"Y"))
        for y in (2.17,2.64):
            piece("BenchBackrail",(5.20,.32,.19),benchpoint(0,y,.75),"Rosewood",rot=rotate(heading,"Y"))
        anchor("CourtSeat"+str(round(xx)),benchpoint(0,1.7,0),heading)
