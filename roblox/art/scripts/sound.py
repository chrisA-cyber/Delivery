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


# Three original Foley masters for the published booth. Pitch is integrated over time.
for name, duration in (("Bell", 0.85), ("Squeak", 0.4), ("Thump", 0.38)):
    pcm = bytearray()
    phase = 0.0
    for i in range(int(rate * duration)):
        t = i / rate
        edge = min(1.0, t * 650, (duration - t) * 90)
        if name == "Bell":
            value = sum(gain * math.sin(2 * math.pi * freq * t) * math.exp(-decay * t)
                        for freq, gain, decay in ((830, .38, 5), (1330, .17, 9), (2200, .08, 13)))
        elif name == "Squeak":
            hz = 680 + 600 * math.sin(math.pi * t / duration) + 40 * math.sin(32 * t)
            phase += 2 * math.pi * hz / rate
            value = (.25 * math.sin(phase) + .09 * math.sin(phase * 3)) * math.sin(math.pi * t / duration)
        else:
            phase += 2 * math.pi * (57 + 124 * math.exp(-19 * t)) / rate
            value = .70 * math.sin(phase) * math.exp(-13 * t) + rng.uniform(-.2, .2) * math.exp(-85 * t)
        pcm.extend(struct.pack("<h", round(30000 * edge * value)))
    with wave.open(str(out / (name + ".wav")), "wb") as target:
        target.setparams((1, 2, rate, 0, "NONE", ""))
        target.writeframes(pcm)
