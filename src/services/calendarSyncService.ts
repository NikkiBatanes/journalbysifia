/**
 * Enterprise-Grade Calendar Sync Service
 * Handles native iOS/Android calendar integration for TimeBlocks
 * Features: Sync, repeat handling, location services, feature gating
 */

import { Platform, PermissionsAndroid } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import RNCalendarEvents from 'react-native-calendar-events';
import Geolocation from '@react-native-community/geolocation';
import { analytics } from '../utils/analytics';

export interface CalendarEvent {
  id?: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  allDay?: boolean;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    endDate?: Date;
    daysOfWeek?: number[];
  };
  calendarId?: string;
  timeBlockId: string;
}

export interface TimeBlockData {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  notes?: string;
  isAllDay: boolean;
  calendarEventId?: string;
  repeat: {
    frequency: 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: Date;
    customDays?: number[];
    customFrequency?: {
      value: number;
      unit: string;
    };
  };
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
  requiresUpgrade?: boolean;
}

export interface DeleteOptions {
  type: 'single' | 'future' | 'all';
  date?: Date;
}

export interface LocationResult {
  success: boolean;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  error?: string;
}

export interface LocationSearchResult {
  id: string;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  type: 'current' | 'recent' | 'search';
}

export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {

    if (Platform.OS === 'ios') {
      const status = await RNCalendarEvents.requestPermissions();

      if (status === 'denied' || status === 'restricted') {

        return false;
      }

      return status === 'authorized';
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
        {
          title: 'Calendar Permission',
          message: 'siFia needs access to your calendar to sync time blocks',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        const status = await RNCalendarEvents.requestPermissions();
        return status === 'authorized';
      }
      return false;
    }
  } catch (error) {
    Logger.error('Calendar permission error', error as Error, {
      component: 'calendarSyncService',
    });
    return false;
  }
};

export const updateTimeBlockInCalendar = async (
  calendarEventId: string,
  timeBlock: TimeBlockData
): Promise<{ success: boolean; error?: string }> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return { success: false, error: 'Calendar permission denied' };
    }

    const calendarId = await getSiFiaCalendar();
    if (!calendarId) {
      return { success: false, error: 'Could not access calendar' };
    }

    // Create recurrence rule if needed
    let recurrence: string | undefined;
    if (timeBlock.repeat.frequency !== 'never') {
      recurrence = getRNCalendarRecurrence(timeBlock.repeat);
    }

    const eventDetails: any = {
      id: calendarEventId,
      title: timeBlock.title,
      startDate: timeBlock.startTime.toISOString(),
      endDate: timeBlock.endTime.toISOString(),
      location: timeBlock.location || '',
      notes: timeBlock.notes || '',
      calendarId,
      allDay: timeBlock.isAllDay,
    };
    if (recurrence) {
      eventDetails.recurrence = recurrence;
    }

    await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);

    return { success: true };
  } catch (error) {
    Logger.error('Calendar update error', error as Error, {
      component: 'calendarSyncService',
    });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update calendar event' };
  }
};

export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'siFia needs access to your location for time block locations',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS location permissions are handled automatically by Geolocation
    return true;
  } catch (error) {
    Logger.error('Location permission error', error as Error, {
      component: 'calendarSyncService',
    });
    return false;
  }
};

const getSiFiaCalendar = async (): Promise<string | null> => {
  try {

    const calendars = await RNCalendarEvents.findCalendars();

    // 1) Prefer an existing 'siFia' calendar
    const existingSiFia = calendars.find(cal => cal.title === 'siFia');
    if (existingSiFia) {

      return existingSiFia.id;
    }

    // 2) Fallback to default calendar if we cannot create (as last resort)
    const defaultCalendar = calendars.find(cal => (cal as any).isPrimary) || calendars[0];

    // 3) Try to create a dedicated 'siFia' calendar using the default calendar's source
    // Note: RNCalendarEvents.saveCalendar requires platform-specific fields.
    try {
      const baseSource: any = (defaultCalendar as any)?.source || {};

      const config: any = {
        title: 'siFia',
        color: '#FF6B6B',
        entityType: 'event',
        name: 'siFia',
      };

      if (Platform.OS === 'ios') {
        // iOS requires a valid source. Reuse default calendar's source when possible.
        if (baseSource && baseSource.id) {
          config.source = baseSource;

        } else {

        }
      } else {
        // Android requires ownerAccount and accessLevel for local calendars
        const ownerAccount = (defaultCalendar as any)?.ownerAccount || 'local';
        config.ownerAccount = ownerAccount;
        config.accessLevel = 'owner';
        // Some Android devices require accountType to be 'LOCAL'
        if (baseSource?.type) {
          config.accountType = baseSource.type;
        }

      }

      const createdId = await (RNCalendarEvents as any).saveCalendar(config);

      if (createdId) {

        return createdId as string;
      } else {

      }
    } catch (createErr) {
      Logger.error('📆 [getSiFiaCalendar] ❌ Could not create siFia calendar', createErr as Error, {
      component: 'calendarSyncService',
    });
      Logger.error('📆 [getSiFiaCalendar] Error details', undefined, {
        component: 'calendarSyncService',
        data: createErr,
      });
    }

    return defaultCalendar?.id || null;
  } catch (error) {
    Logger.error('📆 [getSiFiaCalendar] ❌ Error getting calendar', error as Error, {
      component: 'calendarSyncService',
    });
    return null;
  }
};

