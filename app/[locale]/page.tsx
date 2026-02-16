
import { redirect } from 'next/navigation'
import type { Locale } from '@/i18n-config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { stackServerApp } from '@/stack/server'
import { LandingHero } from '@/components/landing/LandingHero'
import { PhilosophySection } from '@/components/landing/PhilosophySection'
import { FeatureShowcase } from '@/components/landing/FeatureShowcase'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { CtaSection } from '@/components/landing/CtaSection'

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
      <LandingHero dict={dict.hero} locale={locale} />
      <PhilosophySection dict={dict.philosophy} />
      <FeatureShowcase dict={dict.features} />
      <BenefitsSection dict={dict.benefits} />
      <FaqSection dict={dict.faq} locale={locale} />
      <CtaSection dict={dict.cta} />
      
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
