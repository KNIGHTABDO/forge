import type { Metadata } from 'next';
import ResearchClient from '@/components/research/ResearchClient';
import '../research.css';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const titleSuffix = id === 'new' ? 'Start' : id;
  return {
    title: `Forge Deep Research (Beta) · ${titleSuffix}`,
    description: 'Standalone deep research workflow with live progress, transparent source analysis, and citable reports.',
  };
}

export default async function ResearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResearchClient researchId={id} />;
}
