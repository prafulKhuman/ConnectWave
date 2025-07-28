
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithPhoneNumber, ConfirmationResult, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, setupRecaptcha, getContactByPhone, sendEmailVerification as sendVerificationEmailHelper, compareValue } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Smartphone, KeyRound, AlertTriangle, Lock, Loader2, MailCheck, Mail } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function LoginPage() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'otp' | 'pin'>('otp');
  const [showResend, setShowResend] = useState(false);
  const [showPinPassword, setShowPinPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const countryCode = '+91';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowResend(false);
    try {
        const fullPhoneNumber = `${countryCode}${mobileNumber}`;
        const recaptchaVerifier = setupRecaptcha(fullPhoneNumber);
        const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
        setConfirmationResult(confirmation);
        setOtpSent(true);
        setLoginMethod('otp');
        toast({ title: 'OTP Sent', description: 'An OTP has been sent to your mobile number.' });
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/billing-not-enabled' || error.code === 'auth/configuration-not-found') {
        toast({ variant: 'destructive', title: 'OTP Service Unavailable', description: 'OTP service is currently unavailable. You can sign in using your PIN instead.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to send OTP. Please enter a valid 10-digit mobile number.' });
      }
    } finally {
        setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShowResend(false);
    if (!confirmationResult) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please send an OTP first.' });
        setLoading(false);
        return
    };
    try {
      const result = await confirmationResult.confirm(otp);
      if (!result.user.emailVerified) {
        await signOut(auth);
        toast({ variant: 'destructive', title: 'Email Not Verified', description: 'Please verify your email address before logging in. A new verification link has been sent.' });
        await sendVerificationEmailHelper(result.user);
        setLoading(false);
        setShowResend(true);
        return;
      }
      toast({ title: 'Success', description: 'You are now logged in.' });
      router.push('/');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Invalid OTP. Please try again.' });
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const user = await getContactByPhone(mobileNumber);
        if (!user || !user.pin) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invalid mobile number or no PIN set for this account.' });
            setLoading(false);
            return;
        }

        const isPinValid = await compareValue(pin, user.pin);
        if (!isPinValid) {
            toast({ variant: 'destructive', title: 'Error', description: 'Invalid PIN.' });
            setLoading(false);
            return;
        }

        setUserEmail(user.email);
        setShowPinPassword(true);
        toast({ title: 'PIN Verified', description: 'Please enter your password to complete sign-in.'});
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred during PIN verification.' });
    } finally {
        setLoading(false);
    }
  }

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
        
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            toast({ variant: 'destructive', title: 'Email Not Verified', description: 'Please verify your email address before logging in. A new verification link has been sent.' });
            await sendVerificationEmailHelper(userCredential.user);
            setShowResend(true);
            setShowPinPassword(false); // Hide password field, show resend button
            return;
        }
        
        toast({ title: 'Success', description: 'You are now logged in.' });
        router.push('/');

    } catch (error) {
        toast({ variant: 'destructive', title: 'Sign-in Failed', description: 'Incorrect password. Please try again.' });
    } finally {
        setLoading(false);
    }
  }

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await sendVerificationEmailHelper(auth.currentUser);
        toast({ title: 'Email Sent', description: 'A new verification email has been sent.' });
      } else {
         toast({ variant: 'destructive', title: 'Error', description: 'Please try signing in again to resend the verification email.' });
      }
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to resend verification email.' });
    } finally {
      setLoading(false);
      setShowResend(false);
    }
  }

  const currentForm = loginMethod === 'otp' ? handleSendOtp : handlePinLogin;


  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/20 p-3 rounded-full w-fit">
                <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">ConnectWave</CardTitle>
            <CardDescription>Securely sign in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {showResend && (
             <div className="space-y-4 my-4 text-center">
                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                    <AlertTriangle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-yellow-800 font-medium">Your email is not verified. Please check your inbox for a verification link.</p>
                </div>
                <Button onClick={handleResendVerification} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <MailCheck className="mr-2 h-4 w-4" />
                    Resend Verification Email
                </Button>
             </div>
          )}

          {showPinPassword ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={userEmail}
                      readOnly
                      className="pl-10 bg-muted/50"
                    />
                </div>
                 <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10"
                        required
                        disabled={loading}
                    />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Signing in...' : 'Sign In'}
                </Button>
                <Button variant="link" onClick={() => { setShowPinPassword(false); setPassword(''); setUserEmail('') }} className="w-full">
                    Back to PIN input
                </Button>
            </form>
          ) : !otpSent ? (
            <>
            <Tabs defaultValue={loginMethod} onValueChange={(value) => setLoginMethod(value as 'otp' | 'pin')} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="otp">Sign in with OTP</TabsTrigger>
                <TabsTrigger value="pin">Sign in with PIN</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={currentForm} className="space-y-4">
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
                {loginMethod === 'pin' && (
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Enter 4-digit PIN"
                            className="pl-10"
                            maxLength={4}
                            required
                            disabled={loading}
                        />
                    </div>
                )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Verifying...' : (loginMethod === 'otp' ? 'Send OTP' : 'Verify PIN')}
              </Button>
            </form>
            </>
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
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Verifying...' : 'Verify OTP & Sign In'}
              </Button>
              <Button variant="link" onClick={() => { setOtpSent(false); setConfirmationResult(null); }} className="w-full">
                Back to phone number input
              </Button>
            </form>
          )}

          <div className="text-right mt-4">
              <Link href="/forgot-password" passHref>
                  <Button variant="link" className="text-sm h-auto p-0">Forgot Credentials?</Button>
              </Link>
          </div>
          

          <div id="recaptcha-container" className="mt-4"></div>
           <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
