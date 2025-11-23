/**
 * PDF Export Service
 * Generates PDF documents for devotionals and playbooks with consistent layout
 */

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
  truthInLoveSummary?: string;
  bibleVerse?: {
    text: string;
    reference: string;
    version?: string;
  };
  actionSteps?: Array<{
    title: string;
    description: string;
    subtasks?: Array<string | { text?: string; title?: string }>;
    examples?: string[];
  }>;
  affirmations?: string[];
  directChallenge?: string;
  createdAt?: string;
}

class PDFExportService {
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

    const rawVerseText = bibleVerse?.text || '';
    const rawVerseRef = bibleVerse?.reference || '';
    const rawVerseVersion: string = (bibleVerse as any)?.version || '';

    const referenceIncludesVersion = rawVerseVersion
      ? rawVerseRef.toUpperCase().includes(rawVerseVersion.toUpperCase())
      : false;

    const safeVerseText = this.escapeHtml(rawVerseText);
    // Clean up empty parentheses from reference
    const cleanedDevVerseRef = rawVerseRef.replace(/\s*\(\s*\)\s*/g, '').trim();
    const safeVerseRef = this.escapeHtml(cleanedDevVerseRef);
    const safeVerseVersion = !rawVerseVersion || referenceIncludesVersion
      ? ''
      : this.escapeHtml(rawVerseVersion);

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
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .truth-summary {
              font-size: 15px;
              font-weight: 600; /* semi-bold */
              color: #274673; /* anchor blue */
              line-height: 1.6;
              margin-bottom: 10px;
            }

            .day-divider {
              height: 1px;
              background: #e2e8f0;
              border-radius: 999px;
              margin-top: 2px;
              margin-bottom: 14px;
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
              color: #6b7280;
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
                  <div class="verse-text">${safeVerseText}</div>
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
    const { title, truthInLove, truthInLoveSummary, bibleVerse, actionSteps, affirmations, directChallenge, createdAt } = data;

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
      const processedSubtasks = (step.subtasks || []).map(sub => {
        const text = typeof sub === 'string' ? sub : (sub.text || sub.title || '');
        return {
          text: this.escapeHtml(this.cleanMarkdown(text)),
        };
      });

      const processedExamples = (step.examples || []).map(ex =>
        this.escapeHtml(this.cleanMarkdown(ex || '')),
      );

      return {
        title: this.escapeHtml(this.cleanMarkdown(step.title || '')),
        description: this.escapeHtml(this.cleanMarkdown(step.description || '')),
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
      // Debug: Log the normalized challenge to see what we're parsing
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
      return this.escapeHtml(cleaned);
    });
    const safeDirectChallenge = this.escapeHtml(normalizedChallenge);

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
            
            h1 {
              font-size: 26px;
              color: #274673;
              margin: 14px 0 4px 0;
              font-weight: 700;
              line-height: 1.3;
            }

            .date {
              font-size: 12px;
              color: #94a3b8;
              margin-top: 8px;
              font-weight: 500;
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

            .truth-summary {
              font-size: 16px;
              font-weight: 600;
              color: #FF6B6B; /* alert coral */
              line-height: 1.6;
              margin-bottom: 12px;
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
              background: #FF6B6B;
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
              color: #274673;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              flex: 1;
            }
            
            .action-step-description {
              font-size: 11px;
              color: #475569;
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
              color: #475569;
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
              border: 2px solid #cbd5e1;
              border-radius: 50%;
              background: white;
            }

            .subtask-example {
              font-style: italic;
              opacity: 0.8;
            }

            .examples-section {
              margin-top: 12px;
              padding: 12px;
              background: rgba(255, 107, 107, 0.04);
              border-radius: 8px;
              border-left: 3px solid #FF6B6B;
            }

            .examples-header {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 8px;
              font-size: 11px;
              font-weight: 600;
              color: #FF6B6B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .examples-icon {
              font-size: 14px;
              color: #FF6B6B;
            }

            .examples-list {
              list-style: none;
              padding-left: 0;
              margin: 0;
            }

            .examples-list li {
              padding: 6px 0;
              font-size: 11px;
              color: #475569;
              line-height: 1.6;
              font-style: italic;
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
              color: #334155;
              line-height: 1.7;
            }

            .challenge-box {
              background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
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
              background: #FF6B6B; /* alert coral */
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }

            .challenge-text {
              font-size: 11px;
              color: #334155;
              line-height: 1.8;
              flex: 1;
            }

            .footer {
              margin-top: 40px;
              padding-top: 20px;
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
              color: #6b7280;
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

          ${actionSteps && actionSteps.length > 0 ? `
            <div class="section">
              <div class="section-title">Action Steps</div>
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
                              <div class="examples-header">
                                <span class="examples-icon">💬</span>
                              </div>
                              <ul class="examples-list">
                                ${step.examples
                                  .map(example => `<li>${example}</li>`)
                                  .join('')}
                              </ul>
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

          ${bibleVerse ? `
            <div class="section">
              <div class="day-divider"></div>
              <div class="section-title">Bible Verse</div>
              <div class="verse-box">
                <div class="verse-bar"></div>
                <div class="verse-content">
                  <div class="verse-text">${safeVerseText}</div>
                  <div class="verse-reference">— ${safeVerseRef}${safeVerseVersion ? ' ' + safeVerseVersion : ''}</div>
                </div>
              </div>
            </div>
          ` : ''}

          ${safeChallengeItems.length ? `
            <div class="section">
              <div class="section-title">RISE IN FAITH</div>
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
              <div class="section-title">RISE IN FAITH</div>
              <div class="challenge-box">
                <div class="challenge-content">
                  <div class="content-text">${safeDirectChallenge}</div>
                </div>
              </div>
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
   * Export devotional as PDF using native iOS/Android PDF generation
   * Uses react-native-html-to-pdf for native rendering
   */
  async exportDevotionalPDF(data: DevotionalPDFData): Promise<void> {
    try {
      const html = this.generateDevotionalHTML(data);
      const devotionalSlug = data.title
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
      const fileName = `siFia-Devotional-${devotionalSlug || 'Devotional'}-${Date.now()}`;

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
    }
  }

  /**
   * Export playbook as PDF using native iOS/Android PDF generation
   */
  async exportPlaybookPDF(data: PlaybookPDFData): Promise<void> {
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
    }
  }
}

export const pdfExportService = new PDFExportService();
