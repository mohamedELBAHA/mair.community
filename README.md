# GeeksBlabla Website

> This website is built with [Astro](https://astro.build/)

## Quick Links

- [Getting Started](#getting-started)
- [Project Structure](#-project-structure)
- [Commands](#-commands)
- [Podcast Chatbot Indexing & Local Development](#-podcast-chatbot-indexing--local-development)
- [Add a new Episode](#add-a-new-episode)
- [Add a new Article](#add-a-new-article)
- [Licensing](#licensing)
- [Contributors](#contributors)

## Getting Started

1.  Fork and clone the repository

    ```bash
    git clone [https://github.com/your-username/geeksblabla.community.git](https://github.com/your-username/geeksblabla.community.git)
    cd geeksblabla.community
    ```

2.  Install dependencies (using pnpm is recommended)

    ```bash
    pnpm install
    ```

3.  Start the development server

    ```bash
    pnpm run dev
    ```

To simplify project management, we added mock data to ensure the website functions in development mode without requiring any external API keys for some features. However, if you want to work with real data for the gallery, episode planning, adding new episodes, or **enabling the podcast chatbot feature**, you will need API keys.

**Core Website API Keys (Optional, for Notion/YouTube/Cloudinary features):**

```sh
# In a .env file at the project root
NOTION_API_KEY=
GEEKSBLABLA_NOTION_DATABASE_ID=
YOUTUBE_API_KEY=
CLOUDINARY_API_SECRET=
PUBLIC_CLOUDINARY_API_KEY=
PUBLIC_CLOUDINARY_CLOUD_NAME=
```

**Podcast Chatbot Feature API Keys/Config (Required for chatbot functionality):**

```sh
# In a .env file at the project root
# For Astro API Route (Chatbot Frontend Interaction)
OPENAI_API_KEY="sk-..." # Your OpenAI API Key
CHROMA_URL="http://localhost:8000" # URL of your ChromaDB instance (local Docker or remote)
CHROMA_TOKEN="your-token-here" # Token for ChromaDB authentication (if required)
# Optional overrides for Astro API Route
# CHROMA_COLLECTION="podcast_episodes"
# OPENAI_CHAT_MODEL="gpt-3.5-turbo"
# OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
# N_RESULTS_RETRIEVE="20"
# N_RESULTS_CONTEXT="5"
# TRANSLATE_NON_ENGLISH="true"

```

**Important:** Add the `.env` file to your `.gitignore` to avoid committing secrets.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
├── articles/
├── authors/
├── episodes/ # <--- Podcast episode markdown files live here
├── python-scripts/  # <--- Python indexing script lives here
│   └── process_and_index.py
├── src/
│   ├── actions/ # astro actions, Api for to connect with notion
│   ├── assets/ # images, videos, etc.
│   ├── components/ # reusable components (e.g., Chatbot.astro)
│   ├── content/ # content for the blog config, articles, authors, episodes
│   ├── lib/ # utils functions
│   └── pages/
│       └── api/ # <--- Astro API routes (e.g., chat.ts)
├── .env # <--- Store API keys and configuration here (add to .gitignore!)
├── astro.config.mjs
├── README.md
├── package.json
├── requirements.txt # <--- Python dependencies for indexing script
└── tsconfig.json
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                           |
| :------------------------- | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies (Node.js)                  |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm run build`           | Build your production site to `./dist/`          |
| `pnpm run preview`         | Preview your build locally, before deploying     |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm run lint`            | Run lint                                         |
| `pnpm run check`           | Run check                                        |
| `pnpm run check-all`       | Run lint, check and build                        |
| `pnpm run astro -- --help` | Get help using the Astro CLI                     |

---

## 🤖 Podcast Chatbot Indexing & Local Development

The website includes an experimental chatbot feature that allows users to ask questions about podcast episodes. This requires indexing the episode content into a vector database (ChromaDB) using a Python script.

### 1. Python Setup (One-time)

- **Install Python:** Ensure you have Python 3.8 or higher installed.
- **Create Virtual Environment:** Navigate to the project root directory in your terminal and create a virtual environment:
  ```bash
  python -m venv .venv
  ```
- **Activate Virtual Environment:**
  - macOS/Linux: `source .venv/bin/activate`
  - Windows (cmd): `.\.venv\Scripts\activate`
  - Windows (PowerShell): `.\.venv\Scripts\Activate.ps1`
- **Install Python Dependencies:** Install the required libraries listed in `requirements.txt`:
  ```bash
  pip install -r requirements.txt
  ```
  _(Ensure `requirements.txt` includes `openai`, `chromadb`, `python-dotenv`, `python-frontmatter`, `markdown`)_

### 2. Configure Indexing Script

- Create a `.env` file in the project root (if you haven't already).
- Add the necessary environment variables for the Python script (see "Podcast Chatbot Feature API Keys/Config" section above). Key variables:
  - `OPENAI_API_KEY`: Your OpenAI key (required for embeddings).
  - `MARKDOWN_PATH_PATTERN`: Path to your episode files (default `episodes/**/*.md` should work).
  - `STATE_FILE_PATH`: Where to store the index state (default `./processing_state.json`).
  - **ChromaDB Connection:** Choose ONE method:
    - **Local Persistence (Easier Start):** Do **NOT** set `CHROMA_HOST`. Set `VECTOR_STORE_PATH` to the directory where ChromaDB should store its files locally (e.g., `./chroma_db_store`). The script will create and manage these files.
    - **Connect to Running Server (Docker/Remote):** Set `CHROMA_HOST` to the server's address (e.g., `localhost` for local Docker, or your GCP VM IP) and `CHROMA_PORT` (usually `8000`). Do **NOT** set `VECTOR_STORE_PATH` if using `CHROMA_HOST`.

### 3. Running the Indexing Script

- Make sure your Python virtual environment is active (`source .venv/bin/activate` or equivalent).
- Ensure your `.env` file is configured correctly.
- Run the script from the project root:
  ```bash
  python python-scripts/process_and_index.py
  ```
- The script will scan for new/modified/deleted episode files based on the state file, generate embeddings using OpenAI for changes, and upsert/delete data in ChromaDB (either locally persisted or on the configured server).
- **Run this script whenever you add or significantly modify episode markdown files.**

### 4. Running ChromaDB Locally with Docker (Optional, Alternative to Local Persistence)

If you prefer to run ChromaDB as a separate server locally instead of using the script's local file persistence:

- Install Docker Desktop or Docker Engine.
- Run the ChromaDB container from your terminal:
  ```bash
  docker run -d --name chromadb -p 8000:8000 -v $(pwd)/chroma_db_volume:/chroma/chroma chromadb/chroma
  ```
  _(This mounts a local directory `chroma_db_volume` for persistence. Adjust the volume path as needed.)_
- Configure your `.env` file for the Python script by setting `CHROMA_HOST=localhost` and `CHROMA_PORT=8000` (and **remove** or comment out `VECTOR_STORE_PATH`).
- Configure your `.env` file for the Astro app by setting `CHROMA_URL="http://localhost:8000"`.

### 5. Running the Chatbot Feature Locally (Astro)

- Ensure the main Astro development server is running: `pnpm run dev`.
- Configure your `.env` file with the necessary variables for the Astro API route:
  - `OPENAI_API_KEY` (Required).
  - `CHROMA_URL`: This **must** point to a running ChromaDB server instance (e.g., `http://localhost:8000` if running the Docker container locally, or the URL of your remote GCP instance). The Astro app **cannot** directly access the local file persistence (`VECTOR_STORE_PATH`) used by the Python script; it needs the HTTP endpoint.
- Navigate to the page containing the chatbot component in your browser (`localhost:4321/...`).
- The chatbot should now be able to:
  - Take your query.
  - (Translate if necessary).
  - Generate an embedding (OpenAI).
  - Query the running ChromaDB instance specified by `CHROMA_URL`.
  - Get context.
  - Generate a response (OpenAI) based on the context and system prompt.
  - Display the response.

---

## Add a new Episode

Adding a new episode is as simple as adding a new markdown file to the `episodes/` folder with the following format:

> ⚠️ `category` attribute should be one of the following: `dev`, `mss`, `ai`, `career`,`ama`
> ⚠️ Ensure the `youtube:` field contains the **full, correct YouTube URL**.

```md
---
date: 2020-02-16
duration: "01:40:00"
title: "Side Projects & Indie Hacking"
tags: ["dev", "indie", "career"]
category: "career"
youtube: https://www.youtube.com/watch?v= # <-- Use the actual YouTube URL here!
published: true
---

Episode description

## Guests

[Guest 1](https://example.com)

[Guest 2](https://example.com)

## Notes

00:00:00 - Introduction: Welcoming, guests intro.

00:05:00 - Topic 1

00:16:00 - Topic 2

00:24:00 - Topic 3

00:32:00 - Topic 4

## Links

[Link 1](https://www.example.com)

[Link 2](https://www.example.com)

## Prepared and Presented by

[Host 1](https://example.com)
```

> **Remember to run the Python indexing script after adding/modifying episodes to update the chatbot's knowledge.**

## Add a new Article

To add a new article, follow these steps:

1.  If this is your first time, you will need to create your author json file in the `authors/` directory.

    ```json
    // authors/author-name.json
    {
      "name": "Author Name",
      "url": "[https://example.dev](https://example.dev)",
      "bio": "Guest bio",
      "avatar": "/avatars/avatar.jpg",
      "is_core_team": false
    }
    ```

2.  Create a new markdown file in the `articles/` directory.
3.  Use the following format:

    ```md
    ---
    title: "Article Title"
    tags: ["tag1", "tag2", "tag3"]
    keywords: ["keyword1", "keyword2", "keyword3"]
    pubDatetime: 2024-12-01
    authors: ["author-name"] # the name of the author file
    slug: article-slug
    description: "Article description"
    ogImage: "/og-image.jpg"
    ---

    Article content
    ```

## Licensing

The code in this project is licensed under MIT license.

## Contributors

Big thanks to all the code contributors who made this project possible!

![GeeksBlabla contributors](https://contributors.aika.dev/geeksblabla/geeksblabla.com/contributors.svg?max=44)
