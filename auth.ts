import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { NeonAdapter } from "@/lib/auth-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NeonAdapter,
  providers: [
    Resend({
      from: "crosscheck <onboarding@resend.dev>",
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify",
  },
  session: { strategy: "database" },
});
