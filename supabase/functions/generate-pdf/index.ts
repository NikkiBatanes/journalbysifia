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

    // Log HTML length for debugging
    console.log('[PDF] Received HTML length:', html.length);
    console.log('[PDF] First 200 chars:', html.substring(0, 200));

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
 * Generate PDF from HTML using free cloud services
 * Uses services that don't require API keys
 */
async function generatePDFFromHTML(html: string): Promise<Uint8Array> {
  // Use PDFCrowd free API (no key needed for basic usage)
  try {
    console.log('[PDF] Trying PDFCrowd...');
    
    const response = await fetch('https://api.pdfcrowd.com/convert/24.04/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        src: html,
        width: '210mm',
        height: '297mm',
        margin_top: '20px',
        margin_right: '20px',
        margin_bottom: '20px',
        margin_left: '20px',
        print_backgrounds: 'true',
      }).toString(),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const result = new Uint8Array(arrayBuffer);
      console.log('[PDF] PDFCrowd succeeded, buffer length:', result.length);
      return result;
    }
    
    console.error('[PDF] PDFCrowd failed:', response.status, await response.text());
  } catch (error) {
    console.error('[PDF] PDFCrowd exception:', error);
  }

  // Fallback: Try html-pdf-node API
  try {
    console.log('[PDF] Trying html-pdf-node...');
    
    const response = await fetch('https://yakpdf.p.rapidapi.com/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
        source: {
          html,
        },
      }),
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const result = new Uint8Array(arrayBuffer);
      console.log('[PDF] html-pdf-node succeeded, buffer length:', result.length);
      return result;
    }
    
    console.error('[PDF] html-pdf-node failed:', response.status, await response.text());
  } catch (error) {
    console.error('[PDF] html-pdf-node exception:', error);
  }

  throw new Error('All PDF generation services failed. Please try again later.');
}
