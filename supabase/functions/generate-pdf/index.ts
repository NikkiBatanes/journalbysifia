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
 * Generate PDF from HTML using PDFShift API
 * Reliable cloud-based PDF generation service
 */
async function generatePDFFromHTML(html: string): Promise<Uint8Array> {
  // Try multiple PDF services in order of preference
  const services = [
    {
      name: 'api2pdf',
      url: 'https://v2.api2pdf.com/chrome/html',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        html,
        options: {
          printBackground: true,
          format: 'A4',
          margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px',
          },
        },
      },
    },
    {
      name: 'html2pdf.app',
      url: 'https://html2pdf.app/api/v1/generate',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
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
      },
    },
  ];

  let lastError: Error | null = null;

  for (const service of services) {
    try {
      console.log(`[PDF] Trying ${service.name}...`);
      
      const response = await fetch(service.url, {
        method: 'POST',
        headers: service.headers,
        body: JSON.stringify(service.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PDF] ${service.name} failed:`, response.status, errorText);
        lastError = new Error(`${service.name} error: ${response.status} - ${errorText}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const result = new Uint8Array(arrayBuffer);
      
      console.log(`[PDF] ${service.name} succeeded, buffer length:`, result.length);
      
      return result;
    } catch (error) {
      console.error(`[PDF] ${service.name} exception:`, error);
      lastError = error as Error;
      continue;
    }
  }

  // If all services failed, throw the last error
  throw lastError || new Error('All PDF generation services failed');
}
