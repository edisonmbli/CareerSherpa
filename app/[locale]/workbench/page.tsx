'use client'

import { useState, useEffect } from 'react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/i18n-config'

type UploadResponse = {
  resume_id?: string
  detailed_resume_id?: string
  job_id?: string
  error?: string
  [key: string]: unknown
}

type CreateServicePayload = {
  resume_id?: string
  detailed_resume_id?: string
  job_id?: string
  lang: string
}

type CreateServiceResponse = {
  service_id?: string
  error?: string
  [key: string]: unknown
}

export default function WorkbenchPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const [dict, setDict] = useState<Record<string, string>>({})
  const [lang, setLang] = useState<string>('en')
  const [resumeText, setResumeText] = useState('')
  const [detailedText, setDetailedText] = useState('')
  const [jdText, setJdText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [detailedFile, setDetailedFile] = useState<File | null>(null)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [resp, setResp] = useState<UploadResponse | CreateServiceResponse | null>(null)
  const [resumeId, setResumeId] = useState<string | undefined>(undefined)
  const [detailedId, setDetailedId] = useState<string | undefined>(undefined)
  const [jobId, setJobId] = useState<string | undefined>(undefined)

  // 调试：观察 ID 变化
  useEffect(() => {
    console.log('IDs updated:', { resumeId, detailedId, jobId })
  }, [resumeId, detailedId, jobId])

  useEffect(() => {
    async function loadDict() {
      const resolvedParams = await params
      setLang(resolvedParams.locale || 'en')
      const dictionary = await getDictionary(resolvedParams.locale)
      setDict(dictionary)
    }
    loadDict()
  }, [params])

  async function uploadJson(url: string, text: string): Promise<UploadResponse> {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-key': 'wb1' },
        body: JSON.stringify({ lang, text }),
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ error: 'network_error' }))
        return errorData
      }
      return await r.json()
    } catch (error) {
      console.error('Upload JSON error:', error)
      return { error: 'network_error' }
    }
  }

  async function uploadFile(url: string, file: File | null): Promise<UploadResponse> {
    if (!file) return { error: 'no_file' }
    try {
      const fd = new FormData()
      fd.append('lang', lang)
      fd.append('file', file)
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'x-user-key': 'wb1' },
        body: fd,
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ error: 'network_error' }))
        return errorData
      }
      return await r.json()
    } catch (error) {
      console.error('Upload file error:', error)
      return { error: 'network_error' }
    }
  }

  async function createService(payload: CreateServicePayload): Promise<CreateServiceResponse> {
    try {
      const r = await fetch('/api/service/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-key': 'wb1' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ error: 'network_error' }))
        return errorData
      }
      return await r.json()
    } catch (error) {
      console.error('Create service error:', error)
      return { error: 'network_error' }
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16 }}>
      <h2>{dict.workbench_title}</h2>

      <label>{dict.lang_label}: </label>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        <option value="en">en</option>
        <option value="zh">zh</option>
      </select>

      <hr />

      <div>
        <h3>{dict.resume_label}</h3>
        <textarea
          placeholder="Paste resume text..."
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />
        <input
          type="file"
          accept=".txt,application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0] || null
            setResumeFile(file)
            console.log('Resume file selected:', file)
            if (file) {
              console.log('Uploading resume...')
              const data = await uploadFile('/api/upload/resume', file)
              console.log('Resume upload response:', data)
              setResp(data)
              if (data?.resume_id) setResumeId(String(data.resume_id))
            }
          }}
        />
        <button
          disabled={!resumeFile && !resumeText.trim()}
          onClick={async () => {
            const data = resumeFile
              ? await uploadFile('/api/upload/resume', resumeFile)
              : await uploadJson('/api/upload/resume', resumeText)
            console.log('Resume upload response:', data)
            setResp(data)
            if (data?.resume_id) setResumeId(String(data.resume_id))
          }}
        >
          {dict.submit_resume}
        </button>
      </div>

      <div>
        <h3>{dict.detailed_label}</h3>
        <textarea
          placeholder="Paste detailed resume..."
          value={detailedText}
          onChange={(e) => setDetailedText(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />
        <input
          type="file"
          accept=".txt,application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0] || null
            setDetailedFile(file)
            console.log('Detailed file selected:', file)
            if (file) {
              console.log('Uploading detailed resume...')
              const data = await uploadFile('/api/upload/detailed-resume', file)
              console.log('Detailed resume upload response:', data)
              setResp(data)
              if (data?.detailed_resume_id) setDetailedId(String(data.detailed_resume_id))
            }
          }}
        />
        <button
          disabled={!detailedFile && !detailedText.trim()}
          onClick={async () => {
            const data = detailedFile
              ? await uploadFile('/api/upload/detailed-resume', detailedFile)
              : await uploadJson('/api/upload/detailed-resume', detailedText)
            console.log('Detailed resume upload response:', data)
            setResp(data)
            if (data?.detailed_resume_id) setDetailedId(String(data.detailed_resume_id))
          }}
        >
          {dict.submit_detailed}
        </button>
      </div>

      <div>
        <h3>{dict.jd_label}</h3>
        <textarea
          placeholder="Paste JD text..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />
        <input
          type="file"
          accept=".txt,image/*,application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0] || null
            setJdFile(file)
            console.log('JD file selected:', file)
            if (file) {
              console.log('Uploading JD...')
              const data = await uploadFile('/api/upload/jd', file)
              console.log('JD upload response:', data)
              setResp(data)
              if (data?.job_id) setJobId(String(data.job_id))
            }
          }}
        />
        <button
          disabled={!jdFile && !jdText.trim()}
          onClick={async () => {
            const data = jdFile
              ? await uploadFile('/api/upload/jd', jdFile)
              : await uploadJson('/api/upload/jd', jdText)
            console.log('JD upload response:', data)
            setResp(data)
            if (data?.job_id) setJobId(String(data.job_id))
          }}
        >
          {dict.submit_jd}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          disabled={!resumeId || !jobId}
          onClick={async () => {
            const data = await createService({
              resume_id: resumeId,
              detailed_resume_id: detailedId,
              job_id: jobId,
              lang,
            })
            setResp(data)
          }}
        >
          {dict.create_service}
        </button>
      </div>

      <div style={{ marginTop: 8, color: '#999' }}>
        {!resumeId && <span>缺少简历ID；请先上传简历。 </span>}
        {!jobId && <span>缺少JD ID；请先上传JD。</span>}
      </div>

      {resp ? (
        <pre style={{ marginTop: 16, background: '#f7f7f7', padding: 12 }}>
          {JSON.stringify(resp, null, 2)}
        </pre>
      ) : (
        <div style={{ marginTop: 16, color: '#888' }}>暂无响应。请先上传简历与JD。</div>
      )}
    </div>
  )
}
