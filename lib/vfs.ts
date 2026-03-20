export function parseVFS(rawMarkdown: string): Record<string, string> {
  const files: Record<string, string> = {};
  
  const blockRegex = /```[\w-]*\n([\s\S]*?)```/g;
  let match;
  let lastIndex = 0;
  
  while ((match = blockRegex.exec(rawMarkdown)) !== null) {
     const code = match[1];
     // Text before this code block, since the last code block
     const textBefore = rawMarkdown.substring(lastIndex, match.index);
     lastIndex = blockRegex.lastIndex;
     
     // Look for something that looks like a path in textBefore
     const pathMatch = textBefore.match(/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jsx?|tsx?|css|html|json|js|ts)/g);
     let path = '/App.jsx'; // default
     if (pathMatch && pathMatch.length > 0) {
        path = pathMatch[pathMatch.length - 1]; // take the last one found before the block
     } else {
        // Look inside the code block's first line for a comment
        const firstLine = code.split('\n')[0];
        const insideMatch = firstLine.match(/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:jsx?|tsx?|css|html|json|js|ts)/);
        if (insideMatch) {
            path = insideMatch[0];
        } else {
            // Deduplicate if we fallback to App.jsx multiple times
            path = `/App_${Object.keys(files).length}.jsx`;
        }
     }
     
     if (!path.startsWith('/')) path = '/' + path;
     files[path] = code;
  }
  
  if (Object.keys(files).length === 0) {
      if (rawMarkdown.includes('```')) {
          const parts = rawMarkdown.split('```');
          if (parts.length > 1) {
              const code = parts[1].replace(/^[a-z]*\n/, '');
              files['/App.jsx'] = code;
          }
      } else {
          files['/App.jsx'] = `/* VFS PARSE FAILED\\nRAW OUPUT:\\n${rawMarkdown.replace(/\\*/g, '\\\\*')}\\n*/\\nexport default function App() { return <h1>Hello world</h1> }`;
      }
  }
  
  return files;
}
