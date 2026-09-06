import { z } from "zod";

/** Validates persisted invitations as well as attempts; unknown catalog versions can replay. */
export const switchChallengeSchema = z.object({
  id: z.string().min(1).max(100),
  version: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  kind: z.enum(["emotion", "speed"]),
  duration: z.number().min(15).max(20),
  difficulty: z.enum(["easy", "medium"]),
  rating: z.enum(["everyone", "teen", "mature"]),
  tags: z.array(z.string().min(1).max(60)).max(10),
  scoringVersion: z.string().min(1).max(80),
  rubricVersion: z.string().min(1).max(80),
  cues: z.array(z.object({
    id: z.string().min(1).max(100),
    text: z.string().min(1).max(300),
    emoji: z.string().min(1).max(20),
    speed: z.number().min(0.25).max(4).optional(),
    direction: z.string().min(1).max(400),
    directionLabel: z.string().min(1).max(60),
    start: z.number().min(0).max(20),
    end: z.number().min(0).max(20),
  }).strict()).min(4).max(6),
}).strict().superRefine((challenge, context) => {
  const ids = new Set<string>();
  challenge.cues.forEach((cue, index) => {
    const expectedStart = index === 0 ? 0 : challenge.cues[index - 1]!.end;
    if (ids.has(cue.id) || cue.start !== expectedStart || cue.end - cue.start < 2 || cue.end > challenge.duration) {
      context.addIssue({ code: "custom", path: ["cues", index], message: "Switch needs unique, contiguous cues with at least two seconds each." });
    }
    if (cue.text !== challenge.cues[0]!.text) context.addIssue({ code: "custom", path: ["cues", index, "text"], message: "Every Switch cue repeats the same phrase." });
    if (challenge.kind === "speed" && cue.speed === undefined) context.addIssue({ code: "custom", path: ["cues", index, "speed"], message: "Speed cues need the requested pace multiplier." });
    ids.add(cue.id);
  });
  if (challenge.cues.at(-1)?.end !== challenge.duration) {
    context.addIssue({ code: "custom", path: ["duration"], message: "Cue timing must cover the whole recording." });
  }
});
