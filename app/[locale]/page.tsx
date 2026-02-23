import { redirect } from 'next/navigation'
import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { HeroSection } from '@/components/landing/HeroSection'
// import { PhilosophySection } from '@/components/landing/PhilosophySection'
// import { FeatureShowcase } from '@/components/landing/FeatureShowcase'
// import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { FaqSection } from '@/components/landing/FaqSection'
// import { CtaSection } from '@/components/landing/CtaSection'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const dict = (await getDictionary(locale)).landing?.seo
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3000'
  return {
    title: dict?.title || 'Job Assistant AI',
    description: dict?.description || 'Match · Customize · Interview',
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: `/${locale}`,
      languages: {
        en: '/en',
        zh: '/zh',
      },
    },
    openGraph: {
      title: dict?.title || 'Job Assistant AI',
      description: dict?.description || 'Match · Customize · Interview',
      url: `${siteUrl}/${locale}`,
      siteName: 'Job Assistant AI',
      locale,
      type: 'website',
      images: [`${siteUrl}/images/workbench-preview.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict?.title || 'Job Assistant AI',
      description: dict?.description || 'Match · Customize · Interview',
      images: [`${siteUrl}/images/workbench-preview.png`],
    },
  }
}

export default async function LocaleRootPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const user = await stackServerApp.getUser()
  if (user) {
    redirect(`/${locale}/workbench`)
  }
  const dict = (await getDictionary(locale)).landing

  return (
    <div className="flex flex-col min-h-screen">
      {/* 2.1 Hero 区 (The Hook) */}
      <HeroSection dict={dict.hero} locale={locale} />

      {/* 2.2 信任背书区 (Trust & Social Proof Banner) - Placeholder */}
      <section className="w-full border-b border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          [ Placeholder: 2.2 Trust Banner / Social Proof ]
        </div>
      </section>

      {/* 2.3 资产理念区 (The Paradigm Shift: Asset Vault) - Placeholder */}
      <section className="w-full">
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          [ Placeholder: 2.3 Asset Vault Philosophy Section ]
        </div>
      </section>

      {/* 2.4 Bento Grid 场景功能区 (Core Value Showcase) - Placeholder */}
      <section className="w-full bg-muted/10">
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          [ Placeholder: 2.4 Bento Grid Features Section ]
        </div>
      </section>

      <FaqSection dict={dict.faq} locale={locale} />

      {/* 2.5 CTA 转化区 (The Push) - Placeholder */}
      <section className="w-full bg-primary/5">
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          [ Placeholder: 2.5 Final CTA Section ]
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'AI 求职助手 (Job Assistant AI)',
            operatingSystem: 'Web',
            applicationCategory: 'BusinessApplication',
            description: dict.seo.description,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          }),
        }}
      />
    </div>
  )
}
