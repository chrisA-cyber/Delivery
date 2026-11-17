"""Editable modular campus kit, authored in Roblox-space studs with +Z toward the arrivals concourse."""
import math


def build_campus(group, piece, rod, disk, rotation, anchor, sign):
    def slab(name, size, pos, material, solid=True):
        piece(name, size, pos, material, solid=solid)

    def post(name, x, z, base, height, material="Champagne", width=.35):
        piece(name, (width, height, width), (x, base+height/2, z), material, solid=True)

    def lamp(x, z, base=0):
        disk("PavementFoot", (1.4,.36,1.4), (x,base+.18,z), "Copper")
        post("Column", x,z,base+.36,5.45, "Midnight",.32)
        piece("LanternCollar",(.95,.18,.95),(x,base+5.78,z),"Brass")
        piece("PeristyleLantern",(.70,1.16,.70),(x,base+6.37,z),"Bulb")
        piece("LanternCap",(1.14,.25,1.14),(x,base+7.06,z),"Copper")

    def settee(x,z,y,heading=0):
        turn=rotation(heading,"Y")
        co,si=math.cos(math.radians(heading)),math.sin(math.radians(heading))
        def point(local_x,height,local_z):
            return (x+local_x*co+local_z*si,y+height,z-local_x*si+local_z*co)
        piece("SetteeFrame",(5.94,.37,2.08),point(0,1.05,0),"Brass",rot=turn,solid=True)
        piece("SetteePad",(5.61,.57,2.02),point(0,1.44,0),"Leather","Ball",turn,True)
        piece("SetteeBack",(5.79,1.73,.62),point(0,2.02,-.92),"Seat","Ball",turn,True)
        for side in (-1,1):
            piece("SetteeFoot",(.43,.93,.80),point(side*2.45,.48,0),"Copper",rot=turn)

    def shrub(x,z,y=0):
        # Glazed urn with a layered evergreen and a few blossoms; smooth greens read cleanly in Roblox.
        disk("CeramicPlanter",(2.23,1.0,2.23),(x,y+.5,z),"Marble",True)
        disk("PlanterCollar",(2.42,.22,2.42),(x,y+.98,z),"Brass")
        piece("PlanterShrub",(2.9,1.5,2.9),(x,y+1.62,z),"LeafDeep","Ball")
        piece("PlanterShrub",(2.4,2.3,2.3),(x-.15,y+2.75,z+.1),"Leaf","Ball")
        piece("PlanterShrub",(1.45,1.5,1.4),(x+.35,y+3.75,z-.2),"LeafLight","Ball")
        for dx,dy,dz in ((-.95,2.45,.85),(.9,3.2,.55)):
            piece("PlanterBlossom",(.6,.55,.6),(x+dx,y+dy,z+dz),"Petal","Ball")

    group("CampusGround")
    slab("Mainland",(305,1.5,272),(16.5,-.89,80),"Tile")
    # Thresholds are flush with the surrounding lane. Decorative pavers never create little trip ledges.
    # The square stops at Lantern Street's cobbles so the tram crossing reads as a street (and nothing z-fights).
    slab("ArrivalsSquare",(64,.20,28),(0,-.10,54.0),"Stone")
    slab("ArrivalsSquare",(64,.20,14),(0,-.10,88.0),"Stone")
    slab("FrontWalk",(27,.20,20),(0,-.10,31.5),"Stone")
    slab("GrandPromenade",(14,.22,54),(0,-.09,68.0),"Limestone")
    for z in (53,88):
        slab("CrossStreet",(122,.22,12),(0,-.08,z),"Limestone")
        for s in (-1,1):
            piece("CrossStreetInlay",(121,.035,.12),(0,.053,z+s*5.75),"Brass")
    for side in (-1,1):
        slab("ArcadeWalk",(8,.21,55),(side*30.5,-.09,75.0),"Limestone")
        for z in (44.4,63.9,81.2,96.2):
            lamp(side*27.3,z)
        for z in (60.7,94.7):
            shrub(side*23.8,z)
        settee(side*24.1,85.0,0,90 if side<0 else -90)
    for signx in (-1,1):
        for z in (41.7,48.3,59.5,75.4,82.0,94.8):
            piece("PavingBorder",(20.25,.035,.12),(signx*18.30,.040,z),"Brass")
        for x in (8.36,27.81):
            piece("PavingBorder",(.11,.035,51.5),(signx*x,.040,67.8),"Brass")
    for i in range(16):
        a,b=math.tau*i/16,math.tau*(i+1)/16
        for radius,mat in ((6.64,"Brass"),(6.12,"Cobalt")):
            rod("PlazaMedallion",(radius*math.cos(a),.071,66.5+radius*math.sin(a)),
                (radius*math.cos(b),.071,66.5+radius*math.sin(b)),.10,mat,.10,"Block")
    for i,h in enumerate((1.86,2.65,4.06,2.96,1.93)):
        piece("CompassWave",(.24,.05,h),((i-2)*.75,.07,66.5),"Cobalt")
    # Brass sunburst fanned out from the theatre threshold.
    for i in range(9):
        a=math.radians(-64+16*i)
        rod("ThresholdRay",(1.2*math.sin(a),.06,35.6+1.2*math.cos(a)),(7.6*math.sin(a),.06,35.6+7.6*math.cos(a)),
            .16 if i%2==0 else .09,"Brass" if i%2==0 else "Cobalt",.05,"Block")
    for z in (40,47,61,77,94):
        piece("PromenadeBand",(13.9,.037,.23),(0,.044,z),"Brass")
    # The entire neighborhood is continuous. Only the distant city boundary and harbor seawall mark its edge.
    slab("OuterFence",(.9,4.65,272),(168.5,2.15,80),"Brick")
    for z in (-55.8,215.6):
        slab("OuterFence",(305,4.65,.9),(16.5,2.15,z),"Brick")
    anchor("VenueLobby",(0,3,62),-97)
    # Spawn/arrival: heading 0 looks down -Z straight at the theatre door and the DELIVERY marquee.
    anchor("PlazaArrival",(0,3.05,58),0)
    # First landmark, east side of the promenade. The west square remains clear for the Marquee puzzle.
    disk("BroadcastPlinth",(8.25,.62,7.13),(13.0,.31,62.5),"Limestone",True)
    disk("BroadcastRing",(7.73,.22,6.66),(13.0,.71,62.5),"Champagne")
    disk("SculptureInset",(7.38,.17,6.33),(13.0,.90,62.5),"Midnight")
    for i,height in enumerate((2.4,4.45,6.3,4.65,3.04)):
        x=13+(i-2)*.95
        rod("BroadcastWave",(x,1.0,62.5),(x,1+height,62.5),.64,"Champagne" if i%2==0 else "Cobalt")
        piece("WaveCap",(.67,.72,.69),(x,1+height,62.5),"Bulb","Ball")
    # Sign faces point back at the people reading them: the first faces the arrival spot, the second the square.
    for x,z,heading,title in [(-8.7,44,32,"LIVE THEATRE  /  BOX OFFICE"),
                                (8.7,81,-155,"SKY LOUNGE  /  PORTRAITS"),
                                (-30,65.5,90,"STUDIO B     •     WRITERS' LOFT"),
                                (30,84.5,-90,"PROPS DEPOT     •     COSTUMES")]:
        post("DirectoryColumn",x,z,0,3.95,"Copper",.38)
        sign("CampusDirectory",heading,title,(x,4.63,z),8.4,1.37)
    group("TheatreFront")
    anchor("VenueTheatre",(0,3,24))
    # A sixteen-stud portal opens directly into the lower auditorium and stays traversable.
    for s in (-1,1):
        slab("TicketFront",(23.1,13.5,1.5),(s*19.9,6.62,33.4),"Brick")
        slab("TicketPilaster",(1.2,15.27,2.54),(s*8.65,7.50,33.66),"Limestone")
        piece("TicketPilasterLine",(.28,12.0,.21),(s*8.65,6.76,35.02),"Brass")
        slab("BoxOfficeTrim",(13.8,6.36,.54),(s*19.25,4.62,34.43),"Champagne")
        piece("BoxOfficeGlazing",(13.30,5.81,.28),(s*19.25,4.60,34.76),"EveningPane")
        for tick in (-1,0,1):
            px=s*19.25+tick*4.30
            piece("TicketTransom",(3.85,.43,.10),(px,6.91,34.99),"Bulb" if tick==0 else "ApricotPane")
            piece("WicketLight",(2.63,.13,.105),(px,2.57,35.0),"Bulb")
        for u in (-1,0,1):
            piece("CounterMullion",(.19,5.71,.17),(s*19.25+u*4.3,4.59,34.99),"Brass")
        piece("TicketCounter",(14.17,.38,1.53),(s*19.25,2.10,35.14),"Champagne",solid=True)
        sign("BoxOfficeLabel",0,"BOX OFFICE" if s<0 else "STAGE DOOR",(s*19.25,9.24,34.43),10.45,1.49)
        for i in range(3):
            piece("TicketCrown",(7.5-i*.50,.25,.50),(s*19.25,11.18+i*.40,34.43),"Champagne")
    slab("TheatreLintel",(64.4,2.0,3.35),(0,14.48,33.68),"Limestone")
    slab("TheatreParapet",(62.0,8.63,.92),(0,19.59,32.96),"Midnight")
    piece("ParapetCrown",(63.18,.49,1.27),(0,23.77,32.98),"Copper")
    piece("ParapetFilament",(61.3,.13,.17),(0,23.70,33.68),"BlueCove")
    piece("MarqueeCove",(40.95,.17,.18),(0,12.69,37.54),"Bulb")
    for s in (-1,1):
        for j in range(4):
            h=2.1+j*.77
            piece("CrownPiping",(.28,h,.3),(s*(21.93+j*.93),16.38+h/2,33.54),"Brass")
    for i,h in enumerate((1.75,2.79,4.28,3.21,1.83)):
        piece("MastheadSignal",(.55,h,.39),((i-2)*1.04,19.43,33.54),"Bulb","Ball")
    for i,(width,z,y,mat) in enumerate([(41.9,35.8,12.80,"Copper"),(40.9,36.2,13.50,"Champagne"),
                                        (39.2,36.4,14.88,"Midnight"),(35.8,36.25,16.02,"Brass")]):
        piece("TheatreCanopy",(width,.59 if i!=2 else 2.34,3.3),(0,y,z),mat)
    sign("GrandMarquee",0,"D E L I V E R Y",(0,14.87,38.11),27.0,2.17)
    sign("ShowEntrance",0,"ENTER THE LIVE SHOW",(0,10.86,33.97),14.18,1.57,"Midnight")
    for i in range(19):
        piece("StreetMarqueeBulb",(.53,.52,.52),((i-9)*1.88,13.52,38.06),"Bulb","Ball")
    for s in (-1,1):
        lamp(s*12.1,39.1)
        shrub(s*30.2,40.8)
        settee(s*19.1,27.1,0,180)
    sign("FoyerSign",180,"STUDIO CAMPUS  /  PLAZA",(0,10.82,32.68),14.0,1.62,"Midnight")

    # Poster cases: a plate named ShowPoster_<n> whose Back face (local +Z) looks at the street; live text is drawn there.
    poster_count=[0]
    def poster_case(cx,cy,face,out,frame="Champagne"):
        poster_count[0]+=1
        turn=rotation(0 if out>0 else 180,"Y")
        piece("PosterFrame",(4.9,6.4,.25),(cx,cy,face+out*.125),frame)
        piece("ShowPoster_"+str(poster_count[0]),(4.3,5.8,.12),(cx,cy,face+out*.31),"Lacquer",rot=turn)
        piece("PosterGlass",(4.3,5.8,.05),(cx,cy,face+out*.40),"PosterGlass")
        piece("PosterHood",(5.1,.26,.75),(cx,cy+3.33,face+out*.37),frame)
        piece("PosterLight",(4.3,.07,.07),(cx,cy+3.13,face+out*.62),"Bulb")

    def twin_lamp(x,z,label=None,heading=0):
        # Deco standard with two globes on a crossarm along Z; an optional street blade hangs below the arm.
        disk("StandardFoot",(1.3,.4,1.3),(x,.2,z),"Champagne")
        post("StandardPole",x,z,.4,7.3,"Midnight",.34)
        piece("StandardArm",(.22,.22,3.0),(x,7.55,z),"Champagne")
        for s in (-1,1):
            piece("LampGlobe",(.95,.95,.95),(x,8.05,z+s*1.4),"Bulb","Ball")
        piece("StandardFinial",(.5,.9,.5),(x,8.3,z),"Champagne","Ball")
        if label:
            sign("StreetBlade",heading,label,(x,6.35,z),4.2,.95,"Midnight")

    # Theatre front: marble end pilasters, two poster cases, a brass-lipped box office and a richer marquee.
    for s in (-1,1):
        slab("FacadePilaster",(1.3,13.5,1.3),(s*31.6,6.75,34.4),"Marble")
        for k in (-1,1):
            piece("PilasterFlute",(.12,12.2,.08),(s*31.6+k*.32,6.6,35.08),"Brass")
        poster_case(s*28.75,5.2,34.15,1)
        for tick in (-1,0,1):
            piece("SpeakingGrille",(.08,.72,.72),(s*19.25+tick*4.30,3.65,35.0),"Brass","Cylinder",rotation(90,"Y"))
        piece("CounterLip",(14.2,.1,.18),(s*19.25,2.33,35.86),"Brass")
        piece("MarqueeReturn",(.5,3.7,3.4),(s*21.15,14.4,36.2),"Midnight")
        piece("MarqueeReturnTrim",(.62,.2,3.5),(s*21.15,16.3,36.2),"Champagne")
        for j in range(3):
            piece("LampMarqueeBulb",(.44,.44,.44),(s*21.45,13.25+j*1.1,36.2),"Bulb","Ball")
    for i in range(19):
        piece("LampMarqueeBulb",(.46,.46,.46),((i-9)*1.9,16.55,37.55),"Bulb","Ball")
    for row in (35.2,37.0):
        for i in range(10):
            piece("SoffitBulb",(.36,.3,.36),((i-4.5)*3.8,12.38,row),"Bulb","Ball")
    # Paired poster kiosks on the north side of the square face back across the tram crossing to the theatre;
    # bollards frame the promenade's crossing.
    for s in (-1,1):
        kx,kz=s*16.0,91.6
        slab("KioskPlinth",(5.8,.8,1.6),(kx,.4,kz),"Marble")
        slab("KioskBody",(5.4,8.2,1.0),(kx,4.9,kz),"Midnight")
        piece("KioskCap",(6.0,.5,1.5),(kx,9.25,kz),"Champagne")
        piece("KioskCrown",(4.0,.6,1.1),(kx,9.8,kz),"Lacquer")
        poster_case(kx,4.95,kz-.5,-1)
        for x in (s*7.6,s*10.0):
            for z in (69.6,80.6):
                disk("Bollard",(.62,2.3,.62),(x,1.15,z),"Midnight",True)
                piece("BollardCap",(.74,.42,.74),(x,2.42,z),"Champagne","Ball")
        # Lantern Street mouths: a twin-globe standard with a street blade facing back into the square.
        twin_lamp(s*33.0,69.3,"PIER  •  LANTERN ST" if s<0 else "LANTERN ST  •  PARK",90 if s<0 else -90)

    group("BladeSign")
    # A tall vertical DELIVERY blade crowns the parapet: letters face the plaza and market (+Z),
    # the pier (-X) and the park (+X). Chaser bulbs climb the two front corners.
    bz,W,D=31.4,5.4,4.6
    piece("BladePlinth",(W+3.2,.9,D+2.0),(0,24.35,bz),"Midnight")
    piece("BladePlinth",(W+2.0,.8,D+1.2),(0,25.2,bz),"Champagne")
    piece("BladePlinth",(W+1.0,.8,D+.6),(0,26.0,bz),"Lacquer")
    piece("BladeShaft",(W,29.6,D),(0,41.2,bz),"Lacquer")
    for sx in (-1,1):
        for sz in (-1,1):
            piece("BladeEdge",(.34,29.6,.34),(sx*W/2,41.2,bz+sz*D/2),"Champagne")
        piece("BladeNeon",(.14,28.4,.14),(sx*(W/2+.08),41.2,bz-D/2+.45),"RoseCove")
        rod("BladeStay",(sx*1.6,44.0,bz-D/2),(sx*2.4,24.45,bz-11.0),.32,"Champagne")
        for k in range(15):
            piece("LampChaser",(.46,.46,.46),(sx*(W/2+.12),27.2+k*2.0,bz+D/2+.12),"Bulb","Ball")
    for i,letter in enumerate("DELIVERY"):
        y=53.9-i*3.55
        sign("BladeLetter",0,letter,(0,y,bz+D/2+.18),3.9,3.2)
        sign("BladeLetter",90,letter,(W/2+.18,y,bz),3.4,3.2)
        sign("BladeLetter",-90,letter,(-W/2-.18,y,bz),3.4,3.2)
    piece("BladeCrown",(W+1.0,.6,D+1.0),(0,56.3,bz),"Champagne")
    piece("BladeCrown",(W+.3,1.2,D+.3),(0,57.2,bz),"Midnight")
    piece("BladeCrown",(W-1.2,1.0,D-1.2),(0,58.3,bz),"Champagne")
    for px,pz in ((-3.2,-2.8),(0,-2.8),(3.2,-2.8),(3.2,0),(3.2,2.8),(0,2.8),(-3.2,2.8),(-3.2,0)):
        piece("LampChaser",(.5,.5,.5),(px,56.75,bz+pz),"Bulb","Ball")
    piece("BladeSpire",(1.6,2.4,1.6),(0,60.0,bz),"Lacquer")
    rod("BladeMast",(0,61.2,bz),(0,65.2,bz),.28,"Champagne")
    piece("BladeBeacon",(1.1,1.1,1.1),(0,65.7,bz),"Pink","Ball")

    def pavilion(name,side,zc,base,accent,title):
        group(name)
        xc=side*53
        slab("RoomFloor",(37.8,.24,30.7),(xc,-.10,zc),base)
        rearDepth=24.42 if zc>75 else 30.6
        rearZ=zc+2.90 if zc>75 else zc
        slab("WorkshopRear",(.85,13.25,rearDepth),(side*71.7,6.5,rearZ),base)
        for signz in (-1,1):
            edge = 9.29 if signz<0 and zc>75 else 15.05
            slab("WorkshopWall",(37.7,12.23,.73),(xc,6.02,zc+signz*edge),base)
            piece("DadoRail",(37.1,.22,.24),(xc,3.13,zc+signz*(edge-.48)),"Champagne")
            piece("Eaves",(37.9,.61,1.2),(xc,12.36,zc+signz*(edge-.11)),accent)
        front=side*34.3
        pane,cove = {"SoundWorkshop":("EveningPane","BlueCove"),"WritersLoft":("ApricotPane","Bulb"),
                     "CostumeAtelier":("BalletPane","RoseCove"),"PropsDepot":("ApricotPane","Honey")}[name]
        for signz in (-1,1):
            short = signz<0 and zc>75
            windowZ = zc+signz*(7.88 if short else 10.63)
            slab("FacadeWing",(1,11.4,3.38 if short else 9),(front,5.56,windowZ),base)
            slab("PortalPost",(1.34,12.76,1.04),(front-side*.26,6.25,zc+signz*6.02),"Limestone")
            piece("PortalGlazing",(.33,5.97,2.70 if short else 6.75),(front-side*.68,4.95,windowZ),pane)
            for band in (0,1):
                piece("PortalFilament",(.18,.16,2.62 if short else 6.56),(front-side*.93,2.45+band*5.01,windowZ),cove)
            for j in (-1,0,1):
                piece("PortalMullion",(.42,5.80,.14),(front-side*.87,4.95,windowZ+j*(.83 if short else 2.0)),"Champagne")
        slab("PortalLintel",(1.61,2.31,30.79),(front,12.12,zc),accent)
        piece("PortalEyebrow",(2.87,.24,31.42),(front-side*.56,13.36,zc),"Champagne")
        piece("PortalCove",(.19,.22,30.29),(front-side*1.86,13.19,zc),cove)
        heading=90 if side<0 else -90
        sign("ExteriorSign",heading,title,(front-side*.86,12.16,zc),19.55,1.71,accent)
        # A clerestory and shaded workbench enclose the far half while the open courtyard keeps camera sightlines clear.
        slab("MezzanineCanopy",(8.0,.42,30.54),(side*67.82,12.45,zc),accent)
        for signz in (-1,1):
            piece("RoofBeam",(32.3,.32,.42),(xc,12.44,zc+signz*9.8),"Brass")
            lamp(front-side*1.83,zc+signz*7.53)
        return heading

    heading=pavilion("SoundWorkshop",-1,53,"StudioPlaster","Midnight","STUDIO  B")
    anchor("VenueStudioB",(-51,3,53),90)
    sign("StudioBoard",heading,"SOUND REHEARSAL",(-70.9,8.02,53),14.55,1.82)
    # Enamel mixing desk with piano keys, fader bank and a playable-in-place practice station.
    slab("DeskBody",(3.67,2.39,10.3),(-57.4,1.22,53),"Copper")
    piece("DeskTrim",(3.87,.25,10.5),(-57.4,2.49,53),"Champagne")
    for i in range(12):
        piece("PracticeKey",(1.28,.18,.54),(-56.60,2.70,53+(i-5.5)*.62),"Cream")
        if i%3!=0: piece("SharpKey",(.76,.095,.25),(-56.92,2.83,53+(i-5.0)*.62),"Bakelite")
    for i in range(4):
        piece("MixSlider",(1.18,.13,.18),(-58.17,2.74,51+i*1.04),"Ink")
        piece("SliderCap",(.22,.19,.39),(-58.4+(i%3)*.24,2.82,51+i*1.04),"Pink" if i%2 else "Powder")
    for z in (44.3,61.7):
        slab("MonitorCab",(3.43,5.98,4.19),(-63.86,3.0,z),"Bakelite")
        for y,d in ((2.02,2.58),(4.44,1.37)):
            piece("StudioCone",(.37,d,d),(-61.99,y,z),"Copper","Cylinder")
            piece("StudioDustcap",(.41,d*.52,d*.52),(-61.77,y,z),"Midnight","Cylinder")
    for i in range(9):
        piece("AcousticSlat",(.4,6.27,1.22),(-70.97,4.02,42.5+i*2.55),"Cobalt" if i%3==0 else "Aubergine")
    sign("PracticeInstructions",heading,"PLAY THE THREE SOUND CUES",(-59.7,5.76,53),10.1,1.36)
    settee(-44,64,0,180)

    heading=pavilion("WritersLoft",-1,89,"Limestone","Lacquer","WRITERS' LOFT")
    anchor("VenueWriters",(-51,3,89),90)
    sign("WritersBoard",heading,"THE WRITERS' ROOM",(-70.9,8.57,89),15.4,1.89)
    slab("AuthorsTable",(6.51,.47,8.62),(-55.75,2.58,89),"Ochre")
    for dz in (-3,3):
        slab("TableLeg",(4.98,2.45,.5),(-55.75,1.21,89+dz),"Rosewood")
    for i in range(4):
        piece("CueStock",(1.58,.13,1.13),(-54.7,2.89+i*.12,89),"Cream",rot=rotation(-7+i*4,"Y"))
    slab("TypewriterCase",(2.69,.49,2.05),(-56.56,2.98,87.0),"Midnight")
    for row in range(3):
        for col in range(5):
            piece("TypeKey",(.25,.14,.22),(-57.4+col*.42,3.28,86.48+row*.36),"Bulb")
    piece("TypewriterSheet",(1.85,1.19,.07),(-56.56,3.80,87.65),"Cream",rot=rotation(10,"X"))
    sign("WritersHelp",heading,"BUILD A CUE CARD",(-59.88,5.02,89),9.35,1.43,"Lacquer")
    for dz in (-4.95,8):
        slab("BookcaseRear",(1.21,6.32,7.78),(-68.86,3.15,89+dz),"Rosewood")
        for row in range(3):
            piece("BookcaseShelf",(2.45,.18,7.95),(-68.37,.55+row*1.72,89+dz),"Ochre")
            for i,mat in enumerate(("Midnight","Brick","Powder","Seat","Teak","Lacquer","Lilac")):
                piece("BookSpine",(1.02,1.22+(i%3)*.11,.49),(-67.65,1.28+row*1.72,86.3+dz+i*.78),
                      "Ochre" if mat=="Teak" else mat)
    # A loft reading platform and sloped access path give the room a second traversable level.
    slab("ReadingLanding",(6.24,.43,8.0),(-60.62,3.40,98.02),"Ochre")
    walk=11.44
    dy=3.63
    slope=math.atan2(dy,walk)
    piece("ReadingRamp",(6.03,.35,math.hypot(walk,dy)),(-60.62,dy/2-.175,88.43),"Ochre",
          rot=rotation(-math.degrees(slope),"X"),solid=True)
    for x in (-63.8,-57.44):
        rod("ReadingHandrail",(x,1.77,82.71),(x,5.41,94.15),.19,"Brass")
        for t in (0,.5,1):
            post("Baluster",x,82.71+walk*t,dy*t,1.78,"Copper",.13)
    settee(-60.62,100.14,3.63,180)
    settee(-45.3,81.55,0)
    settee(-47.0,99.1,0,180)

    heading=pavilion("CostumeAtelier",1,89,"RosePlaster","Lacquer","COSTUME ATELIER")
    anchor("VenueAtelier",(51,3,89),-90)
    sign("AtelierBoard",heading,"THE FITTING ROOM",(70.87,8.65,89),15.26,1.87,"Lacquer")
    for dz in (-6.48,0,6.48):
        slab("VanityRecess",(.69,6.70,4.75),(68.6,4.10,89+dz),"Brass")
        piece("VanityMirror",(.22,5.83,4.0),(68.15,4.10,89+dz),"Mirror")
        for k in (-1,1):
            for j in (0,1,2):
                piece("VanityBulb",(.31,.31,.31),(68.0,2.24+j*1.82,89+dz+k*2.19),"Bulb","Ball")
        disk("Stool", (1.92,.41,1.92),(65.34,1.36,89+dz),"Seat",True)
        post("StoolStem",65.34,89+dz,0,1.2,"Brass",.39)
    for i,mat in enumerate(("Cobalt","Brick","Lilac")):
        z=85.55+i*3.38
        disk("DressBase",(2.12,.28,1.84),(57.84,.16,z),"Champagne",True)
        post("DressStem",57.84,z,.26,1.64,"Copper",.27)
        piece("DressSkirt",(2.08,1.77,1.44),(57.84,2.23,z),mat,"Ball")
        piece("DressForm",(1.38,2.04,1.0),(57.84,3.70,z),mat,"Ball")
        piece("DressCollar",(1.0,.22,.83),(57.84,4.51,z),"Champagne","Ball")
    sign("FittingHelp",heading,"CHOOSE YOUR SHOW LOOK",(58.89,6.37,89),11.85,1.30,"Lacquer")
    settee(44.0,99.0,0,180)

    heading=pavilion("PropsDepot",1,53,"Brick","Bakelite","PROPS DEPOT")
    anchor("VenueWarehouse",(51,3,53),-90)
    sign("DepotBoard",heading,"PROP DISPATCH",(70.87,8.42,53),13.26,1.95)
    for z in (42.6,64.7):
        for row in range(3):
            slab("SteelShelf",(11.03,.25,2.62),(64,1.30+2.24*row,z),"Midnight")
            for i in range(3):
                if row==1 and i==2: continue
                piece("StorageCrate",(2.65,1.24+(i%2)*.33,2.11),(60.5+i*3.44,2.11+row*2.24,z),
                      "Ochre" if (i+row)%2 else "Copper")
        for s in (-1,1):
            post("RackPost",64+s*5.40,z,0,7.12,"Midnight",.32)
    for name,x,z,px,pz in [("Bell",42,47,42,43.9),("Lantern",60,47,58.0,44.42),("Hat",60,61,58.0,63.7)]:
        anchor("Prop"+name,(x,3,z))
        disk("ObjectPlinth",(2.57,1.40,2.57),(px,.76,pz),"Midnight",True)
        disk("ExhibitTrim",(2.70,.20,2.70),(px,1.48,pz),"Champagne")
        if name=="Bell":
            piece("CounterBell",(1.76,1.34,1.72),(px,2.07,pz),"Brass","Ball")
            post("BellPost",px,pz,2.58,.47,"Champagne",.18)
            piece("BellButton",(.55,.18,.55),(px,3.05,pz),"Bakelite","Ball")
        elif name=="Lantern":
            piece("LanternGlass",(.95,1.32,.92),(px,2.30,pz),"Bulb")
            for side in (-1,1):
                post("LanternBar",px+side*.56,pz,1.62,1.48,"Copper",.11)
            piece("LanternHood",(1.41,.25,1.31),(px,3.03,pz),"Copper")
            post("LanternHook",px,pz,3.13,.44,"Brass",.11)
        else:
            disk("HatBrim",(1.95,.17,1.52),(px,1.72,pz),"Bakelite")
            disk("HatCrown",(1.25,1.22,1.25),(px,2.40,pz),"Midnight")
            disk("HatRibbon",(1.34,.20,1.34),(px,1.95,pz),"Lacquer")

    group("LanternFrontage")
    # Lantern Street slots (|x| 34..72): the workshop backs become stage-door frontage. The walls do not move;
    # everything collidable stays outside the streetcar envelope (z 70.5..78.5) or below 0.44 studs.
    def frontage(side,face,out,style,bays):
        heading=0 if out>0 else 180
        def at(u,y,d):
            return (side*(34.15+u),y,face+out*d)
        mid=side*53.0
        deep=2.135 if out>0 else 1.295
        slab("StagePavement",(37.7,.5,deep),(mid,.05,face+out*deep/2),"Paver")
        slab("StageKerb",(37.7,.52,.4),(mid,.06,face+out*(deep+.2)),"Limestone")
        piece("BaseCourse",(37.7,1.5,.24),(mid,1.05,face+out*.12),style["base"])
        piece("StringCourse",(37.7,.3,.4),(mid,8.0,face+out*.2),"Champagne")
        piece("FrontCornice",(37.9,.55,.7),(mid,11.45,face+out*.35),style["trim"])
        piece("FrontCornice",(37.9,.18,.95),(mid,11.82,face+out*.47),"Champagne")
        for u in (.6,9.9,19.0,28.1,37.1):
            piece("FrontPier",(.9,11.0,.3),at(u,6.0,.15),style["pier"])
        for u in (1.35,36.35):
            rod("Drainpipe",at(u,.3,.34),at(u,10.9,.34),.3,"Copper")
            piece("DrainHopper",(.72,.62,.62),at(u,11.0,.38),"Copper")
        for u in (9.9,28.1):
            piece("SconceBracket",(.2,.2,.75),at(u,6.6,.55),"Champagne")
            piece("LampSconce",(.62,.62,.62),at(u,6.65,.95),"Bulb","Ball")
        for i,(u,kind) in enumerate(zip((5.25,14.45,23.55,32.6),bays)):
            if kind=="door" and style.get("recording"):
                sign("RecordingLamp",heading,"QUIET — RECORDING",at(u,9.75,.18),3.4,1.7,"RedLamp","Bakelite")
                piece("RecordingBulb",(.5,.5,.5),at(u,11.0,.4),"RedLamp","Ball")
            elif kind!="-" and kind!="dock":
                piece("UpperSurround",(3.8,2.8,.18),at(u,9.75,.09),style["trim"])
                piece("UpperPane",(3.4,2.4,.12),at(u,9.75,.17),"WarmWindow" if style["lit"][i] else "EveningPane")
                piece("UpperMullion",(.12,2.4,.1),at(u,9.75,.26),"Champagne")
                piece("UpperSill",(4.0,.2,.42),at(u,8.45,.21),"Limestone")
            if kind=="door":
                aw=1.7 if out>0 else 1.4
                piece("DoorSurround",(3.6,7.1,.2),at(u,3.85,.1),"Champagne")
                piece("StageDoorLeaf",(2.8,5.9,.16),at(u,3.25,.2),style["door"])
                piece("DoorPanel",(2.1,2.2,.06),at(u,4.5,.3),style["trim"])
                piece("DoorTransom",(2.8,.8,.14),at(u,6.75,.2),"WarmWindow")
                piece("DoorHandle",(.24,.24,.24),at(u+.95,3.2,.33),"Brass","Ball")
                step=1.0 if out>0 else .7
                slab("DoorStep",(4.0,.3,step),at(u,.45,step/2),"Limestone")
                piece("DoorAwning",(4.8,.3,aw),at(u,7.6,aw/2),style["awning"])
                piece("AwningEdge",(4.8,.14,.1),at(u,7.42,aw),"Champagne")
                for k in (-1,1):
                    rod("AwningStay",at(u+k*2.1,9.4,.1),at(u+k*2.1,7.75,aw-.1),.09,"Champagne")
                piece("LampStageDoor",(.55,.3,.55),at(u,7.3,aw*.5),"Bulb","Ball")
                sign("StageDoorSign",heading,style["door_text"],at(u,8.15,aw-.18),4.4,.7,style["awning"])
            elif kind=="poster":
                poster_case(side*(34.15+u),4.75,face,out)
            elif kind=="window":
                piece("ShopSurround",(6.4,4.6,.2),at(u,4.2,.1),style["trim"])
                piece("WorkLight",(6.0,4.2,.1),at(u,4.2,.18),"WarmWindow")
                for k in (-1,1):
                    piece("GlazingBar",(.14,4.2,.1),at(u+k*2.0,4.2,.3),"Champagne")
                piece("GlazingBar",(6.0,.14,.1),at(u,5.3,.3),"Champagne")
                piece("ShopSill",(6.6,.25,.5),at(u,1.85,.25),"Limestone")
                for du,y,size,shape in style["silhouettes"]:
                    piece("WindowSilhouette",size,at(u+du,y,.26),"Bakelite",shape)
            elif kind=="dock":
                u=19.0
                piece("RollerShutter",(8.0,6.0,.14),at(u,3.6,.08),"Shutter")
                for k in range(6):
                    piece("ShutterRib",(8.0,.08,.06),at(u,1.2+k*1.0,.17),"Bakelite")
                for k in (-1,1):
                    piece("ShutterGuide",(.3,6.2,.3),at(u+k*4.15,3.6,.15),"Champagne")
                piece("ShutterHood",(8.9,.9,.7),at(u,7.0,.35),"Champagne")
                sign("DockSign",heading,"LOADING DOCK",at(u,7.0,.88),6.2,.7,"Midnight")
                slab("DockDeck",(15.0,.6,1.8),at(u,.6,.9),"TreadPlate")
                for k in (-1,1):
                    slab("DockStep",(.9,.3,1.8),at(u+k*7.95,.45,.9),"TreadPlate")
                    piece("DockBumper",(.7,.55,.22),at(u+k*3.0,.6,1.92),"Black")
                for du,y,s3,mat in ((-6.0,1.65,1.5,"CrateWood"),(-4.45,1.55,1.3,"CrateWood"),(-5.6,3.0,1.2,"Ochre"),
                                    (5.7,1.7,1.6,"CrateWood"),(4.15,1.45,1.1,"Ochre")):
                    piece("PropCrate",(s3,s3,s3),at(u+du,y,.85),mat)
                for du in (-6.0,5.7):
                    piece("CrateBand",(.18,1.62,1.62),at(u+du,1.7,.85),"Cream")
                rod("HoistBeam",at(u-2.6,8.7,0),at(u-2.6,8.7,1.9),.3,"Midnight")
                rod("HoistChain",at(u-2.6,8.6,1.7),at(u-2.6,7.4,1.7),.08,"Bakelite")
                piece("HoistHook",(.35,.45,.35),at(u-2.6,7.25,1.7),"Brass","Ball")
                piece("LampDock",(.6,.6,.6),at(u+3.6,8.6,.45),"Bulb","Ball")

    frontage(-1,68.415,1,{"base":"Midnight","pier":"Marble","trim":"Cobalt","door":"Lacquer","awning":"Midnight",
             "door_text":"STUDIO B  •  STAGE DOOR","recording":True,"lit":(False,True,False,True),
             "silhouettes":[(0,y,(5.8,.16,.08),"Block") for y in (3.1,4.2,6.0)]},
             ("door","poster","poster","window"))
    frontage(-1,79.345,-1,{"base":"Rosewood","pier":"Lacquer","trim":"Lacquer","door":"Rosewood","awning":"Lacquer",
             "door_text":"WRITERS' ROOM","lit":(True,False,True,True),
             "silhouettes":[(-1.4,2.75,(1.7,.9,.1),"Block"),(-1.0,3.6,(.3,.9,.1),"Block"),(1.2,2.6,(1.0,.5,.1),"Block")]},
             ("window","poster","poster","door"))
    frontage(1,68.415,1,{"base":"Limestone","pier":"Limestone","trim":"Bakelite","lit":(True,False,True,False),
             "silhouettes":[]},("poster","dock","-","poster"))
    frontage(1,79.345,-1,{"base":"Marble","pier":"Marble","trim":"Lacquer","door":"Midnight","awning":"Lacquer",
             "door_text":"WARDROBE  •  STAGE DOOR","lit":(True,True,False,True),
             "silhouettes":[(-1.3,3.2,(1.3,2.4,.12),"Ball"),(1.5,3.3,(1.2,2.5,.12),"Ball")]},
             ("door","poster","poster","window"))
    # Zig-zag festoons cross each slot well above the streetcar roof.
    for side in (-1,1):
        pts=[(8.0,68.9),(14.0,79.0),(20.0,68.9),(26.0,79.0),(32.0,68.9)]
        for j,((ua,za),(ub,zb)) in enumerate(zip(pts,pts[1:])):
            a=(side*(34.15+ua),za)
            b=(side*(34.15+ub),zb)
            def sag(t,a=a,b=b):
                return (a[0]+(b[0]-a[0])*t,10.7-1.25*math.sin(math.pi*t),a[1]+(b[1]-a[1])*t)
            for k in range(4):
                rod("FestoonWire",sag(k/4),sag((k+1)/4),.07,"Bakelite")
            for k in (1,2,3):
                x,y,z=sag(k/4)
                piece("StringBulb",(.42,.5,.42),(x,y-.3,z),("Bulb","RoseCove","BlueCove")[(j+k)%3],"Ball")

    group("SkyLounge")
    anchor("VenueBalcony",(0,8,118))
    slab("TerraceDeck",(53.2,1.10,28.9),(0,4.45,119.91),"Limestone")
    slab("TerracePodium",(51.3,4.12,28.1),(0,2.0,119.91),"Brick")
    # A continuous 23-stud wheelchair-friendly approach keeps the active floor reachable without jumping.
    start,end=83.8,106.8
    rise=5.05
    slope=math.atan2(rise,end-start)
    piece("TerraceRamp",(12.6,.50,math.hypot(end-start,rise)),(0,rise/2-.25*math.cos(slope),(start+end)/2),
          "Limestone",rot=rotation(-math.degrees(slope),"X"),solid=True)
    for s in (-1,1):
        x=s*6.43
        rod("RampRail",(x,2.39,start),(x,7.43,end),.25,"Champagne")
        for k in range(5):
            t=k/4
            post("RampUpright",x,start+(end-start)*t,rise*t,2.38,"Copper",.18)
    for endx in (-26.1,26.1):
        slab("TerraceBalustrade",(.49,2.02,28.42),(endx,6.03,119.91),"Midnight")
        piece("TerraceCap",(.72,.20,28.57),(endx,7.12,119.91),"Champagne")
    # The south parapet opens on the x=0 axis into a grand stair down to the Night Market arch, so the
    # terrace becomes an overlook on a through route. Ten 0.5-stud risers, 1.2-stud treads (about 23 degrees).
    gap=4.3
    seg=26.25-gap
    for s in (-1,1):
        slab("TerraceParapet",(seg,2.15,.54),(s*(gap+seg/2),6.1,133.79),"Midnight")
        piece("ParapetCap",(seg+.13,.21,.76),(s*(gap+seg/2),7.26,133.79),"Champagne")
        slab("StairNewel",(.95,3.0,.95),(s*(gap+.1),6.5,133.9),"Marble")
        piece("NewelCap",(1.15,.25,1.15),(s*(gap+.1),8.1,133.9),"Champagne")
        piece("LampGlobe",(.85,.85,.85),(s*(gap+.1),8.62,133.9),"Bulb","Ball")
    top,tread,first=5.0,1.2,134.36
    for k in range(1,10):
        y=top-.5*k
        front=first+tread*k
        slab("GrandStair",(7.6,y+.2,front-133.96),(0,(y-.2)/2,(133.96+front)/2),"Limestone")
        piece("StairNosing",(7.6,.06,.14),(0,y+.01,front-.08),"Brass")
    foot=first+tread*9
    slab("StairLanding",(9.4,.3,2.6),(0,-.15,foot+1.3),"Paver")
    run=foot-first
    slope=math.degrees(math.atan2(4.5,run))
    for s in (-1,1):
        x=s*4.05
        piece("StairCheek",(.5,1.7,math.hypot(run,4.5)+.6),(x,(5.0+.5)/2+.35,(first+foot)/2),"Midnight",
              rot=rotation(slope,"X"),solid=True)
        rod("StairRail",(x,7.5,first-.2),(x,3.0,foot),.22,"Champagne")
        for t in (.2,.5,.8):
            zz=first+run*t
            post("StairBaluster",x,zz,5.0-4.5*t+.85,1.5,"Copper",.13)
        slab("StairFootNewel",(.95,2.6,.95),(x,1.3,foot+.3),"Marble")
        piece("NewelCap",(1.15,.25,1.15),(x,2.72,foot+.3),"Champagne")
        piece("LampGlobe",(.85,.85,.85),(x,3.25,foot+.3),"Bulb","Ball")
    for side in (-1,1):
        slab("FrontParapet",(18.40,2.03,.57),(side*16.96,6.04,106.1),"Midnight")
        lamp(side*22.33,130.55,5)
        shrub(side*20.1,109.75,5)
    for x in (-18.9,-12.3):
        settee(x,126.1,5,180)
    # Pavilion with brass ribs on the west side leaves the east portrait stage and central vistas clear.
    for x in (-23.37,-9.78):
        for z in (118.5,130.2):
            post("PergolaColumn",x,z,5,7.10,"Copper",.37)
    for i in range(7):
        piece("PergolaSlat",(14.54,.24,.46),(-16.6,12.22,118.5+i*1.96),"Champagne")
    sign("LoungeFascia",180,"SKY LOUNGE",(-16.6,11.45,118.40),10.22,1.47,"Midnight")
    group("TheatreRoof")
    for x in (-22,22):
        slab("RooftopPavilion",(9.2,2.64,13.4),(x,25.65,8.3),"Midnight",False)
        piece("RoofPavilionCrown",(9.67,.37,13.85),(x,27.13,8.3),"Copper")
        for j in range(3):
            piece("RooftopLouvre",(6.70,.19,.12),(x,25.15+j*.52,15.11),"Bakelite")
    disk("AntennaDrum",(9.24,1.76,9.24),(0,25.20,-7),"Copper")
    disk("AntennaCollar",(8.33,.45,8.33),(0,26.32,-7),"Champagne")
    for dx,dz in ((-2.65,-2.28),(2.65,-2.28),(0,2.79)):
        rod("MastStrut",(dx,26.46,-7+dz),(0,38.2,-7),.39,"Brass")
    for i in range(3):
        radius=2.26-i*.58
        pts=[(-radius,-radius*.83),(radius,-radius*.83),(0,radius)]
        for j in range(3):
            a,b=pts[j],pts[(j+1)%3]
            rod("MastBrace",(a[0],28.6+i*2.82,-7+a[1]),(b[0],28.6+i*2.82,-7+b[1]),.17,"Champagne")
    piece("Beacon",(.94,1.05,.94),(0,38.63,-7),"Pink","Ball")
    group("CitySkyline")
    # Outlying streets and silhouetted blocks give the public terrace a city horizon from every approach.
    piece("DistantBoulevard",(417,1.1,510),(76.5,-1.72,49),"Tile")
    for i in range(12):
        x=(i-5.5)*14.4
        height=(12,19,16,24,15,28,22,18,25,17,14,21)[i]
        z=-61-(i%3)*4.8
        piece("DistantBlock",(10.9,height,8.7),(x,height/2-1,z),"Midnight" if i%3 else "Violet")
        piece("DistantCrown",(8.10,2.22,6.35),(x,height,z),"Cobalt")
        for j in range(3):
            piece("DistantWindows",(5.61,.46,.18),(x,height-3.39-j*2.68,z+4.44),"Powder" if (i+j)%3 else "Bulb")
    # Leave the western water horizon open. The borough skyline remains east of the park.
    for i in range(8):
        height=(14,11,19,17,24,13,15,20)[i]
        x=192.0+i%3*3.85
        z=-39.0+i*23
        piece("OuterTenement",(8.48,height,11.45),(x,height/2-1,z),"Violet" if i%3 else "Midnight")
        piece("OuterBalcony",(8.86,.35,11.98),(x,height*.77,z),"Copper")
        for j in range(2):
            piece("OuterWindows",(.17,.41,6.19),(x-4.32,height*(.58+j*.22),z),"Powder")
    for i,(height,width) in enumerate(((15,7),(23,8),(17,7),(29,9),(19,7),(24,8),(18,6),(26,8),(20,9),(16,6))):
        x=(i-4.5)*14.1
        z=222.7+(i%3)*3.32
        piece("SkylineTower",(width,height,5.92),(x,height/2,z),"Midnight")
        piece("SkylineStep",(width*.72,2.65,4.44),(x,height+1.27,z),"Cobalt")
        if i%3==1: post("RoofAerial",x,z,height+2.56,3.36,"Brass",.20)
        for j in range(3):
            piece("NightWindows",(width*.48,.50,.15),(x,height-2.23-2.82*j,z-3.04),"Bulb" if (i+j)%3==0 else "Powder")
