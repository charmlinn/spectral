import { MyVideosPanel } from "./editor-launcher";

export default async function EditorIndexPage() {
  return (
    <main className="min-h-screen bg-[#17181c] px-5 py-6 text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">
            My videos
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight">
            Open a project
          </h1>
        </div>
        <MyVideosPanel />
      </section>
    </main>
  );
}
