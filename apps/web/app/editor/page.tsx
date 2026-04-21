import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";

import { EditorLauncher } from "./editor-launcher";

export default async function EditorIndexPage() {
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
            This route no longer uses placeholder project cards. Open an existing persisted project or create one
            through the real API first.
          </p>
        </div>
      </div>

      <EditorLauncher />

      <Card>
        <CardHeader>
          <CardTitle>Current Constraint</CardTitle>
          <CardDescription>The project list API is not exposed yet, so this page stays intentionally minimal.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          There is no mock browse list here. If a project ID does not exist, the editor route will fail fast with the
          real backend response.
        </CardContent>
      </Card>
    </main>
  );
}
