/**
 * PDF Export Service
 * Generates PDF documents for devotionals and playbooks with consistent layout
 */

import { Platform, Alert } from 'react-native';
import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import { Logger } from './ProductionLogger';

export interface DevotionalPDFData {
  title: string;
  /** Overall devotional title (e.g. "Finding Strength in God") */
  duration: string;
  /** Optional day title (e.g. "When You Feel Overwhelmed") */
  dayTitle?: string;
  /** Optional label like "Day 2 of 5" */
  dayLabel?: string;
  bibleVerse?: {
    text: string;
    reference: string;
    version?: string;
  };
  reflection?: string;
  /** Reflection questions for the day, rendered as 'Questions to Ponder' */
  questionsToPonder?: string[];
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
    const { title, duration, dayTitle, dayLabel, bibleVerse, reflection, questionsToPonder, prayer, actionSteps, createdAt } = data;
    
    // Escape all text content to prevent HTML injection/breaking
    const safeTitle = this.escapeHtml(title);
    const safeDuration = this.escapeHtml(duration);

    // Determine if we should show Day X of Y block (skip for 1-day devotionals)
    const shouldShowDaySection = !!dayLabel && !/of\s*1\b/i.test(dayLabel);

    const safeDayTitle = this.escapeHtml(dayTitle || '');
    const safeDayLabel = this.escapeHtml(dayLabel || '');
    const safeReflection = this.escapeHtml(reflection || '');
    const safeQuestions = (questionsToPonder || [])
      .map(q => q?.trim())
      .filter(Boolean)
      .map(q => this.escapeHtml(q as string));

    // Format prayer in three clear parts:
    // Heavenly Father.
    //
    // [body]
    //
    // In Jesus name, amen
    let formattedPrayer = (prayer || '').trim();

    if (formattedPrayer) {
      // Collapse excessive whitespace
      formattedPrayer = formattedPrayer.replace(/\s+/g, ' ');

      // Normalize opening
      formattedPrayer = formattedPrayer.replace(
        /^Heavenly Father[.,]?\s*/i,
        'Heavenly Father.\n\n',
      );

      // Normalize closing
      formattedPrayer = formattedPrayer.replace(
        /\s*In Jesus[’']?\s*name[,]?\s*amen\.?\s*$/i,
        '\n\nIn Jesus\' name, amen',
      );
    }

    const safePrayer = this.escapeHtml(formattedPrayer);
    const safeVerseText = this.escapeHtml(bibleVerse?.text || '');
    const safeVerseRef = this.escapeHtml(bibleVerse?.reference || '');
    const safeVerseVersion = this.escapeHtml((bibleVerse as any)?.version || '');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Arvo:ital,wght@0,400;0,700;1,400;1,700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
              font-size: 15px;
              line-height: 1.7;
              color: #1a1a1a;
              padding: 40px 40px 50px 40px;
              background: #ffffff;
            }

            .page-meta {
              text-align: right;
              font-size: 12px;
              color: #274673;
              margin-bottom: 8px;
              font-weight: 600;
            }

            .header {
              text-align: center;
              margin-bottom: 28px;
              padding: 18px 20px 20px 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
              border-radius: 12px;
            }
            
            .logo-container {
              margin-bottom: 12px;
            }
            
            .logo-image {
              max-width: 96px;
              height: auto;
              margin-bottom: 10px;
            }
            
            .tagline {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
              font-family: 'Arvo', 'Lexend', serif;
            }
            
            h1 {
              font-size: 26px;
              color: #274673;
              margin: 14px 0 4px 0;
              font-weight: 700;
              line-height: 1.3;
            }

            .day-label {
              font-size: 14px;
              font-weight: 700;
              color: #FF6B6B; /* alert coral */
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }

            .day-title {
              font-size: 21px;
              font-weight: 700;
              color: #274673;
              margin-bottom: 10px;
            }

            .day-divider {
              height: 1px;
              background: #e2e8f0;
              border-radius: 999px;
              margin-top: 2px;
              margin-bottom: 14px;
            }
            
            .duration {
              margin-top: 4px;
              font-size: 14px;
              font-weight: 600;
              color: #274673;
            }
            
            .section {
              margin-bottom: 18px;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #274673;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .scripture-title {
              /* normal section title, no bar here */
            }
            
            .verse-box {
              background: #ffffff;
              padding: 18px 20px;
              margin: 10px 0 14px 0;
              border-radius: 8px;
              box-shadow: none;
              display: flex;
              align-items: stretch;
              gap: 16px;
            }

            .verse-bar {
              width: 4px;
              border-radius: 999px;
              background: #FF6B6B; /* alert coral */
            }

            .verse-content {
              flex: 1;
            }
            
            .verse-text {
              font-size: 13px;
              font-style: italic;
              font-family: 'Arvo', 'Lexend', serif;
              color: #1e293b;
              margin-bottom: 14px;
              line-height: 1.9;
              font-weight: 500;
            }
            
            .verse-reference {
              font-size: 12px;
              font-weight: 700;
              color: #274673;
              text-align: right;
              margin-top: 12px;
            }
            
