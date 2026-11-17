"""Synthesize the original show stings as mono 22.05 kHz WAV masters."""
import math
import random
import struct
import wave
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "sound"
out.mkdir(exist_ok=True)
rate = 22050
rng = random.Random(81)
for name, duration in (("places", .65), ("reveal", 1.1), ("applause", 2.2), ("roll", 1.1), ("chuckle", .85)):
    audio = []
    for i in range(int(rate * duration)):
        t = i/rate
        if name in ("places","reveal"):
            notes = (330,440,660) if name=="places" else (392,494,587,784)
            k = min(len(notes)-1, int(t/.12))
            age = t-k*.12
            value = math.sin(2*math.pi*t*notes[k])*.36*math.exp(-age*7)
        elif name=="chuckle":
            env=max(0,math.sin(t*math.pi*9))**3
            value=.27*env*math.sin(2*math.pi*(165-55*t)*t)*(1-t/duration)
        else:
            spacing=.104 if name=="applause" else .061
            age=t%spacing
            value=rng.uniform(-.8,.8)*math.exp(-age*60)*min(1,t*8)*(1-t/duration)
        audio.append(struct.pack("<h",round(value*26000)))
    with wave.open(str(out/(name+".wav")),"wb") as f:
        f.setparams((1,2,rate,0,"NONE",""))
        f.writeframes(b"".join(audio))
