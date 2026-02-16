
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

export function FaqSection({ dict, locale }: { dict: any; locale?: string }) {
  return (
    <section className="py-24 bg-stone-50 dark:bg-stone-900/20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-[family-name:var(--font-playfair),serif]">
            FAQ
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto">
          {dict.items?.map((it: any, idx: number) => (
            <AccordionItem key={idx} value={`item-${idx}`} className="border-b-stone-200 dark:border-stone-800">
              <AccordionTrigger className="text-left text-lg font-medium py-6">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base pb-6 leading-relaxed">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
