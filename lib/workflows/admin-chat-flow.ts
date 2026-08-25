// Place your admin chat workflow and DurableAgent here!
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import {
  bash,
  getReturnsHistory,
  getInventoryStock,
  getSalesAnalytics,
  getSupportTickets,
  searchProducts,
  getAllCategories,
} from "@/lib/tools";

export const backOfficeInstructions = `You are the back-office assistant for the Vercel swag store. You have read-only access to back-office data and the product catalog through these tools:
- Returns: getReturnsHistory
- Inventory: getInventoryStock
- Sales: getSalesAnalytics
- Support tickets: getSupportTickets
- Catalog search: searchProducts, getAllCategories
Be concrete: name specific products, give specific numbers, and state the date range you used. Keep answers short and scannable; lead with the headline number or finding, then a brief breakdown. Never promise to change anything in the store; you only have read tools.`;

export async function adminChatFlow(messages: UIMessage[]) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);

  const agent = new DurableAgent({
    model: "anthropic/claude-sonnet-4.6",
    instructions: backOfficeInstructions,
    tools: {
      bash,
      getReturnsHistory,
      getInventoryStock,
      getSalesAnalytics,
      getSupportTickets,
      searchProducts,
      getAllCategories,
    },
  });

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<UIMessageChunk>(),
  });
}