import { getToolFiles, getToolHTML, getToolMeta } from '@/lib/github';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ToolViewerClient from '@/components/ToolViewerClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getToolMeta(slug);
  return {
    title: meta?.title ? `${meta.title} | FORGE` : `${slug} | FORGE`,
    description: meta?.description || 'An app built with FORGE',
  };
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const [files, meta] = await Promise.all([getToolFiles(slug), getToolMeta(slug)]);

  if (files && files.length > 0) {
    return (
      <ToolViewerClient
        files={files}
        withBanner={true}
        slug={slug}
        title={meta?.title || slug}
      />
    );
  }

  const html = await getToolHTML(slug);

  if (!html) {
    notFound();
  }

  const legacyFiles = [{ path: '/public/index.html', content: html }];

  return (
    <ToolViewerClient
      files={legacyFiles}
      withBanner={true}
      slug={slug}
      title={meta?.title || slug}
    />
  );
}
