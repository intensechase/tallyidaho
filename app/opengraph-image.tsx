import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Tally Idaho — Idaho Legislature Tracker'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Arial, sans-serif',
          padding: '80px',
        }}
      >
        {/* Amber top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#d97706', display: 'flex' }} />

        {/* Logo block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <span style={{ color: '#d97706', fontSize: 18, fontWeight: 700, letterSpacing: '0.45em', textTransform: 'uppercase', marginBottom: 4 }}>
            TALLY
          </span>
          <span style={{ color: '#f8fafc', fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>
            IDAHO
          </span>
          <span style={{ color: '#64748b', fontSize: 16, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 6 }}>
            Legislative Tracker
          </span>
        </div>

        {/* Tagline */}
        <p style={{ color: '#cbd5e1', fontSize: 26, fontWeight: 400, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          Every vote counted. Every voice heard.
        </p>

        {/* Features row */}
        <div style={{ display: 'flex', gap: 40, marginTop: 48 }}>
          {['Bills', 'Votes', 'Legislators', 'Districts', 'Committees'].map(label => (
            <span key={label} style={{ color: '#475569', fontSize: 16, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {label}
            </span>
          ))}
        </div>

        {/* Bottom URL */}
        <div style={{ position: 'absolute', bottom: 36, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#d97706', fontSize: 16, fontWeight: 700 }}>tallyidaho.com</span>
          <span style={{ color: '#334155', fontSize: 16 }}>· Free · Nonpartisan · No ads</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
