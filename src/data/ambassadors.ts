export type Ambassador = {
  id: string;
  name: string;
  role: string;
  location: string;
  bio?: string;
  photo?: string;
  links?: {
    linkedin?: string;
    website?: string;
    twitter?: string;
  };
  // Percentage coordinates relative to the map container
  x: number; // 0-100
  y: number; // 0-100
};

export const AMBASSADORS: Ambassador[] = [
  {
    id: "na-nyc",
    name: "Example Ambassador",
    role: "Community Ambassador (North America)",
    location: "New York, USA",
    bio: "Helps connect Moroccan AI researchers across North America and mentors new graduate students.",
    photo: "/avatars/default-avatar.svg",
    links: {
      linkedin: "https://www.linkedin.com",
      website: "https://example.com",
    },
    x: 30,
    y: 38,
  },
  {
    id: "eu-paris",
    name: "Ambassador Europe",
    role: "Community Ambassador (Europe)",
    location: "Paris, France",
    bio: "Coordinates meetups and supports early-career researchers applying to PhD programs.",
    photo: "/avatars/default-avatar.svg",
    links: {
      linkedin: "https://www.linkedin.com",
    },
    x: 52,
    y: 35,
  },
  {
    id: "ma-casa",
    name: "Ambassador Morocco",
    role: "Community Ambassador (Morocco)",
    location: "Casablanca, Morocco",
    bio: "Organizes local academic & industry bridges and fosters student engagement.",
    photo: "/avatars/default-avatar.svg",
    x: 45,
    y: 48,
  },
];
