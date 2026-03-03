import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/design-preview'],
    },
    sitemap: 'https://www.tallyidaho.com/sitemap.xml',
  }
}
