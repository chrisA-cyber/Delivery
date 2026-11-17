"""Playable town blocks built in local storefront coordinates. Positive depth goes into a shop."""
import math


def build_town(group, piece, rod, disk, rotation, anchor, sign):
    def storefront(x,z,facing):
        angle=math.radians(facing)
        c,s=math.cos(angle),math.sin(angle)
        turn=rotation(facing,"Y")
        def pt(u,y,d):
            return (x+u*c-d*s,y,z-u*s-d*c)
        def block(name,size,u,y,d,mat,solid=False,extra=None,shape="Block"):
            piece(name,size,pt(u,y,d),mat,shape,turn @ extra if extra is not None else turn,solid)
        def beam(name,a,b,gauge,mat):
            rod(name,pt(*a),pt(*b),gauge,mat)
        def badge(name,text,u,y,d,width,height,color="Midnight",add=0):
            sign(name,facing+add,text,pt(u,y,d),width,height,color)
        def flat(name,u,y,d,w,h,mat,solid=False):
            disk(name,(w,h,w),pt(u,y,d),mat,solid)
        def circle(name,u,y,d,w,h,mat):
            block(name,(h,w,w),u,y,d,mat,extra=rotation(90,"Y"),shape="Cylinder")
        return pt,block,beam,badge,flat,circle

    def street_tree(x,z,mat):
        disk("PlanterFoot",(3.34,.65,3.34),(x,.33,z),"Brick",True)
        disk("PlanterRim",(3.60,.29,3.60),(x,.72,z),"Limestone")
        piece("YoungTrunk",(.43,3.69,.43),(x,2.57,z),"Ochre",solid=True)
        for s in (-1,1):
            rod("OrchardFork",(x,3.36,z),(x+s*.95,5.1,z+.24),.28,"Ochre")
            piece("StreetFoliage",(2.99,2.9,2.96),(x+s*.97,5.74,z),mat,"Ball")
        piece("StreetFoliage",(3.67,3.20,3.66),(x,6.60,z-.21),mat,"Ball")

    def wall_window(block,u,y,d,w,mat):
        block("WindowLintel",(w+.30,3.23,.24),u,y,d,"Champagne")
        block("WindowEnamel",(w,2.91,.18),u,y,d-.23,mat)
        block("WindowSash",(.16,2.89,.13),u,y,d-.34,"Limestone")
        block("SashRail",(w,.13,.12),u,y+.48,d-.35,"Limestone")
        block("WindowLedge",(w+.44,.24,.57),u,y-1.59,d-.11,"Limestone")

    def architecture(name,anchor_name,x,z,face,width,depth,wall,trim,pane,title,awning,levels,arrival_depth=9):
        group(name)
        pt,b,beam,badge,flat,circle=storefront(x,z,face)
        p=(pt,b,beam,badge,flat,circle)
        # A shared raised curb is below one standard footstep, including the entrance threshold.
        b("TownSidewalk",(width+2.9,.25,5.52),0,.02,-2.42,"Limestone",True)
        b("ShopFloor",(width,.30,depth),0,0,depth/2,"DeckPlank" if name=="DocksidePost" else "Limestone",True)
        b("DoorMat",(6.44,.065,2.96),0,.19,.3,trim)
        for side in (-1,1):
            u=side*(width/2-.25)
            b("PartyWall",(.56,10.74,depth),u,5.39,depth/2,wall,True)
            # Open street windows reveal actual shelving and merchandise.
            wing=(width-9.00)/2
            mid=side*(4.5+wing/2)
            b("ShopfrontSill",(wing,2.14,.54),mid,1.14,0,wall,True)
            b("WindowCounter",(wing+.24,.32,1.55),mid,2.37,-.10,trim,True)
            for column in (side*4.50,side*(width/2-.49)):
                b("DoorJamb",(.56,8.81,.73),column,4.57,0,trim,True)
                b("JambInset",(.18,7.80,.13),column,4.72,-.46,"Champagne")
            b("DisplayMullion",(.18,5.09,.24),mid,4.94,0,trim)
            b("PaneTransom",(wing,.23,.27),mid,6.45,0,trim)
        b("ShopBack",(width,10.7,.68),0,5.38,depth-.32,wall,True)
        b("FrontLintel",(width,1.06,.80),0,8.79,0,wall,True)
        b("ShopCeiling",(width+.35,.51,depth+.20),0,10.80,depth/2-.02,trim,True)
        b("UpperCornice",(width+.72,.41,depth+.59),0,11.08,depth/2-.05,"Limestone")
        badge("BusinessMarquee",title,0,9.72,-.51,width-1.05,1.71,trim)
        if name=="DocksidePost":
            # The institutional post office has a limestone door hood and brass rail, with masonry quoins.
            for j,(w,h,d,mat) in enumerate([(12.75,.37,2.40,"Limestone"),(11.60,.34,2.12,trim),(10.44,.25,1.76,"Champagne")]):
                b("PostalDoorHood",(w,h,d),0,8.27+j*.28,-.85,mat)
            for side in (-1,1):
                b("PostalPilaster",(.78,8.06,.66),side*5.37,4.22,-.47,"Limestone")
                b("PostalCapital",(1.28,.39,.89),side*5.37,8.17,-.52,"Champagne")
                for j in range(5):
                    b("StoneQuoin",(.96,.42,.53),side*(width/2-.62),.75+j*1.54,-.45,"Limestone")
                b("PostalWindowHood",(5.80,.38,1.30),side*8.55,7.73,-.38,"Limestone")
            b("PostalDoorFillet",(12.57,.13,.14),0,8.14,-2.04,"Brass")
        elif name=="NeedleDrop":
            # Long angular speaker baffles and a neon groove cross the independent record store.
            b("RecordBlade",(width+.48,.54,2.03),0,8.12,-.64,"Bakelite")
            b("RecordBladeEdge",(width+.16,.11,.13),0,8.33,-1.70,"BlueCove")
            for j,h in enumerate((.42,.73,1.08,1.32,.91,.56,.72,.46)):
                b("WaveformBar",(.18,h,.11),-8.68+j*.50,4.40,-.26,"RoseCove" if j%3==0 else "BlueCove")
            for side in (-1,1):
                beam("CanopyStrut",(side*7.45,8.91,.16),(side*7.45,8.17,-1.58),.16,"Champagne")
            circle("ProjectedRecord",7.56,6.50,-.79,2.77,.28,"Bakelite")
            circle("ProjectedLabel",7.56,6.50,-1.04,.88,.16,"RoseCove")
        elif name=="CopperKettle":
            # Sewn canvas, a folded straight valance and two external braces shelter the pavement tables.
            for i in range(11):
                u=(i-5)*(width-.78)/11
                fabric=awning if i%2==0 else "IvoryCanvas"
                b("BakeryAwning",((width-.65)/11+.055,.25,3.19),u,8.09,-1.15,fabric,extra=rotation(-10,"X"))
                b("FoldedCanvas",((width-.70)/11+.045,.51,.21),u,7.65,-2.68,fabric)
            for side in (-1,1): beam("AwningBrace",(side*8,6.89,-.34),(side*8,7.72,-2.55),.15,"Copper")
        else:
            # A clean gallery portico frames the entry, with an actual miniature print hung in its left window.
            b("GalleryCanopy",(11.64,.32,2.47),0,8.23,-.71,"Cream")
            b("GalleryCanopyTrim",(11.77,.12,2.58),0,8.02,-.71,"Copper")
            for side in (-1,1):
                for i in range(3):
                    b("PortalFins",(.13,7.23,.45),side*(4.63+i*.24),4.62,-.37,"Champagne")
            b("FeaturePrintFrame",(2.79,3.47,.24),-7.70,4.77,-.04,"Midnight")
            b("FeaturePrint",(2.52,3.17,.12),-7.70,4.77,-.22,"IvoryCanvas")
            circle("FeatureSun",-7.93,5.24,-.32,1.09,.08,"Petal")
            for j in range(3):
                b("FeatureHills",(.53,1.02+j*.28,.065),-8.18+j*.50,4.20,-.33,"Cobalt",
                  extra=rotation(20,"Z"))
        for side in (-1,1):
            u=side*(width/2-.75)
            b("StreetSconce",(.53,1.18,.52),u,5.74,-.43,"Bulb")
            b("SconceCap",(.78,.24,.69),u,6.39,-.42,trim)
        for floor in range(levels):
            y=11.27+floor*4.70
            body_width=width-1.4-floor*1.22
            b("UpperStorey",(body_width,4.62,depth-1.6-floor*.85),0,y+2.20,depth/2+.09,wall,True)
            for i in range(3):
                u=(i-1)*(body_width*.30)
                wall_window(b,u,y+2.10,1+floor*.42,3.50,pane)
            b("StringCourse",(body_width+.58,.39,depth-1.10-floor*.85),0,y+4.49,depth/2+.06,trim)
        roof=11.3+levels*4.7
        b("RoofCoping",(width-.13,.36,depth+.04),0,roof,depth/2,"Limestone")
        b("RoofHatch",(3.93,1.38,3.10),-width*.25,roof+.82,depth*.69,trim)
        b("RoofVent",(1.31,2.17,1.35),width*.30,roof+1.19,depth*.78,"Copper")
        b("VentHat",(1.91,.24,1.88),width*.30,roof+2.38,depth*.78,trim)
        anchor(anchor_name,pt(0,3.15,arrival_depth),face)
        return p,roof

    def parcels(b,u,y,d,index=0):
        mat=("Ochre","ApricotPane","Powder")[index%3]
        b("WrappedBox",(1.57,.87,1.19),u,y,d,mat)
        b("ParcelCord",(.14,.93,1.22),u+.22,y,d,"Cream")
        b("AddressSlip",(.54,.06,.38),u-.30,y+.46,d-.20,"Cream")

    def counter(b,width,d,mat):
        b("CounterCase",(width,2.55,2.65),0,1.49,d,mat,True)
        b("CounterTop",(width+.33,.28,2.97),0,2.92,d,"Champagne",True)
        b("CounterKick",(width-.53,.25,.13),0,.42,d-1.40,"Bakelite")

    kit,roof=architecture("DocksidePost","VenuePost",-87,65,0,22.2,19.2,"Brick","Midnight","ApricotPane",
                           "D O C K S I D E   P O S T","Cobalt",2)
    pt,b,beam,badge,flat,circle=kit
    counter(b,12.6,13.2,"Midnight")
    badge("SortingHall","PARCELS  •  COLLECTIONS",0,8.1,18.4,15,1.26)
    b("SortingRack",(13.83,4.74,1.28),0,4.42,18.3,"Ochre",True)
    for col in range(6):
        for row in range(2):
            u=(col-2.5)*2.12
            b("Pigeonhole",(1.95,1.34,.19),u,3.50+row*1.84,17.59,"Bakelite")
            b("SortedLetter",(1.13,.42,.34),u,3.18+row*1.84,17.43,"Cream",
              extra=rotation((col%3-1)*11,"Z"))
    for i,(u,d) in enumerate([(-3.5,12.8),(-1.75,13.45),(2.5,13.18)]):
        parcels(b,u,3.50,d,i)
    flat("ParcelScale",4.45,3.15,12.87,1.95,.23,"Bakelite")
    b("ScaleUpright",(.34,1.34,.38),4.45,3.90,13.30,"Brass")
    circle("ScaleFace",4.45,4.57,13.15,1.36,.23,"Cream")
    b("ScaleHand",(.14,.49,.07),4.56,4.72,12.98,"Midnight",extra=rotation(-32,"Z"))
    b("HandcartBed",(3.2,.30,3.98),-8.18,.83,9.27,"Ochre",True)
    for u in (-9.48,-6.84):
        b("CartWheel",(.28,1.19,1.19),u,.69,8.26,"Bakelite",shape="Cylinder")
        beam("CartHandle",(u,1.05,10.54),(u,2.19,11.08),.18,"Champagne")
    for i in range(3): parcels(b,-8.18,.97+i*.88,9.22,i)
    # Clock and stepped pediment are visible from both the wharf and the tram.
    for i in range(3): b("PostalPediment",(8.7-i*1.94,.73,.85),0,roof+.55+i*.65,.58,"Midnight")
    circle("ClockRim",0,roof+.82,-.04,3.65,.36,"Champagne")
    circle("ClockDial",0,roof+.82,-.25,3.17,.16,"Cream")
    for i in range(8):
        a=math.tau*i/8
        b("ClockIndex",(.13,.31,.06),1.25*math.sin(a),roof+.82+1.25*math.cos(a),-.36,"Midnight",
          extra=rotation(-i*45,"Z"))
    beam("ClockHand",(0,roof+.82,-.40),(-.59,roof+1.47,-.40),.11,"Midnight")
    beam("ClockHand",(0,roof+.82,-.40),(.85,roof+1.10,-.40),.095,"Midnight")

    kit,roof=architecture("NeedleDrop","VenueRecords",85,82,180,20.65,19.8,"Midnight","Cobalt","EveningPane",
                           "N E E D L E   D R O P","Cobalt",1,8)
    pt,b,beam,badge,flat,circle=kit
    counter(b,12.25,13.45,"Rosewood")
    badge("ListeningBar","THE LISTENING BAR",0,8.37,18.98,13.2,1.55,"Cobalt")
    for u,mat in [(-3.25,"RoseCove"),(3.25,"BlueCove")]:
        b("ListeningDeck",(4.20,.49,2.34),u,3.29,13.16,"Bakelite")
        flat("TurntablePlatter",u-.25,3.61,13.17,2.07,.12,"Ink")
        flat("CenterLabel",u-.25,3.70,13.17,.68,.08,mat)
        beam("ToneArm",(u+1.44,3.71,13.83),(u+.36,3.82,13.11),.115,"Champagne")
    for idx in range(6):
        u=(idx-2.5)*2.42
        cover=("Petal","Ochre","Cobalt","Powder","Brick","Lilac")[idx]
        b("AlbumSleeve",(2.07,2.08,.23),u,5.46,18.87,cover)
        circle("RecordSilhouette",u,5.46,18.69,1.34,.12,"Bakelite")
        circle("Label",u,5.46,18.60,.49,.10,"Cream")
    for side in (-1,1):
        b("StudioMonitor",(1.87,3.26,1.23),side*7.51,3.08,15.90,"Bakelite",True)
        for y,diam in [(2.49,1.16),(3.83,.69)]:
            circle("SpeakerCone",side*7.51,y,15.20,diam,.15,"Powder")
        for j in range(5):
            b("AcousticFin",(.28,4.53,.40),side*(8.35-j*.35),5.78,18.97,"Ochre")
    b("ListeningSeat",(4.63,.71,1.56),6.59,1.15,5.35,"Leather",True)
    b("ListenBack",(4.63,1.24,.40),6.59,2.10,6.03,"Leather",True)
    circle("RooftopRecordRim",0,roof+2.13,.21,5.84,.52,"Champagne")
    circle("GiantRecord",0,roof+2.13,-.14,5.48,.28,"Bakelite")
    circle("CentreSticker",0,roof+2.13,-.37,2.07,.18,"RoseCove")
    beam("RooftopToneArm",(3.7,roof+.14,-.21),(1.05,roof+2.53,-.42),.24,"Champagne")

    kit,roof=architecture("CopperKettle","VenueCafe",-43,121,90,20.8,22.0,"Brick","Lacquer","ApricotPane",
                           "C O P P E R   K E T T L E","Ochre",2)
    pt,b,beam,badge,flat,circle=kit
    counter(b,13.49,13.41,"Ochre")
    badge("CafeMenu","BREAD  /  PASTRIES  /  COFFEE",0,8.33,21.00,15.88,1.60,"Lacquer")
    b("OvenBody",(6.2,5.18,2.62),-4.25,2.94,19.66,"Brick",True)
    b("OvenSurround",(4.62,2.61,.32),-4.25,3.36,18.24,"Champagne")
    b("OvenMouth",(4.13,2.16,.29),-4.25,3.40,18.01,"Ink")
    b("HearthGlow",(3.24,.38,.12),-4.25,2.64,17.84,"Honey")
    for j in range(5):
        u=-4.84+j*1.19
        b("BakedBaguette",(1.04,.69,1.80),u,3.38,13.10,"Ochre",extra=rotation(11*j,"Y"),shape="Ball")
        for k in (-1,1):
            b("FlourScore",(.13,.07,.61),u+k*.16,3.65,13.08+k*.21,"Cream",extra=rotation(-28,"Y"))
    b("EspressoBoiler",(2.78,1.54,1.56),4.07,3.95,13.27,"Copper",shape="Ball")
    b("CupRail",(2.77,.26,1.81),4.03,3.22,12.91,"Bakelite")
    for u in (3.45,4.63):
        flat("CafeCup",u,3.42,12.46,.54,.54,"Cream")
        beam("SteamNozzle",(u,4.04,12.60),(u,3.73,12.46),.12,"Champagne")
    for side in (-1,1):
        u=side*7.69
        flat("CafeTable",u,2.30,6.14,2.42,.20,"Ochre",True)
        flat("TableBase",u,.24,6.14,1,.30,"Copper")
        b("TableStem",(.28,2.10,.28),u,1.14,6.14,"Copper")
        for d in (4.31,7.89):
            flat("CafeStool",u,1.03,d,1.28,.30,"Leather",True)
            b("StoolLeg",(.30,.93,.30),u,.49,d,"Copper")
    for i in range(3): b("OvenStack",(2.83-i*.37,3.52,2.63-i*.28),-5.8,roof+1.82+i*2.38,15.76,"Brick")
    b("ChimneyCrown",(2.86,.52,2.75),-5.8,roof+8.44,15.76,"Limestone")
    # A copper tea kettle is the roofline sign.
    b("KettleBody",(3.85,2.67,2.60),.22,roof+1.56,.81,"Copper",shape="Ball")
    flat("KettleLid",.22,roof+2.89,.81,2.14,.23,"Champagne")
    beam("KettleSpout",(-1.25,roof+1.58,.76),(-2.69,roof+2.66,.76),.47,"Copper")
    beam("SteamHandle",(1.44,roof+1.50,.76),(2.37,roof+2.49,.76),.27,"Champagne")

    kit,roof=architecture("PocketGallery","VenueGallery",43,130,-90,21.6,20.6,"Limestone","Midnight","BalletPane",
                           "P O C K E T   P R I N T S","Petal",1)
    pt,b,beam,badge,flat,circle=kit
    counter(b,9.76,13.91,"Midnight")
    badge("EditionsSign","THE POSTCARD PRESS",0,8.21,20.04,13.50,1.45)
    b("PressBed",(4.74,.34,2.30),0,3.24,13.79,"Copper")
    for side in (-1,1):
        b("PressUpright",(.39,2.25,.40),side*1.92,4.35,13.89,"Midnight")
        b("InkRoller",(.37,1.14,1.14),side*2.03,4.55,13.87,"Champagne",shape="Cylinder")
    b("PressCrosshead",(4.14,.48,.79),0,5.27,13.87,"Midnight")
    beam("PressLever",(1.94,4.82,13.82),(2.85,5.80,13.10),.14,"Champagne")
    b("PrintedSheet",(2.48,.07,1.67),-.21,3.46,13.62,"Cream",extra=rotation(-9,"Y"))
    for i,(u,mat) in enumerate([(-6.27,"Lilac"),(-2.18,"Cobalt"),(2.18,"Ochre"),(6.27,"Petal")]):
        b("EditionFrame",(3.39,3.67,.38),u,5.35,20.03,"Champagne")
        b("EditionPaper",(3.04,3.31,.17),u,5.35,19.79,"Cream")
        b("EditionField",(2.41,2.56,.11),u,5.38,19.64,mat)
        if i%2:
            circle("PrintMoon",u+.39,5.81,19.55,.82,.055,"Cream")
            for k in (-1,0,1): b("PrintTower",(.40,1.01+k*.18,.07),u+k*.48,4.87,19.54,"Midnight")
        else:
            for k in (-1,0,1): b("LinocutStroke",(.23,1.72,.06),u+k*.54,5.37,19.54,"IvoryCanvas",extra=rotation(27,"Z"))
    b("GalleryBench",(5.26,.46,1.59),7.56,1.43,6.81,"Ochre",True)
    for u in (5.53,9.59): b("GalleryBenchLeg",(.38,1.34,1.23),u,.72,6.81,"Bakelite",True)
    for i,mat in enumerate(("Petal","Cobalt","Champagne")):
        b("GraphicRoofFin",(1.26,3.26+i*.57,.64),(i-1)*1.61,roof+1.98+i*.14,.71,mat,extra=rotation(-16,"Z"))

    group("TownTerraces")
    def terrace(x,z,facing,width,depth,height,wall,trim,pane,title):
        pt,b,beam,badge,flat,circle=storefront(x,z,facing)
        b("TownPavement",(width+1.1,.23,3.65),0,.03,-1.44,"Limestone",True)
        b("TerraceMass",(width,height,depth),0,height/2+.13,depth/2,wall,True)
        b("ArcadeStrip",(width+.33,.35,.80),0,7.92,-.13,trim)
        badge("TenantSign",title,0,6.85,-.40,width-1.21,1.18,trim)
        b("TerraceDoor",(2.55,4.97,.32),0,2.72,-.22,trim)
        b("DoorPane",(1.89,2.07,.10),0,3.54,-.43,pane)
        b("BrassKnob",(.22,.22,.16),.75,2.35,-.45,"Champagne",shape="Ball")
        for side in (-1,1):
            wall_window(b,side*width*.29,3.10,-.14,width*.21,pane)
            wall_window(b,side*width*.26,height-2.25,-.18,width*.27,pane)
        b("BalconyDeck",(width*.79,.35,1.71),0,height-3.96,-.76,trim)
        for j in range(5):
            u=(j-2)*width*.15
            beam("BalconyIron",(u,height-3.79,-1.48),(u,height-2.88,-1.48),.10,"Brass")
        beam("BalconyRail",(-width*.38,height-2.86,-1.48),(width*.38,height-2.86,-1.48),.13,"Champagne")
        b("Parapet",(width+.57,.49,depth+.50),0,height+.25,depth/2,trim)
        b("Penthouse",(width*.61,2.12,depth*.42),-width*.08,height+1.46,depth*.62,wall)
        b("PenthouseCap",(width*.69,.24,depth*.50),-width*.08,height+2.67,depth*.62,trim)
        for side in (-1,1):
            b("FlowerBox",(width*.19,.39,.58),side*width*.27,height-3.64,-.49,"Ochre")
            b("WindowBlossoms",(width*.19,.46,.65),side*width*.27,height-3.32,-.51,"Petal",shape="Ball")
    terrace(-106.0,64.4,0,13.6,11.8,13.3,"Limestone","Cobalt","EveningPane","FERRY TICKETS")
    terrace(-92,85.4,180,15.3,14.0,15.6,"Powder","Midnight","ApricotPane","HARBOR ROOMS")
    terrace(-108.0,87.0,180,13.1,15.4,12.7,"Brick","Lacquer","ApricotPane","ROPE & SAIL")
    terrace(85.25,62.85,0,17.5,12.5,14.68,"Ochre","Midnight","EveningPane","LANTERN NEWS")
    terrace(-43.7,141.65,90,13.46,16.5,14.07,"Powder","Midnight","EveningPane","THE BLUE HERON")
    terrace(43.65,109.95,-90,12.02,13.87,14.78,"Brick","Lacquer","ApricotPane","PAPER HOUSE")
    terrace(43.65,145.03,-90,6.80,13.86,12.44,"Powder","Midnight","BalletPane","FLOWER ROOM")

    group("TownStreetDetails")
    # Opposite the Market Walk shops, the terrace foundation becomes an inhabited frontage.
    for side in (-1,1):
        fx=side*25.8
        pt,b,beam,badge,flat,circle=storefront(fx,119.9,side*90)
        for j,dest in enumerate(("TERRACE BOX", "STAGE STORES", "LANTERN WALK")):
            u=(j-1)*8.67
            b("PodiumBay",(6.65,2.75,.37),u,2.23,-.06,"Midnight")
            for k in (-1,1):
                b("VaultWindow",(2.67,1.68,.14),u+k*1.54,2.42,-.31,"EveningPane")
                b("VaultSash",(.14,1.72,.10),u+k*1.54,2.43,-.42,"Champagne")
            b("VaultAwning",(7.07,.35,1.04),u,3.78,-.43,"Cobalt" if side>0 else "Lacquer")
            badge("WalkTenant",dest,u,1.05,-.38,5.77,.66)
    # Two side alleys connect the storefronts to planted forecourts without crossing the rails.
    for x,z,w,dep in [(-87,67.50,22.52,4.49),(85,80.41,21.03,3.31),(-37.93,121,10.42,17.16),(37.46,130,11.22,16.09)]:
        piece("ForecourtPavers",(w,.11,dep),(x,.025,z),"Limestone",solid=True)
    for x,z,mat in [(-99.8,68.0,"Mulberry"),(-73.35,64.6,"Lilac"),(-80.7,84.0,"Petal"),
                     (73.77,82.92,"Mulberry"),(96.42,84.14,"Lilac"),(74.39,62.1,"Petal"),
                     (-39.39,113.77,"Lilac"),(-39.85,133.4,"Petal"),(39.43,121.96,"Mulberry"),(39.3,140.15,"Petal")]:
        street_tree(x,z,mat)
    for x,z,facing,title in [(-99.2,61.50,0,"POST"),(74.87,86.02,180,"VINYL"),
                             (-45.05,130.57,90,"BAKERY"),(45.37,119.70,-90,"PRINTS")]:
        pt,b,beam,badge,flat,circle=storefront(x,z,facing)
        b("Flagpole",(.18,3.68,.18),0,9.16,0,"Champagne")
        b("MerchantFlag",(1.67,2.02,.15),.80,9.68,0,"Cobalt" if title in ("POST","VINYL") else "Lacquer")
        badge("MerchantFlagType",title,.78,9.67,-.11,1.55,.66)
    for x,z in [(-116,53),(-81.0,103),(78.3,103.8),(-63.7,134),(64.1,117)]:
        for i in range(2):
            piece("DeliveryCase",(1.78,1.23,1.93),(x+i*.55,.76+i*1.17,z),"Ochre",solid=True)
            piece("CaseStrap",(.23,1.28,1.98),(x+i*.55,.76+i*1.17,z),"Cream")
