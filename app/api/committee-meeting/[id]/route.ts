import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { PDFParse } from 'pdf-parse'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const type = req.nextUrl.searchParams.get('type')

  if (type !== 'agenda' && type !== 'minutes') {
    return NextResponse.json({ error: 'type must be agenda or minutes' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: meeting, error } = await supabase
    .from('committee_meetings')
    .select('id, agenda_url, minutes_url, agenda_text, minutes_text')
    .eq('id', id)
    .single()

  if (error || !meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  }

  const textField = type === 'agenda' ? 'agenda_text' : 'minutes_text'
  const urlField  = type === 'agenda' ? 'agenda_url'  : 'minutes_url'

  // Return cached text immediately if available
  const cached = (meeting as any)[textField] as string | null
  if (cached) {
    return NextResponse.json({ text: cached })
  }

  const pdfUrl = (meeting as any)[urlField] as string | null
  if (!pdfUrl) {
    return NextResponse.json({ error: 'No PDF available' }, { status: 404 })
  }

  // Fetch and parse the PDF
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'TallyIdaho/1.0 (tallyidaho.com; public data aggregator)' },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 })
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text?.trim() ?? ''

    if (!text || text.length < 10) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })
    }

    // Cache in DB (fire-and-forget — don't block the response)
    supabase
      .from('committee_meetings')
      .update({ [textField]: text })
      .eq('id', id)
      .then(() => {})

    return NextResponse.json({ text })
  } catch (err) {
    console.error('PDF parse error:', err)
    return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}
