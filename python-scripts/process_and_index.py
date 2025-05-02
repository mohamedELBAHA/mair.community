import os
import glob
import frontmatter
import re
import chromadb
import logging
import time
import json
import hashlib
from dotenv import load_dotenv # To load .env file for local dev

# --- Load Environment Variables ---
# Load .env file if it exists (useful for local development)
load_dotenv()

# --- Configuration ---
# Environment variables control the behavior
MARKDOWN_PATH_PATTERN = os.environ.get("MARKDOWN_PATH_PATTERN", "episodes/**/*.md")
STATE_FILE_PATH = os.environ.get("STATE_FILE_PATH", "./python-scripts/processing_state.json")
# ChromaDB Connection: Set CHROMA_HOST for remote, otherwise uses local PersistentClient
CHROMA_HOST = os.environ.get("CHROMA_HOST", None)
CHROMA_PORT = os.environ.get("CHROMA_PORT", "8000")
CHROMA_TOKEN = os.environ.get("CHROMA_TOKEN", None)
VECTOR_STORE_PATH = os.environ.get("VECTOR_STORE_PATH", "./chroma_db_store") # Used only if CHROMA_HOST is not set
COLLECTION_NAME = os.environ.get("VECTOR_DB_COLLECTION", "podcast_episodes")
# OpenAI Embedding Model
# Ensure OPENAI_API_KEY is set in the environment (loaded by load_dotenv() locally or via secrets in Actions)
OPENAI_EMBEDDING_MODEL = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small") # Or "text-embedding-ada-002"
# Batch sizes
OPENAI_BATCH_SIZE = int(os.environ.get("OPENAI_BATCH_SIZE", "500")) # Batch size for OpenAI API calls
CHROMA_UPSERT_BATCH_SIZE = int(os.environ.get("CHROMA_UPSERT_BATCH_SIZE", "100")) # Batch size for ChromaDB upserts (adjust as needed)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Regex to find timestamped notes (HH:MM:SS or MM:SS)
TIMESTAMP_REGEX = re.compile(r"^((\d{1,2}:\d{2}:\d{2})|(\d{1,2}:\d{2}))\s*-\s*(.*)")

# --- Helper Functions ---

def parse_timestamp(timestamp_str):
    """Converts HH:MM:SS or MM:SS string to total seconds."""
    if not timestamp_str: return None
    try:
        parts = list(map(int, timestamp_str.split(':')))
        seconds = 0
        if len(parts) == 3: # HH:MM:SS
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        elif len(parts) == 2: # MM:SS
            seconds = parts[0] * 60 + parts[1]
        else:
            return None # Invalid format
        return seconds
    except ValueError:
        logging.warning(f"Could not parse timestamp: {timestamp_str}")
        return None


def generate_chunk_id(filename, type, timestamp_sec=None):
    """Creates a consistent, unique ID for each chunk based on filename and type/timestamp."""
    # Use os.path.normpath and os.path.basename for cross-platform compatibility
    try:
        base_name = os.path.splitext(os.path.basename(os.path.normpath(filename)))[0]
        if type == "note" and timestamp_sec is not None:
            return f"{base_name}_t_{timestamp_sec}"
        elif type == "description":
            return f"{base_name}_desc"
        elif type == "title":
             return f"{base_name}_title"
        else:
            logging.warning(f"Generating fallback chunk ID for type '{type}' in file '{filename}'")
            # Include timestamp for uniqueness in fallback
            return f"{base_name}_{type}_{int(time.time())}"
    except Exception as e:
        logging.error(f"Error generating chunk ID for file '{filename}', type '{type}': {e}")
        # Return a unique fallback ID
        return f"error_id_{int(time.time())}_{hash(filename)}"


def calculate_file_hash(filepath):
    """Calculates SHA256 hash of the file's raw content."""
    hasher = hashlib.sha256()
    try:
        with open(filepath, 'rb') as file:
            while chunk := file.read(4096): # Requires Python 3.8+
                hasher.update(chunk)
        return hasher.hexdigest()
    except IOError as e:
        logging.error(f"Could not read file for hashing: {filepath} - {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error during hashing for file {filepath}: {e}")
        return None


