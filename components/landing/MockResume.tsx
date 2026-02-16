
import { cn } from '@/lib/utils'
import { Mail, Phone, MapPin, Globe } from 'lucide-react'

export function MockResume() {
  return (
    <div className="w-full h-full bg-white shadow-sm p-8 md:p-12 text-sm text-gray-800 font-sans leading-relaxed relative overflow-hidden">
       {/* Decorate with "Edit" overlay hint */}
       <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium border border-blue-100 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          AI Customized
       </div>

      {/* Header */}
      <div className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Alex Chen</h1>
        <div className="flex flex-wrap gap-4 text-gray-500 text-xs">
          <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> +1 (555) 123-4567</span>
          <span className="flex items-center gap-1"><Mail className="w-3 h-3"/> alex.chen@example.com</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> San Francisco, CA</span>
          <span className="flex items-center gap-1"><Globe className="w-3 h-3"/> alexchen.dev</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-2 border-b border-gray-100 pb-1">Professional Summary</h3>
        <p className="text-gray-600">
          Senior Backend Engineer with 5+ years of experience in high-concurrency distributed systems. 
          Expert in <span className="bg-yellow-100 text-yellow-800 px-1 rounded">Java/Go microservices</span> and <span className="bg-yellow-100 text-yellow-800 px-1 rounded">cloud-native architecture</span>. 
          Proven track record of optimizing payment systems (5x QPS boost) and reducing failure rates to near zero.
        </p>
      </div>

      {/* Experience */}
      <div className="mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3 border-b border-gray-100 pb-1">Experience</h3>
        
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-bold text-gray-900">TechFlow Inc.</h4>
            <span className="text-gray-500 text-xs">2021 — Present</span>
          </div>
          <div className="text-blue-600 font-medium mb-1">Senior Backend Engineer</div>
          <ul className="list-disc list-outside ml-4 text-gray-600 space-y-1">
            <li>Led the migration of the core payment gateway from Monolithic to Microservices, improving system maintainability by 40%.</li>
            <li>Designed and implemented a <span className="font-medium text-gray-800">high-concurrency order processing system</span> handling 50k+ QPS during peak sales.</li>
            <li>Optimized database queries and introduced Redis caching, reducing API latency by 60%.</li>
          </ul>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-bold text-gray-900">StartUp X</h4>
            <span className="text-gray-500 text-xs">2018 — 2021</span>
          </div>
          <div className="text-blue-600 font-medium mb-1">Backend Developer</div>
          <ul className="list-disc list-outside ml-4 text-gray-600 space-y-1">
            <li>Built RESTful APIs for the flagship e-commerce mobile app using Golang and PostgreSQL.</li>
            <li>Implemented CI/CD pipelines using Jenkins and Docker, reducing deployment time from 1 hour to 10 minutes.</li>
          </ul>
        </div>
      </div>

      {/* Skills */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-2 border-b border-gray-100 pb-1">Skills</h3>
        <div className="grid grid-cols-[100px_1fr] gap-2 text-gray-600">
          <span className="font-medium text-gray-900">Languages:</span>
          <span>Java, Go, Python, SQL</span>
          <span className="font-medium text-gray-900">Infrastructure:</span>
          <span>AWS, Kubernetes, Docker, Terraform</span>
          <span className="font-medium text-gray-900">Databases:</span>
          <span>PostgreSQL, Redis, MongoDB, Elasticsearch</span>
        </div>
      </div>
    </div>
  )
}
