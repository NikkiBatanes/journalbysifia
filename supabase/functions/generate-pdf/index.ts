/**
 * Supabase Edge Function: Generate PDF from HTML
 * Converts HTML content to PDF using Puppeteer
 * Mobile-first, reliable PDF generation without native dependencies
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { html, filename = 'document.pdf' } = await req.json();

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use Deno's built-in fetch to call a PDF generation service
    // For now, we'll use a simple HTML-to-PDF conversion approach
    // In production, you can use Puppeteer or a dedicated PDF service

    // Option 1: Use Puppeteer (requires Deno Deploy with Puppeteer support)
    // Option 2: Use a third-party API like PDFShift, HTML2PDF.app, etc.
    // Option 3: Return HTML and let client handle it (fallback)

    // For MVP, we'll use a simple approach with jsPDF-like conversion
    // This is a placeholder - you'll want to use a proper PDF service

    // Generate a simple PDF response
    const pdfBuffer = await generatePDFFromHTML(html);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Failed to generate PDF',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Generate PDF from HTML using HTML2PDF.app (free, no API key required)
 * Alternative: Use PDFShift, Puppeteer, or other services
 */
async function generatePDFFromHTML(html: string): Promise<Uint8Array> {
  // Use HTML2PDF.app - a free, open-source HTML to PDF API
  // No API key required for basic usage
  const response = await fetch('https://html2pdf.app/api/v1/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      html,
      engine: 'chrome',
      pdf: {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PDF service error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
