import { ResumeView } from "@/components/resume-view";
import { getDraft } from "@/lib/resume";
import { guard } from "../guard";

export default async function PreviewPage() {
  const g = await guard();
  if (!g.ok) return g.screen;

  const { resume, draftUpdatedAt } = await getDraft();
  return (
    <ResumeView
      resume={resume}
      updatedAt={draftUpdatedAt}
      banner={
        <div className="no-print sticky top-0 z-10 bg-brand px-5 py-2 text-center text-sm font-medium text-white">
          Draft preview: not public until you publish ·{" "}
          <a href="/admin" className="underline">Back to editor</a>
        </div>
      }
    />
  );
}
