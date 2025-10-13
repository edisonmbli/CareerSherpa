import { stackServerApp } from '@/stack/server'
import { WorkbenchClient } from './workbench-client'
import { getDictionary } from '@/lib/i18n/dictionaries'

interface WorkbenchServerProps {
  locale: 'en' | 'zh'
}

export async function WorkbenchServer({ locale }: WorkbenchServerProps) {
  // Get user from Stack Auth
  const user = await stackServerApp.getUser()
  
  // Get dictionary for internationalization
  const dict = await getDictionary(locale)
  
  // Extract only the necessary user data for client component
  const userData = user ? { id: user.id } : null
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {dict.workbench_title || 'AI Job Assistant Workbench'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload your resume and job descriptions to get personalized assistance
        </p>
      </div>
      
      <WorkbenchClient 
        user={userData} 
        locale={locale}
        dictionary={dict}
      />
    </div>
  )
}