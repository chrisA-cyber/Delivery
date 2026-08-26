import type { JudgeResult, Prompt } from "@/types/game";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

export async function createResultCard(prompt: Prompt, result: JudgeResult) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, 1200, 630);
  const gradient = ctx.createRadialGradient(1080, 40, 0, 1080, 40, 540);
  gradient.addColorStop(0, "rgba(255,76,200,.45)");
  gradient.addColorStop(1, "rgba(255,76,200,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = "#caff33";
  roundedRect(ctx, 58, 52, 58, 58, 15);
  ctx.fillStyle = "#070707";
  ctx.font = "900 35px Arial";
  ctx.fillText("D", 75, 93);
  ctx.fillStyle = "#f5f2e8";
  ctx.font = "900 30px Arial";
  ctx.fillText("DELIVERY", 132, 92);

  ctx.fillStyle = "#ff4cc8";
  ctx.font = "800 18px Arial";
  ctx.fillText(result.title.toUpperCase(), 62, 180);
  ctx.fillStyle = "#f5f2e8";
  ctx.font = "900 52px Arial";
  wrapText(ctx, `“${prompt.line}”`, 62, 250, 720, 61, 4);

  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "700 20px Arial";
  ctx.fillText(prompt.energy, 62, 530);
  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.font = "700 16px Arial";
  ctx.fillText("delivery.game · SAY THE LINE. GET JUDGED.", 62, 580);

  ctx.fillStyle = "#caff33";
  roundedRect(ctx, 900, 175, 235, 235, 46);
  ctx.fillStyle = "#070707";
  ctx.font = "900 126px Arial";
  ctx.textAlign = "center";
  ctx.fillText(String(result.scores.overall), 1017, 330);
  ctx.font = "900 19px Arial";
  ctx.fillText("DELIVERY SCORE", 1017, 374);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create card")), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
