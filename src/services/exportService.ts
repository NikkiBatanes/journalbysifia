/**
 * Export Service for Access Tiers System
 * Handles PDF and DOCX export functionality with tier restrictions
 */

import { supabase } from './supabaseClient';
import { subscriptionService } from './subscriptionService';

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

export interface ExportAccess {
  allowed: boolean;
  remaining: number | 'Unlimited';
  limit: number | 'Unlimited';
  used: number;
}

export class ExportService {
  private supabase = supabase;

  /**
   * Check if user has export access and remaining exports
   */
  async hasExportAccess(userId: string): Promise<ExportAccess> {
    try {
      const subscription = await subscriptionService.getUserSubscription(userId);
      const usage = await subscriptionService.getCurrentUsage(userId);
      const limits = subscriptionService.getSubscriptionLimits(subscription.tier);

      // Handle unlimited exports
      if (limits.exports === -1) {
        return {
          allowed: true,
          remaining: 'Unlimited',
          limit: 'Unlimited',
          used: usage.exports_used || 0,
        };
      }

      // Handle no export access
      if (limits.exports === 0) {
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          used: usage.exports_used || 0,
        };
      }

      // Handle limited exports
      const used = usage.exports_used || 0;
      const remaining = Math.max(0, limits.exports - used);

      return {
        allowed: remaining > 0,
        remaining,
        limit: limits.exports,
        used,
      };
    } catch (error) {
      console.error('[ExportService] Error checking export access:', error);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        used: 0,
      };
    }
  }

  /**
   * Export playbook to PDF format
   */
  async exportPlaybookToPDF(userId: string, playbookId: string): Promise<ExportResult> {
    try {
      // Check export permissions
      const exportAccess = await this.hasExportAccess(userId);
      if (!exportAccess.allowed) {
        return {
          success: false,
          error: 'Export limit reached. Upgrade for more exports.',
        };
      }

      // Get playbook data
      const playbook = await this.getPlaybookData(playbookId);
      if (!playbook) {
        return {
          success: false,
          error: 'Playbook not found.',
        };
      }

      // Generate PDF
      const pdfUrl = await this.generatePDF(playbook);

      // Track usage
      await subscriptionService.trackUsage(userId, 'export');

      return {
        success: true,
        downloadUrl: pdfUrl,
      };
    } catch (error) {
      console.error('[ExportService] Error exporting to PDF:', error);
      return {
        success: false,
        error: 'Failed to export playbook. Please try again.',
      };
    }
  }

  /**
   * Export playbook to DOCX format
   */
  async exportPlaybookToDOCX(userId: string, playbookId: string): Promise<ExportResult> {
    try {
      // Check export permissions
      const exportAccess = await this.hasExportAccess(userId);
      if (!exportAccess.allowed) {
        return {
          success: false,
          error: 'Export limit reached. Upgrade for more exports.',
        };
      }

      // Get playbook data
      const playbook = await this.getPlaybookData(playbookId);
      if (!playbook) {
        return {
          success: false,
          error: 'Playbook not found.',
        };
      }

      // Generate DOCX
      const docxUrl = await this.generateDOCX(playbook);

      // Track usage
      await subscriptionService.trackUsage(userId, 'export');

      return {
        success: true,
        downloadUrl: docxUrl,
      };
    } catch (error) {
      console.error('[ExportService] Error exporting to DOCX:', error);
      return {
        success: false,
        error: 'Failed to export playbook. Please try again.',
      };
    }
  }

  /**
   * Get playbook data for export
   */
  private async getPlaybookData(playbookId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('playbooks')
        .select(`
          *,
          action_steps (
            *,
            subtasks (*)
          )
        `)
        .eq('id', playbookId)
        .single();

      if (error) {throw error;}
      return data;
    } catch (error) {
      console.error('[ExportService] Error fetching playbook data:', error);
      return null;
    }
  }

  /**
   * Generate PDF file from playbook data
   */
  private async generatePDF(playbook: any): Promise<string> {
    // For beta launch, we'll use a simple HTML to PDF conversion
    // In production, this would integrate with a PDF generation service

    const htmlContent = this.generateHTMLContent(playbook);

    // Mock PDF generation - in production, use a service like Puppeteer or PDFKit
    const mockPdfUrl = `https://api.sifia.app/exports/pdf/${playbook.id}?format=pdf&timestamp=${Date.now()}`;

    // TODO: Implement actual PDF generation
    console.log('[ExportService] Generated PDF for playbook:', playbook.id);

    return mockPdfUrl;
  }

  /**
   * Generate DOCX file from playbook data
   */
  private async generateDOCX(playbook: any): Promise<string> {
    // For beta launch, we'll use a simple template-based approach
    // In production, this would integrate with a DOCX generation service

    // Mock DOCX generation - in production, use a library like docx or officegen
    const mockDocxUrl = `https://api.sifia.app/exports/docx/${playbook.id}?format=docx&timestamp=${Date.now()}`;

    // TODO: Implement actual DOCX generation
    console.log('[ExportService] Generated DOCX for playbook:', playbook.id);

    return mockDocxUrl;
  }

  /**
   * Generate HTML content for export
   */
  private generateHTMLContent(playbook: any): string {
    const actionStepsHtml = playbook.action_steps?.map((step: any) => `
      <div class="action-step">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
        ${step.subtasks?.map((subtask: any) => `
          <div class="subtask">
            <p>• ${subtask.text}</p>
          </div>
        `).join('') || ''}
      </div>
    `).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${playbook.title} - siFia Playbook</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #1e3a8a; }
          h2 { color: #059669; }
          h3 { color: #374151; }
          .action-step { margin-bottom: 30px; }
          .subtask { margin-left: 20px; }
        </style>
      </head>
      <body>
        <h1>${playbook.title}</h1>
        <h2>Summary</h2>
        <p>${playbook.summary}</p>
        
        <h2>Action Steps</h2>
        ${actionStepsHtml}
        
        <footer>
          <p><em>Generated by siFia - Your Faith Journey Companion</em></p>
        </footer>
      </body>
      </html>
    `;
  }
}

// Export singleton instance
export const exportService = new ExportService();
