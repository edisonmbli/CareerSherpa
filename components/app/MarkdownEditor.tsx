'use client'
import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { TemplatePicker } from '@/components/app/TemplatePicker'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'

export function MarkdownEditor({ initialContent, onChange, onSave, onExport, labels }: { initialContent: string; onChange?: (md: string) => void; onSave?: (md: string) => void; onExport?: (md: string) => void; labels?: { save: string; export: string; editTab: string; previewTab: string; templateLabel: string } }) {
  const [md, setMd] = useState(initialContent || '')
  const [template, setTemplate] = useState<'classic' | 'modern' | 'professional'>('classic')
  return (
    <div>
      <div className="hidden lg:grid lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Textarea value={md} onChange={(e) => { setMd(e.target.value); onChange?.(e.target.value) }} rows={20} />
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => onSave?.(md)}>{labels?.save || '保存修改'}</Button>
            <ExportPDFButton selector="#md-preview-desktop" label={labels?.export || '导出 PDF'} onExport={async () => { onExport?.(md) }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">导出模板</div>
            <TemplatePicker value={template} onChange={(v) => setTemplate(v as any)} />
          </div>
        </div>
        <div id="md-preview-desktop" className={`prose whitespace-pre-wrap p-8 bg-white rounded-md border resume-${template}`}>
          <ReactMarkdown>{md}</ReactMarkdown>
        </div>
      </div>
      <div className="lg:hidden">
        <Tabs defaultValue="edit" className="space-y-4">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="edit">{labels?.editTab || '编辑 Markdown'}</TabsTrigger>
            <TabsTrigger value="preview">{labels?.previewTab || '预览 PDF'}</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <div className="space-y-2">
              <Textarea value={md} onChange={(e) => { setMd(e.target.value); onChange?.(e.target.value) }} rows={16} />
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{labels?.templateLabel || '导出模板'}</div>
                <TemplatePicker value={template} onChange={(v) => setTemplate(v as any)} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => onSave?.(md)}>{labels?.save || '保存修改'}</Button>
                <ExportPDFButton selector="#md-preview-mobile" label={labels?.export || '导出 PDF'} onExport={async () => { onExport?.(md) }} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="preview">
            <div id="md-preview-mobile" className={`prose whitespace-pre-wrap p-6 bg-white rounded-md border resume-${template}`}>
              <ReactMarkdown>{md}</ReactMarkdown>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ExportPDFButton({ selector, label, onExport }: { selector: string; label: string; onExport?: () => void }) {
  const handleExport = async () => {
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = 210
    const pageHeight = 297
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    pdf.save('resume.pdf')
    onExport?.()
  }
  return <Button variant="secondary" onClick={handleExport}>{label}</Button>
}