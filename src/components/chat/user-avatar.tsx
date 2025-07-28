
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Contact } from '@/lib/data';

type UserAvatarProps = {
  user: Partial<Contact>;
  className?: string;
};

export function UserAvatar({ user, className }: UserAvatarProps) {
  const fallbackName = user.name || 'User';

  return (
    <div className="relative">
      <Avatar className={cn('h-12 w-12', className)}>
        <AvatarImage src={user.avatar} alt={fallbackName} data-ai-hint="profile picture" />
        <AvatarFallback>{fallbackName.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
      </Avatar>
      {user.online && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
      )}
    </div>
  );
}
