import { notFound } from "next/navigation";
import { ResumeView } from "@/components/resume-view";
import { getVersion } from "@/lib/resume";
import { guard } from "../../../guard";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.screen;

  const { id } = await params;
  const version = /^[0-9a-f-]{36}$/i.test(id) ? await getVersion(id) : null;
  if (!version) notFound();

  return (
    <ResumeView
      resume={version.resume}
      updatedAt={version.updatedAt}
      banner={
        <div className="no-print sticky top-0 z-10 bg-brand px-5 py-2 text-center text-sm font-medium text-white">
          Preview of “{version.label}”{version.isActive ? " (live)" : ": not public"} ·{" "}
          <a href={`/admin/versions/${version.id}`} className="underline">Back to editor</a>
        </div>
      }
    />
  );
}
