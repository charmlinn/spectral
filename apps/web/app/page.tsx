import Link from "next/link";
import { ArrowRight, Layers3, PlaySquare, Workflow } from "lucide-react";

import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";

export default async function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <Card className="surface-glow overflow-hidden">
          <CardHeader className="gap-4">
            <Badge className="w-fit" variant="secondary">
              Spectral monorepo
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-4xl sm:text-5xl">
                Editor shell scaffolded for the Next.js workspace.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base text-muted-foreground">
                The foundation is wired for the web app, shared UI, workspace config, and a stable editor
                surface that other packages can mount into.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/editor">
                Open real editor launcher
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/editor">Create or open a project</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              title: "apps/web",
              description: "App Router shell, editor routes, and responsive workspace layout.",
              icon: PlaySquare,
            },
            {
              title: "packages/ui",
              description: "Minimal shadcn-style component surface shared across the workspace.",
              icon: Layers3,
            },
            {
              title: "packages/config",
              description: "Shared TS, ESLint, PostCSS, and Tailwind entry points.",
              icon: Workflow,
            },
          ].map(({ description, icon: Icon, title }) => (
            <Card key={title}>
              <CardHeader className="pb-3">
                <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge className="w-fit">Current Mode</Badge>
            <CardTitle>Editor routes now expect real persisted projects.</CardTitle>
            <CardDescription>
              Mock snapshots and fake timeline/preview placeholders are being removed from the main editor chain.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the launcher to create a real project record or open an existing project ID. The editor page now loads
            through the actual project API rather than demo content.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              Integration
            </Badge>
            <CardTitle>Runtime, timeline, save, and export wire directly into upstream packages.</CardTitle>
            <CardDescription>
              The central goal is a connected editor path, not a decorative shell.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/editor">Go to launcher</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
