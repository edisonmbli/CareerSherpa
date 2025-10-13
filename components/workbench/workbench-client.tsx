'use client'

import { useState } from 'react'
import { randomUUID } from 'crypto'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { uploadResume, uploadDetailedResume, uploadJobDescription } from '@/lib/actions/upload'
import { createServiceAction, type CreateServiceParams } from '@/lib/actions/service'
interface Dictionary {
  workbench_title: string
  lang_label: string
  resume_label: string
  detailed_label: string
  jd_label: string
  submit_resume: string
  submit_detailed: string
  submit_jd: string
  create_service: string
}

interface UserData {
  id: string
}

interface WorkbenchClientProps {
  user: UserData | null
  locale: 'en' | 'zh'
  dictionary: Dictionary
}

export function WorkbenchClient({ user, locale, dictionary }: WorkbenchClientProps) {
  const [resumeText, setResumeText] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [detailedResumeText, setDetailedResumeText] = useState('')
  const [detailedResumeFile, setDetailedResumeFile] = useState<File | null>(null)
  const [jobDescriptionText, setJobDescriptionText] = useState('')
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null)
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleUploadResume = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', user.id)
      formData.append('lang', locale)
      if (resumeText) formData.append('text', resumeText)
      if (resumeFile) formData.append('file', resumeFile)

      const result = await uploadResume(formData)
      setResponse(JSON.stringify(result, null, 2))
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadDetailedResume = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', user.id)
      formData.append('lang', locale)
      if (detailedResumeText) formData.append('text', detailedResumeText)
      if (detailedResumeFile) formData.append('file', detailedResumeFile)

      const result = await uploadDetailedResume(formData)
      setResponse(JSON.stringify(result, null, 2))
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadJobDescription = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', user.id)
      formData.append('lang', locale)
      if (jobDescriptionText) formData.append('text', jobDescriptionText)
      if (jobDescriptionFile) formData.append('file', jobDescriptionFile)

      const result = await uploadJobDescription(formData)
      setResponse(JSON.stringify(result, null, 2))
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateService = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      // Note: This is a simplified version. In a real implementation,
      // you would need to have resumeId and jobId from previous uploads
      const params: CreateServiceParams = {
        resumeId: 'temp-resume-id', // This should come from actual resume upload
        jobId: 'temp-job-id', // This should come from actual job description upload
        lang: locale,
        idempotencyKey: randomUUID()
      }
      const result = await createServiceAction(params)
      setResponse(JSON.stringify(result, null, 2))
    } catch (error) {
      setResponse(`Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication Required</CardTitle>
          <CardDescription>Please log in to use the workbench</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Resume Upload */}
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.resume_label}</CardTitle>
          <CardDescription>Upload your resume as text or PDF file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="resume-text">Resume Text</Label>
            <Textarea
              id="resume-text"
              placeholder="Paste your resume text here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div>
            <Label htmlFor="resume-file">Resume File</Label>
            <Input
              id="resume-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button 
            onClick={handleUploadResume} 
            disabled={isLoading || (!resumeText && !resumeFile)}
            className="w-full"
          >
            {dictionary.submit_resume}
          </Button>
        </CardContent>
      </Card>

      {/* Detailed Resume Upload */}
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.detailed_label}</CardTitle>
          <CardDescription>Upload your detailed resume</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="detailed-text">Detailed Resume Text</Label>
            <Textarea
              id="detailed-text"
              placeholder="Paste your detailed resume text here..."
              value={detailedResumeText}
              onChange={(e) => setDetailedResumeText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div>
            <Label htmlFor="detailed-file">Detailed Resume File</Label>
            <Input
              id="detailed-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setDetailedResumeFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button 
            onClick={handleUploadDetailedResume} 
            disabled={isLoading || (!detailedResumeText && !detailedResumeFile)}
            className="w-full"
          >
            {dictionary.submit_detailed}
          </Button>
        </CardContent>
      </Card>

      {/* Job Description Upload */}
      <Card>
        <CardHeader>
          <CardTitle>{dictionary.jd_label}</CardTitle>
          <CardDescription>Upload job description as text or image</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="jd-text">Job Description Text</Label>
            <Textarea
              id="jd-text"
              placeholder="Paste job description here..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div>
            <Label htmlFor="jd-file">Job Description File</Label>
            <Input
              id="jd-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setJobDescriptionFile(e.target.files?.[0] || null)}
            />
          </div>
          <Button 
            onClick={handleUploadJobDescription} 
            disabled={isLoading || (!jobDescriptionText && !jobDescriptionFile)}
            className="w-full"
          >
            {dictionary.submit_jd}
          </Button>
        </CardContent>
      </Card>

      {/* Create Service */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Create AI Service</CardTitle>
          <CardDescription>Generate personalized job application materials</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleCreateService} 
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {dictionary.create_service}
          </Button>
        </CardContent>
      </Card>

      {/* Response Display */}
      {response && (
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-auto max-h-96">
              {response}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}