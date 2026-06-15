import { getProject } from "@/lib/api";
import { ResultsDashboard } from "@/components/ResultsDashboard";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  return <ResultsDashboard project={project} />;
}
