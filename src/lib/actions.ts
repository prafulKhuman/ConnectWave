
'use server';

import { Resend } from 'resend';

export async function sendFeedbackEmail(currentUser: any, message: string) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        await resend.emails.send({
            from: 'Connect Wave <onboarding@resend.dev>', // This is a fixed value for Resend's free tier
            to: 'praful.khuman@ics-global.in',
            subject: 'ConnectWave App Feedback / Issues',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    <h2 style="color: #333;">Feedback From</h2>
                    <p><strong>Name:</strong> ${currentUser.name}</p>
                    <p><strong>Email:</strong> ${currentUser.email}</p>

                    <h3 style="margin-top: 20px; color: #333;">Feedback:</h3>
                    <p style="background: #f9f9f9; padding: 10px; border-radius: 5px;">
                        ${message}
                    </p>
                </div>`
        });
        return { success: true };

    } catch (error: any) {
        console.error("Resend API Error:", error);
        return { success: false, error: error.message };
    }
}
