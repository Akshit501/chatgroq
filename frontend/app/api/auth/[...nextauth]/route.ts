import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Ensure NEXTAUTH_URL is strictly set to the production domain on Vercel
if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.includes("localhost") || process.env.VERCEL) {
  process.env.NEXTAUTH_URL = "https://frontend-tau-five-uprlpolv77.vercel.app";
}

const rawClientId =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_ID ||
  process.env.AUTH_GOOGLE_ID ||
  "1022221568103-bt0duq03hqn0q4i9mn4pnp9qakc3q81t.apps.googleusercontent.com";

// Clean and fix optical typo where '0' (zero) was entered as capital 'O'
const clientId = rawClientId
  .trim()
  .replace(/^(\d+-)[oO]/, (_m, p1) => p1 + "0");

const clientSecret = (
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.GOOGLE_SECRET ||
  process.env.AUTH_GOOGLE_SECRET ||
  "placeholder_client_secret"
).trim();

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId,
      clientSecret,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        // @ts-expect-error custom user id property
        session.user.id = token.sub || token.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "groqchat_auth_secret_key_32_characters_random_string",
  logger: {
    error(code, metadata) {
      console.error("NextAuth [Error]:", code, metadata);
    },
    warn(code) {
      console.warn("NextAuth [Warn]:", code);
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
