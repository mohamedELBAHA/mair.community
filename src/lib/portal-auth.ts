import { SignJWT, jwtVerify } from "jose";

export const PORTAL_SESSION_COOKIE = "mair_portal_session";
const ALG = "HS256";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days — bootcamps run a few weeks

export type PortalSession = {
  uid: string;            // mentorship_users.id
  cohortSlug: string;
};

function getSecretKey() {
  const s = import.meta.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET must be set to a string of at least 16 characters");
  }
  return new TextEncoder().encode(s);
}

export async function createPortalToken(payload: PortalSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(getSecretKey());
}

export async function verifyPortalToken(
  token: string | undefined | null
): Promise<PortalSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: [ALG] });
    if (typeof payload.uid !== "string" || typeof payload.cohortSlug !== "string") return null;
    return { uid: payload.uid, cohortSlug: payload.cohortSlug };
  } catch {
    return null;
  }
}

export const PORTAL_SESSION_MAX_AGE = SESSION_TTL;
