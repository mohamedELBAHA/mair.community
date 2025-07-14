import type { FormsSubmissions, Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://mair.ma", // replace this with your deployed domain
  author: "MAIR",
  profile: "https://geeksblabla.community/",
  desc: "Moroccans In AI Research (MAIR)",
  title: "MAIR",
  ogImage: "marima_cover.jpeg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 10,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = {
  github: {
    href: "https://github.com/geeksblabla",
    linkTitle: `${SITE.title} on Github`,
    active: true,
  },
  linkedin: {
    href: "https://www.linkedin.com/company/mairma/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  discord: {
    href: "https://lnkd.in/et9MW3_i",
    linkTitle: `${SITE.title} on Discord`,
    active: true,
  },
};

export const FORMS_SUBMISSIONS: FormsSubmissions[] = [
  {
    name: "Join the core team",
    url: "https://tally.so/r/meqj6E",
    redirect: "join",
  },
  {
    name: "Contribute to the community",
    url: "/blog/contribute-to-geeksblabla",
    redirect: "contribute",
  },
  {
    name: "Suggest an episode or guests",
    url: "/podcast/planning",
  },
  {
    name: "Feedback & suggestions",
    url: "/feedback",
    redirect: "feedback",
  },
];
