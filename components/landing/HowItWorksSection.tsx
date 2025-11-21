import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import workbenchPreview from '@/public/images/workbench-preview.png'

export function HowItWorksSection({ dict }: { dict: any }) {
  return (
    <section className="container mx-auto px-4 py-16 lg:py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="tracking-tight">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {dict.features?.map((f: any) => (
                <li key={f.title} className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">{f.title}</span>
                  <span className="text-sm text-muted-foreground">{f.description}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="p-6">
          <CardHeader>
            <CardTitle className="tracking-tight">Visual Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl overflow-hidden border">
              <Image
                src={workbenchPreview}
                alt="Workbench Preview"
                width={1200}
                height={720}
                className="w-full h-auto"
                priority
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}