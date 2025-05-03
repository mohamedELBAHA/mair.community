import { ChromaClient, IncludeEnum } from "chromadb";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.OPENAI_API_KEY,
});

const client = new ChromaClient({
  path: import.meta.env.CHROMA_URL,
  auth: {
    provider: "token",
    credentials: `Bearer ${import.meta.env.CHROMA_TOKEN}`,
  },
});

const collection = client.getCollection({
  name: import.meta.env.CHROMA_COLLECTION || "podcast_episodes",
});

interface DocumentMetadata {
  episode_title?: string;
  episode_date?: string;
  youtube_url?: string;
  timestamp_sec?: number;
  timestamp_str?: string;
  [key: string]: unknown; // Allow additional properties
}

interface Document {
  content: string;
  metadata: DocumentMetadata;
}

export async function getRelevantDocuments(
  query: string,
  limit: number = Number(import.meta.env.N_RESULTS_CONTEXT) || 10
): Promise<Document[]> {
  try {
    // Get embedding for query
    const embedding = await openai.embeddings.create({
      model: import.meta.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: query,
    });

    const coll = await collection;
    const results = await coll.query({
      queryEmbeddings: [embedding.data[0].embedding],
      nResults: Number(import.meta.env.N_RESULTS_RETRIEVE) || 20, // Get more results to sort
      include: [
        IncludeEnum.Metadatas,
        IncludeEnum.Documents,
        IncludeEnum.Distances,
      ],
    });

    // Combine documents with their metadata and sort by publish date
    const documentsWithMetadata = results.documents[0]
      .map((content: string | null, i: number) => {
        if (!content) return null;
        const metadata = results.metadatas[0][i] || {};

        // Use publish_date for sorting
        const publishDate =
          typeof metadata.publish_date === "string"
            ? metadata.publish_date
            : "1970-01-01";
        return {
          content,
          metadata,
          publishDate,
        };
      })
      .filter((doc): doc is NonNullable<typeof doc> => doc !== null)
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate))
      .slice(0, limit); // Take only the requested number of results

    return documentsWithMetadata.map(({ content, metadata }) => ({
      content,
      metadata: metadata || undefined,
    }));
  } catch (error) {
    console.error("Error querying ChromaDB:", error);
    return [];
  }
}
