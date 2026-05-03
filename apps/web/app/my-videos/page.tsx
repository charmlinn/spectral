import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@spectral/ui/components/button";

import { MyVideosPanel } from "../editor/editor-launcher";

export default async function MyVideosPage() {
  return (
    <main className="min-h-screen bg-[#17181c] text-white">
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#24262b] px-5">
        <Button asChild className="text-white/72 hover:bg-white/8 hover:text-white" variant="ghost">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Templates
          </Link>
        </Button>
        <Button asChild className="border-red-400/45 bg-red-500/10 text-red-200 hover:bg-red-500/18" variant="outline">
          <Link href="/">
            <Plus className="size-4" />
            New Video
          </Link>
        </Button>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">
            My videos
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">
            Recent projects
          </h1>
        </div>
        <MyVideosPanel />
      </section>
    </main>
  );
}
