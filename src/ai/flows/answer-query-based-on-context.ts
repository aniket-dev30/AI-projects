'use server';
/**
 * @fileOverview Answers a query based on provided context.
 *
 * - answerQueryBasedOnContext - A function that answers a question based on context.
 * - AnswerQueryBasedOnContextInput - The input type for the answerQueryBasedOnContext function.
 * - AnswerQueryBasedOnContextOutput - The return type for the answerQueryBasedOnContext function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerQueryBasedOnContextInputSchema = z.object({
  query: z.string().describe('The query to answer.'),
  context: z.string().describe('The context to answer the query based on.'),
});
export type AnswerQueryBasedOnContextInput = z.infer<typeof AnswerQueryBasedOnContextInputSchema>;

const AnswerQueryBasedOnContextOutputSchema = z.object({
  answer: z.string().describe('The answer to the query.'),
  confidence: z.number().describe('Confidence score of the answer, from 0 to 1.'),
});
export type AnswerQueryBasedOnContextOutput = z.infer<typeof AnswerQueryBasedOnContextOutputSchema>;

export async function answerQueryBasedOnContext(input: AnswerQueryBasedOnContextInput): Promise<AnswerQueryBasedOnContextOutput> {
  return answerQueryBasedOnContextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerQueryBasedOnContextPrompt',
  input: {schema: AnswerQueryBasedOnContextInputSchema},
  output: {schema: AnswerQueryBasedOnContextOutputSchema},
  prompt: `You are an expert at answering questions based on provided context.\n\nContext: {{{context}}}\n\nQuery: {{{query}}}\n\nAnswer:`, // Keep as one line.
});

const answerQueryBasedOnContextFlow = ai.defineFlow(
  {
    name: 'answerQueryBasedOnContextFlow',
    inputSchema: AnswerQueryBasedOnContextInputSchema,
    outputSchema: AnswerQueryBasedOnContextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
