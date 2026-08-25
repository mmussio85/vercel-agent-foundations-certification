/**
 * This is where the tools for your agent will live.
 *
 * During the workshop you'll define tools in this file that your agents
 * will choose to run depending on the question or request that is made
 * to them.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/tools
 */

import { tool } from "ai";
import { z } from "zod";
import { ApiRequestError, createReturn, getCategories, getOrder, getProductById, getProducts, getProductStock, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";

import { start } from "workflow/api"; 
import { returnFlow } from "./workflows/return-flow"; 

export const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or wants recommendations. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
      category: z 
        .string() 
        .optional() 
        .describe( 
            `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`, 
        ), 
  }),
  execute: async ({ query, category }) => { 
    "use step";
    try {
      const products = await getProducts({
        search: query,
        category: category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          image: p.images[0],
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Fetch the COMPLETE details for ONE specific product, by its id or slug. Returns everything searchProducts leaves out: the full description, EVERY product image (not just a thumbnail), the product's tags/attributes, live stock levels (in stock / low stock / units remaining), and a handful of related products from the same category.

WHEN TO USE THIS vs searchProducts:
- searchProducts = BROAD discovery across the catalog. Use it when the user is browsing, wants recommendations, or describes what they want only loosely ("do you sell hoodies?", "show me water bottles"). It returns a short, shallow list (thumbnail + name + price + short description) — good for finding candidates, not for a deep dive.
- getProductDetails = DEEP DIVE on a SINGLE item the user has already zeroed in on ("tell me more about the black hoodie", "is the ceramic mug in stock?", "what does the tote look like?"). Reach for this the moment the user asks about one specific product.

If the user names a product in words but you don't have its id or slug yet, call searchProducts FIRST to resolve it to an id/slug, then call getProductDetails with that value.`,
  inputSchema: z.object({
    productIdOrSlug: z
      .string()
      .describe(
        `The product's id (e.g. 'hoodie_001') or slug (e.g. 'black-pullover-hoodie'). The API resolves either. When the user described the product in words, take this from a prior searchProducts result rather than guessing.`,
      ),
  }),
  execute: async ({ productIdOrSlug }) => {
    "use step";
    try {
      const product = await getProductById(productIdOrSlug);
      // Stock lives on a separate endpoint and related products are a catalog
      // lookup — fetch both in parallel, and don't let either failure sink the
      // whole call (the core product details are the important part).
      const [stock, related] = await Promise.all([
        getProductStock(product.id).catch(() => null),
        getProducts({ category: product.category, limit: 6 }).catch(() => []),
      ]);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: product.category,
        images: product.images, // all images, not just images[0]
        tags: product.tags, // colors/attributes; the API has no explicit "sizes" field
        featured: product.featured,
        stock: stock
          ? {
              stock: stock.stock,
              inStock: stock.inStock,
              lowStock: stock.lowStock,
            }
          : null,
        related: related
          .filter((p) => p.id !== product.id)
          .slice(0, 4)
          .map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            currency: p.currency,
            image: p.images[0],
            category: p.category,
          })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getAllCategories = tool({
    description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
    inputSchema: z.object({}),
    execute: async () => {
      "use step";
      try {
        const categories = await getCategories();
        return {
          count: categories.length,
          categories: categories.map((c) => ({
            slug: c.slug,
            name: c.name,
            productCount: c.productCount,
          })),
        };
      } catch (err) {
        const message =
          err instanceof ApiRequestError ? err.message : "Unknown error";
        return { count: 0, categories: [], error: message };
      }
    },
  });

  export const returnOrder = tool({
    description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
    inputSchema: z.object({
      orderId: z
        .string()
        .describe("The order ID the user wants to return."),
      reason: z
        .string()
        .min(10)
        .max(500)
        .describe("Why the user is returning the order."),
    }),
    execute: async ({ orderId, reason }) => {
      "use step";
      const run = await start(returnFlow, [orderId, reason]); 
      return { runId: run.runId, message: `Return request received for order ${orderId}.` }; 
    },
  });