const getRNCalendarRecurrence = (repeat: TimeBlockData['repeat']): string => {
  switch (repeat.frequency) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
    default:
      return 'daily';
  }
};

export const syncTimeBlockToCalendar = async (
  timeBlock: TimeBlockData
): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {

    const hasPermission = await requestCalendarPermissions();

    if (!hasPermission) {

      return {
        success: false,
        error: 'Calendar permission denied. Please enable calendar access in Settings > Privacy & Security > Calendars > siFia',
      };
    }

    const calendarId = await getSiFiaCalendar();

    if (!calendarId) {

      return { success: false, error: 'Could not access calendar' };
    }

    // Create recurrence rule if needed
    let recurrence: string | undefined;
    if (timeBlock.repeat.frequency !== 'never') {
      recurrence = getRNCalendarRecurrence(timeBlock.repeat);
    }

    // Build event details; only add recurrence if defined to satisfy typings
    const eventDetails: any = {
      title: timeBlock.title,
      startDate: timeBlock.startTime.toISOString(),
      endDate: timeBlock.endTime.toISOString(),
      location: timeBlock.location || '',
      notes: timeBlock.notes || '',
      calendarId,
      allDay: timeBlock.isAllDay,
    };
    if (recurrence) {
      eventDetails.recurrence = recurrence;
    }

    const eventId = await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);

    // Track success analytics
    try {
      analytics.trackTimeBlockEvent('timeblock_created', {
        title_length: timeBlock.title?.length || 0,
        category: 'calendar_sync',
        duration_minutes: Math.round((timeBlock.endTime.getTime() - timeBlock.startTime.getTime()) / (1000 * 60)),
        is_all_day: timeBlock.isAllDay,
        has_location: !!timeBlock.location,
        has_notes: !!timeBlock.notes,
        repeat_frequency: timeBlock.repeat?.frequency || 'never',
        date: timeBlock.startTime.toISOString().split('T')[0],
      });
    } catch (analyticsError) {
      Logger.warn('Analytics error', {
      component: 'calendarSyncService',
      errorMessage: analyticsError instanceof Error ? analyticsError.message : String(analyticsError),
    });
    }

    return { success: true, eventId };
  } catch (error) {
    Logger.error('Calendar sync error', error as Error, {
      component: 'calendarSyncService',
    });

    // Track error analytics
    try {
      analytics.trackTimeBlockEvent('timeblock_error', {
        error_type: error instanceof Error ? error.message : 'calendar_sync_error',
        operation: 'sync_to_calendar',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (analyticsError) {
      Logger.warn('Analytics error', {
      component: 'calendarSyncService',
      errorMessage: String(analyticsError),
    });
    }

    return {
      success: false,
      error: String(error),
    };
  }
};

export const removeTimeBlockFromCalendar = async (
  eventId: string,
  options?: DeleteOptions
): Promise<{ success: boolean; error?: string }> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return { success: false, error: 'Calendar permission denied' };
    }

    // Parse virtual calendar event ID format: "realEventId:targetDate"
    let realEventId = eventId;
    let instanceDate = options?.date;

    if (eventId.includes(':')) {
      const parts = eventId.split(':');
      realEventId = parts[0];
      // Use the date from the virtual ID if available, otherwise use options.date
      if (parts[1]) {
        instanceDate = new Date(parts[1]);
      }
    }

    // Check if we actually have a real event ID to work with
    if (!realEventId || realEventId === 'undefined' || realEventId === 'null') {
      Logger.warn('🗓️ No valid calendar event ID found - cannot remove from calendar', {
      component: 'calendarSyncService',
    });
      return { success: false, error: 'No calendar event ID available' };
    }

    // If we have delete options and a date, attempt granular removal (iOS supports this)
    if (options?.type === 'future' && instanceDate) {
      try {
        await (RNCalendarEvents as any).removeEvent(realEventId, {
          futureEvents: true,
          instanceStartDate: instanceDate.toISOString(),
        });

      } catch (e) {
        Logger.warn('🗓️ Future events removal failed, falling back to series removal', {
      component: 'calendarSyncService',
      errorMessage: e instanceof Error ? e.message : String(e),
    });
        // Fallback: remove base event if granular removal fails
        await RNCalendarEvents.removeEvent(realEventId);
      }
    } else if (options?.type === 'single' && instanceDate) {
      try {
        await (RNCalendarEvents as any).removeEvent(realEventId, {
          futureEvents: false,
          instanceStartDate: instanceDate.toISOString(),
        });

      } catch (e) {
        Logger.warn('🗓️ Single instance removal not supported by provider', {
      component: 'calendarSyncService',
      errorMessage: e instanceof Error ? e.message : String(e),
    });
        // Do NOT delete the entire series when single-instance deletion isn't supported.
        return { success: false, error: 'GRANULAR_SINGLE_DELETE_UNSUPPORTED' };
      }
    } else {
      // Default: remove this single event/series

      await RNCalendarEvents.removeEvent(realEventId);
    }

    return { success: true };
  } catch (error) {
    Logger.error('Calendar remove error', error as Error, {
      component: 'calendarSyncService',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove from calendar',
    };
  }
};

