
'use server';
// Note: JSDOM is a CommonJS module. If 'jsdom' causes issues with ES modules in Next.js server actions, 
// consider dynamic import or alternative HTML parsing libraries if needed.
// For now, assuming direct import works or project is configured for it.
// If build errors occur around JSDOM, this might need adjustment.
// Ensure 'jsdom' is added to dependencies if not already: npm install jsdom @types/jsdom
// For this exercise, we assume jsdom can be used as is.

let JSDOM_PROMISE: Promise<typeof import('jsdom').JSDOM> | null = null;

async function getJSDOM() {
  if (!JSDOM_PROMISE) {
    JSDOM_PROMISE = import('jsdom').then(jsdomModule => jsdomModule.JSDOM);
  }
  return JSDOM_PROMISE;
}


export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'RAGNavigatorBot/1.0' } });
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      // Return an empty string or a specific error message that can be handled by the caller
      return `Error fetching content: ${response.status}`;
    }
    const html = await response.text();
    const JSDOM = await getJSDOM();
    const dom = new JSDOM(html);
    const reader = new dom.window.DOMParser().parseFromString(html, 'text/html');
    
    // Remove script and style elements
    reader.querySelectorAll('script, style, noscript, iframe, nav, footer, header, aside').forEach(el => el.remove());

    // Heuristic to get main content, can be improved
    let mainContent = reader.querySelector('article')?.textContent || reader.querySelector('main')?.textContent || reader.body.textContent || '';
    
    // Basic cleaning
    mainContent = mainContent.replace(/\s\s+/g, ' ').trim(); // Collapse multiple whitespaces
    mainContent = mainCorpusBody(mainContent)
    return mainContent;

  } catch (error: any) {
    console.error(`Error processing content for ${url}:`, error.message);
    return `Error processing content: ${error.message}`;
  }
}

function mainCorpusBody(body: string) {
    // Split the body into lines
    const lines = body.split('\n');
    const cleanedLines: string[] = [];
    let consecutiveEmptyLines = 0;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
            consecutiveEmptyLines++;
        } else {
            if (consecutiveEmptyLines > 0 && cleanedLines.length > 0) {
                // Add a single empty line for separation if there were multiple
                cleanedLines.push(""); 
            }
            cleanedLines.push(trimmedLine);
            consecutiveEmptyLines = 0;
        }
    }
    // Remove leading/trailing empty lines that might have been added
    let start = 0;
    while (start < cleanedLines.length && cleanedLines[start] === "") start++;
    let end = cleanedLines.length -1;
    while (end >=0 && cleanedLines[end] === "") end--;

    return cleanedLines.slice(start, end + 1).join('\n');
}

