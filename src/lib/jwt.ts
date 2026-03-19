import { SignJWT } from 'jose';

export async function generateProjectToken(): Promise<string> {
    const secretKey = process.env.JARVIS_JWT_SECRET;

    if (!secretKey) {
        throw new Error("JARVIS_JWT_SECRET is not defined in environment variables.");
    }

    const secret = new TextEncoder().encode(secretKey);

    return new SignJWT({ sub: 'jarvis' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1m') // Current time + 60s
        .sign(secret);
}
