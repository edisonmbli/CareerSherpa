import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Target, FileText, Mic } from 'lucide-react'
import React, { type ElementType } from 'react'

export function ValuePropsSection({ dict }: { dict: any }) {
  const icons: ElementType[] = [Target, FileText, Mic]
  return (
    <section className="container mx-auto px-4 py-16 lg:py-24">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {dict.items?.map((item: any, idx: number) => {
          const Icon = icons[idx % icons.length] || Target
          return (
            <Card key={item.title} className="p-6">
              <CardHeader className="space-y-4">
                {React.createElement(Icon, { className: 'h-8 w-8 text-primary' })}
                <CardTitle className="tracking-tight">{item.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{item.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </section>
  )
}