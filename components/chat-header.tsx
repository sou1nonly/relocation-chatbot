'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import { useEffect, useState, memo } from 'react';

import { ModelSelector } from '@/components/model-selector';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { MemoryViewer } from '@/components/memory-viewer';
import { Button } from '@/components/ui/button';
import { PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import type { Session } from 'next-auth';
import Image from 'next/image';
import { ChevronDown } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { toast } from './toast';
import { guestRegex } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function HeaderUserNav({ user }: { user: any }) {
  const router = useRouter();
  const { data, status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = guestRegex.test(data?.user?.email ?? '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 px-3 gap-2">
          <Image
            src={`https://avatar.vercel.sh/${user.email}`}
            alt={user.email ?? 'User Avatar'}
            width={20}
            height={20}
            className="rounded-full"
          />
          <span className="text-sm">{isGuest ? 'Guest' : user?.email}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {`Toggle ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button
            type="button"
            className="w-full cursor-pointer"
            onClick={() => {
              if (status === 'loading') {
                toast({
                  type: 'error',
                  description:
                    'Checking authentication status, please try again!',
                });
                return;
              }

              if (isGuest) {
                router.push('/login');
              } else {
                signOut({
                  redirectTo: '/',
                });
              }
            }}
          >
            {isGuest ? 'Login to your account' : 'Sign out'}
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  const [memoryData, setMemoryData] = useState<any>(null);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);

  useEffect(() => {
    const fetchMemoryData = async () => {
      if (!session?.user?.id) return;

      setIsLoadingMemory(true);
      try {
        const response = await fetch('/api/memory');
        if (response.ok) {
          const data = await response.json();
          setMemoryData(data.memoryData);
        }
      } catch (error) {
        console.error('Failed to fetch memory data:', error);
      } finally {
        setIsLoadingMemory(false);
      }
    };

    fetchMemoryData();
  }, [session?.user?.id, chatId]); // Refetch when chat changes

  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {!isReadonly && (
        <ModelSelector
          session={session}
          selectedModelId={selectedModelId}
          className="order-1 md:order-2"
        />
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-3"
        />
      )}

      {/* Memory Viewer */}
      <div className="order-1 md:order-4">
        <MemoryViewer memoryData={memoryData} isLoading={isLoadingMemory} />
      </div>

      {/* User Navigation - moved from sidebar */}
      <div className="hidden md:flex order-5 md:ml-auto">
        <HeaderUserNav user={session.user} />
      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});
