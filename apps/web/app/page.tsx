import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";

import { Button } from "@spectral/ui/components/button";

import { EditorLauncher } from "./editor/editor-launcher";

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-[#17181c] text-white">
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#24262b] px-5">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/8">
            <Sparkles className="size-4 text-red-400" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-wide">
            Spectral
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild className="border-white/15 bg-white/8 text-white hover:bg-white/12" variant="outline">
            <Link href="/my-videos">
              <FolderOpen className="size-4" />
              My Videos
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[92rem] flex-col gap-6 px-5 py-8">
        <div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">
              Video templates
            </p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">
              Choose a visualizer template
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/58">
              Start from an imported Specterr-style preset, then edit audio,
              artwork, text, visualizer layers, and export settings in the
              editor.
            </p>
          </div>
        </div>

        <EditorLauncher />
      </section>
    </main>
  );
}
