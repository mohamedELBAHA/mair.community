import type { APIRoute } from "astro";
import { handleChat } from "../../lib/chat";

export const prerender = false;

// Mark this route as server-side only
export const partial = true;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body?.message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await handleChat(body.message.trim());
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
