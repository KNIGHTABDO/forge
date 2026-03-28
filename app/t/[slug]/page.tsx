import { getToolFiles, getToolHTML, getToolMeta } from '@/lib/github';
import ToolViewerClient from '@/components/ToolViewerClient';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getToolMeta(slug);
  return {
    title: `${meta?.title || slug} — FORGE`
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Try fetching as V2 project files
  let files = await getToolFiles(slug);
  
  if (!files || files.length === 0) {
     // Fallback to legacy V1 storage schema
     const html = await getToolHTML(slug);
     if (html) {
       files = [{ path: '/public/index.html', content: html }];
     } else {
       const notFoundProps = { background: '#000', color: '#fff', padding: 20, textAlign: 'center' as const };
       return (
          <div style={{...notFoundProps, height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
             <h1>Tool not found</h1>
             <p>No tool exists at /t/{slug}</p>
          </div>
       );
     }
  }

  const meta = await getToolMeta(slug);
  const title = meta?.title || slug;

  return (
    <ToolViewerClient 
      files={files} 
      withBanner={true} 
      slug={slug} 
      title={title} 
    />
  );
}
