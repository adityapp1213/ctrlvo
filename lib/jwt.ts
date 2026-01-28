import { jwtVerify, createRemoteJWKSet } from "jose";

const ISSUER = process.env.CLERK_ISSUER!;
const JWKS_URL = process.env.CLERK_JWKS_URL!;

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export async function verifyClerkToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
  });
  return payload;
}

