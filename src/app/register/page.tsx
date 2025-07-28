
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Smartphone, KeyRound, User, Lock, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword, addUserToFirestore, sendEmailVerification } from '@/lib/firebase';
import { auth } from '@/lib/firebase';
import type { Contact } from '@/lib/data';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be exactly 4 digits.' });
        setLoading(false);
        return;
    }
    
    try {
      // Step 1: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Step 2: Send verification email
      await sendEmailVerification(firebaseUser);

      // Step 3: Add user to Firestore database
      const newUser: Omit<Contact, 'id' | 'avatar' | 'online' | 'lastSeen'> = {
        name,
        email,
        phone: mobileNumber,
        pin,
        password, // Storing password here for PIN login fallback. In a real app, this is not recommended.
      };
      await addUserToFirestore({ id: firebaseUser.uid, ...newUser });

      toast({ title: 'Registration Successful', description: 'A verification email has been sent. Please verify your email before logging in.' });
      router.push('/login');

    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Registration failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak. Please use a stronger one.';
      }
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 bg-primary/20 p-3 rounded-full w-fit">
                <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Create an Account</CardTitle>
            <CardDescription>Join ConnectWave today!</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
             <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
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
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="Mobile Number"
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Create a 4-digit PIN"
                  className="pl-10"
                  maxLength={4}
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
                  placeholder="Create a Password"
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Registering...' : 'Register'}
              </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
