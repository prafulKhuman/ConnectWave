
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, setupRecaptcha } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Smartphone, KeyRound } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const countryCode = '+91';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const fullPhoneNumber = `${countryCode}${mobileNumber}`;
        const recaptchaVerifier = setupRecaptcha(fullPhoneNumber);
        const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
        setConfirmationResult(confirmation);
        setOtpSent(true);
        toast({ title: 'OTP Sent', description: 'An OTP has been sent to your mobile number.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send OTP. Please enter a valid 10-digit mobile number.' });
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!confirmationResult) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please send an OTP first.' });
        setLoading(false);
        return
    };
    try {
      await confirmationResult.confirm(otp);
      localStorage.setItem('session-timestamp', Date.now().toString());
      toast({ title: 'Success', description: 'You are now logged in.' });
      router.push('/');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid OTP. Please try again.' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/20 p-3 rounded-full w-fit">
                <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">ConnectWave</CardTitle>
            <CardDescription>Securely sign in with your mobile number.</CardDescription>
        </CardHeader>
        <CardContent>
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-md border border-input bg-background px-3 py-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 21 15"><path fill="#f93" d="M0 0h21v5H0z"/><path fill="#fff" d="M0 5h21v5H0z"/><path fill="#128807" d="M0 10h21v5H0z"/><g transform="translate(10.5 7.5)"><circle r="2" fill="#008"/><circle r="1.75" fill="#fff"/><path fill="#008" d="M-1.75 0a1.75 1.75 0 1 0 3.5 0a.175.175 0 1 1-3.5 0m.35 0a1.4 1.4 0 1 1 2.8 0 .14.14 0 1 0-2.8 0m-.175.21a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.575-1.575a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.75 1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.925 1.4a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-2.1-1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.575-1.575a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.75 1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.4-1.925a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.75-1.75a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m1.575 1.575a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m1.75-1.75a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m-1.925-1.4a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m2.1 1.75a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m-1.575 1.575a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m-1.75-1.75a.175.175 0 1 1-.35 0 .175.175 0 0 1 .35 0m1.4 1.925a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.575-1.575a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.75 1.75a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.925 1.4a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m2.1-1.75a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.575-1.575a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.75-1.75a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m-1.4-1.925a.175.175 0 1 1 0-.35.175.175 0 0 1 0 .35m1.75-1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.575 1.575a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.75-1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m-1.925-1.4a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m2.1 1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.575 1.575a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.75-1.75a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0m1.4 1.925a.175.175 0 1 1 .35 0 .175.175 0 0 1-.35 0"/></g></svg>
                        <span className="text-sm font-medium text-muted-foreground">{countryCode}</span>
                    </div>
                    <Input
                        type="tel"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="Mobile number"
                        required
                        disabled={loading}
                        className="flex-1"
                    />
                </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP & Sign In'}
              </Button>
              <Button variant="link" onClick={() => setOtpSent(false)} className="w-full">
                Back to phone number input
              </Button>
            </form>
          )}
          <div id="recaptcha-container" className="mt-4"></div>
        </CardContent>
      </Card>
    </div>
  );

    

    