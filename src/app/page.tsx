
"use client";

import React, { useState, useEffect } from "react";
import { indexWebsiteContent, type IndexWebsiteContentOutput } from "@/ai/flows/index-website-content";
import { answerQueryBasedOnContext, type AnswerQueryBasedOnContextOutput } from "@/ai/flows/answer-query-based-on-context";
import { fetchPageContent } from "./actions";
import { SitemapForm } from "@/components/sitemap-form";
import { QueryForm } from "@/components/query-form";
import { ResultsDisplay } from "@/components/results-display";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, ListChecks, Loader2, ShieldQuestion, FileText, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type QueryResultWithSources = AnswerQueryBasedOnContextOutput & { sources: string[] };

export default function RAGNavigatorPage() {
  const [sitemapUrl, setSitemapUrl] = useState<string>("");
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [isFetchingContent, setIsFetchingContent] = useState<boolean>(false);
  const [contentFetchProgress, setContentFetchProgress] = useState<number>(0);
  const [indexingResult, setIndexingResult] = useState<IndexWebsiteContentOutput | null>(null);
  const [indexedContentMap, setIndexedContentMap] = useState<Map<string, string> | null>(null);
  
  const [query, setQuery] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<QueryResultWithSources | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: error,
      });
      setError(null); // Clear error after showing toast
    }
  }, [error, toast]);

  const handleSitemapSubmit = async (url: string) => {
    setSitemapUrl(url);
    setIsIndexing(true);
    setIndexingResult(null);
    setIndexedContentMap(null);
    setQueryResult(null);
    setError(null);
    setContentFetchProgress(0);

    try {
      const result = await indexWebsiteContent({ sitemapUrl: url });
      setIndexingResult(result);

      if (result.errors && result.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Indexing Errors",
          description: (
            <ScrollArea className="h-20">
              <ul className="list-disc pl-5">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </ScrollArea>
          )
        });
      }

      if (result.indexedUrls && result.indexedUrls.length > 0) {
        setIsFetchingContent(true);
        const contentMap = new Map<string, string>();
        let fetchedCount = 0;
        for (const indexedUrl of result.indexedUrls) {
          try {
            const content = await fetchPageContent(indexedUrl);
            contentMap.set(indexedUrl, content);
          } catch (fetchErr: any) {
            console.error(`Failed to fetch content for ${indexedUrl}: ${fetchErr.message}`);
            contentMap.set(indexedUrl, `Error: Could not fetch content. ${fetchErr.message}`); // Store error message as content
          }
          fetchedCount++;
          setContentFetchProgress((fetchedCount / result.indexedUrls.length) * 100);
        }
        setIndexedContentMap(contentMap);
        toast({
          title: "Content Fetching Complete",
          description: `${contentMap.size} pages processed.`,
        });
      } else {
        toast({
          variant: "default",
          title: "Indexing Complete",
          description: "No URLs were indexed. Check sitemap or robots.txt.",
        });
      }
    } catch (e: any) {
      setError(`Indexing failed: ${e.message}`);
      setIndexingResult(null); // Clear partial results on hard fail
    } finally {
      setIsIndexing(false);
      setIsFetchingContent(false);
    }
  };

  const handleQuerySubmit = async (userQuery: string) => {
    setQuery(userQuery);
    setIsQuerying(true);
    setQueryResult(null);
    setError(null);

    if (!indexedContentMap || indexedContentMap.size === 0) {
      setError("No content available for querying. Please index a sitemap first.");
      setIsQuerying(false);
      return;
    }

    try {
      // Concatenate all fetched content to form the context
      const context = Array.from(indexedContentMap.values()).join("\n\n---\n\n");
      if (context.trim() === "") {
        setError("The indexed content is empty. Cannot perform query.");
        setIsQuerying(false);
        return;
      }
      
      const result = await answerQueryBasedOnContext({ query: userQuery, context });
      setQueryResult({ ...result, sources: Array.from(indexedContentMap.keys()) });
    } catch (e: any) {
      setError(`Query failed: ${e.message}`);
    } finally {
      setIsQuerying(false);
    }
  };

  const resetState = () => {
    setSitemapUrl("");
    setIsIndexing(false);
    setIsFetchingContent(false);
    setContentFetchProgress(0);
    setIndexingResult(null);
    setIndexedContentMap(null);
    setQuery("");
    setIsQuerying(false);
    setQueryResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="font-headline text-5xl font-bold text-primary">
          RAG Navigator
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Index websites and query their content with Retrieval Augmented Generation.
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-3xl flex items-center">
              <ListChecks className="mr-3 h-8 w-8 text-primary" />
              Step 1: Index a Website
            </CardTitle>
            <CardDescription>
              Provide a sitemap URL to begin indexing content. The crawler will respect robots.txt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SitemapForm onSubmit={handleSitemapSubmit} isLoading={isIndexing || isFetchingContent} />
          </CardContent>
        </Card>

        {(isIndexing || isFetchingContent || indexingResult) && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline text-2xl flex items-center">
                <Loader2 className={`mr-3 h-7 w-7 text-primary ${ (isIndexing || isFetchingContent) ? 'animate-spin' : ''}`} />
                Indexing Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isIndexing && <p className="text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sitemap processing...</p>}
              {isFetchingContent && (
                <div>
                  <p className="text-primary mb-2 flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching content from indexed pages...</p>
                  <Progress value={contentFetchProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-1 text-center">{Math.round(contentFetchProgress)}% complete</p>
                </div>
              )}
              {indexingResult && !isIndexing && !isFetchingContent && (
                <div className="space-y-3">
                  <Alert variant="default" className="bg-green-50 border-green-300">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-700">Indexing Process Complete</AlertTitle>
                    <AlertDescription className="text-green-600">
                      <p>Successfully indexed URLs: {indexingResult.indexedUrls.length}</p>
                      <p>Skipped URLs (robots.txt or errors): {indexingResult.skippedUrls.length}</p>
                      {indexingResult.errors.length > 0 && <p>Encountered errors: {indexingResult.errors.length}</p>}
                    </AlertDescription>
                  </Alert>
                  {indexingResult.indexedUrls.length > 0 && (
                    <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-primary hover:underline">View Indexed URLs ({indexingResult.indexedUrls.length})</summary>
                        <ScrollArea className="h-32 mt-2 border rounded-md p-2 bg-muted/30">
                            <ul className="list-disc pl-5 space-y-1">
                                {indexingResult.indexedUrls.map(url => (
                                    <li key={url} className="text-xs text-muted-foreground break-all">
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                                        {url} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                      </a>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </details>
                  )}
                  {indexingResult.skippedUrls.length > 0 && (
                     <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-amber-600 hover:underline">View Skipped URLs ({indexingResult.skippedUrls.length})</summary>
                         <ScrollArea className="h-32 mt-2 border rounded-md p-2 bg-muted/30">
                            <ul className="list-disc pl-5 space-y-1">
                                {indexingResult.skippedUrls.map(url => (
                                    <li key={url} className="text-xs text-muted-foreground break-all">
                                      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 hover:underline">
                                        {url} <ExternalLink className="inline-block h-3 w-3 ml-1" />
                                      </a>
                                    </li>
                                ))}
                            </ul>
                        </ScrollArea>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {indexedContentMap && indexedContentMap.size > 0 && !isIndexing && !isFetchingContent && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="font-headline text-3xl flex items-center">
                <ShieldQuestion className="mr-3 h-8 w-8 text-accent" />
                Step 2: Ask a Question
              </CardTitle>
              <CardDescription>
                Query the indexed content. The AI will generate a response based on what it learned.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QueryForm onSubmit={handleQuerySubmit} isLoading={isQuerying} />
            </CardContent>
          </Card>
        )}

        {isQuerying && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-12 w-12 text-accent animate-spin" />
            <p className="ml-4 text-lg text-accent">Thinking...</p>
          </div>
        )}

        {queryResult && !isQuerying && (
          <ResultsDisplay result={queryResult} indexedContentMap={indexedContentMap} />
        )}
        
        {(indexingResult || queryResult) && !isIndexing && !isFetchingContent && !isQuerying &&(
           <div className="mt-12 text-center">
            <Button variant="outline" onClick={resetState}>
                Start Over
            </Button>
          </div>
        )}
      </main>

      <footer className="mt-16 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} RAG Navigator. Powered by GenAI.</p>
      </footer>
    </div>
  );
}

