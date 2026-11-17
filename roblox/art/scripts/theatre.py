"""Blender 4.5 source builder. Export the same authored transforms to glTF and Rojo native parts."""
import json
import math
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
    "Ink": ("161524","SmoothPlastic",0.2,.32), "Black":("11101b","Metal",.65,.28),
    "Velvet":("482056","SmoothPlastic",.04,.72), "Violet":("271a47","SmoothPlastic",.03,.74),
    "Seat":("73324e","SmoothPlastic",.12,.56), "Cloth":("3b234c","Fabric",.0,.78),
    "Brass":("c38b52","Metal",.72,.26), "Copper":("875333","Metal",.7,.33),
    "Honey":("ffdc83","Neon",.4,.32), "Pink":("ff54bf","Neon",.2,.3),
    "Blue":("627aff","Neon",.2,.3), "Cream":("fff0cf","SmoothPlastic",.1,.32),
    "Glass":("282233","Glass",.35,.2), "Deck":("333043","Marble",.58,.30),
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

group("Architecture")
piece("Floor",(70,1,83),(0,-.6,0),"Black",solid=True)
piece("Rear",(65,31,1),(0,13,-26),"Violet",solid=True)
piece("Ceiling",(65,.7,80),(0,24,3),"Black",solid=True)
for side in (-1,1):
    piece("GalleryWall",(1,28,83),(side*31,12,2),"Violet",solid=True)
    for z in range(-18,32,6):
        piece("FlutedPier",(1.3,19,.5),(side*29,9,z),"Copper")
        piece("WallSconce",(.45,4,.65),(side*28.4,8,z),"Honey")
        piece("AcousticPanel",(.5,8,4.8),(side*29.5,6,z+3),"Cloth")
for i in range(42):
    x=(i-20.5)*1.45
    piece("Fold",(2.5,22.7,2.3),(x,10,-23.6+.26*math.cos(i*.9)),"Velvet" if i%4==0 else "Violet","Ball")

group("Bandstand")
for name,w,h,depth,y,z,mat in [
    ("Apron",46,.48,23,.15,-10.4,"Copper"),("Lip",45.5,.12,22.7,.48,-10.4,"Honey"),
    ("Step",44.8,.6,22,.76,-10.6,"Black"),("StepInlay",44.8,.12,22,1.09,-10.6,"Brass"),
    ("UpperDeck",43.7,.8,21,1.45,-11,"Deck"),("TopTrim",43,.09,20.5,1.9,-11,"Brass"),
    ("DeckSurface",42.65,.1,20.25,1.98,-11,"Deck")]:
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
for side in (-1,1):
    for i in range(7):
        t=i/6
        rod("DrapedVelvet",(side*(13.3+6*t),19.5,-19.7-t*.3),(side*(17.6+t*1.3),8.4,-17.65-t*.08),1.1,"Velvet" if i%2 else "Violet")
        rod("CurtainTail",(side*(17.6+t*1.3),8.4,-17.65),(side*(16.7+t*3),2.1,-17.65),1.08,"Violet")
    piece("Tieback",(2.9,.45,1.4),(side*18.3,8.4,-17.45),"Brass","Ball")

group("Dial")
for i,(radius,z,mat) in enumerate([(10,-22.5,"Copper"),(9.65,-22.0,"Brass"),(9.25,-21.65,"Cream")]):
    face_disc("DialFace",radius*2,.48,0,8.4,z,mat)
# Cover the lower dial so the board sits on a fan of brass ribs.
piece("DialPlinth",(20.6,7.8,.5),(0,3.55,-21.08),"Violet")
for i in range(37):
    theta=math.pi*(.045+.91*i/36)
    r=8.75
    length=1.05 if i%3==0 else .55
    rod("DialTick",((r-length)*math.cos(theta),8.4+(r-length)*math.sin(theta),-21.2),
        (r*math.cos(theta),8.4+r*math.sin(theta),-21.2),.12 if i%3==0 else .06,"Black")
rod("TuningNeedle",(0,8.4,-20.85),(2.55,16.45,-20.85),.25,"Copper")
for side in (-1,1):
    for i in range(3):
        piece("BadgeWing",(3.5-i*.6,.5,.65),(side*(13.0-i*.22),10.4-i*.65,-20.15),"Brass")
panel("BoardFrame",0,9.2,-19.75,24.8,5.7,.75,"Brass")
panel("BoardRecess",0,9.2,-19.25,24.25,5.2,.4,"Black")
piece("LiveBoard",(23.35,4.82,.12),(0,9.2,-18.97),"Ink")
for i in range(5):
    rod("PedestalRay",((i-2)*.7,2,-20),((i-2)*1.88,6.7,-20),.5,"Brass")
# Layered footlights and baffles give the cabinet readable depth at phone scale.
for i in range(14):
    piece("ApronPin",(.18,.18,.18),((i-6.5)*1.75,1.37,-.10),"Honey","Ball")
# Speech-wave badge over the crown.
for i,h in enumerate((.65,1.25,1.8,1.15,.65)):
    piece("WaveLogo",(.26,h,.3),((i-2)*.46,19.8,-15.96),"Cream")

group("Flip")
x,y,z=-10.4,2.1,-10.2
for s in (-1,1):
    piece("Foot",(1.25,.65,1.3),(x+s*.93,y+.32,z+.25),"Brass","Ball")
    rod("Ankle",(x+s*.93,y+.4,z),(x+s*.93,y+1.1,z),.42,"Copper")
panel("Cabinet",x,y+2.55,z,4.25,3.3,1.55,"Copper")
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
    rod("Iris",(x+s*.87-.21,y+2.95-.33,z+1.34),(x+s*.87+.21,y+2.95+.33,z+1.34),.22,"Black")
    piece("HandlePost",(.26,.64,.4),(x+s*.85,y+4.48,z),"Brass")
    piece("SideKnob",(.48,.86,.8),(x+s*2.22,y+2.55,z),"Copper","Cylinder")
piece("CarryHandle",(1.94,.28,.4),(x,y+4.8,z),"Brass")
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

group("Gallery")
for row in range(2):
    z=4+row*6
    piece("Tier",(38,.5+row*1.2,5.6),(0,.02+row*.6,z),"Black",solid=True)
    piece("AisleLight",(35,.12,.13),(0,.32+row*1.2,z-2.85),"Brass")
    for col in range(-2,3):
        x=col*5;y=.7+row*1.2
        piece("Cushion",(3.7,.77,3.12),(x,y+.47,z),"Seat","Ball")
        piece("SeatBack",(3.7,2.75,.87),(x,y+1.48,z+1.3),"Seat","Ball",rotation(-6,"X"))
        for s in (-1,1):
            piece("Arm",( .38,.52,2.8),(x+s*1.77,y+1.08,z),"Brass","Ball")
            piece("Bracket",(.26,1.38,.5),(x+s*1.68,y+.45,z+.67),"Black")

# Save editable PBR sources and a local assembly which never needs asset IDs to render.
out={"ClassName":"Model","Children":[{"Name":k,"ClassName":"Model","Children":v[1]} for k,v in groups.items()]}
(ROOT/"ShowSet.model.json").write_text(json.dumps(out,separators=(",",":")),encoding="utf8")
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"DeliveryTheatre.blend"),compress=True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/"DeliveryTheatre.glb"),export_format="GLB",export_animations=False,export_cameras=False)
print("DELIVERY ART",sum(len(v[1]) for v in groups.values()),"pieces",len(materials),"PBR materials")
