import { Editor } from "@/components/admin/editor";
import { getDraft } from "@/lib/resume";
import { guard } from "./guard";

export default async function AdminPage() {
  const g = await guard();
  if (!g.ok) return g.screen;

  const { resume, draftUpdatedAt, publishedAt } = await getDraft();
  return <Editor initial={resume} email={g.email} draftUpdatedAt={draftUpdatedAt} publishedAt={publishedAt} />;
}
