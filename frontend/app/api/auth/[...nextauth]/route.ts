import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId:
        process.env.GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_ID ||
        process.env.AUTH_GOOGLE_ID ||
        "placeholder_client_id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ||
        process.env.GOOGLE_SECRET ||
        process.env.AUTH_GOOGLE_SECRET ||
        "placeholder_client_secret",
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token?.sub) {
        // @ts-expect-error custom user id property
        session.user.id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "groqchat_auth_secret_key_32_characters_random_string",
});

export { handler as GET, handler as POST };

