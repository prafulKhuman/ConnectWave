
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthUserChanged, getCurrentUser, getContacts, findUserByEmail, addContact, deleteContact, createChatWithUser } from '@/lib/firebase';
import type { Contact } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Home, Trash2, MessageSquare, Search } from 'lucide-react';
import { UserAvatar } from '@/components/chat/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ContactsPage() {
  const [currentUser, setCurrentUser] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged(async (user) => {
      if (user) {
        const userProfile = await getCurrentUser(user.uid);
        setCurrentUser(userProfile);
        if (userProfile) {
          const unsubscribeContacts = getContacts(userProfile.id, (userContacts) => {
            setContacts(userContacts);
            setLoading(false);
          });
          return () => unsubscribeContacts();
        } else {
            setLoading(false);
            router.push('/login');
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter an email address.' });
      return;
    }
    setAddLoading(true);
    try {
        const foundUser = await findUserByEmail(contactEmail);
        if (!foundUser) {
            toast({ variant: 'destructive', title: 'User Not Found', description: 'No user found with that email address.' });
            return;
        }

        if(foundUser.id === currentUser.id) {
            toast({ variant: 'destructive', title: 'Error', description: 'You cannot add yourself as a contact.' });
            return;
        }

        if (contacts.some(c => c.id === foundUser.id)) {
            toast({ variant: 'destructive', title: 'Contact Exists', description: `${foundUser.name} is already in your contacts.` });
            return;
        }

        await addContact(currentUser.id, foundUser);
        toast({ title: 'Contact Added', description: `${foundUser.name} has been added to your contacts.` });
        setContactEmail('');

    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add contact.' });
    } finally {
        setAddLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!currentUser) return;
    setDeleteLoading(contactId);
    try {
        await deleteContact(currentUser.id, contactId);
        toast({ title: 'Contact Deleted', description: 'The contact has been removed.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete contact.' });
    } finally {
        setDeleteLoading(null);
    }
  }

  const handleStartChat = async (contactId: string) => {
    if (!currentUser) return;
    setChatLoading(contactId);
    try {
        await createChatWithUser(currentUser.id, contactId);
        router.push('/');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to start chat.' });
    } finally {
        setChatLoading(null);
    }
  }

  if (loading || !currentUser) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
            <div className='flex items-center gap-3'>
                <UserPlus className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Manage Contacts</h1>
                    <p className="text-muted-foreground">Add, remove, and start chats with your contacts.</p>
                </div>
            </div>
            <Button variant="outline" onClick={() => router.push('/')}>
                <Home className="mr-2 h-4 w-4" /> Go to Chats
            </Button>
        </header>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Add a New Contact</CardTitle>
                <CardDescription>Enter the email address of the user you want to add.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAddContact} className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="pl-10"
                            required
                            disabled={addLoading}
                        />
                    </div>
                    <Button type="submit" className="w-full sm:w-auto" disabled={addLoading}>
                        {addLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {addLoading ? 'Adding...' : 'Add Contact'}
                    </Button>
                </form>
            </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Your Contacts ({contacts.length})</CardTitle>
                <CardDescription>All your saved contacts are listed below.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {contacts.length === 0 && !loading && (
                        <p className="text-center text-muted-foreground py-8">You haven't added any contacts yet.</p>
                    )}
                    {contacts.map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <UserAvatar user={contact} />
                                <div>
                                    <p className="font-semibold">{contact.name}</p>
                                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleStartChat(contact.id)} disabled={chatLoading === contact.id}>
                                    {chatLoading === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                                    <span className="hidden sm:inline ml-2">Chat</span>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive" disabled={deleteLoading === contact.id}>
                                            {deleteLoading === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            <span className="hidden sm:inline ml-2">Delete</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently remove {contact.name} from your contacts. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteContact(contact.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