def load_processing_state(state_filepath):
    """Loads the previous processing state (filepath -> {hash, chunk_ids})."""
    if os.path.exists(state_filepath):
        try:
            with open(state_filepath, 'r', encoding='utf-8') as f:
                state = json.load(f)
                if isinstance(state, dict):
                    logging.info(f"Loaded previous state for {len(state)} files from {state_filepath}")
                    return state
                else:
                    logging.warning(f"State file {state_filepath} did not contain a valid dictionary. Starting fresh.")
                    return {}
        except (json.JSONDecodeError, IOError, TypeError) as e:
            logging.warning(f"Could not load or parse state file {state_filepath}: {e}. Starting fresh.")
    else:
        logging.info(f"State file {state_filepath} not found. Starting fresh.")
    return {}


def save_processing_state(state_filepath, current_state):
    """Saves the current processing state."""
    try:
        # Ensure parent directory exists
        parent_dir = os.path.dirname(state_filepath)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir)
            logging.info(f"Created directory for state file: {parent_dir}")

        with open(state_filepath, 'w', encoding='utf-8') as f:
            json.dump(current_state, f, indent=2, ensure_ascii=False)
        logging.info(f"Successfully saved processing state for {len(current_state)} files to {state_filepath}")
    except IOError as e:
        logging.error(f"Could not save state file {state_filepath}: {e}")
    except Exception as e:
        logging.error(f"Unexpected error during state saving to {state_filepath}: {e}")


# --- Main Incremental Processing Logic ---

