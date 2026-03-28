import { getToolFiles, getToolHTML, getToolMeta } from '@/lib/github';
import ToolViewerClient from '@/components/ToolViewerClient';

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Try fetching as V2 project files
  let files = await getToolFiles(slug);
  
  if (!files || files.length === 0) {
     // Fallback to legacy V1 storage schema
     const html = await getToolHTML(slug);
     if (html) {
       files = [{ path: '/public/index.html', content: html }];
     } else {
       return <div style={{ background: '#000', color: '#fff', padding: 20 }}>Tool not found</div>;
     }
  }

  const meta = await getToolMeta(slug);
  const title = meta?.title || slug;

  return (
    <ToolViewerClient 
      files={files} 
      withBanner={false} 
      slug={slug} 
      title={title} 
    />
  );
}