            .content-text {
              font-size: 11px;
              color: #334155;
              line-height: 1.9;
              margin-bottom: 16px;
              text-align: justify;
            }

            .prayer-text {
              font-family: 'Arvo', 'Lexend', serif;
              font-style: italic;
            }

            .questions-list {
              list-style: none;
              padding-left: 0;
              margin-top: 4px;
            }

            .questions-list li {
              margin-bottom: 10px;
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }

            .question-badge {
              width: 20px;
              height: 20px;
              border-radius: 999px;
              background: #FF6B6B; /* alert coral */
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .question-text {
              font-size: 11px;
              color: #334155;
              line-height: 1.8;
              flex: 1;
            }
            
            .action-steps {
              list-style: none;
              counter-reset: step-counter;
              margin-top: 16px;
            }
            
            .action-steps li {
              counter-increment: step-counter;
              margin-bottom: 16px;
              padding: 16px 16px 16px 50px;
              position: relative;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 3px solid #274673;
            }
            
            .action-steps li:before {
              content: counter(step-counter);
              position: absolute;
              left: 14px;
              top: 50%;
              transform: translateY(-50%);
              background: #274673;
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              font-weight: 700;
            }
            
            .footer {
              margin-top: 50px;
              padding-top: 25px;
              border-top: 2px solid #e2e8f0;
              text-align: center;
            }
            
            .footer-logo {
              font-size: 18px;
              font-weight: 700;
              color: #274673;
              margin-bottom: 8px;
            }
            
            .footer-text {
              font-size: 12px;
              color: #9ca3af; /* gray */
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          ${createdAt ? `<div class="page-meta">${new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}

          <div class="header">
            <div class="logo-container">
              <img src="https://sifia.app/images/sifia-logo-blue.png" class="logo-image" />
            </div>
            <h1>${safeTitle}</h1>
            <div class="duration">A ${safeDuration} Series</div>
          </div>

          ${shouldShowDaySection && (safeDayLabel || safeDayTitle) ? `
            <div class="section" style="margin-top: 4px;">
              ${safeDayLabel ? `<div class="day-label">${safeDayLabel}</div>` : ''}
              ${safeDayTitle ? `<div class="day-title">${safeDayTitle}</div>` : ''}
              <div class="day-divider"></div>
            </div>
          ` : ''}

          ${bibleVerse ? `
            <div class="section">
              <div class="day-divider"></div>
              <div class="section-title scripture-title">Today's Scripture</div>
              <div class="verse-box">
                <div class="verse-bar"></div>
                <div class="verse-content">
                  <div class="verse-text">"${safeVerseText}"</div>
                  <div class="verse-reference">— ${safeVerseRef}${safeVerseVersion ? ' ' + safeVerseVersion : ''}</div>
                </div>
              </div>
            </div>
          ` : ''}

          ${safeReflection ? `
            <div class="section">
              <div class="section-title">Reflection</div>
              <div class="content-text">${safeReflection}</div>
            </div>
          ` : ''}

          ${safeQuestions.length ? `
            <div class="section">
              <div class="section-title">Questions to Ponder</div>
              <ul class="questions-list">
                ${safeQuestions
                  .map((q, index) => `
                    <li>
                      <span class="question-badge">${index + 1}</span>
                      <span class="question-text">${q}</span>
                    </li>
                  `)
                  .join('')}
              </ul>
            </div>
          ` : ''}

          ${safePrayer ? `
            <div class="section">
              <div class="section-title">Prayer</div>
              <div class="content-text prayer-text">${safePrayer}</div>
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
            <div class="footer-text">Where technology serves the heart of discipleship.</div>
            <div class="footer-logo">© siFia</div>
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
              font-size: 15px;
              line-height: 1.7;
              color: #1a1a1a;
              padding: 50px 40px;
              background: #ffffff;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 30px;
              border-bottom: 3px solid #274673;
              background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
              padding: 30px 20px;
              border-radius: 12px;
            }
            
            .logo-container {
              margin-bottom: 20px;
            }
            
            .logo {
              font-size: 32px;
              font-weight: 700;
              color: #274673;
              letter-spacing: -0.5px;
              margin-bottom: 8px;
            }
            
            .tagline {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            h1 {
              font-size: 32px;
              color: #0f172a;
              margin: 20px 0 12px 0;
              font-weight: 700;
              line-height: 1.3;
            }
            
            .date {
              font-size: 12px;
              color: #94a3b8;
              margin-top: 12px;
              font-weight: 500;
            }
            
            .section {
              margin-bottom: 35px;
              page-break-inside: avoid;
            }
            
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #274673;
              margin-bottom: 16px;
              padding-bottom: 10px;
              border-bottom: 2px solid #e2e8f0;
              display: flex;
              align-items: center;
            }
            
            .section-title:before {
              content: '';
              width: 4px;
              height: 24px;
              background: #274673;
              margin-right: 12px;
              border-radius: 2px;
            }
            
            .verse-box {
              background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%);
              border-left: 5px solid #274673;
              padding: 24px;
              margin: 20px 0;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }
            
            .verse-text {
              font-size: 17px;
              font-style: italic;
              color: #1e293b;
              margin-bottom: 14px;
              line-height: 1.9;
              font-weight: 500;
            }
            
            .verse-reference {
              font-size: 14px;
              font-weight: 700;
              color: #274673;
              text-align: right;
              margin-top: 12px;
            }
            
            .content-text {
              font-size: 15px;
              color: #334155;
              line-height: 1.9;
              margin-bottom: 16px;
              text-align: justify;
            }
            
            .action-step {
              margin-bottom: 20px;
              padding: 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
              border-radius: 10px;
              border-left: 4px solid #274673;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
            }
            
            .action-step-title {
              font-size: 17px;
              font-weight: 700;
              color: #274673;
              margin-bottom: 10px;
            }
            
            .action-step-description {
              font-size: 15px;
              color: #475569;
              margin-bottom: 12px;
              line-height: 1.7;
            }
            
            .subtasks {
              list-style: none;
              padding-left: 0;
              margin-top: 10px;
            }
            
            .subtasks li {
              padding: 8px 8px 8px 30px;
              margin-bottom: 8px;
              position: relative;
              background: #f1f5f9;
              border-radius: 6px;
              font-size: 14px;
              color: #475569;
            }
            
            .subtasks li:before {
              content: '✓';
              position: absolute;
              left: 10px;
              color: #274673;
              font-weight: 700;
              font-size: 14px;
            }
            
            .affirmations {
              list-style: none;
              padding: 0;
            }
            
            .affirmations li {
              background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%);
              padding: 18px 20px;
              margin-bottom: 10px;
              border-radius: 6px;
              border-left: 3px solid #FF6B6B;
              font-size: 14px;
              color: #333;
            }
            .challenge-box {
              background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
              border: 2px solid #FF6B6B;
              padding: 24px;
              border-radius: 10px;
              margin: 20px 0;
              box-shadow: 0 2px 8px rgba(255, 107, 107, 0.1);
            }
            
