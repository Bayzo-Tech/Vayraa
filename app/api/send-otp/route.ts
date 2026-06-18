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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q_json',
        message: `Your Vayra OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
        language: 'english',
        flash: 0,
        numbers: phone,
      }),
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => { clearTimeout(timeoutId); console.log('Fast2SMS response:', JSON.stringify(data)); })
      .catch(err => { clearTimeout(timeoutId); console.error('Fast2SMS error:', err); });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}