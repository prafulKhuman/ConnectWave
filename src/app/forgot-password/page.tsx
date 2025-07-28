
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, KeyRound, Loader2, Lock } from 'lucide-react';
import { sendPasswordResetEmail, findUserByEmail, signInWithEmailAndPassword, hashValue, updateUserProfile } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetTab, setResetTab] = useState('password');
  const router = useRouter();
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Please check your inbox for instructions to reset your password.',
      });
      router.push('/login');
    } catch (error: any) {
      let errorMessage = 'Failed to send password reset email. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email address.';
      }
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handlePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'New PIN must be exactly 4 digits.' });
        return;
    }
    setLoading(true);
    try {
        // Step 1: Verify the user's password
        await signInWithEmailAndPassword(auth, email, password);
        
        // Step 2: Find user in Firestore to get their ID
        const user = await findUserByEmail(email);
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find user profile.' });
            return;
        }

        // Step 3: Hash the new PIN
        const hashedPin = await hashValue(newPin);

        // Step 4: Update the user's profile with the new hashed PIN
        await updateUserProfile(user.id, { pin: hashedPin });

        // Step 5: Sign the user out for security and notify them
        await auth.signOut();
        toast({ title: 'PIN Reset Successful', description: 'Your App Lock PIN has been changed. Please log in again.' });
        router.push('/login');

    } catch (error: any) {
        let errorMessage = 'Failed to reset PIN. Please check your credentials.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No user found with this email address.';
        }
        console.error("PIN Reset Error:", error);
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/20 p-3 rounded-full w-fit">
                <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Forgot Credentials</CardTitle>
            <CardDescription>Reset your password or your App Lock PIN.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs value={resetTab} onValueChange={setResetTab} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Reset Password</TabsTrigger>
                <TabsTrigger value="pin">Reset PIN</TabsTrigger>
              </TabsList>
              <TabsContent value="password">
                <form onSubmit={handlePasswordReset} className="space-y-4 pt-4">
                    <p className="text-sm text-center text-muted-foreground">Enter your email to receive a password reset link.</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        className="pl-10"
                        required
                        disabled={loading}
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                </form>
              </TabsContent>
               <TabsContent value="pin">
                  <form onSubmit={handlePinReset} className="space-y-4 pt-4">
                    <p className="text-sm text-center text-muted-foreground">Enter your email, password, and new PIN.</p>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email Address"
                            className="pl-10"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Current Password"
                            className="pl-10"
                            required
                            disabled={loading}
                        />
                    </div>
                     <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="password"
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value)}
                            placeholder="New 4-digit PIN"
                            className="pl-10"
                            maxLength={4}
                            required
                            disabled={loading}
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Resetting...' : 'Set New PIN'}
                    </Button>
                  </form>
              </TabsContent>
            </Tabs>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remember your credentials?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