def process_episodes_incremental():
    """
    Processes Markdown files incrementally using OpenAI embeddings. Detects new,
    modified, and deleted files based on content hashing and updates a ChromaDB
    collection accordingly. Includes checks to prevent adding duplicate chunk IDs
    within a single run and logs debugging info for embedding input. Uses batching
    for OpenAI API calls and ChromaDB upserts.
    """
    logging.info(f"Starting incremental processing run...")
    logging.info(f"Configuration:")
    logging.info(f"  Markdown Pattern: {MARKDOWN_PATH_PATTERN}")
    logging.info(f"  State File: {STATE_FILE_PATH}")
    logging.info(f"  Chroma Host: {CHROMA_HOST if CHROMA_HOST else 'N/A (Using Local Persistence)'}")
    if not CHROMA_HOST:
        logging.info(f"  Chroma Local Path: {VECTOR_STORE_PATH}")
    logging.info(f"  Chroma Collection: {COLLECTION_NAME}")
    logging.info(f"  OpenAI Embedding Model: {OPENAI_EMBEDDING_MODEL}")
    logging.info(f"  OpenAI Batch Size: {OPENAI_BATCH_SIZE}")
    logging.info(f"  Chroma Upsert Batch Size: {CHROMA_UPSERT_BATCH_SIZE}") # Log Chroma batch size

    # Check for OpenAI API Key early
    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if not openai_api_key:
        logging.error("FATAL: OPENAI_API_KEY environment variable not set!")
        logging.error("Please set it in your environment or a .env file.")
        return # Cannot proceed without API key

    # Initialize OpenAI Client (will use key from env)
    try:
        from openai import OpenAI, APIError, BadRequestError
        client_openai = OpenAI()
    except ImportError:
         logging.error("FATAL: OpenAI library not installed. Please run 'pip install openai'")
         return

    previous_state = load_processing_state(STATE_FILE_PATH) # Format: {"filepath": {"hash": "...", "chunk_ids": [...]}}
    current_run_processing_state = {} # Stores state generated during *this* run

    try:
        all_current_files_paths = set(glob.glob(MARKDOWN_PATH_PATTERN, recursive=True))
    except Exception as e:
        logging.error(f"Error during glob pattern matching '{MARKDOWN_PATH_PATTERN}': {e}")
        return

    previous_processed_files = set(previous_state.keys())

    files_to_process = set() # Files that are new or changed
    files_to_delete_chunks_for = set() # Files that were deleted or changed

    logging.info(f"Found {len(all_current_files_paths)} files matching pattern.")

    # 1. Identify file changes (New, Modified, Deleted)
    logging.info("Scanning files for changes...")
    for filepath in all_current_files_paths:
        current_hash = calculate_file_hash(filepath)
        if not current_hash:
             logging.warning(f"Skipping file due to hash error: {filepath}")
             continue

        normalized_filepath = os.path.normpath(filepath)

        if normalized_filepath not in previous_processed_files:
            logging.info(f"Detected NEW file: {normalized_filepath}")
            files_to_process.add(normalized_filepath)
            current_run_processing_state[normalized_filepath] = {"hash": current_hash, "chunk_ids": []}
        elif previous_state[normalized_filepath].get("hash") != current_hash:
            logging.info(f"Detected CHANGED file: {normalized_filepath} (Hash mismatch)")
            files_to_process.add(normalized_filepath)
            files_to_delete_chunks_for.add(normalized_filepath)
            current_run_processing_state[normalized_filepath] = {"hash": current_hash, "chunk_ids": []}
        else:
            # File is unchanged, carry over state
            current_run_processing_state[normalized_filepath] = previous_state[normalized_filepath]

    deleted_files = previous_processed_files - set(map(os.path.normpath, all_current_files_paths))
    if deleted_files:
        normalized_deleted_files = set(map(os.path.normpath, deleted_files))
        logging.info(f"Detected DELETED files: {len(normalized_deleted_files)}")
        logging.debug(f"Deleted file paths: {', '.join(normalized_deleted_files)}")
        files_to_delete_chunks_for.update(normalized_deleted_files)

    logging.info(f"Files to process (new/modified): {len(files_to_process)}")
    logging.info(f"Files requiring old chunk deletion (deleted/modified): {len(files_to_delete_chunks_for)}")

    # 2. Prepare lists for ChromaDB operations
    chunks_to_upsert = []
    all_ids_to_delete = []
    run_generated_ids = set() # Tracks IDs generated in THIS run

    # Collect IDs for deletion
    logging.info("Gathering chunk IDs for deletion...")
    for filepath in files_to_delete_chunks_for:
        normalized_filepath = os.path.normpath(filepath)
        if normalized_filepath in previous_state:
            ids = previous_state[normalized_filepath].get("chunk_ids", [])
            if ids:
                logging.debug(f"Adding {len(ids)} chunk IDs from '{normalized_filepath}' to deletion list.")
                all_ids_to_delete.extend(ids)
            else:
                 logging.debug(f"No previous chunk IDs found for deletion candidate '{normalized_filepath}' in state.")
        else:
            logging.warning(f"Cannot find previous state for deletion candidate: {normalized_filepath}")

    # Process New/Modified files: Parse, Chunk, Store chunk info
    if files_to_process:
        logging.info(f"Parsing and chunking {len(files_to_process)} files...")
        for filepath in files_to_process:
            normalized_filepath = os.path.normpath(filepath)
            logging.debug(f"Processing: {normalized_filepath}")
            try:
                if not os.path.exists(filepath):
                    logging.warning(f"File not found during processing: {filepath}")
                    continue

                post = frontmatter.load(filepath)
                metadata = post.metadata
                content = post.content
                episode_title = metadata.get('title', f'Untitled Episode ({os.path.basename(filepath)})')
                youtube_url = metadata.get('youtube', None)
                publish_date = str(metadata.get('date', ''))
                tags = metadata.get('tags', [])

                file_chunk_ids_generated = [] # Track IDs generated for this specific file

                # --- Process Title Chunk ---
                chunk_id_title = generate_chunk_id(filepath, "title")
                if chunk_id_title not in run_generated_ids:
                    title_text = episode_title.strip() if episode_title else ""
                    if title_text: # Avoid empty title chunks
                        run_generated_ids.add(chunk_id_title)
                        file_chunk_ids_generated.append(chunk_id_title)
                        chunks_to_upsert.append({
                            "id": chunk_id_title, "text": title_text,
                            "metadata": { "source_file": normalized_filepath, "episode_title": episode_title, "youtube_url": youtube_url or "",
                                          "timestamp_str": "00:00:00", "timestamp_sec": 0, "publish_date": publish_date,
                                          "tags": ",".join(tags) if isinstance(tags, list) else "", # Ensure tags is list
                                          "chunk_type": "title" }
                        })
                    else:
                        logging.warning(f"Skipping empty title chunk for file '{normalized_filepath}'.")
                else:
                    logging.warning(f"Duplicate ID generated within this run: '{chunk_id_title}' for file '{normalized_filepath}'. Skipping title chunk.")

                # --- Process Description Chunk ---
                notes_start_index = content.find('\n## ')
                description = content[:notes_start_index].strip() if notes_start_index != -1 else content.strip()
                description = re.sub(r'\n{2,}', '\n', description).strip()
                if description: # Avoid empty description chunks
                    chunk_id_desc = generate_chunk_id(filepath, "description")
                    if chunk_id_desc not in run_generated_ids:
                        run_generated_ids.add(chunk_id_desc)
                        file_chunk_ids_generated.append(chunk_id_desc)
                        chunks_to_upsert.append({
                            "id": chunk_id_desc, "text": description,
                            "metadata": { "source_file": normalized_filepath, "episode_title": episode_title, "youtube_url": youtube_url or "",
                                          "timestamp_str": "00:00:00", "timestamp_sec": 0, "publish_date": publish_date,
                                          "tags": ",".join(tags) if isinstance(tags, list) else "",
                                          "chunk_type": "description" }
                        })
                    else:
                         logging.warning(f"Duplicate ID generated within this run: '{chunk_id_desc}' for file '{normalized_filepath}'. Skipping description chunk.")
                else:
                    logging.debug(f"No description content found for file '{normalized_filepath}'.")


                # --- Process Notes Chunks ---
                lines = content.splitlines()
                for line_num, line in enumerate(lines):
                    match = TIMESTAMP_REGEX.match(line)
                    if match:
                        timestamp_str = match.group(1); note_text = match.group(4).strip(); timestamp_sec = parse_timestamp(timestamp_str)
                        if note_text and timestamp_sec is not None: # Ensure text exists and timestamp is valid
                            chunk_id_note = generate_chunk_id(filepath, "note", timestamp_sec)
                            if chunk_id_note not in run_generated_ids:
                                run_generated_ids.add(chunk_id_note)
                                file_chunk_ids_generated.append(chunk_id_note)
                                chunks_to_upsert.append({
                                    "id": chunk_id_note, "text": note_text,
                                    "metadata": { "source_file": normalized_filepath, "episode_title": episode_title, "youtube_url": youtube_url or "",
                                                  "timestamp_str": timestamp_str, "timestamp_sec": timestamp_sec, "publish_date": publish_date,
                                                  "tags": ",".join(tags) if isinstance(tags, list) else "",
                                                  "chunk_type": "note" }
                                })
                            else:
                                logging.warning(f"Duplicate ID generated within this run: '{chunk_id_note}' for file '{normalized_filepath}' near line {line_num + 1} ('{line[:50]}...'). Skipping note chunk.")
                        elif not note_text:
                             logging.debug(f"Skipping note chunk with empty text for file '{normalized_filepath}' near line {line_num + 1}.")


                # Update state for the successfully processed file
                if normalized_filepath in current_run_processing_state:
                     current_run_processing_state[normalized_filepath]["chunk_ids"] = file_chunk_ids_generated
                else:
                     logging.error(f"Internal state error: File '{normalized_filepath}' processed but wasn't in current_run_processing_state mapping.")

            except Exception as e:
                logging.error(f"Failed to parse/chunk file {filepath}: {e}", exc_info=True)
                # Remove file from current state so it gets retried next time
                if normalized_filepath in current_run_processing_state:
                    del current_run_processing_state[normalized_filepath]
                continue

    # 3. Perform ChromaDB Operations
    if not chunks_to_upsert and not all_ids_to_delete:
        logging.info("No changes detected requiring database interaction.")
        save_processing_state(STATE_FILE_PATH, current_run_processing_state)
        return

    logging.info("Connecting to ChromaDB for updates...")
    client_chroma = None
    db_operation_successful = False # Flag to control state saving
    try:
        # Determine connection method
        if CHROMA_HOST:
            logging.info(f"Using HttpClient to connect to {CHROMA_HOST}:{CHROMA_PORT}")
            client_chroma = chromadb.HttpClient(
                host=CHROMA_HOST,
                port=CHROMA_PORT,
                settings=chromadb.config.Settings(anonymized_telemetry=False),
                headers={"Authorization": f"Bearer {CHROMA_TOKEN}"} if CHROMA_TOKEN else None
            )
        else:
            logging.info(f"Using PersistentClient with path: {VECTOR_STORE_PATH}")
            parent_dir = os.path.dirname(VECTOR_STORE_PATH)
            if parent_dir and not os.path.exists(parent_dir):
                 os.makedirs(parent_dir)
            client_chroma = chromadb.PersistentClient(
                path=VECTOR_STORE_PATH,
                settings=chromadb.config.Settings(anonymized_telemetry=False)
            )

        logging.info("Pinging ChromaDB server...")
        client_chroma.heartbeat()
        logging.info("ChromaDB connection successful.")

        collection = client_chroma.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
        logging.info(f"Using collection '{COLLECTION_NAME}'.")

        # --- Perform Deletions ---
        if all_ids_to_delete:
            unique_ids_to_delete = list(set(all_ids_to_delete))
            logging.info(f"Attempting to delete {len(unique_ids_to_delete)} chunk IDs from ChromaDB...")
            if unique_ids_to_delete:
                 # Consider batching deletions if the list is extremely large
                 collection.delete(ids=unique_ids_to_delete)
                 logging.info("Deletion request completed.")
            else:
                 logging.info("No unique IDs identified for deletion.")

        # --- Prepare Data for Upsert ---
        final_embeddings_list = []
        embeddings_dict = {} # Maps original index -> embedding
        if chunks_to_upsert:
            logging.info(f"Preparing {len(chunks_to_upsert)} chunks for upsert...")

            # Extract text for embedding
            chunk_texts_raw = [chunk["text"] for chunk in chunks_to_upsert]

            # Filter out empty strings AND None values BEFORE embedding
            valid_indices = [i for i, text in enumerate(chunk_texts_raw) if isinstance(text, str) and text.strip()]
            chunk_texts_to_embed = [chunk_texts_raw[i] for i in valid_indices]
            num_filtered = len(chunk_texts_raw) - len(chunk_texts_to_embed)
            if num_filtered > 0:
                logging.warning(f"Filtered out {num_filtered} empty, None, or non-string chunks before sending to OpenAI.")

            # Debugging Input to OpenAI
            logging.info(f"Preparing to embed {len(chunk_texts_to_embed)} valid chunks.")
            if isinstance(chunk_texts_to_embed, list) and chunk_texts_to_embed:
                max_len = max(len(s) for s in chunk_texts_to_embed)
                logging.info(f"Length of longest chunk text to embed: {max_len} characters.")
            elif not chunk_texts_to_embed:
                logging.info("List of chunks to embed is empty after filtering.")

            # Generate embeddings using OpenAI in batches
            logging.info(f"Generating embeddings using OpenAI model '{OPENAI_EMBEDDING_MODEL}' in batches of {OPENAI_BATCH_SIZE}...")

            if not chunk_texts_to_embed:
                 logging.warning("chunk_texts_to_embed list is empty after filtering, skipping OpenAI embedding generation.")
            else:
                total_embedded = 0
                for i in range(0, len(chunk_texts_to_embed), OPENAI_BATCH_SIZE):
                    batch_texts = chunk_texts_to_embed[i : i + OPENAI_BATCH_SIZE]
                    batch_original_indices = valid_indices[i : i + OPENAI_BATCH_SIZE]
                    logging.info(f"Processing OpenAI batch {i // OPENAI_BATCH_SIZE + 1}: {len(batch_texts)} items")

                    if not batch_texts: continue
                    current_batch_input = batch_texts

                    try:
                        embedding_response = client_openai.embeddings.create(
                            model=OPENAI_EMBEDDING_MODEL,
                            input=current_batch_input
                        )
                        for j, item in enumerate(embedding_response.data):
                            original_index = batch_original_indices[j]
                            embeddings_dict[original_index] = item.embedding
                        total_embedded += len(embedding_response.data)

                    except APIError as e:
                         logging.error(f"OpenAI API Error on batch starting with index {batch_original_indices[0]}: {e}", exc_info=True)
                         logging.error(f"--- Failing Batch Input (first 5 items) ---")
                         for k, text in enumerate(current_batch_input[:5]): logging.error(f"Batch item {k}: '{text[:100]}...' (Length: {len(text)})")
                         logging.error(f"--- End Failing Batch ---")
                         if e.body: logging.error(f"OpenAI API Error Body: {e.body}")
                         raise
                    except Exception as e:
                        logging.error(f"Failed during OpenAI embedding generation on batch starting with index {batch_original_indices[0]}: {e}", exc_info=True)
                        raise
                logging.info(f"Successfully generated {total_embedded} embeddings across all batches.")

            # Prepare final lists for ChromaDB upsert, only including chunks that got embeddings
            ids_to_upsert = []
            metadatas_to_upsert = []
            documents_to_upsert = []
            # final_embeddings_list is populated below

            for i, chunk in enumerate(chunks_to_upsert):
                 if i in embeddings_dict: # Check if an embedding was generated for this chunk's original index
                     ids_to_upsert.append(chunk["id"])
                     metadatas_to_upsert.append(chunk["metadata"])
                     documents_to_upsert.append(chunk["text"])
                     final_embeddings_list.append(embeddings_dict[i]) # Use the mapped embedding

            if len(final_embeddings_list) != len(ids_to_upsert):
                 logging.error("Internal error: Mismatch between final embeddings and other lists for upsert.")
                 raise ValueError("Final list mismatch before upsert")

        # --- Perform Upserts in Batches ---
        if final_embeddings_list: # Only upsert if we have valid embeddings
            logging.info(f"Attempting to upsert {len(ids_to_upsert)} chunks into ChromaDB in batches of {CHROMA_UPSERT_BATCH_SIZE}...")
            total_upserted = 0
            for i in range(0, len(ids_to_upsert), CHROMA_UPSERT_BATCH_SIZE):
                batch_ids = ids_to_upsert[i : i + CHROMA_UPSERT_BATCH_SIZE]
                batch_embeddings = final_embeddings_list[i : i + CHROMA_UPSERT_BATCH_SIZE]
                batch_metadatas = metadatas_to_upsert[i : i + CHROMA_UPSERT_BATCH_SIZE]
                batch_documents = documents_to_upsert[i : i + CHROMA_UPSERT_BATCH_SIZE]

                logging.info(f"Processing ChromaDB upsert batch {i // CHROMA_UPSERT_BATCH_SIZE + 1}: {len(batch_ids)} items")

                if not batch_ids: # Should not happen, but safety check
                    continue

                try:
                    collection.upsert(
                        ids=batch_ids,
                        embeddings=batch_embeddings,
                        metadatas=batch_metadatas,
                        documents=batch_documents
                    )
                    total_upserted += len(batch_ids)
                except Exception as e:
                     # Catch potential errors during ChromaDB upsert batch
                     logging.error(f"Error during ChromaDB upsert batch {i // CHROMA_UPSERT_BATCH_SIZE + 1}: {e}", exc_info=True)
                     # Log first few IDs of the failing batch for easier debugging
                     logging.error(f"Failing ChromaDB upsert batch IDs (first 5): {batch_ids[:5]}")
                     raise # Re-raise to prevent state saving

            logging.info(f"Upsert operation completed for {total_upserted} items across all batches.")
        else:
            logging.warning("Skipping upsert because no valid embeddings were generated.")


        # If we reached here, DB operations were successful or skipped appropriately
        db_operation_successful = True
        count = collection.count()
        logging.info(f"Collection '{COLLECTION_NAME}' now contains {count} items.")

    except Exception as e:
        logging.error(f"An error occurred during ChromaDB operations: {e}", exc_info=True)
        logging.error("Database state may be inconsistent.")

    finally:
        # 4. Save State (Only if DB operations were successful)
        if db_operation_successful:
             logging.info("Database operations finished successfully. Saving current processing state.")
             save_processing_state(STATE_FILE_PATH, current_run_processing_state)
        else:
             logging.error("Processing state was NOT saved due to errors during database operations. Changes will be retried on next run.")


# --- Main Execution Guard ---
if __name__ == "__main__":
    process_episodes_incremental()
