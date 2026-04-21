import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge } from "@spectral/ui/components/badge";
import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Input } from "@spectral/ui/components/input";

import { listEditorEntries } from "@/src/lib/editor-mocks";

export default async function EditorIndexPage() {
  const entries = await listEditorEntries();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button asChild className="w-fit" size="sm" variant="ghost">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Overview
            </Link>
          </Button>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Editor entry points</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            This route stays server-rendered and can later swap the mock entries for database-backed projects.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Input readOnly value="Search wiring reserved for project CRUD and query state." />
        </div>
      </div>

      <div className="grid gap-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{entry.presetName}</Badge>
                  <Badge variant="outline">{entry.resolution}</Badge>
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl">{entry.title}</CardTitle>
                  <CardDescription>{entry.description}</CardDescription>
                </div>
              </div>
              <CardContent className="p-0">
                <Button asChild>
                  <Link href={`/editor/${entry.id}`}>
                    Open shell
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
