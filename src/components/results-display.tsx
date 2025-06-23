"use client";

import type { AnswerQueryBasedOnContextOutput } from "@/ai/flows/answer-query-based-on-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, Percent } from "lucide-react";

interface ResultsDisplayProps {
  result: (AnswerQueryBasedOnContextOutput & { sources: string[] }) | null;
  indexedContentMap: Map<string, string> | null;
}

export function ResultsDisplay({ result, indexedContentMap }: ResultsDisplayProps) {
  if (!result || !indexedContentMap) {
    return null;
  }

  const confidencePercentage = (result.confidence * 100).toFixed(0);

  return (
    <Card className="w-full shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <FileText className="mr-3 h-7 w-7 text-primary" />
          Navigator's Response
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none p-4 bg-primary/5 border border-primary/20 rounded-md shadow">
          <p className="text-foreground text-base">{result.answer}</p>
        </div>

        <div className="flex items-center space-x-2">
          <Percent className="h-5 w-5 text-accent" />
          <span className="font-medium">Confidence:</span>
          <Badge variant={result.confidence > 0.7 ? "default" : "secondary"} className={result.confidence > 0.7 ? "bg-green-500 text-white" : "bg-amber-500 text-white"}>
            {result.confidence > 0.7 ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <AlertCircle className="mr-1 h-4 w-4" />}
            {confidencePercentage}%
          </Badge>
        </div>

        {result.sources && result.sources.length > 0 && (
          <div>
            <h3 className="font-headline text-xl mb-3">Sources Consulted:</h3>
            <Accordion type="single" collapsible className="w-full">
              {result.sources.map((sourceUrl, index) => {
                const content = indexedContentMap.get(sourceUrl) || "Content not available.";
                return (
                  <AccordionItem value={`item-${index}`} key={sourceUrl} className="border-b border-border">
                    <AccordionTrigger className="text-base hover:no-underline">
                      <span className="truncate text-primary hover:underline">{sourceUrl}</span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      <Card className="bg-muted/50 max-h-60 overflow-y-auto">
                        <CardContent className="p-4">
                          <pre className="whitespace-pre-wrap break-words font-code text-xs text-muted-foreground leading-relaxed">
                            {content}
                          </pre>
                        </CardContent>
                      </Card>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
         {(!result.sources || result.sources.length === 0) && (
            <p className="text-muted-foreground">No specific sources were cited for this answer.</p>
        )}
      </CardContent>
    </Card>
  );
}
