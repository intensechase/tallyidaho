'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Failed')

      setStatus('success')
      setFormData({ name: '', email: '', subject: 'general', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-playfair font-black text-3xl text-slate-900 mb-2">Contact Us</h1>
      <p className="text-slate-500 mb-8">Questions, corrections, or feedback? We&apos;d love to hear from you.</p>

      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        {status === 'success' ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">Thank you! We&apos;ll get back to you as soon as possible.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Something went wrong. Please email us at <a href="mailto:support@tallyidaho.com" className="underline">support@tallyidaho.com</a>.</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
              <select
                id="subject"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
              >
                <option value="general">General Question</option>
                <option value="correction">Data Correction</option>
                <option value="bug">Report a Bug</option>
                <option value="feedback">Feedback</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea
                id="message"
                required
                rows={5}
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold rounded-lg transition"
            >
              {status === 'sending' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </div>

      <p className="text-sm text-slate-500 mt-6 text-center">
        Or email us directly at{' '}
        <a href="mailto:support@tallyidaho.com" className="text-amber-600 hover:underline">
          support@tallyidaho.com
        </a>
      </p>
    </main>
  )
}
