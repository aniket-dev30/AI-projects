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
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import { LoadingSpinner } from "./loading-spinner";

const queryFormSchema = z.object({
  query: z.string().min(3, { message: "Query must be at least 3 characters." }),
});

type QueryFormValues = z.infer<typeof queryFormSchema>;

interface QueryFormProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export function QueryForm({ onSubmit, isLoading }: QueryFormProps) {
  const form = useForm<QueryFormValues>({
    resolver: zodResolver(queryFormSchema),
    defaultValues: {
      query: "",
    },
  });

  function handleSubmit(data: QueryFormValues) {
    onSubmit(data.query);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg">Your Question</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ask something about the indexed content..."
                  {...field}
                  className="min-h-[100px] text-base"
                  aria-label="Your Question"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          {isLoading ? (
            <>
              <LoadingSpinner className="mr-2 h-4 w-4" /> Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Ask RAG Navigator
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
