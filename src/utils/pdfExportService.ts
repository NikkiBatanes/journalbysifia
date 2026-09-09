/**
 * PDF Export Service
 * Generates PDF documents for playbooks with consistent layout
 */

import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import { Platform } from 'react-native';
import { Logger } from './ProductionLogger';

export interface PlaybookPDFData {
  title: string;
  truthInLove?: string;
  truthInLoveSummary?: string;
  bibleVerse?: {
    text: string;
    reference: string;
    version?: string;
  };
  bibleVerseReflection?: string;
  actionSteps?: Array<{
    title: string;
    description: string;
    subtasks?: Array<string | { text?: string; title?: string }>;
    examples?: string[];
  }>;
  affirmations?: string[];
  prayer?: string;
  wordsToSpeak?: string;
  directChallenge?: string;
  createdAt?: string;
}

class PDFExportService {
  private toFileUri(filePath: string): string {
    return filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  }

  private getPdfOptions(html: string, fileName: string) {
    const baseOptions = {
      html,
      fileName,
      width: 595, // A4 width in points
      height: 842, // A4 height in points
      padding: 20,
      bgColor: '#FFFEFA',
    };

    // Android sharing uses react-native-share's FileProvider, which exposes cache paths.
    // Keeping Android PDFs in cache lets the native share sheet read the generated file.
    return Platform.OS === 'android'
      ? baseOptions
      : {
          ...baseOptions,
          directory: 'Documents',
        };
  }

  private getPdfFallbackOptions(html: string, fileName: string) {
    return Platform.OS === 'android'
      ? { html, fileName }
      : {
          html,
          fileName,
          directory: 'Documents',
        };
  }

  /**
   * Clean markdown formatting from text
   */
  private cleanMarkdown(text: string): string {
    if (!text) {return '';}
    return text
      .replace(/\*\*|__/g, '') // Remove bold
      .replace(/\*|_/g, '')     // Remove italic
      .replace(/~~/g, '')        // Remove strikethrough
      .trim();
  }

  /**
   * Escape HTML special characters to prevent broken HTML
   */
  private escapeHtml(text: string): string {
    if (!text) {return '';}
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>'); // Preserve line breaks
  }

  private formatChallengeHtml(text: string): string {
    const cleaned = this.cleanMarkdown(text || '').trim();
    if (!cleaned) {return '';}

    const lines = cleaned
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);

    let question = '';
    let remainder: string[] = [];

    if (lines.length > 1) {
      [question, ...remainder] = lines;
    } else {
      const questionMatch = cleaned.match(/^(.+?\?)(?:\s+|$)([\s\S]*)$/);
      if (questionMatch) {
        question = questionMatch[1].trim();
        const trailing = questionMatch[2].trim();
        remainder = trailing ? trailing.split(/\n+/).map(line => line.trim()).filter(Boolean) : [];
      } else {
        question = cleaned;
      }
    }

    let label = '';
    if (question && /:\s*$/.test(question) && remainder.length > 0) {
      label = question;
      const [nextLine, ...restLines] = remainder;
      question = nextLine;
      remainder = restLines;
    }

    const safeLabel = this.escapeHtml(label);
    const safeQuestion = this.escapeHtml(question);
    const safeRemainder = remainder.map(line => this.escapeHtml(line)).join('<br>');

