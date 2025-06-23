"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Globe } from "lucide-react";
import { LoadingSpinner } from "./loading-spinner";

const sitemapFormSchema = z.object({
  sitemapUrl: z.string().url({ message: "Please enter a valid URL." }),
});

type SitemapFormValues = z.infer<typeof sitemapFormSchema>;

interface SitemapFormProps {
  onSubmit: (sitemapUrl: string) => void;
  isLoading: boolean;
}

export function SitemapForm({ onSubmit, isLoading }: SitemapFormProps) {
  const form = useForm<SitemapFormValues>({
    resolver: zodResolver(sitemapFormSchema),
    defaultValues: {
      sitemapUrl: "",
    },
  });

  function handleSubmit(data: SitemapFormValues) {
    onSubmit(data.sitemapUrl);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="sitemapUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg">Sitemap URL</FormLabel>
              <FormControl>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="https://example.com/sitemap.xml" 
                    {...field} 
                    className="pl-10 text-base"
                    aria-label="Sitemap URL"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {isLoading ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" /> Indexing...
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" /> Start Indexing
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
