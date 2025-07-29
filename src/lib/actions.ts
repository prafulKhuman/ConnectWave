
'use server';

import { Resend } from 'resend';

export async function sendFeedbackEmail(fromEmail: string, message: string) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev', // This is a fixed value for Resend's free tier
            to: 'praful.khuman@ics-global.in',
            subject: 'ConnectWave App Feedback',
            html: `<p>Feedback from: ${fromEmail}</p><p>${message}</p>`
        });
        return { success: true };
    } catch (error: any) {
        console.error("Resend API Error:", error);
        return { success: false, error: error.message };
    }
}
