"use client";

import type { EditorTrack } from "@/src/lib/editor-mocks";

import { Badge } from "@spectral/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Slider } from "@spectral/ui/components/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@spectral/ui/components/tabs";

type TimelinePanelProps = {
  duration: string;
  tracks: EditorTrack[];
};

const rulerMarks = ["00:00", "00:05", "00:10", "00:15", "00:20", "00:25", "00:30", "00:35", "00:40", "00:45"];

export function TimelinePanel({ duration, tracks }: TimelinePanelProps) {
  return (
    <Card className="flex min-h-[18rem] flex-col overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Timeline shell</Badge>
              <Badge variant="outline">Duration {duration}</Badge>
            </div>
            <div>
              <CardTitle>Bottom timeline container</CardTitle>
              <CardDescription>
                Placeholder mount for the dedicated timeline package and interaction engine.
              </CardDescription>
            </div>
          </div>
          <div className="min-w-56 space-y-2 rounded-[22px] border border-border/70 bg-background/60 px-4 py-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <span>Timeline zoom</span>
              <span>125%</span>
            </div>
            <Slider defaultValue={[62]} max={100} step={1} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1">
        <Tabs className="flex min-h-0 flex-col gap-4" defaultValue="timeline">
          <TabsList className="w-fit">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <div className="grid grid-cols-10 gap-2 rounded-[24px] border border-border/70 bg-background/50 p-4 text-xs text-muted-foreground">
              {rulerMarks.map((mark) => (
                <div key={mark} className="rounded-full border border-border/70 px-2 py-1 text-center">
                  {mark}
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="grid gap-3 rounded-[24px] border border-border/70 bg-background/60 p-4 lg:grid-cols-[11rem_minmax(0,1fr)]"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{track.label}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{track.kind}</p>
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {Array.from({ length: track.clips }).map((_, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className={`h-10 flex-1 rounded-full ${track.accent} shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]`}
                      />
                    ))}
                    <span className="shrink-0 text-xs text-muted-foreground">{track.durationLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="lyrics" className="rounded-[24px] border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
            Lyric cue editing is intentionally deferred to the dedicated timeline package while this shell keeps the
            workspace proportions stable.
          </TabsContent>

          <TabsContent
            value="diagnostics"
            className="rounded-[24px] border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground"
          >
            This panel is reserved for transport state, selection diagnostics, and drag metadata once the timeline
            engine lands.
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
