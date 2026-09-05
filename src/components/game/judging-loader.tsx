"use client";
import { Download, Headphones, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob } from "@/lib/share-card";

export function JudgingLoader({ audioBlob }: { audioBlob?: Blob | null }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <section
      className="game-experience py-12 sm:py-20"
      aria-busy="true"
      aria-labelledby="judging-title"
    >
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-8 grid size-20 place-items-center rounded-2xl bg-electric text-ink">
          <Headphones className="size-9" />
        </div>
        <p className="mono-label text-acid">Take submitted · private</p>
        <h1
          id="judging-title"
          className="display-type mt-4 text-6xl sm:text-7xl"
        >
          The jury is
          <br />
          in session.
        </h1>
        <p role="status" className="mt-6 text-base leading-7 text-white/70">
          {seconds < 25
            ? "Your take is being processed. The next screen has your result and a note for the next attempt."
            : "This is taking longer than usual. Your original take is still on this device. A slow request won’t discard it."}
        </p>
        <div className="mt-7 flex items-center justify-center gap-3 text-sm text-electric">
          <LoaderCircle className="size-4 animate-spin" />
          <span>{seconds}s elapsed</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-white/60">
          Please keep this page open. There is no public audience.
        </p>
        {audioBlob && (
          <button
            className="button-ghost mt-6"
            onClick={() => downloadBlob(audioBlob, "delivery-take.wav")}
          >
            <Download className="size-4" />
            Save a copy of your take
          </button>
        )}
      </div>
    </section>
  );
}
