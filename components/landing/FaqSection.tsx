import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

export function FaqSection({ dict }: { dict: any; locale?: string }) {
  return (
    <section className="container mx-auto px-4 py-16 lg:py-24">
      <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto">
        {dict.items?.map((it: any, idx: number) => (
          <AccordionItem key={idx} value={`item-${idx}`}>
            <AccordionTrigger>{it.q}</AccordionTrigger>
            <AccordionContent>{it.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}