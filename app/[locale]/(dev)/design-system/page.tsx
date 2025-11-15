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
import FeedbackDemo from '@/components/dev/FeedbackDemo'
import PrimaryDemo from '@/components/dev/PrimaryDemo'

export default async function DesignSystemPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  // Dev-only showcase page
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const dict = await getDictionary(locale)

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.designSystem.title}</h1>
        <div className="flex items-center gap-2">
          <I18nToggle />
          <ThemeToggle />
        </div>
      </div>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{dict.designSystem.sections.primaryDemo ?? 'Primary Demo'}</AppCardTitle>
        </AppCardHeader>
        <AppCardContent>
          <PrimaryDemo labels={{
            default: dict.designSystem.samples.primary?.default ?? 'Primary Button',
            disabled: dict.designSystem.samples.primary?.disabled ?? 'Disabled',
            focus: dict.designSystem.samples.primary?.focus ?? 'Focus-visible'
          }} />
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{dict.designSystem.sections.typography}</AppCardTitle>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-2xl lg:text-3xl font-semibold tracking-tight leading-tight">{dict.designSystem.samples.typography.h1}</div>
            <div className="text-xl font-semibold tracking-tight leading-snug">{dict.designSystem.samples.typography.h2}</div>
            <p className="text-base leading-relaxed">{dict.designSystem.samples.typography.body}</p>
            <p className="text-sm text-muted-foreground">{dict.designSystem.samples.typography.muted}</p>
          </div>
        </AppCardContent>
      </AppCard>

      <div className="grid gap-8 lg:grid-cols-2">
        <AppCard>
          <AppCardHeader>
            <AppCardTitle>{dict.designSystem.sections.colorSurface}</AppCardTitle>
          </AppCardHeader>
          <AppCardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-12 w-full rounded bg-background border"></div>
                <div className="text-sm">{dict.designSystem.samples.colors.pageBackground}</div>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-full rounded bg-card shadow"></div>
                <div className="text-sm">{dict.designSystem.samples.colors.cardBackground}</div>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-full rounded bg-primary"></div>
                <div className="text-sm">{dict.designSystem.samples.colors.primary}</div>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-full rounded bg-muted"></div>
                <div className="text-sm">{dict.designSystem.samples.colors.muted}</div>
              </div>
            </div>
          </AppCardContent>
        </AppCard>

        <AppCard>
          <AppCardHeader>
            <AppCardTitle>{dict.designSystem.sections.cardSpacing}</AppCardTitle>
          </AppCardHeader>
          <AppCardContent className="space-y-4">
            <div className="grid gap-8">
              <AppCard>
                <AppCardContent>
                  <div className="text-sm text-muted-foreground">{dict.designSystem.samples.spacing.cardInner}</div>
                </AppCardContent>
              </AppCard>
              <AppCard>
                <AppCardContent>
                  <div className="text-sm text-muted-foreground">{dict.designSystem.samples.spacing.cardBetween}</div>
                </AppCardContent>
              </AppCard>
            </div>
          </AppCardContent>
        </AppCard>
      </div>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{dict.designSystem.sections.buttonsBadges}</AppCardTitle>
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
          <AppCardTitle>{dict.designSystem.sections.alerts}</AppCardTitle>
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
          <AppCardTitle>{dict.designSystem.sections.feedback}</AppCardTitle>
        </AppCardHeader>
        <AppCardContent>
          <FeedbackDemo labels={dict.designSystem.samples.feedback} />
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{dict.designSystem.sections.fileSupport ?? 'File Support'}</AppCardTitle>
        </AppCardHeader>
        <AppCardContent>
          <p className="text-sm text-muted-foreground">
            {dict.designSystem.samples.pdfNotice ?? '目前仅支持文本型 PDF，扫描件/图片暂不支持；请上传含文本内容的 PDF。'}
          </p>
        </AppCardContent>
      </AppCard>

      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{dict.designSystem.sections.formControls}</AppCardTitle>
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
