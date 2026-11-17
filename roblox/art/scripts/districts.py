"""Three original outdoor neighborhoods joined by Lantern Street and the Market Walk."""
import math


def build_districts(group, piece, rod, disk, rot, anchor, sign):
    def slab(name, size, pos, material):
        piece(name, size, pos, material, solid=True)

    def post(name, x, z, height, material, width=.4, base=0):
        slab(name, (width,height,width), (x,base+height/2,z), material)

    def lantern(x, z, height=7.2, base=0):
        disk("LanternShoe",(1.05,.32,1.05),(x,.16+base,z),"Brass")
        post("LanternPole",x,z,height,"Midnight",.27,base)
        piece("LanternShade",(1.35,.94,1.35),(x,base+height+.32,z),"Bulb","Ball")
        disk("LanternHood",(1.58,.23,1.58),(x,base+height+.84,z),"Copper")

    def flat_path(name, a, b, width, material):
        dx,dz=b[0]-a[0],b[1]-a[1]
        piece(name,(width,.12,math.hypot(dx,dz)),((a[0]+b[0])/2,0,(a[1]+b[1])/2),
              material,rot=rot(math.degrees(math.atan2(dx,dz)),"Y"),solid=True)

    def tree(x,z,hue,height,lean=1):
        post("OrchardTrunk",x,z,height*.59,"Ochre",.82)
        for branch in (-1,1):
            rod("BlossomBough",(x,height*.36,z),(x+branch*2.35,height*.68,z+lean*.82),.55,"Ochre")
            piece("BlossomCluster",(5.62,4.82,5.25),(x+branch*2.35,height*.77,z+lean*.73),hue,"Ball")
        piece("BlossomCrown",(6.36,5.41,6.33),(x,height,z-.59),hue,"Ball")

    def bench(x,z):
        slab("ParkBench",(5.60,.38,1.53),(x,1.52,z),"Ochre")
        slab("ParkBack",(5.53,1.3,.32),(x,2.15,z+.62),"Ochre")
        for k in (-1,1):
            slab("BenchFoot",(.39,1.53,1.12),(x+k*2.24,.76,z),"Bakelite")

    def notice(name,text,x,z,facing,w=12,back="Midnight",base=0):
        post("NoticeStanchion",x,z,3.5,"Copper",.36,base)
        sign(name,facing,text,(x,base+4.37,z),w,1.79,back)

    group("LanternStreet")
    slab("StreetBed",(249,.20,13),(0,-.10,74.5),"Tile")
    for side in (-1,1):
        piece("StreetRail",(222,.11,.18),(0,.059,74.5+side*2.08),"Champagne")
        flat_path("MarketWalk",(side*32,96),(side*32,153),9.2,"Limestone")
    flat_path("MarketCrosswalk",(-36,151),(36,151),9.6,"Limestone")
    flat_path("LanternLane",(0,151),(0,207),11.4,"Limestone")
    for x in range(-110,111,5):
        piece("RailSleeper",(1.0,.05,4.9),(x,.021,74.5),"Ochre")
    for x in (-94,-77,78,94):
        for z in (68.6,80.7):
            lantern(x,z)
    for x in (-32,32):
        for z in (106,125,145):
            lantern(x+(-5.6 if x<0 else 5.6),z)
    for x,z,h,label in [(-76,65,90,"WATERFRONT PIER"),(76,65,-90,"SIGNAL PARK"),
                         (-36,137,180,"NIGHT MARKET"),(36,137,180,"NIGHT MARKET")]:
        notice("DistrictSign",label,x,z,h,12.1)

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
    piece("Slipway",(19,.42,6),(-138,-2.05,116),"DeckPlank",rot=rot(13.0,"Z"),solid=True)
    anchor("VenuePier",(-122,3.05,74),122)
    # Small reel dial leaves a clear sightline over the water to the flashing buoy.
    slab("ReelBody",(2.37,2.07,2.7),(-124.2,1.10,77.3),"Cobalt")
    piece("ReelDial",(1.49,.29,1.49),(-124.2,2.27,77.3),"Champagne","Ball")
    piece("ReelNeedle",(.17,.22,.99),(-124.2,2.43,77.32),"Lacquer",rot=rot(28,"Y"))
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
    piece("CraneWindows",(5.64,2.66,.19),(cx,16.50,cz+2.36),"EveningPane")
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

    group("SignalPark")
    slab("ParkMeadow",(93,.25,101),(120,-.075,77),"Meadow")
    for a,b in [((76,74),(121,74)),((120,74),(109,55)),((109,55),(140,67)),
                ((140,67),(116,96)),((116,96),(120,74)),((116,96),(88,108))]:
        flat_path("GardenWalk",a,b,6.8,"Sand")
    anchor("ParkArrival",(99,3.05,80),-110.73)
    anchor("VenuePark",(120,3.05,74),-37)
    notice("RunBoard","SIGNAL RUN",123.7,67.8,-20,9.7,"Cobalt")
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
    disk("BandstandCanopy",(16.44,.49,16.44),(x,8.48,z),"Cobalt")
    for j in range(4):
        size=12.24-j*2.31
        disk("TieredCanopy",(size,.67,size),(x,8.99+j*.56,z),"Cobalt")
    piece("BandstandFinial",(.76,2.34,.76),(x,11.71,z),"Bulb","Ball")
    for i,(x,z,h) in enumerate([(83,47,10),(95,39,12),(109,36,11),(124,41,13),(146,43,11),(156,55,13),
                                (160,78,11),(152,104,13),(136,112,12),(115,116,10),(96,105,11),(81,110,13)]):
        tree(x,z,["Petal","Lilac","Mulberry"][i%3],h,(-1)**i)
    for x,z in [(95,62),(103,91),(129,107)]:
        bench(x,z)
    for x,z in [(107,43),(152,70),(106,105),(91.45,79.95)]:
        lantern(x,z)
    notice("ParkGateSign","SIGNAL PARK",92,68,0,11.80,"Cobalt")

    group("NightMarket")
    slab("MarketPaving",(86,.24,61),(0,-.06,177),"Brick")
    flat_path("MarketSpine",(0,147),(0,209),13.4,"Limestone")
    for z in (159,181,196):
        flat_path("StallRow",(-38,z),(38,z),6.4,"Sand")
    anchor("VenueMarket",(0,3.05,171),90)
    anchor("MarketPaper",(-15,3.05,162),90)
    anchor("MarketRibbon",(16,3.05,182),-90)
    for x in (-19.25,19.25):
        post("ArcadeGateway",x,149,12.65,"Brick",1.32)
        disk("MarketColumnShoe",(2.25,.55,2.25),(x,.33,149),"Champagne",True)
        piece("MarketLantern",(1.68,1.76,1.68),(x,13.54,149),"Bulb","Ball")
    rod("MarketSpan",(-19.25,12.22,149),(19.25,12.22,149),.51,"Champagne")
    sign("MarketArch",180,"N I G H T   M A R K E T",(0,13.43,149),19.32,2.22,"Lacquer")
    sign("MarketArchReverse",0,"L A N T E R N   S T R E E T",(0,13.43,149.41),19.32,2.22,"Midnight")
    # Fabric folds are alternating pitched stripes with a contrasting scalloped edge.
    def stall(x,z,side,awning,title,goods):
        facing=90 if side<0 else -90
        slab("StallFloor",(9.2,.34,10.0),(x,.18,z),"DeckPlank")
        for dx in (-3.95,3.95):
            for dz in (-4.42,4.42):
                post("StallUpright",x+dx,z+dz,6.43,"Ochre",.31,.34)
        for j in range(7):
            shade=awning if j%2==0 else "IvoryCanvas"
            piece("MarketAwning",(9.95,.31,1.43),(x,6.75,z+(j-3)*1.4),shade,rot=rot(side*9,"Z"))
            piece("AwningScallop",(.42,.91,1.40),(x-side*4.88,5.58,z+(j-3)*1.40),shade,"Ball")
        slab("MerchantCounter",(2.30,2.50,8.60),(x-side*2.85,1.63,z),"Ochre")
        piece("CounterRunner",(2.40,.13,8.69),(x-side*2.85,2.94,z),awning)
        sign("MerchantName",facing,title,(x-side*4.88,4.99,z),8.4,1.12,"Midnight")
        for j in range(5):
            gx,gz=x-side*(2.60+(j%2)*.33),z+(j-2)*1.33
            if goods=="paper":
                piece("PaperReam",(1.54,.26,1.05),(gx,3.16,gz),"Cream",rot=rot(4*j,"Y"))
                piece("PaperFoil",(1.4,.18,.98),(gx,3.40,gz),"Powder" if j%2 else "Petal",rot=rot(5*j,"Y"))
            elif goods=="ribbon":
                disk("RibbonSpool",(1.0,.8,1.0),(gx,3.43,gz),["Petal","Cobalt","Ochre"][j%3])
                disk("RibbonFlange",(1.11,.11,1.11),(gx,3.88,gz),"Cream")
            else:
                piece("DisplayGoods",(1.28,.88+(j%2)*.27,1.04),(gx,3.46,gz),goods,"Ball")
    for args in [(-23,162,-1,"Petal","PAPER MILL","paper"),(24,182,1,"Cobalt","SATIN RIBBON","ribbon"),
                 (24,161,1,"Ochre","HONEY BUNS","Ochre"),(-25,181,-1,"Midnight","PLUM ORCHARD","Mulberry"),
                 (-23,198,-1,"Cobalt","FRESH BOUQUETS","Petal"),(24,198,1,"Brick","PEACH SODA","ApricotPane")]:
        stall(*args)
    slab("WrapCounter",(3.46,2.45,6.79),(-5.67,1.31,171),"Lacquer")
    piece("WrapTop",(3.60,.23,6.90),(-5.67,2.65,171),"Champagne")
    for j,mat in enumerate(("Cobalt","Ochre","Petal")):
        piece("WrappedParcel",(1.44,.82,1.35),(-5.80,3.17,171+(j-1)*1.79),mat)
        piece("ParcelTie",(.24,.91,1.41),(-5.80,3.20,171+(j-1)*1.79),"Cream")
    notice("WrapSign","WRAP COUNTER",-6.3,165.0,90,8.25,"Lacquer")
    for z in (155,174,192,205):
        for side in (-1,1):
            post("FestivalPole",side*31.3,z,11.6,"Copper",.40)
        for i in range(12):
            def point(t):
                return (-31.3+62.6*t,11.53-2.27*math.sin(math.pi*t),z)
            p,q=point(i/12),point((i+1)/12)
            rod("FestivalCable",p,q,.10,"Bakelite")
            bx,by,bz=q
            piece("FestoonLamp",(.67,.89,.67),(bx,by-.42,bz),["Bulb","RoseCove","BlueCove"][i%3],"Ball")
    for i,(x,z) in enumerate([(-41,147),(41,147),(-41,166),(41,175),(-39,199),(40,206)]):
        tree(x,z,"Mulberry" if i%2 else "Petal",9.5)
    for x,z in [(-11,155.9),(11,155.9),(-35,186),(34,166)]:
        lantern(x,z)
