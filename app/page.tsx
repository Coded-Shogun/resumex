import { ResumeView } from "@/components/resume-view";
import { getActive } from "@/lib/resume";

// Rendered per request so a version made live in /admin shows up
// immediately, with no rebuild or redeploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { resume, activatedAt } = await getActive();
  return <ResumeView resume={resume} updatedAt={activatedAt} />;
}
