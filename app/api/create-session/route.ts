import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// Creates a real Firebase-signed session cookie from an ID token.
// This cookie cannot be faked in devtools — Firebase signs it server-side.
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ success: false, message: "Missing ID token" }, { status: 400 });
    }

    // Verify the ID token is genuinely from Firebase before trusting it
    await adminAuth.verifyIdToken(idToken);

    // Firebase session cookies allow a max of 14 days (2 weeks) —
    // this is a hard limit enforced by Firebase, not something we choose.
    const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 days in milliseconds
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const response = NextResponse.json({ success: true });
    response.cookies.set("bayzo_session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("create-session error:", error);
    return NextResponse.json({ success: false, message: "Could not create session" }, { status: 401 });
  }
}