            .challenge-title {
              font-size: 18px;
              font-weight: 700;
              color: #FF6B6B;
              margin-bottom: 12px;
            }
            
            .footer {
              margin-top: 50px;
              padding-top: 25px;
              border-top: 2px solid #e2e8f0;
              text-align: center;
            }
            
            .footer-logo {
              font-size: 18px;
              font-weight: 700;
              color: #274673;
              margin-bottom: 8px;
            }
            
            .footer-text {
              font-size: 12px;
              color: #9ca3af; /* gray */
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <div class="logo">siFia</div>
              <div class="tagline">Where technology serves the heart of discipleship.</div>
            </div>
            <h1>${title}</h1>
            ${createdAt ? `<div class="date">Created on ${new Date(createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>` : ''}
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
            <div class="footer-logo">siFia</div>
            <div class="footer-text">Your Faith Journey Companion</div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Export devotional as PDF using native iOS/Android PDF generation
   * Uses react-native-html-to-pdf for native rendering
   */
  async exportDevotionalPDF(data: DevotionalPDFData): Promise<void> {
    try {
      const html = this.generateDevotionalHTML(data);
      const fileName = `siFia_Devotional_${data.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;

      Logger.debug('[PDFExportService] Generating PDF with native renderer', {
        component: 'pdfExportService',
        fileName,
        htmlLength: html.length,
      });

      // Use native PDF generation (iOS/Android)
      const options = {
        html,
        fileName,
        directory: 'Documents',
        width: 595, // A4 width in points
        height: 842, // A4 height in points
        padding: 20,
        bgColor: '#FFFFFF',
      };

      const file = await generatePDF(options);
      
      Logger.debug('[PDFExportService] PDF generated successfully', {
        component: 'pdfExportService',
        filePath: file.filePath,
      });

      // Share the PDF file
      await Share.open({
        url: `file://${file.filePath}`,
        type: 'application/pdf',
        title: 'Share Devotional',
        filename: `${fileName}.pdf`,
      });

      Logger.debug('[PDFExportService] Devotional PDF shared successfully', {
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
   * Export playbook as PDF using native iOS/Android PDF generation
   */
  async exportPlaybookPDF(data: PlaybookPDFData): Promise<void> {
    try {
      const html = this.generatePlaybookHTML(data);
      const fileName = `siFia_Playbook_${data.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;

      Logger.debug('[PDFExportService] Generating playbook PDF with native renderer', {
        component: 'pdfExportService',
        fileName,
      });

      // Use native PDF generation (iOS/Android)
      const options = {
        html,
        fileName,
        directory: 'Documents',
        width: 595, // A4 width in points
        height: 842, // A4 height in points
        padding: 20,
        bgColor: '#FFFFFF',
      };

      const file = await generatePDF(options);
      
      Logger.debug('[PDFExportService] Playbook PDF generated successfully', {
        component: 'pdfExportService',
        filePath: file.filePath,
      });

      // Share the PDF file
      await Share.open({
        url: `file://${file.filePath}`,
        type: 'application/pdf',
        title: 'Share Playbook',
        filename: `${fileName}.pdf`,
      });

      Logger.debug('[PDFExportService] Playbook PDF shared successfully', {
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
