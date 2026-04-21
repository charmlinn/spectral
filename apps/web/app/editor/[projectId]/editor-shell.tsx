"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { PanelRight } from "lucide-react";

import type { EditorPanelId, EditorProjectSnapshot } from "@/src/lib/editor-mocks";
import { Button } from "@spectral/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@spectral/ui/components/sheet";

import { EditorHeader } from "./_components/editor-header";
import { EditorSidebar } from "./_components/editor-sidebar";
import { InspectorPanel } from "./_components/inspector-panel";
import { PreviewStage } from "./_components/preview-stage";
import { TimelinePanel } from "./_components/timeline-panel";

type EditorShellProps = {
  project: EditorProjectSnapshot;
};

const zoomSteps = ["50%", "75%", "100%", "125%"];

export function EditorShell({ project }: EditorShellProps) {
  const [activePanelId, setActivePanelId] = useState<EditorPanelId>(project.sections[0]?.id ?? "general");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState("100%");
  const deferredPanelId = useDeferredValue(activePanelId);

  const activeSection = useMemo(
    () => project.sections.find((section) => section.id === deferredPanelId) ?? project.sections[0],
    [deferredPanelId, project.sections],
  );

  if (!activeSection) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
      <EditorHeader
        inspectorOpen={inspectorOpen}
        lastSavedAt={project.lastSavedAt}
        presetName={project.presetName}
        projectId={project.id}
        resolution={project.resolution}
        status={project.status}
        title={project.title}
        onOpenMobileInspector={() => setMobileInspectorOpen(true)}
        onToggleInspector={() => setInspectorOpen((currentValue) => !currentValue)}
      />

      <div className="xl:hidden">
        <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
          <SheetTrigger asChild>
            <Button className="w-full justify-center" variant="outline">
              <PanelRight className="size-4" />
              Open Inspector Drawer
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[92vw] max-w-none overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Inspector Drawer</SheetTitle>
              <SheetDescription>
                Mobile access to diagnostics, project notes, and future object-level controls.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <InspectorPanel cards={project.inspectorCards} projectId={project.id} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
        <EditorSidebar
          activeSectionId={activePanelId}
          section={activeSection}
          sections={project.sections}
          onSelectSection={(sectionId) => {
            startTransition(() => {
              setActivePanelId(sectionId);
            });
          }}
        />

        <div className="flex min-h-0 flex-col gap-4">
          <PreviewStage
            activeSectionLabel={activeSection.label}
            aspectRatio={project.aspectRatio}
            notes={project.notes}
            previewStats={project.previewStats}
            stageLabel={project.stageLabel}
            zoomLevel={zoomLevel}
            zoomSteps={zoomSteps}
            onZoomChange={setZoomLevel}
          />
          <TimelinePanel duration={project.duration} tracks={project.tracks} />
        </div>

        <InspectorPanel
          cards={project.inspectorCards}
          className={inspectorOpen ? "hidden xl:flex" : "hidden"}
          projectId={project.id}
        />
      </div>
    </main>
  );
}
