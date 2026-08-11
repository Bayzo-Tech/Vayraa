import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
    const token = request.cookies.get("bayzo_session")?.value;

    if (!token) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // ✅ NOTE: presence check only, same as before — full cryptographic
    // verification of this cookie happens in Node.js API routes/pages via
    // adminAuth.verifySessionCookie(), since Edge middleware can't run the
    // Firebase Admin SDK. The cookie itself is now Firebase-signed (set by
    // /api/create-session), so it can no longer be faked by just typing a
    // value into document.cookie like the old plain-uid cookie could.

    return NextResponse.next();
}

export const config = {
    matcher: ["/payment/:path*", "/orders/:path*", "/history/:path*", "/admin/:path*"],
};