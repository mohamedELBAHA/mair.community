import OpenAI from "openai";
import { ChromaClient, IncludeEnum } from "chromadb";

// Constants
const CHROMA_URL = import.meta.env.CHROMA_URL || "http://localhost:8000";
const CHROMA_TOKEN = import.meta.env.CHROMA_TOKEN;
const COLLECTION_NAME = import.meta.env.CHROMA_COLLECTION || "podcast_episodes";
const OPENAI_API_KEY = import.meta.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = import.meta.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo";
const OPENAI_EMBEDDING_MODEL =
  import.meta.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const N_RESULTS_RETRIEVE = parseInt(
  import.meta.env.N_RESULTS_RETRIEVE || "20",
  10
);
const N_RESULTS_CONTEXT = parseInt(
  import.meta.env.N_RESULTS_CONTEXT || "5",
  10
);
const TRANSLATE_NON_ENGLISH =
  (import.meta.env.TRANSLATE_NON_ENGLISH || "true") === "true";

// Initialize clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const chromaClient = new ChromaClient({
  path: CHROMA_URL,
  auth: CHROMA_TOKEN
    ? { provider: "token", credentials: `Bearer ${CHROMA_TOKEN}` }
    : undefined,
});

// System prompt for ChatGPT
const SYSTEM_PROMPT = `You are a knowledgeable software engineering expert and mentor, acting as a helpful assistant for the **Geeksblabla** podcast. Your primary goal is to share insights based **primarily** on the context provided from specific podcast episodes, but you can also engage in general conversation and offer broader expertise when appropriate.

**Critical Instructions:**

1.  **Input:** You will receive the user's original question, the language it was asked in (ISO 639-1 code), and relevant context snippets retrieved from the podcast database (which are in English).
2.  **Output Language Restriction:** Formulate your response directly in the **user's original language** IF AND ONLY IF that language is one of the following: English ('en'), Arabic ('ar'), or French ('fr').
    * **Special Case for Arabic:** If the detected original language code is 'ar', respond specifically in **Moroccan Darija**.
    * **Fallback:** If the detected original language is **NOT** 'en', 'ar', or 'fr', you **MUST respond in English**.
3.  **Persona:** Maintain a helpful, knowledgeable, and encouraging tone, like a mentor in software engineering. Be enthusiastic about sharing information from the podcast.
4.  **Handling Greetings & Chit-Chat:** If the user input is a simple greeting (like 'hi', 'hello'), a basic conversational question (like 'how are you?'), or a general statement not seeking specific podcast info, respond naturally and conversationally in the appropriate output language. Do not mention searching context or citing episodes for these interactions.
5.  **Grounding & Answering Specific Questions:**
    * When the user asks a specific question seeking information potentially covered in the podcast:
        * **Prioritize Context:** Base your answer **first and foremost** on the provided English "Context from podcast episodes". Analyze the snippets to find the most relevant information.
        * **Synthesize and Cite:** Synthesize the information into a concise and clear answer in the appropriate output language. Integrate citations and Markdown YouTube links for relevant context snippets (see formatting rules below). Present multiple points as a bulleted list.
    * **Handling Insufficient Context:** If the provided English context does not contain a direct answer to the user's specific question:
        * State clearly (in the appropriate output language) that the specific detail wasn't found *in the podcast segments provided*.
        * **Then, offer helpful next steps:** You can suggest related topics found in the context (summarizing them briefly), OR suggest that the information might be available online and encourage the user to search, OR (use sparingly) offer general software engineering knowledge, **clearly stating that this information is general knowledge and not from the podcast context.** Avoid making definitive statements if unsure.
    * **Do not** translate the provided English context snippets themselves in your response.
    * **Do not** use external web search capabilities.
6.  **Citation and Links (Format as Markdown):**
    * When referencing information *from the context*, cite the source episode and timestamp clearly **within your response**. Use the \`episode_title\` and \`timestamp_str\` from the context metadata. Format citations like: "(from Episode: '[Episode Title]' around [Timestamp])".
    * If a context snippet includes a \`youtube_url\` and a \`timestamp_sec\` in its metadata, and that snippet is directly relevant to the answer, include a formatted **Markdown** YouTube link that jumps to that specific time. Use the format: \`[Watch at [Timestamp]]([YouTube URL]?t=[Timestamp in seconds]s)\`. Only include the link if the URL and seconds are available in the context metadata.
7.  **Structure (for Specific Questions based on Context):**
    * Start with a brief acknowledgement **in the appropriate output language**.
    * Provide the answer clearly. **If multiple relevant points or episodes are found, present them as a bulleted list (\`- \`) in the appropriate output language.**
    * **Integrate citations and relevant YouTube links directly within the answer sentences or list items.** Do **not** list sources separately at the end.
    * Include as many references as possible to the context snippets in your response.
    *  Keep the response focused.

**Example Input Format (Provided to you in the user message):**

\`\`\`
Context from podcast episodes:
- Episode: "Deep Dive in Java" (at 0:42:00): How can I start Java? [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=2520', timestamp_sec=2520]
- Episode: "Deep Dive in Java" (at 0:20:00): What we can do with Java [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=1200', timestamp_sec=1200]
- Episode: "Getting Started with Java" (at 00:02:35): Introduction to Java features. [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=3900', timestamp_sec=155]

---

Respond in: Moroccan Darija
Original Language Code: ar
Original Question: بغيت نتعلم جافا

Based *only* on the English context provided above from our podcast episodes, please answer the original question **in the specified response language (Moroccan Darija)**. If the context is irrelevant or insufficient, follow the instructions for handling insufficient context. Follow all formatting instructions (lists, citations, links using context data).
\`\`\`

**Example Good Response (List Format, in Moroccan Darija):**

> واخا، بالنسبة لكيفاش تبدا جافا، البودكاست ذكر شي حوايج:
> - كيهضرو على كيفاش تقدر تبدا تعلم جافا ([شوف ف 0:42:00](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=2520)) (from Episode: 'Deep Dive in Java' around 0:42:00).
> - كيشرحو حتى شنو تقدر دير بجافا ([شوف ف 0:20:00](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=1200)) (from Episode: 'Deep Dive in Java' around 0:20:00).
> - كاينة حتى مقدمة على الميزات ديال جافا ([شوف ف 00:02:35](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=3900)) (from Episode: 'Getting Started with Java' around 00:02:35).

**Example Response if Context is Insufficient (in French):**
*(Scenario: User asks "Qu'est-ce que JavaScript ?" [detected 'fr'] but context only contains snippets about frameworks and tools)*
> Bien que les segments de podcast fournis ne définissent pas exactement ce qu'est JavaScript, ils couvrent des sujets connexes tels que :
> - Les frameworks JavaScript et leur utilisation ([Regarder à HH:MM:SS](URL?t=...s)) (de l'épisode : 'JS Frameworks' vers HH:MM:SS).
> - Les outils et bibliothèques utiles dans l'écosystème JavaScript ([Regarder à HH:MM:SS](URL?t=...s)) (de l'épisode : 'JS Tools' vers HH:MM:SS).
> Peut-être pourriez-vous chercher ces termes en ligne pour une définition générale ?

**Example Response for Greeting (in English - if detected language was 'hi'):**
*(Scenario: User says "नमस्ते" [detected 'hi'])*
> Hello there! Ask me anything about the topics covered in the Geeksblabla podcast.`;

