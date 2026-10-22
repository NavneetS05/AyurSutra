import api from './api'

/**
 * Downloads a PDF file authenticated via Axios Bearer token and triggers browser download.
 */
export async function downloadPdf(url: string, defaultFilename: string): Promise<void> {
  try {
    const response = await api.get(url, {
      responseType: 'blob',
    })

    const blob = new Blob([response.data], { type: 'application/pdf' })
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = defaultFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('Failed to download PDF:', err)
    // Fallback: try opening with token param in case blob was blocked
    const token = localStorage.getItem('access_token')
    const separator = url.includes('?') ? '&' : '?'
    const fallbackUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url
    window.open(fallbackUrl, '_blank')
  }
}
