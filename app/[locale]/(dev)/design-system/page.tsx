import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { AppCard, AppCardContent, AppCardHeader, AppCardTitle } from '@/components/app/AppCard'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { I18nToggle } from '@/components/app/I18nToggle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Info } from 'lucide-react'

interface Props {
  params: { locale: Locale }
}

export default async function DesignSystemPage({ params }: Props) {
  // Dev-only showcase page
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const dict = await getDictionary(params.locale)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.workbench_title}</h1>
        <div className="flex items-center gap-2">
          <I18nToggle />
          <ThemeToggle />
        </div>
      </div>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Buttons & Badges</AppCardTitle>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>{dict.create_service}</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="success">Success</Badge>
          </div>
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Alerts</AppCardTitle>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              Tailwind tokens: background/foreground, muted, border, primary, secondary, destructive.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Destructive</AlertTitle>
            <AlertDescription>
              Uses `destructive` and `destructive-foreground` tokens.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <Info className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>示例：用于提醒免费队列或限流等提示。</AlertDescription>
          </Alert>
          <Alert variant="success">
            <Info className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>示例：用于操作成功反馈。</AlertDescription>
          </Alert>
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>示例：用于通用信息提示。</AlertDescription>
          </Alert>
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Form Controls</AppCardTitle>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={4} placeholder="Tell us about yourself" />
            </div>
          </div>
        </AppCardContent>
      </AppCard>
    </div>
  )
}