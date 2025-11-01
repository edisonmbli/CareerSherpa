'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { uploadResume, uploadDetailedResume, uploadJobDescription } from '@/lib/actions/upload'
import { createServiceAction, type CreateServiceParams } from '@/lib/actions/service'
import { SimpleErrorDisplay } from '@/components/ui/error-display'
import { errorHandler } from '@/lib/errors/error-handler'
import type { UserFriendlyError } from '@/lib/errors/error-mapping'

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
  const [error, setError] = useState<UserFriendlyError | null>(null)
  
  // Track uploaded IDs
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null)
  const [uploadedDetailedResumeId, setUploadedDetailedResumeId] = useState<string | null>(null)
  const [uploadedJobId, setUploadedJobId] = useState<string | null>(null)

  const handleUploadResume = async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('lang', locale)
      
      // Priority: File > Text (if both are provided, use file)
      if (resumeFile) {
        formData.append('file', resumeFile)
      } else if (resumeText) {
        formData.append('text', resumeText)
      }

      const result = await uploadResume(formData)
      
      if (result.success && result.data?.resume_id) {
        setUploadedResumeId(result.data.resume_id)
        setResponse(JSON.stringify(result, null, 2))
      } else {
        // 使用错误处理系统
        const errorResponse = errorHandler.handleError(
          new Error(result.message || 'Resume upload failed'),
          undefined,
          undefined,
          locale
        )
        setError({
          ...errorResponse.error,
          actionable: true
        })
      }
    } catch (error) {
      const errorResponse = errorHandler.handleError(error as Error, undefined, undefined, locale)
      setError({
        ...errorResponse.error,
        actionable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadDetailedResume = async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('lang', locale)
      
      // Priority: File > Text (if both are provided, use file)
      if (detailedResumeFile) {
        formData.append('file', detailedResumeFile)
      } else if (detailedResumeText) {
        formData.append('text', detailedResumeText)
      }

      const result = await uploadDetailedResume(formData)
      
      if (result.success && result.data?.detailed_resume_id) {
        setUploadedDetailedResumeId(result.data.detailed_resume_id)
        setResponse(JSON.stringify(result, null, 2))
      } else {
        const errorResponse = errorHandler.handleError(
          new Error(result.message || 'Detailed resume upload failed'),
          undefined,
          undefined,
          locale
        )
        setError({
          ...errorResponse.error,
          actionable: true
        })
      }
    } catch (error) {
      const errorResponse = errorHandler.handleError(error as Error, undefined, undefined, locale)
      setError({
        ...errorResponse.error,
        actionable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadJobDescription = async () => {
    if (!user) return
    setIsLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('lang', locale)
      
      // Priority: File > Text (if both are provided, use file)
      if (jobDescriptionFile) {
        formData.append('file', jobDescriptionFile)
      } else if (jobDescriptionText) {
        formData.append('text', jobDescriptionText)
      }

      const result = await uploadJobDescription(formData)
      
      if (result.success && result.data?.jd_id) {
        setUploadedJobId(result.data.jd_id)
        setResponse(JSON.stringify(result, null, 2))
      } else {
        const errorResponse = errorHandler.handleError(
          new Error(result.message || 'Job description upload failed'),
          undefined,
          undefined,
          locale
        )
        setError({
          ...errorResponse.error,
          actionable: true
        })
      }
    } catch (error) {
      const errorResponse = errorHandler.handleError(error as Error, undefined, undefined, locale)
      setError({
        ...errorResponse.error,
        actionable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateService = async () => {
    if (!user) return
    
    // Check if required uploads are completed
    if (!uploadedResumeId || !uploadedJobId) {
      setResponse('Error: Please upload both resume and job description first')
      return
    }
    
    setIsLoading(true)
    setError(null)
    try {
      const params: CreateServiceParams = {
        resumeId: uploadedResumeId,
        jobId: uploadedJobId,
        ...(uploadedDetailedResumeId && { detailedResumeId: uploadedDetailedResumeId }),
        lang: locale,
        idempotencyKey: crypto.randomUUID()
      }
      
      // Starting service creation
      
      const result = await createServiceAction(params)
      
      // Service creation completed
      
      if (result.success) {
        setResponse(JSON.stringify(result, null, 2))
      } else {
        const errorResponse = errorHandler.handleError(
          new Error(result.message || 'Service creation failed'),
          undefined,
          undefined,
          locale
        )
        setError({
          ...errorResponse.error,
          actionable: true
        })
      }
    } catch (error) {
      const errorResponse = errorHandler.handleError(error as Error, undefined, undefined, locale)
      setError({
        ...errorResponse.error,
        actionable: true
      })
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
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <SimpleErrorDisplay error={error} />
      )}
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Resume Upload - Required */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {dictionary.resume_label}
            <span className="text-red-500 text-sm">*</span>
          </CardTitle>
          <CardDescription>Upload your resume as PDF file or paste as text (required)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="resume-file">Resume File</Label>
            <Input
              id="resume-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
            {resumeFile && (
              <p className="text-sm text-green-600 mt-1">✓ File selected: {resumeFile.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="resume-text">Resume Text</Label>
            <Textarea
              id="resume-text"
              placeholder="Paste your resume text here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-[100px]"
            />
            {resumeFile && resumeText.trim() && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ Both file and text provided. File will be used.
              </p>
            )}
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

      {/* Job Description Upload - Required */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {dictionary.jd_label}
            <span className="text-red-500 text-sm">*</span>
          </CardTitle>
          <CardDescription>Upload job description as image/PDF or paste as text (required)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="jd-file">Job Description File</Label>
            <Input
              id="jd-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setJobDescriptionFile(e.target.files?.[0] || null)}
            />
            {jobDescriptionFile && (
              <p className="text-sm text-green-600 mt-1">✓ File selected: {jobDescriptionFile.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="jd-text">Job Description Text</Label>
            <Textarea
              id="jd-text"
              placeholder="Paste job description here..."
              value={jobDescriptionText}
              onChange={(e) => setJobDescriptionText(e.target.value)}
              className="min-h-[100px]"
            />
            {jobDescriptionFile && jobDescriptionText.trim() && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ Both file and text provided. File will be used.
              </p>
            )}
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

      {/* Detailed Resume Upload - Optional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {dictionary.detailed_label}
            <span className="text-gray-500 text-sm">(Optional)</span>
          </CardTitle>
          <CardDescription>Upload your detailed resume for better results (optional but recommended)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="detailed-file">Detailed Resume File</Label>
            <Input
              id="detailed-file"
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setDetailedResumeFile(e.target.files?.[0] || null)}
            />
            {detailedResumeFile && (
              <p className="text-sm text-green-600 mt-1">✓ File selected: {detailedResumeFile.name}</p>
            )}
          </div>
          <div>
            <Label htmlFor="detailed-text">Detailed Resume Text</Label>
            <Textarea
              id="detailed-text"
              placeholder="Paste your detailed resume text here..."
              value={detailedResumeText}
              onChange={(e) => setDetailedResumeText(e.target.value)}
              className="min-h-[100px]"
            />
            {detailedResumeFile && detailedResumeText.trim() && (
              <p className="text-sm text-amber-600 mt-1">
                ⚠️ Both file and text provided. File will be used.
              </p>
            )}
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

      {/* Create Service */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Create AI Service</CardTitle>
          <CardDescription>Generate personalized job application materials</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleCreateService} 
            disabled={isLoading || !uploadedResumeId || !uploadedJobId}
            size="lg"
            className="w-full"
          >
            {isLoading ? 'Creating Service...' : dictionary.create_service}
          </Button>
          {!uploadedResumeId || !uploadedJobId ? (
            <p className="text-sm text-gray-500 mt-2 text-center">
              Please upload both resume and job description first
            </p>
          ) : null}
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
    </div>
  )
}