import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'
import {
  AppCard,
  AppCardContent,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
} from '@/components/app/AppCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AssetUploader } from '@/components/app/AssetUploader'
import { stackServerApp } from '@/stack/server'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  await stackServerApp.getUser({ or: 'redirect' } as any)
  const dict = await getDictionary(locale)
  const p = dict.profile

  return (
    <main className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">{p.title}</h1>
      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assets">{p.tabs.assets}</TabsTrigger>
          <TabsTrigger value="billing">{p.tabs.billing}</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-6 pt-6">
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{p.resume.title}</AppCardTitle>
              <AppCardDescription>{p.resume.description}</AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <AssetUploader
                locale={locale}
                taskTemplateId="resume_summary"
                initialStatus="IDLE"
                initialFileName={null}
                dict={p.uploader}
              />
            </AppCardContent>
          </AppCard>

          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{p.detailed.title}</AppCardTitle>
              <AppCardDescription>{p.detailed.description}</AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <AssetUploader
                locale={locale}
                taskTemplateId="detailed_resume_summary"
                initialStatus="IDLE"
                initialFileName={null}
                dict={p.uploader}
              />
            </AppCardContent>
          </AppCard>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 pt-6">
          <AppCard>
            <AppCardHeader>
              <AppCardTitle>{p.quota.title}</AppCardTitle>
              <AppCardDescription>{p.quota.description}</AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <p className="text-sm text-muted-foreground">敬请期待</p>
            </AppCardContent>
          </AppCard>
        </TabsContent>
      </Tabs>
    </main>
  )
}
