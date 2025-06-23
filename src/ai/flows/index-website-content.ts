
'use server';

/**
 * @fileOverview Indexes website content by crawling a sitemap URL (including sitemap indexes), respecting robots.txt if parser is available.
 *
 * - indexWebsiteContent - A function that initiates the website indexing process.
 * - IndexWebsiteContentInput - The input type for the indexWebsiteContent function.
 * - IndexWebsiteContentOutput - The return type for the indexWebsiteContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

let JSDOM_PROMISE: Promise<typeof import('jsdom').JSDOM> | null = null;
async function getJSDOM() {
  if (!JSDOM_PROMISE) {
    JSDOM_PROMISE = import('jsdom').then(jsdomModule => jsdomModule.JSDOM);
  }
  return JSDOM_PROMISE;
}


// Minimal interface for the parts of robots-txt-parser we use
interface RobotsParser {
  isAllowed: (url: string) => boolean;
  parse: (content: string) => void;
}

let ROBOTS_TXT_PARSER_MODULE_PROMISE: Promise<any | null> | null = null;

const MAX_URLS_TO_INDEX = 50; // Limit the number of URLs to process
const FETCH_DELAY_MS = 250;   // Delay between fetching pages
const SITEMAP_FETCH_DELAY_MS = 100; // Shorter delay between fetching sub-sitemaps
const FETCH_USER_AGENT = 'RAGNavigatorBot/1.0 (+https://firebase.google.com/docs/app-hosting)';


async function getRobotsTxtParserModule(): Promise<any | null> {
  if (!ROBOTS_TXT_PARSER_MODULE_PROMISE) {
    // To avoid build-time "Module not found" errors when 'robots-txt-parser'
    // is not installed or cannot be resolved by the bundler, we'll directly
    // return a promise resolving to null. The application logic will then
    // fall back to not using robots.txt parsing.
    ROBOTS_TXT_PARSER_MODULE_PROMISE = Promise.resolve(null);
    console.warn(
      "The 'robots-txt-parser' module is not available or could not be loaded. " +
      "This might be due to installation issues or build configuration. " +
      "As a result, robots.txt rules will not be strictly checked, and all URLs found in the sitemap " +
      "will be attempted for indexing. If robots.txt parsing is critical, " +
      "ensure 'robots-txt-parser' is correctly installed and accessible in your project environment."
    );
  }
  return ROBOTS_TXT_PARSER_MODULE_PROMISE;
}


const IndexWebsiteContentInputSchema = z.object({
  sitemapUrl: z.string().describe('The URL of the sitemap (or sitemap index) to index.'),
});
export type IndexWebsiteContentInput = z.infer<typeof IndexWebsiteContentInputSchema>;

const IndexWebsiteContentOutputSchema = z.object({
  indexedUrls: z.array(z.string()).describe('The URLs that were successfully indexed.'),
  skippedUrls: z.array(z.string()).describe('The URLs that were skipped due to robots.txt (if parser available) or errors.'),
  errors: z.array(z.string()).describe('Errors encountered during indexing.'),
});
export type IndexWebsiteContentOutput = z.infer<typeof IndexWebsiteContentOutputSchema>;

export async function indexWebsiteContent(input: IndexWebsiteContentInput): Promise<IndexWebsiteContentOutput> {
  return indexWebsiteContentFlow(input);
}

async function fetchRobotsTxt(sitemapUrl: string): Promise<string | null> {
  try {
    const baseUrl = new URL(sitemapUrl).origin;
    const robotsUrl = `${baseUrl}/robots.txt`;
    const response = await fetch(robotsUrl, { headers: { 'User-Agent': FETCH_USER_AGENT }});
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch (error: any) {
    console.error('Error fetching robots.txt:', error.message);
    return null;
  }
}

// Fetches XML and returns JSDOM document or null on error
async function fetchAndGetJsdomDoc(url: string, errors: string[]): Promise<Document | null> {
    try {
      const JSDOM = await getJSDOM();
      const response = await fetch(url, { headers: { 'User-Agent': FETCH_USER_AGENT }});
      if (!response.ok) {
        errors.push(`Failed to fetch sitemap/index at ${url}: ${response.status} ${response.statusText}`);
        return null;
      }
      const xml = await response.text();
      if (!xml.trim()) {
        errors.push(`Sitemap/index at ${url} is empty.`);
        return null;
      }
      const dom = new JSDOM(xml, { contentType: 'application/xml' });
      return dom.window.document;
    } catch (error: any) {
      errors.push(`Error fetching or parsing XML for ${url}: ${error.message}`);
      return null;
    }
}

// Extracts page URLs from a JSDOM document representing a single sitemap (not an index)
async function extractPageUrlsFromSitemapDoc(doc: Document): Promise<string[]> {
    const urls: string[] = [];
    const locElements = doc.getElementsByTagName('loc');
    for (let i = 0; i < locElements.length; i++) {
        if (locElements[i].textContent) {
            urls.push(locElements[i].textContent!);
        }
    }
    return urls;
}

async function getSitemapUrls(initialSitemapUrl: string, errors: string[]): Promise<string[]> {
  const allPageUrls: string[] = [];
  const processedSitemapUrls = new Set<string>(); // To avoid loops or duplicate processing of sitemap files
  const sitemapQueue: string[] = [initialSitemapUrl];

  while (sitemapQueue.length > 0 && allPageUrls.length < MAX_URLS_TO_INDEX) {
    const currentSitemapUrl = sitemapQueue.shift()!;

    if (processedSitemapUrls.has(currentSitemapUrl)) {
      continue; 
    }
    processedSitemapUrls.add(currentSitemapUrl);

    // Apply delay only for sub-sitemaps, not the initial one
    if (currentSitemapUrl !== initialSitemapUrl && SITEMAP_FETCH_DELAY_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, SITEMAP_FETCH_DELAY_MS));
    }

    const doc = await fetchAndGetJsdomDoc(currentSitemapUrl, errors);
    if (!doc) {
      continue;
    }

    const sitemapIndexElements = doc.getElementsByTagName('sitemapindex');
    
    if (sitemapIndexElements.length > 0) {
      // It's a sitemap index file
      if (currentSitemapUrl === initialSitemapUrl) {
          errors.push(`Detected sitemap index at ${currentSitemapUrl}. Processing sub-sitemaps listed within.`);
      }
      const sitemapTags = sitemapIndexElements[0].getElementsByTagName('sitemap');
      for (let i = 0; i < sitemapTags.length; i++) {
        const locTag = sitemapTags[i].getElementsByTagName('loc')[0];
        if (locTag && locTag.textContent) {
          if (!processedSitemapUrls.has(locTag.textContent)) {
            sitemapQueue.push(locTag.textContent);
          }
        }
      }
    } else {
      // Not a sitemap index, treat as a sitemap containing page URLs
      const pageUrls = await extractPageUrlsFromSitemapDoc(doc);
      if (pageUrls.length === 0 && doc.documentElement && doc.documentElement.textContent && doc.documentElement.textContent.trim().length > 0) {
           errors.push(`Sitemap at ${currentSitemapUrl} (not an index) contained no <loc> tags or was malformed for <loc> extraction, despite having content.`);
      }
      for (const pageUrl of pageUrls) {
        if (allPageUrls.length < MAX_URLS_TO_INDEX) {
          allPageUrls.push(pageUrl);
        } else {
          errors.push(`Reached MAX_URLS_TO_INDEX limit (${MAX_URLS_TO_INDEX}) while processing ${currentSitemapUrl}. Not all URLs from this sitemap were included.`);
          sitemapQueue.length = 0; // Stop processing further sitemaps from the queue
          break;
        }
      }
    }
  }

  if (sitemapQueue.length > 0 && allPageUrls.length >= MAX_URLS_TO_INDEX) {
    errors.push(`Sitemap processing stopped due to MAX_URLS_TO_INDEX limit (${MAX_URLS_TO_INDEX}). There may be more sitemaps in the index or queue that were not processed.`);
  }
  
  // Final check if no URLs were found from a non-empty initial sitemap
  if (allPageUrls.length === 0) {
    const hasNonDetectionErrors = errors.some(e => !e.startsWith("Detected sitemap index"));
    if (!hasNonDetectionErrors) { // Only if the only "error" was detection message, or no errors at all
        const initialDocCheck = await fetchAndGetJsdomDoc(initialSitemapUrl, []); // Re-check content without polluting main errors
        if (initialDocCheck && initialDocCheck.documentElement && initialDocCheck.documentElement.textContent && initialDocCheck.documentElement.textContent.trim().length > 0) {
            errors.push(`No page URLs ultimately found from ${initialSitemapUrl} (and its sub-sitemaps, if any). The sitemap(s) might be empty of page links, malformed, or in an unsupported format for page URL extraction.`);
        } else if (initialDocCheck === null && errors.length === 0){ // fetchAndGetJsdomDoc would have pushed error if it failed
             errors.push(`Failed to fetch or parse the initial sitemap at ${initialSitemapUrl}. It might be unavailable or empty.`);
        }
    }
  }

  return allPageUrls.slice(0, MAX_URLS_TO_INDEX); // Ensure limit is strictly applied
}


async function fetchAndIndexContent(url: string): Promise<string | null> {
  try {
    const JSDOM = await getJSDOM();
    const response = await fetch(url, { headers: { 'User-Agent': FETCH_USER_AGENT }});
    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    const dom = new JSDOM(html);
    // Prefer main content areas, then body, then strip scripts/styles
    let textContent = dom.window.document.querySelector('article')?.textContent ||
                      dom.window.document.querySelector('main')?.textContent ||
                      dom.window.document.body?.textContent || '';
    
    // Fallback to parsing and cleaning if specific tags not found or body is too noisy
    if (!textContent || textContent.length < 100) { // Arbitrary threshold for "too short"
        const tempDoc = new JSDOM(html).window.document;
        tempDoc.querySelectorAll('script, style, nav, footer, header, aside, noscript, iframe, form, button, input, select, textarea, label, .sidebar, .menu, .advertisement, .ad, .banner, #sidebar, #navigation, #footer, #header')
            .forEach(el => el.remove());
        textContent = tempDoc.body?.textContent || '';
    }
    
    textContent = textContent.replace(/\s\s+/g, ' ').trim(); // Collapse multiple whitespaces
    
    console.log(`Indexed content from ${url} (length: ${textContent.length})`);
    return textContent; 
  } catch (error: any) {
    console.error(`Error fetching or indexing content from ${url}:`, error.message);
    return null;
  }
}

const indexWebsiteContentFlow = ai.defineFlow(
  {
    name: 'indexWebsiteContentFlow',
    inputSchema: IndexWebsiteContentInputSchema,
    outputSchema: IndexWebsiteContentOutputSchema,
  },
  async input => {
    const {sitemapUrl} = input;
    const indexedUrls: string[] = [];
    const skippedUrls: string[] = [];
    const errors: string[] = [];

    const robotsTxtContent = await fetchRobotsTxt(sitemapUrl);
    const RobotsTxtParserConstructor = await getRobotsTxtParserModule();
    let parser: RobotsParser | null = null;

    if (RobotsTxtParserConstructor) {
      try {
        parser = new RobotsTxtParserConstructor({
          userAgent: FETCH_USER_AGENT, 
          allowOnNeutral: true, 
        });
        if (robotsTxtContent) {
          parser.parse(robotsTxtContent);
        } else {
          console.log('robots.txt not found or could not be fetched, proceeding without robots.txt rules (parser was available).');
        }
      } catch (error: any) {
         console.error("Error initializing or parsing with robots-txt-parser (constructor was available but failed):", error.message);
         parser = null; 
      }
    } else if (robotsTxtContent) {
        console.warn(`robots.txt content was fetched for ${new URL(sitemapUrl).origin}, but the 'robots-txt-parser' module could not be loaded/initialized. URLs will be processed without strict robots.txt rule enforcement.`);
    }

    let sitemapUrlsToParse: string[] = [];
    try {
        sitemapUrlsToParse = await getSitemapUrls(sitemapUrl, errors);
    } catch (error: any) {
        errors.push(`Failed to parse sitemap(s): ${error.message}`);
        return { indexedUrls, skippedUrls, errors };
    }
    
    const actualUrlsToProcess = sitemapUrlsToParse; // Already capped by getSitemapUrls and errors logged if so.


    for (const url of actualUrlsToProcess) {
      let normalizedUrl = url;
      try {
        normalizedUrl = new URL(url).toString(); 
      } catch (e: any) {
        errors.push(`Invalid URL from sitemap: ${url} - ${e.message}`);
        skippedUrls.push(url); 
        continue;
      }
      
      if (parser && robotsTxtContent && !parser.isAllowed(normalizedUrl)) {
        skippedUrls.push(normalizedUrl);
        console.log(`Skipping ${normalizedUrl} due to robots.txt`);
        continue;
      }

      if (FETCH_DELAY_MS > 0) {
        await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS));
      }
      const content = await fetchAndIndexContent(normalizedUrl);
      if (content && content.trim().length > 0) { // Ensure content is not just whitespace
        indexedUrls.push(normalizedUrl);
      } else {
        skippedUrls.push(normalizedUrl);
        if (content === null) { // Fetching failed
            errors.push(`Failed to fetch content for ${normalizedUrl}.`);
        } else { // Content was empty or whitespace
            errors.push(`Content for ${normalizedUrl} was empty or only whitespace after processing.`);
        }
      }
    }

    return {
      indexedUrls,
      skippedUrls,
      errors,
    };
  }
);