    return `
      ${safeLabel ? `<div class="challenge-body">${safeLabel}</div>` : ''}
      <div class="challenge-question">${safeQuestion}</div>
      ${safeRemainder ? `<div class="challenge-body">${safeRemainder}</div>` : ''}
    `;
  }

  private extractDescriptionAndExamples(description: string, examples: string[] = []): { description: string; examples: string[] } {
    const cleanedDescription = this.cleanMarkdown(description || '').trim();
    const cleanedExamples = (examples || [])
      .map(example => this.cleanMarkdown(example || '').trim())
      .filter(Boolean);

    if (!cleanedDescription) {
      return {
        description: '',
        examples: cleanedExamples,
      };
    }

    if (cleanedExamples.length > 0) {
      return {
        description: cleanedDescription,
        examples: cleanedExamples,
      };
    }

    if (!/Example:\s*/i.test(cleanedDescription)) {
      return {
        description: cleanedDescription,
        examples: [],
      };
    }

    const segments = cleanedDescription
      .split(/Example:\s*/i)
      .map(segment => segment.trim())
      .filter(Boolean);

    const [mainDescription, ...descriptionExamples] = segments;

    return {
      description: mainDescription || '',
      examples: descriptionExamples,
    };
  }

  /**
   * Generate HTML template for playbook PDF
   */
  private generatePlaybookHTML(data: PlaybookPDFData): string {
    const { title, truthInLove, truthInLoveSummary, bibleVerse, bibleVerseReflection, actionSteps, affirmations, prayer, wordsToSpeak, directChallenge, createdAt } = data;

    const safeTitle = this.escapeHtml(this.cleanMarkdown(title));
    const safeTruthInLove = this.escapeHtml(this.cleanMarkdown(truthInLove || ''));
    const safeTruthInLoveSummary = this.escapeHtml(this.cleanMarkdown(truthInLoveSummary || ''));

    const rawPlaybookVerseText = bibleVerse?.text || '';
    const rawPlaybookVerseRef = bibleVerse?.reference || '';
    const rawPlaybookVerseVersion: string = (bibleVerse as any)?.version || '';

    const playbookRefIncludesVersion = rawPlaybookVerseVersion
      ? rawPlaybookVerseRef.toUpperCase().includes(rawPlaybookVerseVersion.toUpperCase())
      : false;

    // Clean verse text - remove trailing empty parentheses that sometimes appear
    const cleanedVerseText = this.cleanMarkdown(rawPlaybookVerseText)
      .replace(/\(\s*\)\s*$/g, '')  // Remove trailing empty parentheses
      .replace(/\(\)\s*$/g, '')      // Remove trailing empty parentheses without spaces
      .trim();
    const safeVerseText = this.escapeHtml(cleanedVerseText);
    // Clean up empty parentheses from reference - more aggressive cleaning
    let cleanedVerseRef = this.cleanMarkdown(rawPlaybookVerseRef)
      .replace(/\(\s*\)/g, '')  // Remove empty parentheses
      .replace(/\(\)/g, '')      // Remove empty parentheses without spaces
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
    const safeVerseRef = this.escapeHtml(cleanedVerseRef);
    const safeVerseVersion = !rawPlaybookVerseVersion || playbookRefIncludesVersion
      ? ''
      : this.escapeHtml(this.cleanMarkdown(rawPlaybookVerseVersion));

    const safeActionSteps = (actionSteps || []).map(step => {
      const normalizedStep = this.extractDescriptionAndExamples(step.description || '', step.examples || []);
      const processedSubtasks = (step.subtasks || []).map(sub => {
        const text = typeof sub === 'string' ? sub : (sub.text || sub.title || '');
        return {
          text: this.escapeHtml(this.cleanMarkdown(text)),
        };
      });

      const processedExamples = (normalizedStep.examples || []).map(ex =>
        this.escapeHtml(this.cleanMarkdown(ex || '')),
      );

      return {
        title: this.escapeHtml(this.cleanMarkdown(step.title || '')),
        description: this.escapeHtml(normalizedStep.description || ''),
        subtasks: processedSubtasks,
        examples: processedExamples,
      };
    });

    const safeAffirmations = (affirmations || [])
      .map(a => a?.trim())
      .filter(Boolean)
      .map(a => this.escapeHtml(this.cleanMarkdown(a as string)));

    // Normalize challenge labels: replace "Spiritual:" / "Tactical:" with numbered labels 1. / 2.
    let normalizedChallenge = this.cleanMarkdown((directChallenge || '').trim());
    if (normalizedChallenge) {
      // Handle variations: "Spiritual:", "Spiritual", "**Spiritual:**", etc.
      normalizedChallenge = normalizedChallenge
        .replace(/Spiritual\s*:?/gi, '1.')
        .replace(/Tactical\s*:?/gi, '2.');
    }

    // Try to extract up to two numbered challenge items: "1. ... 2. ..."
    const challengeItems: string[] = [];
    if (normalizedChallenge) {
      Logger.info('PDF Export: Normalized challenge', { challenge: normalizedChallenge });

      // 1st item: capture everything after "1." up to (but not including) "2." or end of string
      // Updated regex to handle "2." followed by any character (space, parenthesis, etc.)
      const firstMatch = normalizedChallenge.match(/1\.\s*([\s\S]*?)(?=2\.|$)/);
      if (firstMatch && firstMatch[1] && firstMatch[1].trim()) {
        const item1 = firstMatch[1].trim();
        Logger.info('PDF Export: Challenge item 1', { item: item1 });
        challengeItems.push(item1);
      }

      // 2nd item: capture everything after "2." to the end
      const secondMatch = normalizedChallenge.match(/2\.\s*([\s\S]*)$/);
      if (secondMatch && secondMatch[1] && secondMatch[1].trim()) {
        const item2 = secondMatch[1].trim();
        Logger.info('PDF Export: Challenge item 2', { item: item2 });
        challengeItems.push(item2);
      }

      Logger.info('PDF Export: Challenge items before dedup', { items: challengeItems });
    }

    // Ensure we only have maximum 2 items and remove any duplicates
    const uniqueChallengeItems = [...new Set(challengeItems)].slice(0, 2);
    Logger.info('PDF Export: Unique challenge items', { items: uniqueChallengeItems });

    const safeChallengeItems = uniqueChallengeItems.map(item => {
      // Remove deadline text like "(48-72 hour deadline):"
      const cleaned = item.replace(/\([^)]*deadline[^)]*\)\s*:?/gi, '').trim();
      return this.formatChallengeHtml(cleaned);
    });
    const safeDirectChallenge = this.formatChallengeHtml(normalizedChallenge);

    const safePrayer = this.escapeHtml(this.cleanMarkdown(prayer || ''));
    const safeWordsToSpeak = this.escapeHtml(this.cleanMarkdown(wordsToSpeak || ''));
    const safeBibleVerseReflection = this.escapeHtml(this.cleanMarkdown(bibleVerseReflection || ''));

    // Ensure prayer ends with "In Jesus's Name, Amen"
    let finalPrayer = safePrayer;
    if (safePrayer && !safePrayer.toLowerCase().includes('in jesus')) {
      finalPrayer = safePrayer + (safePrayer.endsWith('.') ? '' : '.') + '<br><br>In Jesus\'s Name, Amen';
    }

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
              color: #29342E;
              padding: 40px 40px 50px 40px;
              background: #FFFEFA;
            }

            .page-meta {
              text-align: right;
              font-size: 12px;
              color: #526A5B;
              margin-bottom: 8px;
              font-weight: 600;
            }

            .header {
              text-align: center;
              margin-bottom: 28px;
              padding: 18px 20px 20px 20px;
              background: linear-gradient(135deg, #FFFEFA 0%, #FFFEFA 100%);
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
            
            h1 {
              font-size: 26px;
              color: #526A5B;
              margin: 14px 0 4px 0;
              font-weight: 700;
              line-height: 1.3;
            }

            .date {
              font-size: 12px;
              color: #DFE4DD;
              margin-top: 8px;
              font-weight: 500;
            }
            
            .section {
              margin-bottom: 18px;
            }
            
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #526A5B;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .truth-summary {
              font-size: 16px;
              font-weight: 600;
              color: #29342E; /* black */
              line-height: 1.6;
              margin-bottom: 12px;
            }
            
            .verse-box {
              background: #FFFEFA;
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
              background: #D97872; /* alert coral */
            }

            .verse-content {
              flex: 1;
            }

            .verse-text {
              font-size: 13px;
              font-style: italic;
              font-family: 'Arvo', 'Lexend', serif;
              color: #29342E;
              margin-bottom: 14px;
              line-height: 1.9;
              font-weight: 500;
            }
            
            .verse-reference {
              font-size: 12px;
              font-weight: 700;
              color: #526A5B;
              text-align: right;
              margin-top: 12px;
            }
            
            .content-text {
              font-size: 11px;
              color: #7C837D;
              line-height: 1.9;
              margin-bottom: 16px;
              text-align: justify;
            }
            
            .action-step {
              margin-bottom: 12px;
              padding: 14px;
              background: rgba(39, 70, 115, 0.04);
              border-radius: 12px;
              position: relative;
            }
            
            .action-step-header {
              display: flex;
              align-items: center;
              margin-bottom: 10px;
            }
            
            .action-step-number {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #D97872;
              color: white;
              font-size: 13px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              margin-right: 10px;
            }
            
            .action-step-title {
              font-size: 14px;
              font-weight: 600;
              color: #526A5B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              flex: 1;
            }
            
            .action-step-description {
              font-size: 11px;
              color: #7C837D;
              margin-bottom: 8px;
              line-height: 1.7;
            }
            
            .subtasks {
              list-style: none;
              padding-left: 0;
              margin-top: 8px;
            }
            
            .subtasks li {
              padding: 8px 8px 8px 36px;
              margin-bottom: 8px;
              position: relative;
              font-size: 11px;
              color: #7C837D;
              line-height: 1.6;
            }
            
            .subtasks li:before {
              content: '';
              position: absolute;
              left: 8px;
              top: 50%;
              transform: translateY(-50%);
              width: 18px;
              height: 18px;
              border: 2px solid #DFE4DD;
              border-radius: 50%;
              background: white;
            }

            .subtask-example {
              font-style: italic;
              opacity: 0.8;
            }

            .examples-section {
              background: #FFFEFA;
              padding: 18px 20px;
              margin: 14px 0 0 0;
              border-radius: 8px;
              box-shadow: none;
              display: flex;
              align-items: stretch;
              gap: 16px;
            }

            .examples-bar {
              width: 4px;
              border-radius: 999px;
              background: #D97872;
              min-height: 100%;
            }

            .examples-content {
              flex: 1;
            }

            .examples-list {
              list-style: none;
              padding-left: 0;
              margin: 0;
            }

            .examples-list li {
              font-family: 'Arvo', 'Lexend', serif;
              font-style: italic;
              padding: 4px 0;
              font-size: 11px;
              color: #7C837D;
              line-height: 1.6;
            }

            .examples-list li:before {
              content: '';
              margin-right: 0;
              font-size: 0;
            }
            
            .affirmations {
              list-style: none;
              padding: 0;
            }
            
            .affirmations li {
              background: rgba(255, 107, 107, 0.04);
              padding: 12px 14px;
              margin-bottom: 8px;
              border-radius: 8px;
              font-size: 11px;
              color: #7C837D;
              line-height: 1.7;
            }

            .challenge-box {
              background: linear-gradient(135deg, #FFFEFA 0%, #FFFEFA 100%);
              padding: 0;
              border-radius: 8px;
              margin: 18px 0;
            }

            .challenge-content {
              padding: 20px;
            }

            .challenge-list {
              list-style: none;
              padding-left: 0;
              margin: 0;
            }

            .challenge-list li {
              display: flex;
              align-items: flex-start;
              gap: 10px;
              margin-bottom: 12px;
              padding: 0;
              margin-left: 0;
            }

            .challenge-badge {
              width: 20px;
              height: 20px;
              border-radius: 999px;
              background: #D97872; /* alert coral */
              color: #FFFEFA;
              font-size: 11px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .challenge-text {
              font-size: 12px;
              color: #7C837D;
              line-height: 1.8;
              flex: 1;
              font-weight: 500;
            }

            .challenge-fallback-text {
              font-size: 12px;
              color: #7C837D;
              line-height: 1.8;
              font-weight: 500;
            }

            .challenge-question {
              font-size: 16px;
              color: #7C837D;
              line-height: 1.8;
              font-weight: 500;
              margin-bottom: 6px;
            }

            .challenge-body {
              font-size: 12px;
              color: #7C837D;
              line-height: 1.8;
              font-weight: 500;
            }

            .prayer-box {
              background: linear-gradient(135deg, #FFFEFA 0%, #FFFEFA 100%);
              border-radius: 8px;
              padding: 16px;
              margin-top: 12px;
            }

            .prayer-text {
              font-family: 'Arvo', 'Lexend', serif;
              font-style: italic;
              font-size: 12px;
              color: #7C837D;
              line-height: 1.8;
            }

            .words-to-speak-box {
              background: linear-gradient(135deg, #FFFEFA 0%, #FFFEFA 100%);
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              max-width: 100%;
            }

            .words-to-speak-text {
              font-size: 16px;
              color: #7C837D;
              line-height: 1.8;
              font-weight: 500;
            }

            .bible-reflection {
              font-family: 'Arvo', 'Lexend', serif;
              font-size: 12px;
              color: #7C837D;
              line-height: 1.6;
              margin-top: 12px;
              font-style: italic;
              padding-left: 12px;
              border-left: 2px solid #DFE4DD;
            }

            .page-break {
              page-break-before: always;
              break-before: page;
              margin-top: 60px;
            }

            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #DFE4DD;
              text-align: center;
            }
            
            .footer-logo {
              font-size: 18px;
              font-weight: 700;
              color: #526A5B;
              margin-bottom: 8px;
            }
            
            .footer-text {
              font-size: 12px;
              color: #7C837D;
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
          </div>

          ${truthInLove ? `
            <div class="section">
              <div class="section-title">Truth in Love</div>
              ${safeTruthInLoveSummary ? `<div class="truth-summary">${safeTruthInLoveSummary}</div>` : ''}
              <div class="content-text">${safeTruthInLove}</div>
            </div>
          ` : ''}

          ${bibleVerse ? `
            <div class="section page-break">
              <div class="day-divider"></div>
              <div class="section-title">Scripture to Anchor</div>
              <div class="verse-box">
                <div class="verse-bar"></div>
                <div class="verse-content">
                  <div class="verse-text">${safeVerseText}</div>
                  <div class="verse-reference">— ${safeVerseRef}${safeVerseVersion ? ' ' + safeVerseVersion : ''}</div>
                </div>
              </div>
              ${safeBibleVerseReflection ? `<div class="bible-reflection">${safeBibleVerseReflection}</div>` : ''}
            </div>
          ` : ''}

          ${actionSteps && actionSteps.length > 0 ? `
            <div class="section">
              <div class="section-title">Faithful Actions</div>
              ${safeActionSteps
                .map(
                  (step, index) => `
                    <div class="action-step">
                      <div class="action-step-header">
                        <div class="action-step-number">${index + 1}</div>
                        <div class="action-step-title">${step.title}</div>
                      </div>
                      <div class="action-step-description">${step.description}</div>
                      ${step.subtasks && step.subtasks.length > 0
                        ? `
                            <ul class="subtasks">
                              ${step.subtasks
                                .map(subtask => `<li>${subtask.text}</li>`)
                                .join('')}
                            </ul>
                          `
                        : ''}

                      ${step.examples && step.examples.length > 0
                        ? `
                            <div class="examples-section">
                              <div class="examples-bar"></div>
                              <div class="examples-content">
                                <ul class="examples-list">
                                  ${step.examples
                                    .map(example => `<li>${example}</li>`)
                                    .join('')}
                                </ul>
                              </div>
                            </div>
                          `
                        : ''}
                    </div>
                  `,
                )
                .join('')}
            </div>
          ` : ''}

          ${affirmations && affirmations.length > 0 ? `
            <div class="section">
              <div class="section-title">Declarations</div>
              <ul class="affirmations">
                ${safeAffirmations.map(affirmation => `<li>${affirmation}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${prayer ? `
            <div class="section">
              <div class="section-title">Prayer</div>
              <div class="prayer-box">
                <div class="prayer-text">${finalPrayer}</div>
              </div>
            </div>
          ` : ''}

          ${wordsToSpeak ? `
            <div class="section">
              <div class="section-title">Words to Speak Over Myself</div>
              <div class="words-to-speak-box">
                <div class="words-to-speak-text">${safeWordsToSpeak}</div>
              </div>
            </div>
          ` : ''}

          ${safeChallengeItems.length ? `
            <div class="section">
              <div class="challenge-box">
                <div class="challenge-content">
                  <ul class="challenge-list">
                    ${safeChallengeItems
                      .map((item, index) => `
                        <li>
                          <span class="challenge-badge">${index + 1}</span>
                          <span class="challenge-text">${item}</span>
                        </li>
                      `)
                      .join('')}
                  </ul>
                </div>
              </div>
            </div>
          ` : safeDirectChallenge ? `
            <div class="section">
              <div class="challenge-box">
                <div class="challenge-content">
                  <div class="challenge-fallback-text">${safeDirectChallenge}</div>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <div class="footer-text">A companion for real-life moments, rooted in Scripture.</div>
            <div class="footer-logo"> siFia</div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Export playbook as PDF using native iOS/Android PDF generation
   */
  async exportPlaybookPDF(data: PlaybookPDFData): Promise<boolean> {
    try {
      const html = this.generatePlaybookHTML(data);
      const playbookSlug = data.title
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
      const fileName = `siFia-Playbook-${playbookSlug || 'Playbook'}-${Date.now()}`;

      Logger.debug('[PDFExportService] Generating playbook PDF with native renderer', {
        component: 'pdfExportService',
        fileName,
      });

      // Use native PDF generation (iOS/Android)
      const options = this.getPdfOptions(html, fileName);

      let file;
      try {
        file = await generatePDF(options);
      } catch (pdfError) {
        // Handle iOS print panel compatibility issues
        Logger.error('[PDFExportService] Playbook PDF generation failed, trying fallback', pdfError as Error, {
          component: 'pdfExportService',
          errorType: 'PDF_GENERATION_ERROR',
        });

        // Fallback: try without print-specific options that might cause issues
        const fallbackOptions = this.getPdfFallbackOptions(html, fileName);

        file = await generatePDF(fallbackOptions);
      }

      Logger.debug('[PDFExportService] Playbook PDF generated successfully', {
        component: 'pdfExportService',
        filePath: file.filePath,
      });

      // Share the PDF file with iPad-safe options
      const shareOptions = {
        url: this.toFileUri(file.filePath),
        type: 'application/pdf',
        title: 'Share Playbook',
        filename: `${fileName}.pdf`,
        failOnCancel: false,
        useInternalStorage: Platform.OS === 'android',
        // iPad-specific: exclude print option to prevent crashes
        excludedActivityTypes: Platform.OS === 'ios' && Platform.isPad ? [
          'com.apple.UIKit.Activity.Print',
          'com.apple.UIKit.Activity.AirDrop',
        ] : undefined,
      };

      await Share.open(shareOptions);

      Logger.debug('[PDFExportService] Playbook PDF shared successfully', {
        component: 'pdfExportService',
        fileName,
      });
      return true;
    } catch (error) {
      Logger.error('[PDFExportService] Failed to export playbook PDF', error as Error, {
        component: 'pdfExportService',
      });
      return false;
    }
  }
}

export const pdfExportService = new PDFExportService();
