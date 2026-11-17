"""Clock Court, a pedestrian cut-through from record row to the east market gate."""

import math


def build_clock_court(group, piece, rod, disk, rotate, anchor, sign):
    group("ClockCourt")
    path = [(99, 90), (99, 115), (82, 125), (82, 150), (32, 151)]

    def path_strip(name, a, b, width, height, material):
        dx, dz = b[0] - a[0], b[1] - a[1]
        piece(name, (width, .08, math.hypot(dx, dz) + .2),
              ((a[0] + b[0]) / 2, height, (a[1] + b[1]) / 2),
              material, rot=rotate(math.degrees(math.atan2(dx, dz)), "Y"))

    for a, b in zip(path, path[1:]):
        path_strip("CourtWalkEdge", a, b, 8.4, .065, "Stone")
        path_strip("CourtWalk", a, b, 7.4, .12, "Limestone")
        disk("TurningSquare", (8.45, .16, 8.45), (b[0], .065, b[1]), "Stone")
        disk("TurningInlay", (7.42, .12, 7.42), (b[0], .134, b[1]), "Limestone")

    # A mosaic turning circle makes the back lane feel like a little civic square.
    disk("CourtPlinth", (25.2, .26, 25.2), (90.5, .08, 128.2), "Brick", True)
    disk("CourtMosaicEdge", (22.5, .10, 22.5), (90.5, .25, 128.2), "Champagne")
    disk("CourtMosaic", (21.2, .08, 21.2), (90.5, .32, 128.2), "Tile")
    for index in range(12):
        angle = math.tau * index / 12
        piece("MosaicHour", (.38, .045, 1.3),
              (90.5 + 9.28 * math.sin(angle), .38, 128.2 + 9.28 * math.cos(angle)),
              "Limestone", rot=rotate(math.degrees(angle), "Y"))

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

    # Visitors ring these three hanging chimes from the foot of the tower.
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
    sign("CarillonPlate", -90, "CLOCK COURT  /  THREE STREET BELLS", (x-2.57,7.94,z), 4.78, 1.38, "Midnight")

    for xx, zz, heading, label in [(101.8,100,180,"CLOCK COURT   •   MARKET WALK"),
                                     (68,147.2,90,"NIGHT MARKET   /   CLOCK COURT")]:
        piece("Fingerpost", (.29,6.45,.29), (xx,3.25,zz), "Copper", solid=True)
        sign("CourtFinger", heading, label, (xx,5.55,zz), 6.2, 1.33, "Cobalt")
        for side in (-1,1):
            piece("FingerRivet", (.14,.14,.14), (xx + side*.20,4.60,zz), "Champagne","Ball")
    # Plane trees, wrought iron tree grates and slatted benches edge the square.
    for xx,zz in ((74.4,119), (101.3,134.6), (90.3,142), (65,144)):
        disk("TreeGrate",(4.25,.20,4.25),(xx,.12,zz),"Bakelite")
        rod("PlaneTrunk",(xx,.2,zz),(xx+.18,6.10,zz),.72,"Copper")
        for j,(offx,offz,lift) in enumerate(((-1.7,-.7,7.3),(1.5,1.1,8.2),(-.5,1.2,9.7),(1.1,-1.7,8.8))):
            rod("PlaneBranch",(xx,4.3,zz),(xx+offx,lift-.7,zz+offz),.27,"Ochre")
            piece("PlaneCanopy",(4.5,3.4,4.0),(xx+offx,lift,zz+offz),"PlaneLeaf" if j%2 else "PlaneShade","Ball")
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
