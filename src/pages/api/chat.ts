import type { APIRoute } from "astro";
import OpenAI from "openai";
import { ChromaClient, IncludeEnum } from "chromadb"; // Make sure IncludeEnum is imported

export const prerender = false;

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
// Define allowed output languages (ISO 639-1 codes, plus 'darija' for clarity)
const ALLOWED_OUTPUT_LANGUAGES = ["en", "ar", "fr", "darija"]; // English, Arabic (-> Darija), French

// Basic validation for API Key
if (!OPENAI_API_KEY) {
  console.error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// System prompt for ChatGPT (Instructs to reply in original language using English context)
// Updated to specify Moroccan Darija for Arabic AND restrict output languages.
const SYSTEM_PROMPT = `You are a friendly and helpful chatbot assistant for the **Geeksblabla** podcast. Your primary goal is to answer user questions accurately based **only** on the context provided from specific podcast episodes.

**Critical Instructions:**

1.  **Input:** You will receive the user's original question, the language it was asked in (ISO 639-1 code, e.g., 'en', 'ar', 'fr'), and relevant context snippets retrieved from the podcast database (which are in English).
2.  **Output Language Restriction:** You **MUST** formulate your response directly in the **user's original language** IF AND ONLY IF that language is one of the following: English ('en'), Arabic ('ar'), or French ('fr').
    * **Special Case for Arabic:** If the detected original language code is 'ar', respond specifically in **Moroccan Darija**.
    * **Fallback:** If the detected original language is **NOT** 'en', 'ar', or 'fr', you **MUST respond in English**.
3.  **Grounding:** Base your entire answer **strictly** on the provided English "Context from podcast episodes". **Do not translate the context snippets.** Use the information within them to answer the original question.
4.  **Persona:** Be conversational, helpful, and enthusiastic about the podcast content, adapting the tone appropriately for the target output language (English, Moroccan Darija, or French).
5.  **Handling Greetings:** If the user input was identified as a simple greeting, respond with a friendly greeting back in the **appropriate output language (user's original if allowed, otherwise English)** and briefly invite them to ask a question about the podcast topics. Do not mention context or episodes for simple greetings.
6.  **Handling Insufficient Specific Context:** If the provided English context does not contain a direct answer to the user's specific question (and it's not just a greeting), state clearly **in the appropriate output language** that the specific detail wasn't found in the provided segments. Then, **helpfully summarize the related topics that *were* found in the English context snippets, also in the appropriate output language.**
7.  **Answering Specific Questions:**
    * Read the user's "Original Question" carefully.
    * Analyze the English "Context" snippets to find the most relevant information to answer the original question.
    * Synthesize the information into a concise and clear answer **in the appropriate output language**.
8.  **Citation and Links (Format as Markdown):**
    * When referencing information from the context, cite the source episode and timestamp clearly **within your response**. Use the \`episode_title\` and \`timestamp_str\` from the context metadata. Format citations like: "(from Episode: '[Episode Title]' around [Timestamp])".
    * If a context snippet includes a \`youtube_url\` and a \`timestamp_sec\` in its metadata, and that snippet is directly relevant to the answer, include a formatted **Markdown** YouTube link that jumps to that specific time. Use the format: \`[Watch at [Timestamp]]([YouTube URL]?t=[Timestamp in seconds]s)\`. For example: \`[Watch at 00:12:00](http://example.com/youtube/ep35?t=720s)\`. Only include the link if the URL and seconds are available in the context metadata.
9.  **Structure (for Specific Questions):**
    * Start with a brief acknowledgement **in the appropriate output language**.
    * Provide the answer clearly. **If multiple relevant points or episodes are found, present them as a bulleted list (\`- \`) in the appropriate output language.**
    * **Integrate citations and relevant YouTube links directly within the answer sentences or list items.** Do **not** list sources separately at the end.
    * Keep the response focused.

**Example Input Format (Provided to you in the user message):**

\`\`\`
Context from podcast episodes:
- Episode: "Deep Dive in Java" (at 0:42:00): How can I start Java? [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=2520', timestamp_sec=2520]
- Episode: "Deep Dive in Java" (at 0:20:00): What we can do with Java [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=1200', timestamp_sec=1200]
- Episode: "Getting Started with Java" (at 00:02:35): Introduction to Java features. [Metadata: youtube_url='https://www.youtube.com/watch?v=yj2GuZnBC8s?t=3900', timestamp_sec=155]

---

Original Language Code: ar
Original Question: بغيت نتعلم جافا

Based *only* on the English context provided above from our podcast episodes, please answer the original question **in the original language (Moroccan Darija)**. Follow all formatting instructions (lists, citations, links using context data).
\`\`\`

**Example Good Response (List Format, in Moroccan Darija):**

> واخا، بالنسبة لكيفاش تبدا جافا، البودكاست ذكر شي حوايج:
> - كيهضرو على كيفاش تقدر تبدا تعلم جافا ([شوف ف 0:42:00](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=2520)) (من حلقة: 'Deep Dive in Java' تقريبا ف 0:42:00).
> - كيشرحو حتى شنو تقدر دير بجافا ([شوف ف 0:20:00](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=1200)) (من حلقة: 'Deep Dive in Java' تقريبا ف 0:20:00).
> - كاينة حتى مقدمة على الميزات ديال جافا ([شوف ف 00:02:35](https://www.youtube.com/watch?v=yj2GuZnBC8s?t=3900)) (من حلقة: 'Getting Started with Java' تقريبا ف 00:02:35).

**Example Response if Context is Insufficient (in French):**
*(Scenario: User asks "Qu'est-ce que JavaScript ?" [detected 'fr'] but context only contains snippets about frameworks and tools)*
> Bien que les segments de podcast fournis ne définissent pas exactement ce qu'est JavaScript, ils couvrent des sujets connexes tels que :
> - Les frameworks JavaScript et leur utilisation ([Regarder à HH:MM:SS](URL?t=...s)) (de l'épisode : 'JS Frameworks' vers HH:MM:SS).
> - Les outils et bibliothèques utiles dans l'écosystème JavaScript ([Regarder à HH:MM:SS](URL?t=...s)) (de l'épisode : 'JS Tools' vers HH:MM:SS).
> Souhaitez-vous en savoir plus sur ces domaines spécifiques ?

**Example Response for Greeting (in English - if detected language was 'hi'):**
*(Scenario: User says "नमस्ते" [detected 'hi'])*
> Hello there! Ask me anything about the topics covered in the Geeksblabla podcast.`;

console.log("ChromaDB URL configured:", CHROMA_URL);
const chromaClient = new ChromaClient({
  path: CHROMA_URL,
  auth: CHROMA_TOKEN
    ? { provider: "token", credentials: `Bearer ${CHROMA_TOKEN}` }
    : undefined,
});

// Helper function to get collection
async function getCollection() {
  try {
    const collection = await chromaClient.getCollection({
      name: COLLECTION_NAME,
    });
    return collection;
  } catch (error) {
    console.error("Failed to get ChromaDB collection:", error);
    if (error instanceof Error) console.error("Error Details:", error.message);
    return null;
  }
}

// --- Language Detection & Translation Helper Functions ---

interface TranslationResult {
  translatedText: string | null; // English translation (or original if English)
  detectedLanguage: string | null; // e.g., 'en', 'ar', 'fr', or null if detection fails
  isEnglish: boolean;
}

// Context-aware translation to English (keeps technical terms)
async function detectAndTranslateQuery(
  text: string
): Promise<TranslationResult> {
  const defaultResult: TranslationResult = {
    translatedText: text,
    detectedLanguage: "en",
    isEnglish: true,
  };
  if (!text) return defaultResult;

  console.log(
    `Attempting language detection and context-aware translation for: "${text}"`
  );
  try {
    // Updated prompt to emphasize ISO codes
    const detectAndTranslatePrompt = `First, detect the primary language of the following user query (return the ISO 639-1 code only, e.g., 'en', 'ar', 'fr', 'hi', 'es').
Second, if the detected language is **not** English ('en'), translate the query accurately to English. **Crucially: Preserve any technical terms, library names, framework names, code snippets, acronyms, or proper nouns exactly as they appear in the original text.** Only translate the surrounding natural language.
If the detected language **is** English, the translation is just the original text.
Format your response strictly as JSON: {"detected_language": "<code>", "english_translation": "<translation_or_original_text>"}

Original Query: "${text}"

JSON Response:`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL, // Or GPT-4
      messages: [{ role: "user", content: detectAndTranslatePrompt }],
      temperature: 0.1,
      max_tokens: Math.floor(text.length * 1.5) + 100,
      n: 1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content?.trim();
    if (responseContent) {
      try {
        const parsedJson = JSON.parse(responseContent);
        // Normalize detected language code (lowercase, handle potential variations)
        const lang = parsedJson.detected_language?.toLowerCase().trim();
        const translation = parsedJson.english_translation;
        if (lang && translation) {
          console.log(
            `Detected Language: ${lang}, Translation: "${translation}"`
          );
          // Basic validation of common ISO codes
          const commonISOCodes = ["en", "ar", "fr", "es", "de", "it", "pt"];
          if (!commonISOCodes.includes(lang) && lang.length > 3) {
            console.warn(
              `Detected language code '${lang}' seems unusual. Treating as non-English.`
            );
            return {
              translatedText: translation,
              detectedLanguage: lang,
              isEnglish: false,
            };
          }
          return {
            translatedText: translation,
            detectedLanguage: lang,
            isEnglish: lang === "en",
          };
        } else {
          console.warn(
            "Parsed JSON response missing language or translation.",
            parsedJson
          );
        }
      } catch (parseError) {
        console.error(
          "Failed to parse JSON response from language detection/translation:",
          responseContent,
          parseError
        );
      }
    } else {
      console.warn(
        "Language detection/translation attempt returned empty content."
      );
    }
  } catch (error) {
    console.error(
      "Error during language detection/translation API call:",
      error
    );
  }

  // Fallback if JSON method fails or API error occurs
  console.warn(
    "Falling back to using original text and assuming English for detection."
  );
  return defaultResult;
}

// Main API Route Handler
export const POST: APIRoute = async ({ request }) => {
  let originalUserQuery = "";
  let detectedLanguage: string | null = "en"; // Default to English
  let queryForEmbedding = "";
  let responseLanguage = "en"; // Default response language

  try {
    // 1. Validate Request Body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Validate Message Field
    if (!body || typeof body.message !== "string" || !body.message.trim()) {
      /* ... error handling ... */
      return new Response(
        JSON.stringify({
          error: "Message field is required and must be a non-empty string",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    originalUserQuery = body.message.trim();
    console.log("Received original query:", originalUserQuery);

    // 2.5 Detect Language and Translate Query to English if needed
    queryForEmbedding = originalUserQuery; // Default
    if (TRANSLATE_NON_ENGLISH) {
      const translationResult =
        await detectAndTranslateQuery(originalUserQuery);
      queryForEmbedding = translationResult.translatedText || originalUserQuery; // Use translated or fallback
      detectedLanguage = translationResult.detectedLanguage || "en"; // Store detected language
      if (!translationResult.isEnglish) {
        console.log(
          `Using translated query for embedding: "${queryForEmbedding}" (Original lang: ${detectedLanguage})`
        );
      } else {
        console.log("Query is English, using original for embedding.");
      }
    } else {
      console.log("Translation disabled, using original query for embedding.");
      detectedLanguage = "en"; // Assume English if translation disabled
    }

    // Determine the final response language based on detection and allowed list
    if (
      detectedLanguage &&
      ALLOWED_OUTPUT_LANGUAGES.includes(detectedLanguage)
    ) {
      responseLanguage = detectedLanguage; // Use detected if allowed
    } else {
      responseLanguage = "en"; // Fallback to English
      console.log(
        `Detected language '${detectedLanguage}' not in allowed list [${ALLOWED_OUTPUT_LANGUAGES.join(", ")}], defaulting response language to 'en'.`
      );
    }
    // Handle special case for Arabic -> Darija
    const targetLanguageInstruction =
      responseLanguage === "ar" ? "Moroccan Darija" : responseLanguage;

    // 3. Get Embedding for the English Query
    console.log(
      `Getting embedding for query: "${queryForEmbedding}" using model '${OPENAI_EMBEDDING_MODEL}'...`
    );
    let queryEmbedding;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: queryForEmbedding,
      });
      queryEmbedding = embeddingResponse.data[0]?.embedding;
      if (!queryEmbedding) throw new Error("No embedding data received.");
      console.log("Generated query embedding length:", queryEmbedding.length);
    } catch (error) {
      console.error("Failed to get embedding from OpenAI:", error);
      queryEmbedding = null;
    }

    // 4. Query ChromaDB for Relevant Context (using English embedding)
    let contextString =
      "Context retrieval failed or no relevant context found.";
    // ... (Keep the existing ChromaDB query, sorting, and context formatting logic here) ...
    if (queryEmbedding) {
      const collection = await getCollection();
      if (collection) {
        try {
          const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: N_RESULTS_RETRIEVE,
            include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
          });
          if (results.ids?.[0]?.length > 0) {
            const retrievedResults = results.ids[0].map((id, i) => ({
              id: id,
              doc: results.documents?.[0]?.[i] || "",
              meta: results.metadatas?.[0]?.[i] || {},
            }));
            retrievedResults.sort((a, b) => {
              const timeA =
                typeof a.meta?.timestamp_sec === "number"
                  ? a.meta.timestamp_sec
                  : 0;
              const timeB =
                typeof b.meta?.timestamp_sec === "number"
                  ? b.meta.timestamp_sec
                  : 0;
              return timeB - timeA;
            });
            const topLatestResults = retrievedResults.slice(
              0,
              N_RESULTS_CONTEXT
            );
            // Format context for the LLM (still English content)
            contextString = "Context from podcast episodes:\n";
            topLatestResults.forEach(item => {
              const title = item.meta.episode_title || "Unknown Episode";
              const time = item.meta.timestamp_str || "N/A";
              const docText = item.doc || "Content unavailable";
              const youtubeUrl = item.meta.youtube_url || null;
              const timestampSec =
                typeof item.meta.timestamp_sec === "number"
                  ? item.meta.timestamp_sec
                  : null;
              contextString += `- Episode: "${title}" (at ${time}): ${docText}`;
              if (youtubeUrl || timestampSec !== null) {
                contextString += ` [Metadata:`;
                if (youtubeUrl) contextString += ` youtube_url='${youtubeUrl}'`;
                if (timestampSec !== null)
                  contextString += `${youtubeUrl ? "," : ""} timestamp_sec=${timestampSec}`;
                contextString += `]`;
              }
              contextString += `\n`;
            });
            console.log("Formatted Context String for LLM:\n", contextString);
          } else {
            console.log("No relevant documents found in ChromaDB.");
            contextString = "No relevant context found in podcast episodes.";
          }
        } catch (error) {
          console.error("Failed during ChromaDB query or processing:", error);
        }
      } else {
        console.log(
          "Proceeding without ChromaDB context (collection access failed)."
        );
      }
    } else {
      console.log("Proceeding without ChromaDB context (embedding failed).");
    }

    // 5. Ask OpenAI (Once) with Context and instructions to reply in the determined response language
    console.log(
      `Getting final chat completion from OpenAI model '${OPENAI_CHAT_MODEL}' (instructed to reply in ${targetLanguageInstruction})...`
    );
    let finalResponseContent =
      "Sorry, I encountered an error trying to generate a response.";

    try {
      // Construct the user message for the final LLM call, including language instruction
      // Pass the original query and the determined response language
      const finalUserPrompt = `${contextString}\n\n---\n\nRespond in: ${targetLanguageInstruction}\nOriginal Question: ${originalUserQuery}\n\nBased *only* on the English context provided above from our podcast episodes, please answer the original question **in the specified response language (${targetLanguageInstruction})**. Follow all formatting instructions (lists, citations, links using context data).`;

      const finalCompletion = await openai.chat.completions.create({
        model: OPENAI_CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT }, // System prompt guides overall behavior
          { role: "user", content: finalUserPrompt }, // User prompt provides context and specific task
        ],
      });
      finalResponseContent =
        finalCompletion.choices[0]?.message?.content?.trim() ||
        `Sorry, I couldn't generate a valid response in ${targetLanguageInstruction}.`;
      console.log(
        `Final response received (intended language: ${targetLanguageInstruction}).`
      );
    } catch (error) {
      console.error("Failed to get final completion from OpenAI:", error);
      // Provide a generic error message, potentially in English as fallback
      finalResponseContent = `Sorry, an error occurred while generating the response. Please try again.`;
    }

    // 6. Send the final response
    const responsePayload = { response: finalResponseContent };
    console.log(
      "Sending final response payload:",
      JSON.stringify(responsePayload)
    );

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Catch any unexpected errors in the main try block
    console.error("Unhandled Error in API route:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected internal server error occurred.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
