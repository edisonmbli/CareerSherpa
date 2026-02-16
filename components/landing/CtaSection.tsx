
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CtaSection({ dict }: { dict: any }) {
  return (
    <section className="py-24 relative overflow-hidden bg-background">
       <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 bottom-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]" />
      </div>

      <div className="container px-4 md:px-6 mx-auto text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-[family-name:var(--font-playfair),serif]">
            {dict.title}
          </h2>
          <div className="flex justify-center">
            <Button asChild size="lg" className="rounded-full px-8 h-14 text-lg">
              <Link href="/workbench">
                {dict.button}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
