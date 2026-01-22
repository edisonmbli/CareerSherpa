'use client'
import { useUser } from '@stackframe/stack'
import Link from 'next/link'
import Image from 'next/image'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function UserMenu({ locale, dict }: { locale: string; dict: any }) {
  const user = useUser()
  const avatarUrl = (user as any)?.profileImageUrl || ''
  const display = avatarUrl ? '' : ((user as any)?.name || (user as any)?.username || dict.shell?.myAccount || 'My Account')
  const onSignOut = async () => {
    try { await user?.signOut?.() } catch { }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full">
          {avatarUrl ? (<Image src={avatarUrl} alt="avatar" width={24} height={24} className="h-6 w-6 rounded-full" />) : (<span>{display}</span>)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          {avatarUrl ? (<Image src={avatarUrl} alt="avatar" width={24} height={24} className="h-6 w-6 rounded-full" />) : (<div className="h-6 w-6 rounded-full bg-muted" />)}
          <span className="truncate">{display}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/account`}>{dict.shell?.accountSettings || 'Account Settings'}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/profile?tab=assets`}>{dict.shell?.assets || 'Assets'}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/profile?tab=billing`}>{dict.shell?.billing || 'Billing'}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>{dict.shell?.signOut || 'Sign out'}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}