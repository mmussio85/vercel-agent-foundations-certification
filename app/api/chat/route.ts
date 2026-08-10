/**
 * This is where the chat API route will live.
 *
 * During the workshop you'll wire this up to the agent in `lib/agent.ts`
 * using `createAgentUIStreamResponse` from the AI SDK. The chat panel in
 * `components/agent-chat.tsx` posts here once you swap its placeholder
 * `useState` for `useChat`.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */

import { createAgentUIStreamResponse } from "ai";
import { shoppingAgent } from "@/lib/agent";

export const POST = async (req: Request) => {
  const { messages } = await req.json();
  return createAgentUIStreamResponse({ agent: shoppingAgent, uiMessages: messages });
};  