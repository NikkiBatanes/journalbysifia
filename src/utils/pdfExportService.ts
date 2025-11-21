/**
 * PDF Export Service
 * Generates PDF documents for devotionals and playbooks with consistent layout
 */

import { Platform, Alert } from 'react-native';
import Share from 'react-native-share';
import { Logger } from './ProductionLogger';
import { supabase } from '../services/supabaseClient';

export interface DevotionalPDFData {
  title: string;
  duration: string;
  bibleVerse?: {
    text: string;
    reference: string;
  };
  reflection?: string;
  prayer?: string;
  actionSteps?: string[];
  createdAt?: string;
}

export interface PlaybookPDFData {
  title: string;
  truthInLove?: string;
  bibleVerse?: {
    text: string;
    reference: string;
  };
  actionSteps?: Array<{
    title: string;
    description: string;
    subtasks?: string[];
  }>;
  affirmations?: string[];
  directChallenge?: string;
  createdAt?: string;
}

class PDFExportService {
  /**
   * Escape HTML special characters to prevent broken HTML
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>'); // Preserve line breaks
  }

  /**
   * Generate HTML template for devotional PDF
   */
  private generateDevotionalHTML(data: DevotionalPDFData): string {
    const { title, duration, bibleVerse, reflection, prayer, actionSteps, createdAt } = data;
    
    // Escape all text content to prevent HTML injection/breaking
    const safeTitle = this.escapeHtml(title);
    const safeDuration = this.escapeHtml(duration);
    const safeReflection = this.escapeHtml(reflection || '');
    const safePrayer = this.escapeHtml(prayer || '');
    const safeVerseText = this.escapeHtml(bibleVerse?.text || '');
    const safeVerseRef = this.escapeHtml(bibleVerse?.reference || '');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #333;
              padding: 40px;
              background: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #274673;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #274673;
              margin-bottom: 10px;
            }
            h1 {
              font-size: 28px;
              color: #274673;
              margin-bottom: 10px;
              font-weight: 700;
            }
            .duration {
              font-size: 14px;
              color: #666;
              font-weight: 500;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              color: #274673;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e0e0e0;
            }
            .verse-box {
              background: #f5f8fa;
              border-left: 4px solid #274673;
              padding: 20px;
              margin: 15px 0;
              border-radius: 4px;
            }
            .verse-text {
              font-size: 16px;
              font-style: italic;
              color: #333;
              margin-bottom: 10px;
              line-height: 1.8;
            }
            .verse-reference {
              font-size: 14px;
              font-weight: 600;
              color: #274673;
              text-align: right;
            }
            .content-text {
              font-size: 14px;
              color: #444;
              line-height: 1.8;
              margin-bottom: 15px;
            }
            .action-steps {
              list-style: none;
              counter-reset: step-counter;
            }
            .action-steps li {
              counter-increment: step-counter;
              margin-bottom: 12px;
              padding-left: 35px;
              position: relative;
            }
            .action-steps li:before {
              content: counter(step-counter);
              position: absolute;
              left: 0;
              top: 0;
              background: #274673;
              color: white;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
            .date {
              font-size: 12px;
              color: #999;
              text-align: center;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">siFia</div>
            <h1>${safeTitle}</h1>
            <div class="duration">${safeDuration}</div>
            ${createdAt ? `<div class="date">Created: ${new Date(createdAt).toLocaleDateString()}</div>` : ''}
          </div>

          ${bibleVerse ? `
            <div class="section">
              <div class="section-title">Today's Verse</div>
              <div class="verse-box">
                <div class="verse-text">"${safeVerseText}"</div>
                <div class="verse-reference">— ${safeVerseRef}</div>
              </div>
            </div>
          ` : ''}

          ${safeReflection ? `
            <div class="section">
              <div class="section-title">Reflection</div>
              <div class="content-text">${safeReflection}</div>
            </div>
          ` : ''}

          ${safePrayer ? `
            <div class="section">
              <div class="section-title">Prayer</div>
              <div class="content-text">${safePrayer}</div>
            </div>
          ` : ''}

          ${actionSteps && actionSteps.length > 0 ? `
            <div class="section">
              <div class="section-title">Action Steps</div>
              <ul class="action-steps">
                ${actionSteps.map(step => `<li>${step}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="footer">
            Generated by siFia • Your Faith Journey Companion
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML template for playbook PDF
   */
  private generatePlaybookHTML(data: PlaybookPDFData): string {
    const { title, truthInLove, bibleVerse, actionSteps, affirmations, directChallenge, createdAt } = data;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #333;
              padding: 40px;
              background: #fff;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #274673;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #274673;
              margin-bottom: 10px;
            }
            h1 {
              font-size: 28px;
              color: #274673;
              margin-bottom: 10px;
              font-weight: 700;
            }
            .section {
              margin-bottom: 30px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              color: #274673;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e0e0e0;
            }
            .verse-box {
              background: #f5f8fa;
              border-left: 4px solid #274673;
              padding: 20px;
              margin: 15px 0;
              border-radius: 4px;
            }
            .verse-text {
              font-size: 16px;
              font-style: italic;
              color: #333;
              margin-bottom: 10px;
              line-height: 1.8;
            }
            .verse-reference {
              font-size: 14px;
              font-weight: 600;
              color: #274673;
              text-align: right;
            }
            .content-text {
              font-size: 14px;
              color: #444;
              line-height: 1.8;
              margin-bottom: 15px;
            }
            .action-step {
              margin-bottom: 25px;
              padding: 15px;
              background: #f9f9f9;
              border-radius: 8px;
              border-left: 4px solid #274673;
            }
            .action-step-title {
              font-size: 16px;
              font-weight: 600;
              color: #274673;
              margin-bottom: 8px;
            }
            .action-step-description {
              font-size: 14px;
              color: #555;
              margin-bottom: 10px;
            }
            .subtasks {
              list-style: none;
              padding-left: 0;
            }
            .subtasks li {
              padding-left: 25px;
              margin-bottom: 6px;
              position: relative;
            }
            .subtasks li:before {
              content: '✓';
              position: absolute;
              left: 0;
              color: #274673;
              font-weight: bold;
            }
            .affirmations {
              list-style: none;
              padding: 0;
            }
            .affirmations li {
              background: #f5f8fa;
              padding: 15px;
              margin-bottom: 10px;
              border-radius: 6px;
              border-left: 3px solid #FF6B6B;
              font-size: 14px;
              color: #333;
            }
            .challenge-box {
              background: #fff5f5;
              border: 2px solid #FF6B6B;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .challenge-title {
              font-size: 16px;
              font-weight: 600;
              color: #FF6B6B;
              margin-bottom: 10px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              font-size: 12px;
              color: #999;
            }
            .date {
              font-size: 12px;
              color: #999;
              text-align: center;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">siFia</div>
            <h1>${title}</h1>
            ${createdAt ? `<div class="date">Created: ${new Date(createdAt).toLocaleDateString()}</div>` : ''}
          </div>

          ${truthInLove ? `
            <div class="section">
              <div class="section-title">Truth in Love</div>
              <div class="content-text">${truthInLove}</div>
            </div>
          ` : ''}

          ${bibleVerse ? `
            <div class="section">
              <div class="section-title">Scripture Foundation</div>
              <div class="verse-box">
                <div class="verse-text">"${bibleVerse.text}"</div>
                <div class="verse-reference">— ${bibleVerse.reference}</div>
              </div>
            </div>
          ` : ''}

          ${actionSteps && actionSteps.length > 0 ? `
            <div class="section">
              <div class="section-title">Action Steps</div>
              ${actionSteps.map(step => `
                <div class="action-step">
                  <div class="action-step-title">${step.title}</div>
                  <div class="action-step-description">${step.description}</div>
                  ${step.subtasks && step.subtasks.length > 0 ? `
                    <ul class="subtasks">
                      ${step.subtasks.map(subtask => `<li>${subtask}</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${affirmations && affirmations.length > 0 ? `
            <div class="section">
              <div class="section-title">Affirmations</div>
              <ul class="affirmations">
                ${affirmations.map(affirmation => `<li>${affirmation}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${directChallenge ? `
            <div class="section">
              <div class="challenge-box">
                <div class="challenge-title">Your Challenge</div>
                <div class="content-text">${directChallenge}</div>
              </div>
            </div>
          ` : ''}

          <div class="footer">
            Generated by siFia • Your Faith Journey Companion
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Export devotional as PDF using server-side generation
   * More reliable than native modules, works on all platforms
   */
  async exportDevotionalPDF(data: DevotionalPDFData): Promise<void> {
    try {
      const html = this.generateDevotionalHTML(data);
      const fileName = `siFia_Devotional_${data.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;

      Logger.debug('[PDFExportService] Generating PDF', {
        component: 'pdfExportService',
        fileName,
        htmlLength: html.length,
        dataKeys: Object.keys(data),
      });

      // Call Supabase Edge Function to generate PDF
      const { data: pdfResponse, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          html,
          filename: fileName,
        },
      });

      if (error) {
        Logger.error('[PDFExportService] Edge Function error', error as Error, {
          component: 'pdfExportService',
        });
        throw new Error(`PDF generation failed: ${error.message}`);
      }

      Logger.debug('[PDFExportService] PDF response received', {
        component: 'pdfExportService',
        responseType: typeof pdfResponse,
        isArrayBuffer: pdfResponse instanceof ArrayBuffer,
        isUint8Array: pdfResponse instanceof Uint8Array,
        length: pdfResponse?.length || pdfResponse?.byteLength || 0,
      });

      // Convert ArrayBuffer to base64 for sharing
      const uint8Array = new Uint8Array(pdfResponse);
      
      Logger.debug('[PDFExportService] Converting to base64', {
        component: 'pdfExportService',
        uint8ArrayLength: uint8Array.length,
      });

      const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      const base64Data = `data:application/pdf;base64,${btoa(binaryString)}`;

      Logger.debug('[PDFExportService] Sharing PDF', {
        component: 'pdfExportService',
        base64Length: base64Data.length,
      });

      // Share the PDF using base64 data URL
      await Share.open({
        url: base64Data,
        type: 'application/pdf',
        title: 'Share Devotional',
        filename: fileName,
      });

      Logger.debug('[PDFExportService] Devotional PDF exported successfully', {
        component: 'pdfExportService',
        fileName,
      });
    } catch (error) {
      Logger.error('[PDFExportService] Failed to export devotional PDF', error as Error, {
        component: 'pdfExportService',
      });
      Alert.alert('Export Failed', 'Unable to export devotional as PDF. Please try again.');
    }
  }

  /**
   * Export playbook as PDF using server-side generation
   */
  async exportPlaybookPDF(data: PlaybookPDFData): Promise<void> {
    try {
      const html = this.generatePlaybookHTML(data);
      const fileName = `siFia_Playbook_${data.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;

      // Call Supabase Edge Function to generate PDF
      const { data: pdfResponse, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          html,
          filename: fileName,
        },
      });

      if (error) {
        throw new Error(`PDF generation failed: ${error.message}`);
      }

      // Convert ArrayBuffer to base64 for sharing
      const uint8Array = new Uint8Array(pdfResponse);
      const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
      const base64Data = `data:application/pdf;base64,${btoa(binaryString)}`;

      // Share the PDF
      await Share.open({
        url: base64Data,
        type: 'application/pdf',
        title: 'Share Playbook',
        filename: fileName,
      });

      Logger.debug('[PDFExportService] Playbook PDF exported successfully', {
        component: 'pdfExportService',
        fileName,
      });
    } catch (error) {
      Logger.error('[PDFExportService] Failed to export playbook PDF', error as Error, {
        component: 'pdfExportService',
      });
      Alert.alert('Export Failed', 'Unable to export playbook as PDF. Please try again.');
    }
  }
}

export const pdfExportService = new PDFExportService();
