
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const apiKey = '4db5e4414c2df29dfc12669fb662e1c272f1';
    if (!apiKey) {
      throw new Error('TURN_API_KEY is not set');
    }

    const response = await fetch(`https://connectwave.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error("TURN Server API Error:", errorText);
        throw new Error(`Failed to fetch TURN credentials: ${response.statusText}`);
    }
    
    const iceServers = await response.json();

    // The API returns an array, which is what RTCPeerConnection expects.
    return NextResponse.json(iceServers);

  } catch (error: any) {
    console.error('API Route Error in /api/turn:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch TURN credentials' }, { status: 500 });
  }
}