export const getCurrentLocation = async (): Promise<LocationResult> => {
  try {

    const hasPermission = await requestLocationPermissions();

    if (!hasPermission) {

      return { success: false, error: 'Location permission denied' };
    }

    return new Promise((resolve) => {

      Geolocation.getCurrentPosition(
        async (position: any) => {
          const { latitude, longitude } = position.coords;

          try {
            // Reverse geocode with OpenStreetMap Nominatim
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`;
            const response = await fetch(reverseUrl, {
              headers: {
                'User-Agent': 'siFia/1.0 (+https://sifia.app)',
                'Accept-Language': 'en',
              },
            });
            const data = await response.json();

            let locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            if (data && data.address) {
              const a = data.address;
              const city = a.city || a.town || a.village || a.hamlet || '';
              const region = a.state || a.region || '';
              const country = a.country || '';
              locationString = [city, region, country].filter(Boolean).join(', ');
            }

            resolve({
              success: true,
              location: locationString,
              coordinates: { latitude, longitude },
            });
          } catch (error) {
            Logger.error('📍 [getCurrentLocation] Reverse geocoding failed', error as Error, {
      component: 'calendarSyncService',
    });
            // Fallback to coordinates if reverse geocoding fails
            const locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

            resolve({
              success: true,
              location: locationString,
              coordinates: { latitude, longitude },
            });
          }
        },
        (error: any) => {
          Logger.error('📍 [getCurrentLocation] ❌ Geolocation error', error as Error, {
      component: 'calendarSyncService',
    });
          resolve({
            success: false,
            error: error.message || 'Failed to get location',
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  } catch (error) {
    Logger.error('Location error', error as Error, {
      component: 'calendarSyncService',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get location',
    };
  }
};

export const searchLocations = async (query: string): Promise<LocationSearchResult[]> => {
  try {
    // OpenStreetMap Nominatim search (autocomplete style)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=jsonv2&addressdetails=1&limit=5`;

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'siFia/1.0 (+https://sifia.app)',
        'Accept-Language': 'en',
      },
    });
    const results: any[] = await resp.json();
    if (!Array.isArray(results)) {
      return [];
    }

    const mapped: LocationSearchResult[] = results.map((r: any) => {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      const name = r.name || r.display_name?.split(',')[0] || 'Location';
      const address = r.display_name || '';
      return {
        id: r.place_id?.toString?.() || `${lat},${lon}`,
        name,
        address,
        coordinates: { latitude: lat, longitude: lon },
      };
    });

    return mapped;
  } catch (error) {
    Logger.error('Location search error', error as Error, {
      component: 'calendarSyncService',
    });
    return [];
  }
};

export const deleteRecurringTimeBlock = async (
  timeBlock: TimeBlockData
): Promise<{ success: boolean; error?: string }> => {
  try {
    // If it has a calendar event, remove it
    if (timeBlock.calendarEventId) {
      const result = await removeTimeBlockFromCalendar(timeBlock.calendarEventId);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  } catch (error) {
    Logger.error('Delete recurring error', error as Error, {
      component: 'calendarSyncService',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete recurring time block',
    };
  }
};