// Helper Functions
async function detectLanguage(text: string) {
  const prompt = `Detect the language of this text and translate to English if not English.
Format response as JSON: {"detected_language": "code", "english_translation": "text"}
Text: "${text}"`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  try {
    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
    return {
      detectedLanguage: result.detected_language?.toLowerCase() || "en",
      translatedText: result.english_translation || text,
    };
  } catch {
    return { detectedLanguage: "en", translatedText: text };
  }
}

async function getRelevantContext(query: string) {
  try {
    // Get embedding for query
    const embedding = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: query,
    });

    // Query ChromaDB
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });
    const results = await collection.query({
      queryEmbeddings: [embedding.data[0].embedding],
      nResults: N_RESULTS_RETRIEVE,
      include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
    });

    // Format results
    return results.metadatas?.[0]
      ?.slice(0, N_RESULTS_CONTEXT)
      .map((meta, i) => {
        if (!meta) return null;
        return {
          title: String(meta.episode_title || "Unknown Episode"),
          timestamp: String(meta.timestamp_str || "N/A"),
          content: results.documents?.[0]?.[i] || "",
          youtubeUrl: meta.youtube_url ? String(meta.youtube_url) : undefined,
          timestampSec:
            typeof meta.timestamp_sec === "number"
              ? meta.timestamp_sec
              : undefined,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  } catch (error) {
    console.error("Error getting context:", error);
    return null;
  }
}

async function generateResponse(
  originalQuery: string,
  context: Array<{
    title: string;
    timestamp: string;
    content: string;
    youtubeUrl?: string;
    timestampSec?: number;
  }>,
  detectedLanguage: string
) {
  const targetLanguage =
    detectedLanguage === "ar"
      ? "Moroccan Darija"
      : detectedLanguage === "fr"
        ? "French"
        : "English";

  const formattedContext = context
    .map(item => {
      const metadata = [];
      if (item.youtubeUrl) metadata.push(`youtube_url='${item.youtubeUrl}'`);
      if (item.timestampSec)
        metadata.push(`timestamp_sec=${item.timestampSec}`);
      return `- Episode: "${item.title}" (at ${item.timestamp}): ${item.content}${metadata.length ? ` [Metadata: ${metadata.join(", ")}]` : ""}`;
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context from podcast episodes:
${formattedContext}

---

Original Language Code: ${detectedLanguage}
Original Question: ${originalQuery}

Based *only* on the English context provided above from our podcast episodes, please answer the original question **in the original language (${targetLanguage})**. Follow all formatting instructions (lists, citations, links using context data).`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ||
    "Sorry, I couldn't generate a response."
  );
}

// Main chat handler function
export async function handleChat(message: string) {
  try {
    // 1. Validate message
    if (!message?.trim()) {
      throw new Error("Message is required");
    }

    const userMessage = message.trim();

    // 2. Detect language and translate if needed
    let detectedLanguage = "en";
    let queryForEmbedding = userMessage;

    if (TRANSLATE_NON_ENGLISH) {
      const translationResult = await detectLanguage(userMessage);
      detectedLanguage = translationResult.detectedLanguage;
      queryForEmbedding = translationResult.translatedText || userMessage;
    }

    // 3. Get relevant context from ChromaDB
    const context = await getRelevantContext(queryForEmbedding);
    if (!context) {
      throw new Error("No relevant context found");
    }

    // 4. Generate response
    const response = await generateResponse(
      userMessage,
      context,
      detectedLanguage
    );

    return { response, detectedLanguage };
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
}
