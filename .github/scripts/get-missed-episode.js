#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RSS_URL = "https://anchor.fm/s/88e3048/podcast/rss";
const EPISODES_DIR = path.join(__dirname, "../../episodes");
const ROOT_DIR = path.join(__dirname, "../..");

export const getYoutubeIdFromUrl = url => {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

async function getLocalEpisodesLength() {
  const files = fs.readdirSync(EPISODES_DIR);
  return files.length;
}

async function getRSSEpisodesLength() {
  try {
    const response = await fetch(RSS_URL);
    const data = await response.text();
    const parser = new XMLParser();
    const result = parser.parse(data);

    const episodes = result.rss.channel.item;
    return episodes.length;
  } catch (error) {
    console.error("Error fetching RSS feed:", error.message);
    process.exit(1);
  }
}

/**
 * Write YouTube ID to a JSON file in the root directory
 * @param {string} youtubeId - The YouTube ID to write
 */
async function writeYoutubeIdToFile(youtubeId) {
  const filePath = path.join(ROOT_DIR, "missed-episode.json");
  const content = JSON.stringify({ id: youtubeId }, null, 2);
  fs.writeFileSync(filePath, content);
  console.log(`YouTube ID written to ${filePath}`);
}

async function findMissingEpisodesYoutubeId() {
  const [localEpisodes, rssEpisodes] = await Promise.all([
    getLocalEpisodesLength(),
    getRSSEpisodesLength(),
  ]);
  if (localEpisodes > rssEpisodes) {
    const missedEpisodeNumber = rssEpisodes;
    console.log(`Next episode to upload: #${missedEpisodeNumber}`);
    const youtubeId = await getEpisodeYoutubeId(missedEpisodeNumber);
    console.log(`YouTube ID: ${youtubeId}`);
    await writeYoutubeIdToFile(youtubeId);
    return youtubeId;
  } else {
    console.log("All episodes are up to date in the RSS feed.");
    return null;
  }
}

/**
 * Get the YouTube ID of an episode
 * @param {number} input - The episode number
 * @returns {string} The YouTube ID
 * @throws {Error} If the episode file doesn't exist or youtubeId is not found
 */
async function getEpisodeYoutubeId(input) {
  const episodeNumber = input.toString().padStart(4, "0");
  const episodePath = path.join(EPISODES_DIR, `episode-${episodeNumber}.md`);

  if (!fs.existsSync(episodePath)) {
    throw new Error(`Episode file not found: episode-${episodeNumber}.md`);
  }

  const content = fs.readFileSync(episodePath, "utf8");
  const { data: frontmatter } = matter(content);

  if (!frontmatter.youtube) {
    throw new Error(`YouTube URL not found in episode-${episodeNumber}.md`);
  }

  const youtubeId = getYoutubeIdFromUrl(frontmatter.youtube);
  if (!youtubeId) {
    throw new Error(`Invalid YouTube URL in episode-${episodeNumber}.md`);
  }
  return youtubeId;
}

// Run the script
findMissingEpisodesYoutubeId().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
