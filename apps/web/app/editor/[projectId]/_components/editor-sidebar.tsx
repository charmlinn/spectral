"use client";

import type { EditorPanelId, EditorSection } from "@/src/lib/editor-mocks";

import { Button } from "@spectral/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@spectral/ui/components/card";
import { Input } from "@spectral/ui/components/input";
import { ScrollArea } from "@spectral/ui/components/scroll-area";
import { Textarea } from "@spectral/ui/components/textarea";

type EditorSidebarProps = {
  activeSectionId: EditorPanelId;
  section: EditorSection;
  sections: EditorSection[];
  onSelectSection: (sectionId: EditorPanelId) => void;
};

export function EditorSidebar({
  activeSectionId,
  section,
  sections,
  onSelectSection,
}: EditorSidebarProps) {
  return (
    <Card className="flex min-h-[32rem] flex-col overflow-hidden">
      <CardHeader className="gap-2">
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          The left rail mirrors the original Specterr editor categories while keeping the data layer out of the
          shell.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 px-4 pt-0">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-1">
          {sections.map((item) => (
            <Button
              key={item.id}
              className="justify-start rounded-[22px]"
              size="sm"
              variant={item.id === activeSectionId ? "secondary" : "ghost"}
              onClick={() => onSelectSection(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </CardContent>

      <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
        <div className="space-y-6 pb-6">
          <div className="rounded-[24px] border border-border/70 bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">{section.eyebrow}</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold">{section.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
          </div>

          <div className="grid gap-3">
            {section.fields.map((field) => (
              <label key={field.label} className="grid gap-2">
                <span className="text-sm font-medium">{field.label}</span>
                {field.multiline ? (
                  <Textarea readOnly value={field.value} />
                ) : (
                  <Input readOnly value={field.value} />
                )}
                <span className="text-xs leading-5 text-muted-foreground">{field.helper}</span>
              </label>
            ))}
          </div>

          <div className="rounded-[24px] border border-dashed border-border bg-background/60 p-4">
            <p className="text-sm font-medium">Integration edges</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {section.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </Card>
  );
}
