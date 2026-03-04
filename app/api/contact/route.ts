import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json()

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const subjectLabels: Record<string, string> = {
    general: 'General Question',
    correction: 'Data Correction',
    bug: 'Report a Bug',
    feedback: 'Feedback',
  }

  const subjectLabel = subjectLabels[subject] ?? subject

  try {
    await resend.emails.send({
      from: 'support@tallyidaho.com',
      to: 'support@tallyidaho.com',
      replyTo: email,
      subject: `[Contact] ${subjectLabel} from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subjectLabel}\n\n${message}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
