import { ResumeView } from "@/components/resume-view";
import { getPublished } from "@/lib/resume";

// Rendered per request so edits published from /admin show up immediately,
// with no rebuild or redeploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { resume, publishedAt } = await getPublished();
  return <ResumeView resume={resume} updatedAt={publishedAt} />;
}
