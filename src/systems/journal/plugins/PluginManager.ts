import { JournalPlugin, ViewMode, JournalCategory } from '../types';
import { JOURNAL_PLUGINS } from './registry';

/**
 * Plugin Manager - Enterprise-grade plugin management system
 * Provides utilities for plugin discovery, registration, and management
 */
export class PluginManager {
  private static plugins: JournalPlugin[] = [...JOURNAL_PLUGINS];

  /**
   * Register a new plugin dynamically
   * @param plugin - The plugin to register
   */
  static registerPlugin(plugin: JournalPlugin): void {
    // Check if plugin already exists
    const existingIndex = this.plugins.findIndex(p => p.id === plugin.id);

    if (existingIndex >= 0) {
      // Update existing plugin
      this.plugins[existingIndex] = plugin;
      console.log(`📝 Updated plugin: ${plugin.id}`);
    } else {
      // Add new plugin
      this.plugins.push(plugin);
      console.log(`✅ Registered new plugin: ${plugin.id}`);
    }
  }

  /**
   * Unregister a plugin
   * @param pluginId - The ID of the plugin to remove
   */
  static unregisterPlugin(pluginId: string): boolean {
    const initialLength = this.plugins.length;
    this.plugins = this.plugins.filter(p => p.id !== pluginId);
    const removed = this.plugins.length < initialLength;

    if (removed) {
      console.log(`🗑️ Unregistered plugin: ${pluginId}`);
    }

    return removed;
  }

  /**
   * Get all registered plugins
   */
  static getAllPlugins(): JournalPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get plugins by category with priority sorting
   */
  static getPluginsByCategory(category: JournalCategory): JournalPlugin[] {
    return this.plugins
      .filter(plugin => plugin.category === category)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get plugins compatible with a specific view mode
   */
  static getPluginsByViewMode(viewMode: ViewMode): JournalPlugin[] {
    return this.plugins.filter(plugin =>
      plugin.viewModes.includes(viewMode)
    );
  }

  /**
   * Get plugins by multiple categories
   */
  static getPluginsByCategories(categories: JournalCategory[]): JournalPlugin[] {
    return categories.flatMap(category =>
      this.getPluginsByCategory(category)
    );
  }

  /**
   * Get a specific plugin by ID
   */
  static getPluginById(id: string): JournalPlugin | undefined {
    return this.plugins.find(plugin => plugin.id === id);
  }

  /**
   * Check if a plugin is registered
   */
  static hasPlugin(id: string): boolean {
    return this.plugins.some(plugin => plugin.id === id);
  }

  /**
   * Get plugin statistics
   */
  static getStats() {
    const stats = {
      total: this.plugins.length,
      byCategory: {} as Record<JournalCategory, number>,
      byViewMode: {} as Record<ViewMode, number>,
    };

    // Count by category
    this.plugins.forEach(plugin => {
      stats.byCategory[plugin.category] = (stats.byCategory[plugin.category] || 0) + 1;

      // Count by view mode
      plugin.viewModes.forEach(viewMode => {
        stats.byViewMode[viewMode] = (stats.byViewMode[viewMode] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * Validate plugin structure
   */
  static validatePlugin(plugin: Partial<JournalPlugin>): string[] {
    const errors: string[] = [];

    if (!plugin.id) {errors.push('Plugin ID is required');}
    if (!plugin.category) {errors.push('Plugin category is required');}
    if (!plugin.component) {errors.push('Plugin component is required');}
    if (typeof plugin.priority !== 'number') {errors.push('Plugin priority must be a number');}
    if (!Array.isArray(plugin.viewModes) || plugin.viewModes.length === 0) {
      errors.push('Plugin must support at least one view mode');
    }

    return errors;
  }
}

// Export convenience functions for backward compatibility
export const {
  getAllPlugins,
  getPluginsByCategory,
  getPluginsByViewMode,
  getPluginById,
  hasPlugin,
  registerPlugin,
  unregisterPlugin,
  getStats,
  validatePlugin,
} = PluginManager;
