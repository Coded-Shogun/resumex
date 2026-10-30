import { notFound } from "next/navigation";
import { Editor } from "@/components/admin/editor";
import { getVersion } from "@/lib/resume";
import { guard } from "../../guard";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VersionPage({ params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g.ok) return g.screen;

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const version = await getVersion(id);
  if (!version) notFound();

  const { resume, ...meta } = version;
  return <Editor key={`${meta.id}-${meta.updatedAt}-${meta.isActive}`} initial={resume} version={meta} role={g.profile.role} />;
}
