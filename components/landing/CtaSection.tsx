import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CtaSection({ dict }: { dict: any }) {
  return (
    <section className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight leading-tight">{dict.title}</h2>
      <Button asChild size="lg" className="mt-6">
        <Link href="/workbench">{dict.button}</Link>
      </Button>
    </section>
  )
}