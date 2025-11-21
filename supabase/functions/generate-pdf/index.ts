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
 * Generate PDF from HTML using Puppeteer
 * More reliable than external services, runs directly in Edge Function
 */
async function generatePDFFromHTML(html: string): Promise<Uint8Array> {
  try {
    // Import Puppeteer for Deno
    const puppeteer = await import('https://deno.land/x/puppeteer@16.2.0/mod.ts');
    
    // Launch browser
    const browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for it to load
    await page.setContent(html, {
      waitUntil: ['load', 'domcontentloaded'],
    });
    
    // Wait a bit for fonts and styles to fully render
    await page.waitForTimeout(1000);
    
    // Generate PDF with proper settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });
    
    await browser.close();
    
    return new Uint8Array(pdfBuffer);
  } catch (error) {
    console.error('Puppeteer PDF generation failed:', error);
    
    // Fallback: Try html2pdf.app as backup
    try {
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
        const errorText = await response.text();
        throw new Error(`PDF service error: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (fallbackError) {
      console.error('Fallback PDF service also failed:', fallbackError);
      throw new Error('Both Puppeteer and fallback PDF service failed. Please try again later.');
    }
  }
}
