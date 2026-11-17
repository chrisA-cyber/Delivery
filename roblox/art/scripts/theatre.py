"""Blender 4.5 source builder. Export the same authored transforms to glTF and Rojo native parts."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
convert = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
palette = {
    "PlaneLeaf": ("679b75","SmoothPlastic",.02,.75), "PlaneShade": ("447b70","SmoothPlastic",.02,.82),
    "Ink": ("161524","SmoothPlastic",0.2,.32), "Black":("11101b","Metal",.65,.28),
    "Velvet":("482056","SmoothPlastic",.04,.72), "Violet":("271a47","SmoothPlastic",.03,.74),
    "Seat":("73324e","SmoothPlastic",.12,.56), "Cloth":("3b234c","Fabric",.0,.78),
    "Brass":("c38b52","Metal",.72,.26), "Copper":("875333","Metal",.7,.33),
    "Honey":("ffdc83","Neon",.4,.32), "Pink":("ff54bf","Neon",.2,.3),
    "Blue":("627aff","Neon",.2,.3), "Cream":("fff0cf","SmoothPlastic",.1,.32),
    "Glass":("282233","Glass",.35,.2), "Deck":("34303b","SmoothPlastic",.28,.39),
    "Midnight":("242957","SmoothPlastic",.34,.41), "Lacquer":("5b2338","SmoothPlastic",.42,.26),
    "Aubergine":("301d35","Fabric",.06,.78), "Champagne":("ddb481","Metal",.66,.30),
    "Drape":("763356","Fabric",.02,.81), "Bulb":("ffdc9e","Neon",.05,.22),
    "Cobalt":("415ba8","SmoothPlastic",.18,.3), "Bakelite":("202033","SmoothPlastic",.36,.23),
    "Rosewood":("422936","Wood",.08,.44), "Leather":("9e5867","SmoothPlastic",.19,.42),
    "Stone":("a7959c","Concrete",.04,.70), "Limestone":("d9c4b0","Concrete",.08,.54),
    "Brick":("9b5964","Brick",.04,.68), "Tile":("595776","Slate",.07,.66),
    "Powder":("929acb","SmoothPlastic",.05,.46), "Ochre":("b68455","Wood",.08,.50),
    "Lilac":("a16a93","Fabric",.08,.60), "EveningPane":("7387b0","SmoothPlastic",.08,.37),
    "ApricotPane":("c39680","SmoothPlastic",.10,.36), "BalletPane":("a979a3","SmoothPlastic",.06,.38),
    "BlueCove":("83a7ff","Neon",.10,.34), "RoseCove":("ff94c6","Neon",.10,.34),
    "Meadow":("b29761","Grass",.01,.89), "Petal":("d58ca5","SmoothPlastic",.02,.79),
    "Mulberry":("815a83","SmoothPlastic",.02,.78), "Harbor":("42838e","SmoothPlastic",.18,.30),
    "DeckPlank":("a17859","WoodPlanks",.04,.69), "Sand":("d0ae87","Sand",.02,.86),
    "IvoryCanvas":("e3c5a5","Fabric",.01,.75),
}
materials = {}
for name,(hexcolor,kind,metal,rough) in palette.items():
    rgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*[c**2.2 for c in rgb],1)
    bs.inputs["Metallic"].default_value=metal;bs.inputs["Roughness"].default_value=rough
    if kind=="Neon":
        bs.inputs["Emission Color"].default_value=(*rgb,1);bs.inputs["Emission Strength"].default_value=1.2
    materials[name]=m

# Unit meshes share UVs and materials across repeated objects.
meshes={}
for shape in ("Block","Cylinder","Ball"):
    if shape=="Block": bpy.ops.mesh.primitive_cube_add(size=1)
    elif shape=="Ball": bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=.5)
    else: bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.5,depth=1)
    proto=bpy.context.object
    if shape=="Cylinder": proto.data.transform(Matrix.Rotation(math.pi/2,4,"Y"))
    if shape=="Block":
        bevel=proto.modifiers.new("Machined edges","BEVEL")
        bevel.width=.033
        bevel.segments=2
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    for face in proto.data.polygons: face.use_smooth=shape=="Ball" or (shape=="Cylinder" and len(face.vertices)==4)
    for material in palette:
        mesh=proto.data.copy();mesh.name=shape+"_"+material;mesh.materials.append(materials[material]);meshes[shape,material]=mesh
    bpy.data.objects.remove(proto,do_unlink=True)
groups={}
def group(name):
    global section
    section=name
    if name not in groups:
        coll=bpy.data.collections.new(name);scene.collection.children.link(coll)
        groups[name]=(coll,[])
def piece(name,size,pos,mat,shape="Block",rot=None,solid=False):
    rot=rot if rot is not None else Matrix.Identity(3)
    size=tuple(max(.035,float(n)) for n in size)
    obj=bpy.data.objects.new(name,meshes[shape,mat]);groups[section][0].objects.link(obj)
    world=Matrix.Translation(Vector(pos)) @ rot.to_4x4()
    obj.matrix_world=convert @ world @ Matrix.Diagonal((*size,1))
    rgb=materials[mat].diffuse_color[:3]
    props={"Anchored":True,"CanCollide":solid,"CanTouch":False,"CanQuery":solid,
           "CastShadow":solid or min(size)>.8,"Size":list(size),"Color":list(rgb),
           "Material":palette[mat][1],"CFrame":[*pos,*[round(v,6) for row in rot for v in row]]}
    children=[]
    if shape=="Ball" and max(size)/min(size)>1.3:
        children=[{"Name":"Silhouette","ClassName":"SpecialMesh","Properties":{"MeshType":"Sphere","Scale":[1,1,1]}}]
    elif shape!="Block":
        props["Shape"]=shape
    groups[section][1].append({"Name":name,"ClassName":"Part","Properties":props,"Children":children})
def rotation(degrees,axis): return Matrix.Rotation(math.radians(degrees),3,axis)
def rod(name,a,b,width,mat,depth=None,shape="Cylinder"):
    a,b=Vector(a),Vector(b);v=b-a
    rot=v.to_track_quat("X","Y").to_matrix()
    piece(name,(v.length+.035,width,depth or width),(a+b)/2,mat,shape,rot)
def disk(name,size,pos,mat,solid=False):
    # Vertical axis in world space; ellipse spans X and Z.
    x,h,z=size
    if x > z*1.08:
        # A stadium profile keeps its intended footprint in the native cylinder renderer.
        width=x-z
        piece(name,(width,h,z),pos,mat,solid=solid)
        for side in (-1,1):
            piece(name,(h,z,z),(pos[0]+side*width/2,pos[1],pos[2]),mat,"Cylinder",rotation(90,"Z"),solid)
    else:
        piece(name,(h,x,z),pos,mat,"Cylinder",rotation(90,"Z"),solid)
def face_disc(name,diam,depth,x,y,z,mat):
    piece(name,(depth,diam,diam),(x,y,z),mat,"Cylinder",rotation(90,"Y"))
def arch(name,cx,cy,z,rx,ry,thick,mat,steps=32):
    for i in range(steps):
        a=math.pi*i/steps;b=math.pi*(i+1)/steps
        p=(cx+rx*math.cos(a),cy+ry*math.sin(a),z)
        q=(cx+rx*math.cos(b),cy+ry*math.sin(b),z)
        rod(name,p,q,thick,mat)
def panel(name,x,y,z,w,h,d,mat):
    radius=min(h/2,w/2,.65)
    piece(name,(w-2*radius,h,d),(x,y,z),mat)
    piece(name,(w,h-2*radius,d),(x,y,z),mat)
    for sign in (-1,1):
        for top in (-1,1):
            face_disc(name,2*radius,d,x+sign*(w/2-radius),y+top*(h/2-radius),z,mat)

def cloth_panel(name, columns, rows, profile, swatches):
    """UV-map a continuous folded fabric sheet and cook identical facets into local Studio wedges."""
    points = [Vector(profile(u/columns, v/rows)) for v in range(rows+1) for u in range(columns+1)]
    faces, colors = [], []
    for v in range(rows):
        for u in range(columns):
            a = v*(columns+1)+u
            b, d, c = a+1, a+columns+1, a+columns+2
            faces.extend([(a,b,c), (a,c,d)])
            colors.extend([u % len(swatches)]*2)
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([convert @ p for p in points],[],faces)
    for swatch in swatches:
        mesh.materials.append(materials[swatch])
    uv=mesh.uv_layers.new(name="Woven cloth")
    for face,color in zip(mesh.polygons, colors):
        face.material_index=color
        face.use_smooth=True
        for li in face.loop_indices:
            index=mesh.loops[li].vertex_index
            uv.data[li].uv=(index%(columns+1)/columns,1-index//(columns+1)/rows)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    groups[section][0].objects.link(obj)
    for face,color in zip(faces, colors):
        a,b,c=[points[i] for i in face]
        if (b-a).length >= max((c-a).length,(c-b).length):
            a,c=c,a
        elif (c-a).length > (c-b).length:
            a,b=b,a
        ab,ac,bc=b-a,c-a,c-b
        right=ac.cross(ab).normalized()
        back=bc.normalized()
        up=back.cross(right).normalized()
        height=abs(ab.dot(up))
        for center,axis,span in [((a+b)/2,1,abs(ab.dot(back))),((a+c)/2,-1,abs(ac.dot(back)))]:
            if min(span,height)<.012: continue
            matrix=Matrix((right*axis,up,back*axis)).transposed()
            props={"Anchored":True,"CanCollide":False,"CanQuery":False,"CanTouch":False,"CastShadow":False,
                   "Size":[.055,height,span],"Color":list(materials[swatches[color]].diffuse_color[:3]),
                   "Material":palette[swatches[color]][1],"CFrame":[*center,*[round(k,6) for row in matrix for k in row]]}
            groups[section][1].append({"ClassName":"WedgePart","Name":name,"Properties":props})

group("Architecture")
piece("Floor",(70,1,83),(0,-.6,0),"Black",solid=True)
piece("Rear",(65,31,1),(0,13,-26),"Violet",solid=True)
piece("Ceiling",(65,.7,61),(0,24,3),"Midnight",solid=True)
for side in (-1,1):
    piece("GalleryWall",(1,28,83),(side*31,12,2),"Violet",solid=True)
    for z in range(-18,32,6):
        piece("FlutedPier",(1.3,19,.5),(side*29,9,z),"Copper")
        piece("WallSconce",(.45,4,.65),(side*28.4,8,z),"Honey")
        piece("AcousticPanel",(.5,8,4.8),(side*29.5,6,z+3),"Cloth")
# The acoustic wall is a deep blue night skyline, with a few lit windows behind the broadcast dial.
for i,height in enumerate((9,12,16,18,11,13,8,12,10,14,9,11,15,17,13,10,12)):
    x=(i-8)*3.4
    piece("StudioSkyline",(3.05,height,.45),(x,height/2,-24.47),"Midnight")
    piece("Cornice",(3.17,.17,.64),(x,height,-24.35),"Cobalt")
    if i % 3 == 0:
        piece("RoofSpire",(.12,1.8,.18),(x,height+.86,-24.32),"Brass")
    if abs(x)>10:
        for floor in range(3):
            piece("WindowRow",(1.42 if floor!=1 else .72,.28,.12),(x,height-1.25-floor*1.12,-24.15),
                  "Bulb" if (i+floor)%4==0 else "Cobalt")
for side in (-1,1):
    for band in range(2):
        center=side*(23.15+3.5*band)
        for i,h in enumerate((6.8,9.0,11.2)):
            x=center+side*i*.49
            piece("DecoReed",(.26,h,.25),(x,2+h/2,-20.85),"Copper" if i%2==0 else "Brass")

group("Bandstand")
for name,w,h,depth,y,z,mat in [
    ("Apron",46,.48,23,.15,-10.4,"Copper"),("Lip",45.5,.12,22.7,.48,-10.4,"Honey"),
    ("Step",44.8,.6,22,.76,-10.6,"Black"),("StepInlay",44.8,.12,22,1.09,-10.6,"Brass"),
    ("UpperDeck",43.7,.8,21,1.45,-11,"Lacquer"),("TopTrim",43,.09,20.5,1.9,-11,"Champagne"),
    ("DeckSurface",42.65,.1,20.25,1.98,-11,"Rosewood")]:
    disk(name,(w,h,depth),(0,y,z),mat,True)
disk("SpotlightRing",(8.7,.09,6.1),(5.3,2.08,-9.3),"Honey")
disk("SpotlightMark",(8.2,.1,5.7),(5.3,2.14,-9.3),"Black")
for side in (-1,1):
    for i in range(3):
        x=side*(17.6+i*1.4)
        rod("FanBlade",(x,2,-16),(x+side*(3+i*.7),10+i*1.35,-16),.85,"Brass",.65,"Block")
    for i,(rx,ry,mat,thick,z) in enumerate([(22,14.8,"Copper",1.05,-17.5),(21.8,14.6,"Brass",.55,-17.05),(21.1,14.1,"Pink",.17,-16.7),(20.65,13.65,"Blue",.14,-16.6)]):
        rectX=side*rx
        rod("ArchUpright",(rectX,1.7,z),(rectX,5.4,z),thick,mat)
        if side==1: arch("Proscenium",0,5.4,z,rx,ry,thick,mat,36)
for i in range(31):
    a=math.pi*i/30
    piece("MarqueeBulb",(.5,.52,.43),(21.8*math.cos(a),5.4+14.6*math.sin(a),-16.48),"Honey","Ball")
group("VelvetFly")
for side in (-1,1):
    def curtain(u,v):
        pinch=math.sin(math.pi*min(1,v/.64)/2)**2 if v<.64 else .73+(.27*math.cos((v-.64)/.36*math.pi))
        width=8.65*(1-pinch)+1.25
        center=17.05+2.6*pinch
        pleat=math.cos(u*math.pi*6)
        return (side*(center+(u-.5)*width),20.05-17.85*v-.55*math.sin(math.pi*u)*(1-pinch),
                -18.25+.63*pleat*(1-.5*pinch)+.27*math.sin(2.4*v))
    cloth_panel("GatheredVelvet",9,4,curtain,("Drape","Velvet","Aubergine"))
    piece("Tieback",(2.92,.38,1.12),(side*19.62,8.78,-17.64),"Champagne","Ball")
    rod("TasselCord",(side*19.88,8.78,-17.15),(side*20.67,7.45,-17.13),.13,"Champagne")
    piece("Tassel",(.57,.96,.47),(side*20.67,7.12,-17.06),"Brass","Ball")
for left,right in [(-23.2,-9.1),(-9.1,9.1),(9.1,23.2)]:
    def swag(u,v):
        sag=math.sin(math.pi*u)
        return (left+(right-left)*u,21.98-v*(1.2+1.64*sag)-.28*sag,
                -19.1+.62*sag+.30*math.cos(v*math.pi*3+u*1.6))
    cloth_panel("ScallopedValance",7,2,swag,("Velvet","Drape","Velvet"))
    for i in range(7):
        rod("ValanceBraid",swag(i/7,1),swag((i+1)/7,1),.12,"Champagne")


group("Dial")
for radius,z,mat in [(10.3,-22.57,"Black"),(10.06,-22.33,"Brass"),(9.78,-22.08,"Copper"),
                     (9.58,-21.84,"Champagne"),(9.36,-21.61,"Midnight"),(7.75,-21.53,"Cobalt"),
                     (7.57,-21.44,"Midnight")]:
    face_disc("DialFace",radius*2,.32,0,8.4,z,mat)
# Cover the lower dial so the board sits on a fan of brass ribs.
piece("DialPlinth",(20.6,7.8,.5),(0,3.55,-21.08),"Violet")
for i in range(37):
    theta=math.pi*(.045+.91*i/36)
    r=8.75
    length=1.05 if i%3==0 else .55
    rod("DialTick",((r-length)*math.cos(theta),8.4+(r-length)*math.sin(theta),-21.2),
        (r*math.cos(theta),8.4+r*math.sin(theta),-21.2),.17 if i%3==0 else .075,"Champagne")
rod("TuningNeedle",(0,8.4,-20.85),(2.55,16.45,-20.85),.17,"Pink")
# Recessed metal cartridge holds the masthead apart from the illuminated dial markings.
panel("MastheadFrame",0,14.22,-20.78,13.0,2.5,.36,"Champagne")
panel("MastheadInset",0,14.22,-20.48,12.68,2.21,.20,"Bakelite")
for side in (-1,1):
    for i in range(3):
        piece("BadgeWing",(3.5-i*.6,.5,.65),(side*(13.0-i*.22),10.4-i*.65,-20.15),"Brass")
panel("BoardFrame",0,9.2,-19.75,24.8,5.7,.75,"Brass")
panel("BoardRecess",0,9.2,-19.25,24.25,5.2,.4,"Black")
piece("LiveBoard",(23.35,4.82,.12),(0,9.2,-18.97),"Ink")
for i in range(7):
    rod("PedestalRay",((i-3)*.36,2,-20),((i-3)*1.82,6.55,-20),.35,"Brass")
panel("TunerCabinet",0,5.7,-20.05,15.6,2.2,.8,"Copper")
panel("TunerGlass",0,5.7,-19.52,15.12,1.78,.25,"Bakelite")
for i in range(23):
    h=.8 if i%5==1 else .4
    piece("TunerEtch",(.075,h,.09),((i-11)*.51,5.94-h/2,-19.31),"Champagne")
for side in (-1,1):
    face_disc("TunerKnob",1.3,.34,side*7.47,5.73,-19.28,"Brass")
    face_disc("TunerKnurl",.92,.18,side*7.47,5.73,-19.05,"Ink")
# Layered footlights and baffles give the cabinet readable depth at phone scale.
for i in range(14):
    piece("ApronPin",(.18,.18,.18),((i-6.5)*1.75,1.37,-.10),"Honey","Ball")
# Speech-wave badge over the crown.
for i,h in enumerate((.65,1.25,1.8,1.15,.65)):
    piece("WaveLogo",(.26,h,.3),((i-2)*.46,19.8,-15.96),"Cream")

group("Flip")
x,y,z=-10.4,2.1,-10.2
for s in (-1,1):
    piece("PatentShoe",(1.32,.57,1.7),(x+s*.82,y+.32,z+.34),"Bakelite","Ball")
    piece("ShoeSpat",(.65,.21,.42),(x+s*.82,y+.55,z+.59),"Champagne","Ball")
    rod("Ankle",(x+s*.82,y+.4,z),(x+s*.74,y+1.3,z),.45,"Copper")
piece("Tailcoat",(2.7,1.65,1.41),(x,y+1.32,z),"Midnight","Ball")
for s in (-1,1):
    rod("SilkLapel",(x+s*1.02,y+1.9,z+.61),(x+s*.21,y+1.06,z+.73),.28,"Champagne",.15,"Block")
    piece("CoatTail",(.78,1.5,.39),(x+s*.78,y+.96,z-.53),"Lacquer","Ball")
    for j in (0,1):
        face_disc("CoatButton",.16,.1,x+s*.35,y+.88+j*.26,z+.7,"Brass")
# Move the cabinet up over a tailored body, retaining the carry-case silhouette.
y+=1.02
panel("Cabinet",x,y+2.55,z,4.25,3.3,1.55,"Copper")
for s in (-1,1):
    piece("CaseBumper",(.44,2.4,.96),(x+s*2.06,y+2.46,z-.06),"Lacquer","Ball")
    for j in (-1,1):
        face_disc("CabinetRivet",.16,.10,x+s*1.79,y+2.52+j*1.18,z+1.01,"Champagne")
panel("RadioFace",x,y+2.55,z+.65,3.98,3.06,.48,"Brass")
panel("BlackGlassVisor",x,y+2.98,z+.98,3.38,1.47,.17,"Black")
for s in (-1,1):
    for i in range(3):
        piece("SpeakerLouvre",(.65,.08,.12),(x+s*1.19,y+1.57+i*.22,z+1.0),"Black")
for i in range(6):
    piece("TuningRidge",(.09,.20,.13),(x-.32+i*.13,y+1.27,z+1.04),"Copper")
for s in (-1,1):
    face_disc("EyeRim",1.35,.27,x+s*.87,y+2.95,z+1.0,"Black")
    face_disc("EyeGlass",1.09,.18,x+s*.87,y+2.95,z+1.21,"Cream")
    face_disc("AnimatedPupil",.62,.13,x+s*.87+.13,y+2.96,z+1.37,"Bakelite")
    face_disc("EyeGlint",.19,.08,x+s*.87+.19,y+3.11,z+1.465,"Cream")
    rod("AnimatedBrow",(x+s*.87-.46,y+3.64,z+1.21),(x+s*.87+.40,y+3.60+s*.12,z+1.21),.16,"Lacquer")
    piece("HandlePost",(.26,.64,.4),(x+s*.85,y+4.48,z),"Brass")
    piece("SideKnob",(.48,.86,.8),(x+s*2.22,y+2.55,z),"Copper","Cylinder")
piece("CarryHandle",(1.94,.28,.4),(x,y+4.8,z),"Brass")
piece("LeatherGrip",(1.22,.38,.46),(x,y+4.82,z),"Lacquer","Ball")
rod("Aerial",(x-1.56,y+4,z-.3),(x-1.91,y+5.17,z-.3),.12,"Champagne")
piece("OnAirBeacon",(.44,.44,.44),(x-1.91,y+5.20,z-.3),"Pink","Ball")
# A host holding a cue card in one hand and presenting with the other.
for s in (-1,1):
    shoulder=(x+s*1.22,y+.58,z+.05)
    elbow=(x+s*2.15,y+.04,z+.29)
    hand=(x+s*(2.80 if s<0 else 2.61),y+(.86 if s<0 else 1.37),z+.78)
    piece("ShoulderGear",(.70,.70,.68),shoulder,"Brass","Ball")
    rod("Sleeve",shoulder,elbow,.64,"Midnight")
    piece("Hinge",(.54,.54,.54),elbow,"Copper","Ball")
    rod("Cuff",elbow,hand,.40,"Champagne")
    piece("Glove",(.68,.59,.54),hand,"Cream","Ball")
    if s<0:
        for j in range(3):
            piece("Finger",(.18,.44,.21),(hand[0]-.11-j*.13,hand[1]+.25,hand[2]+.01),"Cream","Ball",rotation(-13-j*11,"Z"))
cardPos=(x+2.57,y+1.66,z+.9)
piece("HostCardFoil",(1.33,.90,.09),cardPos,"Lacquer",rot=rotation(-13,"Z"))
piece("HostCardPaper",(1.22,.78,.08),(cardPos[0],cardPos[1],cardPos[2]+.07),"Cream",rot=rotation(-13,"Z"))
for i,w in enumerate((.72,.9,.53)):
    piece("HostCardLine",(w,.055,.05),(cardPos[0]-.03,cardPos[1]+.18-i*.16,cardPos[2]+.14),"Violet",rot=rotation(-13,"Z"))
for i,h in enumerate((.38,.67,.46)):
    piece("HostMouth",(.23,h,.19),(x+(i-1)*.41,y+1.8,z+1.1),"Honey")
for s in (-1,1):
    piece("BowTie",(.82,.38,.46),(x+s*.35,y+1.0,z+.97),"Black","Ball",rotation(s*22,"Z"))

group("StageProps")
x,z=8.2,-8.2
disk("MicBase",(1.5,.28,1.3),(x,2.33,z),"Brass")
rod("MicStem",(x,2.45,z),(x,5.48,z),.14,"Brass")
rod("Boom",(x,5.48,z),(x-.52,5.83,z+.1),.14,"Copper")
piece("MicCapsule",(.65,1,.58),(x-.57,5.92,z+.09),"Copper","Ball",rotation(-18,"Z"))
for i in range(4):
    rod("Grille",(x-.86,5.63+i*.15,z+.34),(x-.3,5.8+i*.15,z+.34),.045,"Cream")
for s in (-1,1):
    for i in range(3):
        x1=s*(11+i*4.5)
        rod("LampCan",(x1,20.9,0),(x1-s*.52,19.9,-.45),.9,"Black")
        piece("LampLens",(.76,.22,.74),(x1-s*.52,19.83,-.45),"Honey","Ball")

group("FoleyRack")
# The sound booth rolls out for the Foley round. The native renderer reveals this group per client.
x,z=5.0,-7.23
panel("ConsoleLivery",x,3.42,z,4.83,.94,.56,"Midnight")
piece("TableTop",(5.05,.22,1.52),(x,3.95,z-.10),"Champagne")
for s in (-1,1):
    rod("DeskLeg",(x+s*1.95,2.14,z-.12),(x+s*1.95,3.84,z-.12),.19,"Copper")
for i,(pad,material) in enumerate([("Bell","Honey"),("Squeak","Pink"),("Thump","Blue")]):
    px=x+(i-1)*1.58
    disk("InstrumentFoot",(1.22,.14,1.13),(px,4.12,z-.10),"Bakelite")
    piece("Pad"+pad,(.98,.49 if pad!="Squeak" else .61,.86),(px,4.35,z-.1),material,"Ball")
    if pad=="Bell":
        piece("BellPlunger",(.21,.23,.21),(px,4.64,z-.10),"Brass","Ball")
    elif pad=="Squeak":
        rod("SqueakerNozzle",(px+.35,4.43,z-.04),(px+.60,4.56,z),.17,"Copper")
    else:
        disk("DrumRim",(1.08,.09,1.03),(px,4.49,z-.1),"Champagne")
        disk("DrumHead",(.90,.08,.88),(px,4.55,z-.1),"Cream")
for node in groups["FoleyRack"][1]:
    node["Properties"]["Transparency"]=1
for obj in groups["FoleyRack"][0].objects:
    obj.hide_render=True
group("HouseBoxes")
for side in (-1,1):
    x=side*21.65
    panel("BoxShell",x,7.45,-17.50,5.18,10.84,1.6,"Copper")
    panel("BoxEnamel",x,7.49,-16.58,4.87,10.42,.63,"Bakelite")
    for i,width in enumerate((6.07,5.46,4.86)):
        piece("BoxCrown",(width,.32,.93),(x,12.85+i*.30,-16.54),"Champagne" if i==0 else "Lacquer")
    face_disc("SpeakerBasket",3.46,.33,x,9.57,-16.19,"Champagne")
    face_disc("SpeakerCone",3.18,.26,x,9.57,-15.96,"Bakelite")
    face_disc("SpeakerCap",1.45,.22,x,9.57,-15.75,"Copper")
    for j in range(5):
        lineY=(j-2)*.45
        width=2*math.sqrt(1.44**2-lineY**2)
        rod("SpeakerSlat",(x-width/2,9.57+lineY,-15.60),(x+width/2,9.57+lineY,-15.60),.105,"Champagne")
    for j,h in enumerate((2.1,2.8,3.4,2.6,1.9)):
        piece("BoxDecoReed",(.22,h,.23),(x+(j-2)*.49,3.53+h/2,-16.0),"Copper" if j%2 else "Brass")
    for j in range(3):
        piece("BoxSill",(5.52-j*.25,.25,.89),(x,2.36+j*.27,-16.40),"Lacquer" if j%2 else "Champagne")
# The Daily notice lives in a miniature enamel ticket booth with a canopy, shelf, and stamped brass trim.
x,z=14.0,-14.0
panel("DailyBooth",x,5.16,z-.5,6.22,5.87,.84,"Champagne")
panel("DailyCase",x,5.16,z-.02,5.98,5.64,.34,"Midnight")
piece("DailyPedestal",(3.78,1.56,.97),(x,2.78,z-.46),"Lacquer")
for i,width in enumerate((6.52,6.04,5.45)):
    piece("BoothCanopy",(width,.19,.9),(x,7.98+i*.20,z-.12),"Champagne" if i!=1 else "Copper")
piece("TicketShelf",(5.96,.2,1.0),(x,3.22,z+.19),"Champagne")
for s in (-1,1):
    for i in range(3):
        piece("TicketLamp",(.19,.19,.15),(x+s*2.78,4.27+i*.83,z+.21),"Bulb","Ball")
group("FloorInlay")
for side in (-1,1):
    for i in range(3):
        a=(side*(12.9+i*1.30),2.045,-17.2)
        b=(side*(8.85+i*.72),2.045,-2.7)
        rod("RunwayInlay",a,b,.08,"Copper",.08,"Block")
# Fixed venue microphones, velvet aisle ropes and seat numbers distinguish a theatre from an empty arena.
group("Gallery")
for row in range(2):
    z=4+row*6
    piece("Tier",(38,.5+row*1.2,5.6),(0,.02+row*.6,z),"Black",solid=True)
    piece("AisleLight",(35,.12,.13),(0,.32+row*1.2,z-2.85),"Brass")
    for col in range(-2,3):
        x=col*5;y=.7+row*1.2
        piece("Cushion",(3.7,.77,3.12),(x,y+.47,z),"Seat","Ball")
        piece("SeatShell",(3.80,2.79,.82),(x,y+1.41,z+1.49),"Lacquer","Ball",rotation(-7,"X"))
        piece("SeatBack",(3.56,2.64,.68),(x,y+1.48,z+1.26),"Seat","Ball",rotation(-7,"X"))
        piece("HeadRoll",(2.62,.43,.68),(x,y+2.40,z+1.26),"Leather","Ball",rotation(-7,"X"))
        for s in (-1,1):
            piece("Tuft",(.24,.24,.16),(x+s*.45,y+1.82,z+.94),"Leather","Ball")
        piece("SeatTicket",(.85,.35,.15),(x,y+1.73,z+1.94),"Brass")
        disk("SeatPedestal",(1.43,.21,1.32),(x,y-.32,z),"Black")

        for s in (-1,1):
            piece("Arm",( .38,.52,2.8),(x+s*1.77,y+1.08,z),"Brass","Ball")
            piece("Bracket",(.26,1.38,.5),(x+s*1.68,y+.45,z+.67),"Black")

for side in (-1,1):
    for i in range(4):
        z=-1.45+4.95*i
        x=side*14.25
        disk("StanchionFoot",(.98,.2,.98),(x,.37+max(0,i-1)*.6,z),"Brass")
        rod("Stanchion",(x,.43,z),(x,2.3+max(0,i-1)*.60,z),.20,"Brass")
        piece("Finial",(.38,.41,.38),(x,2.34+max(0,i-1)*.60,z),"Champagne","Ball")
        if i<3:
            e0=2.24+max(0,i-1)*.60
            e1=2.24+max(0,i)*.60
            for j in range(4):
                def rope(t):
                    return (x,e0*(1-t)+e1*t-.46*math.sin(math.pi*t),z+4.95*t)
                rod("VelvetRope",rope(j/4),rope((j+1)/4),.18,"Drape")
# The same floor marks and placard strings ship with both the authored venue kit and the playable local assembly.
def anchor(name,pos,heading=0):
    rot=rotation(heading,"Y")
    cframe=[*pos,*[round(k,6) for row in rot for k in row]]
    groups[section][1].append({"Name":name,"ClassName":"Part","Properties":{
        "CFrame":cframe,"Anchored":True,"CanCollide":False,"CanQuery":False,"CanTouch":False,
        "CastShadow":False,"Transparency":1,"Size":[1,1,1]}})
    mark=bpy.data.objects.new(name,None)
    mark.empty_display_type="ARROWS"
    mark.empty_display_size=.8
    groups[section][0].objects.link(mark)
    mark.matrix_world=convert @ Matrix.Translation(Vector(pos)) @ rot.to_4x4()
def venue_sign(name,heading,text,pos,width,height,back="Bakelite",trim="Champagne"):
    turn=rotation(heading,"Y")
    front=turn @ Vector((0,0,1))
    piece(name+"Frame",(width+.28,height+.25,.36),pos,trim,rot=turn)
    point=Vector(pos)+front*.25
    piece(name,(width,height,.20),point,back,rot=turn)
    node=groups[section][1][-1]
    node["Children"].append({"Name":"Wayfinding","ClassName":"StringValue","Properties":{"Value":text}})
    lettering=bpy.data.curves.new(name+" lettering","FONT")
    lettering.body=text
    lettering.align_x="CENTER"
    lettering.align_y="CENTER"
    lettering.size=min(height*.83,(width*.91)/(max(1,len(text))*.67))
    lettering.extrude=.014
    lettering.materials.append(materials["Cream"])
    obj=bpy.data.objects.new(name+" lettering",lettering)
    groups[section][0].objects.link(obj)
    obj.matrix_world=convert @ Matrix.Translation(point+front*.12) @ turn.to_4x4()
sys.path.insert(0,str(Path(__file__).resolve().parent))
from campus import build_campus
build_campus(group,piece,rod,disk,rotation,anchor,venue_sign)
from districts import build_districts
build_districts(group,piece,rod,disk,rotation,anchor,venue_sign)
from town import build_town
build_town(group,piece,rod,disk,rotation,anchor,venue_sign)
from clockcourt import build_clock_court
build_clock_court(group,piece,rod,disk,rotation,anchor,venue_sign)
# Save editable PBR sources and a local assembly which never needs asset IDs to render.
out={"ClassName":"Model","Children":[{"Name":k,"ClassName":"Model","Children":v[1]} for k,v in groups.items()]}
(ROOT/"ShowSet.model.json").write_text(json.dumps(out,separators=(",",":")),encoding="utf8")
# Editable contact-light rig and named camera compositions remain available to the art director.
stage_rig=bpy.data.collections.new("Stage review cameras and lights")
scene.collection.children.link(stage_rig)
def review_camera(name, eye, target, fov):
    lens=bpy.data.cameras.new(name)
    camera=bpy.data.objects.new(name,lens)
    stage_rig.objects.link(camera)
    camera.location=convert @ Vector(eye)
    camera.rotation_euler=((convert @ Vector(target))-camera.location).to_track_quat("-Z","Y").to_euler()
    lens.lens_unit="FOV"
    lens.angle=math.radians(fov)
    return camera
scene.camera=review_camera("Stage wide",(-1.5,8.8,32),(0,8.0,-15),57)
review_camera("Presenter close",(-4.7,6.95,3.8),(-10.35,5.52,-10.1),38)
review_camera("Performer close",(11.6,6.5,4.9),(5,5.55,-9.5),39)
review_camera("Daily card",(13.5,5.9,-4),(14,5.55,-14),43)
review_camera("Campus establishing",(94,82,165),(0,3.3,75),67)
review_camera("District rooftops",(153,149,289),(-6,2,92),68)
review_camera("Harbor to theatre",(-154,27,104),(-65,6,63),70)
review_camera("Signal boulevard",(85,11,74),(138,5,80),76)
review_camera("Festival walk",(3,8,142),(0,5,181),67)
review_camera("Post Office facade",(-72.7,14.2,83.9),(-88.6,9.8,60.4),75)
review_camera("Needle Drop facade",(74.3,12.7,64.4),(86.0,8.8,86.0),76)
review_camera("Bakehouse entrance",(-28.1,12.8,136.9),(-47.6,10.35,118.6),76)
review_camera("Pocket Prints facade",(28.5,12.25,112.7),(47.25,8.65,131.0),74)
review_camera("Campus street",(-2,8.0,82),(0,6,37),60)
review_camera("Welcome shot",(13.3,23.3,100.8),(-1.4,5.2,47.5),64)
review_camera("The prop depot",(38,8,61),(60,4,51),56)
review_camera("Writers loft",(-37,7.4,95),(-60,3.8,89),57)
review_camera("Sky terrace",(28,18,136),(0,6,112),55)
def area(name,pos,target,color,energy,size):
    data=bpy.data.lights.new(name,"AREA")
    light=bpy.data.objects.new(name,data)
    stage_rig.objects.link(light)
    light.location=convert @ Vector(pos)
    light.rotation_euler=((convert @ Vector(target))-light.location).to_track_quat("-Z","Y").to_euler()
    data.color=color
    data.energy=energy
    data.shape="DISK"
    data.size=size
area("Warm front softbox",(2,15,6),(0,5,-11),(1,.82,.67),11000,12)
area("Rose curtain wash",(19,5,-11),(16,13,-20),(1,.20,.48),6200,5)
area("Blue curtain wash",(-19,5,-11),(-16,13,-20),(.30,.39,1),6200,5)
area("Velvet overhead",(0,19,-7),(0,5,-10),(.75,.64,1),6400,9)
area("House light",(0,13,11),(0,3,6),(1,.63,.49),3800,10)
area("Dusk over the square",(4,57,53),(0,2,64),(.74,.76,1),65000,56)
area("Street marquee bounce",(0,14,57),(0,7,33),(1,.73,.46),14500,23)
area("West studio's glow",(-47,17,67),(-68,4,54),(.67,.72,1),12800,19)
area("East arcade's glow",(44,19,68),(63,3,55),(1,.64,.46),12700,19)
area("Wardrobe lights",(45,19,99),(63,4,90),(1,.65,.80),14200,18)
area("Writers' room sky",(-48,19,98),(-63,3,88),(1,.84,.64),11800,19)
area("Terrace at dusk",(11,28,117),(1,5,119),(.75,.66,1),18500,24)
area("Harbor daylight",(-117,53,84),(-143,2,74),(.72,.86,1),95000,51)
area("Honey meadow",(121,45,65),(126,3,84),(1,.84,.69),85000,56)
area("Market lantern sky",(3,38,166),(0,2,184),(1,.74,.71),90000,44)
area("Parcel counter window",(-84,9.1,63),(-88,3.2,51),(1,.81,.61),3200,6)
area("Listening room window",(86,9.2,84),(85,3,95),(.69,.76,1),3600,7)
area("Bakehouse pendants",(-54,9.3,121),(-58,3.2,121),(1,.79,.59),3600,7)
area("Pocket gallery daylight",(54,9.4,131),(59,4.0,130),(.88,.85,1),3700,8)
def engraved_text(name,body,pos,size,mat):
    font=bpy.data.curves.new(name,"FONT")
    font.body=body
    font.size=size
    font.align_x="CENTER"
    font.align_y="CENTER"
    font.extrude=.025
    font.bevel_depth=.012
    font.materials.append(materials[mat])
    obj=bpy.data.objects.new(name,font)
    stage_rig.objects.link(obj)
    obj.location=convert @ Vector(pos)
    obj.rotation_euler.x=math.pi/2
engraved_text("Masthead lettering","D E L I V E R Y",(0,14.25,-20.28),1.25,"Cream")
engraved_text("House placard","THE DAILY",(14,7.22,-13.75),.58,"Cream")
scene.world=bpy.data.worlds.new("Midnight studio world")
scene.world.use_nodes=True
scene.world.node_tree.nodes.get("Background").inputs[0].default_value=(.12,.13,.22,1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value=.28
scene.render.resolution_x=1280
scene.render.resolution_y=720
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"DeliveryTheatre.blend"),compress=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in scene.objects:
    if obj.type=="MESH": obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/"DeliveryTheatre.glb"),export_format="GLB",use_selection=True,
                         export_animations=False,export_cameras=False,export_lights=False)
print("DELIVERY ART",sum(len(v[1]) for v in groups.values()),"pieces",len(materials),"PBR materials")
