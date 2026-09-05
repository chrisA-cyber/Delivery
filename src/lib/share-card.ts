import type { JudgeResult, Prompt } from "@/types/game";

export function wrapCardText(
  measure: (value: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Fits the entire text. Nothing is silently dropped from a shared receipt. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  startSize: number,
  family = "DM Sans",
) {
  let size = startSize;
  let lines: string[] = [];
  for (; size >= 10; size -= 1) {
    ctx.font = `700 ${size}px "${family}", Arial, sans-serif`;
    lines = wrapCardText((value) => ctx.measureText(value).width, text, width);
    if (
      lines.length * size * 1.2 <= height &&
      lines.every((line) => ctx.measureText(line).width <= width)
    )
      break;
  }
  if (size < 10)
    throw new Error(
      "This receipt is too long for a readable card. Save the audio or copy the playable line.",
    );
  lines.forEach((line, index) =>
    ctx.fillText(line, x, y + size + index * size * 1.2),
  );
}

export async function createResultCard(prompt: Prompt, result: JudgeResult) {
  await Promise.all([
    document.fonts.load('700 48px "DM Sans"'),
    document.fonts.load('700 120px "Barlow Condensed"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  const fixture = result.source === "fallback";
  ctx.fillStyle = "#171715";
  ctx.fillRect(0, 0, 1200, 800);
  ctx.fillStyle = "#f4f0e7";
  ctx.font = '700 40px "Barlow Condensed", Arial';
  ctx.fillText("DELIVERY", 48, 67);
  ctx.font = '700 15px "DM Sans", Arial';
  ctx.textAlign = "right";
  ctx.fillStyle = "#c9edbc";
  ctx.fillText(
    fixture ? "LOCAL FIXTURE · NOT A LIVE SCORE" : "THE VOICE PERFORMANCE GAME",
    1152,
    59,
  );
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4f0e7";
  ctx.beginPath();
  ctx.roundRect(40, 104, 1120, 400, 20);
  ctx.fill();
  ctx.fillStyle = "#171715";
  ctx.font = '700 14px "DM Sans", Arial';
  ctx.fillText("THE LINE", 72, 142);
  fitText(ctx, `“${prompt.line}”`, 72, 160, 750, 290, 48);
  ctx.fillStyle = "#ff745c";
  ctx.beginPath();
  ctx.roundRect(872, 136, 256, 330, 14);
  ctx.fill();
  ctx.fillStyle = "#171715";
  ctx.font = '700 15px "DM Sans", Arial';
  ctx.textAlign = "center";
  ctx.fillText(fixture ? "FIXTURE SCORE" : "DELIVERY SCORE", 1000, 181);
  ctx.font = '700 160px "Barlow Condensed", Arial';
  ctx.fillText(String(result.scores.overall), 1000, 338);
  ctx.font = '700 20px "DM Sans", Arial';
  ctx.fillText("/ 100", 1000, 376);
  ctx.textAlign = "left";
  fitText(ctx, result.title, 894, 405, 212, 35, 20);
  ctx.fillStyle = "#c9edbc";
  ctx.beginPath();
  ctx.roundRect(40, 522, 1120, 158, 16);
  ctx.fill();
  ctx.fillStyle = "#171715";
  ctx.font = '700 14px "DM Sans", Arial';
  ctx.fillText("THE DIRECTION", 72, 559);
  fitText(ctx, prompt.energy, 72, 572, 1056, 80, 27);
  ctx.fillStyle = "#b5b3aa";
  ctx.font = '500 15px "DM Sans", Arial';
  ctx.fillText(
    `Commitment ${result.scores.commitment}  /  Comedy ${result.scores.comedy}  /  Accuracy ${result.scores.accuracy}  /  Chaos ${result.scores.chaos}`,
    48,
    719,
  );
  ctx.fillStyle = "#f4f0e7";
  ctx.font = '700 16px "DM Sans", Arial';
  ctx.fillText("SAME LINE. YOUR INTERPRETATION?", 48, 763);
  ctx.textAlign = "right";
  ctx.fillStyle = "#b5b3aa";
  ctx.font = '500 14px "DM Sans", Arial';
  ctx.fillText(
    prompt.rating === "mature" ? "MATURE · 18+" : "AUDIO NOT INCLUDED",
    1152,
    763,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not create card")),
      "image/png",
    ),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
