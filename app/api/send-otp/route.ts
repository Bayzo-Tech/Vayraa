import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone || phone.length !== 10) {
      return NextResponse.json(
        { success: false, message: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await adminDb.collection('otpStore').doc(phone).set({
      otp,
      expiry: Date.now() + 10 * 60 * 1000,
      createdAt: new Date(),
    });

    const params = new URLSearchParams({
      authorization: process.env.FAST2SMS_API_KEY!,
      variables_values: otp,
      route: 'dlt',
      numbers: phone,
      message: '214466',
      sender_id: 'VAYRAA',
    });

    try {
      const res = await fetch(
        `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`,
        { method: 'GET' }
      );
      const data = await res.json();
      console.log('Fast2SMS:', JSON.stringify(data));
    } catch (smsErr) {
      console.error('Fast2SMS error:', smsErr);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}