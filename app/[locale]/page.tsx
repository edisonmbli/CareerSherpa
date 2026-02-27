import { redirect } from 'next/navigation'
import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { HeroSection } from '@/components/landing/HeroSection'
// import { PhilosophySection } from '@/components/landing/PhilosophySection'
// import { FeatureShowcase } from '@/components/landing/FeatureShowcase'
// import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { TrustBanner } from '@/components/landing/TrustBanner'
import { CoreValueSection } from '@/components/landing/CoreValueSection'
import { BentoGrid } from '@/components/landing/BentoGrid'
import { CtaSection } from '@/components/landing/CtaSection'
import { Footer } from '@/components/landing/Footer'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const dict = (await getDictionary(locale)).landing?.seo
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3000'
  return {
    title: dict?.title || 'AI CareerSherpa',
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
      title: dict?.title || 'AI CareerSherpa',
      description: dict?.description || 'Match · Customize · Interview',
      url: `${siteUrl}/${locale}`,
      siteName: 'AI CareerSherpa',
      locale,
      type: 'website',
      images: [`${siteUrl}/images/workbench-preview.png`],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict?.title || 'AI CareerSherpa',
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
    <div className="flex flex-col min-h-screen overflow-x-clip">
      {/* 2.1 Hero 区 (The Hook) */}
      <HeroSection dict={dict.hero} locale={locale} />

      {/* 2.2 信任背书区 (Trust & Social Proof Banner) */}
      <TrustBanner dict={dict} />

      {/* 2.3 核心价值理念区 (The Paradigm Shift: Core Value) */}
      <div className="mt-16 md:mt-24 lg:mt-32">
        <CoreValueSection dict={dict} />
      </div>

      {/* 2.4 Bento Grid 场景功能区 (Core Value Showcase) */}
      <div className="mt-20 md:mt-32 lg:mt-40">
        <BentoGrid dict={dict} />
      </div>

      {/* 2.5 CTA 转化区 (The Push) - 高潮前的宏大留白与停顿 */}
      <div className="mt-32 md:mt-48 lg:mt-56 pb-24 md:pb-32 lg:pb-40">
        <CtaSection dict={dict} />
      </div>

      {/* 2.6 页脚 (Footer Legitimacy) */}
      <Footer dict={dict.footer} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'AI CareerSherpa',
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
