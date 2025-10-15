/**
 * Enterprise-Grade Calendar Sync Service
 * Handles native iOS/Android calendar integration for TimeBlocks
 * Features: Sync, repeat handling, location services, feature gating
 */

import { Platform, PermissionsAndroid } from 'react-native';
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
    console.log('🔍 Requesting calendar permissions...');

    if (Platform.OS === 'ios') {
      const status = await RNCalendarEvents.requestPermissions();
      console.log('🔍 iOS calendar permission status:', status);

      if (status === 'denied' || status === 'restricted') {
        console.log('🔍 Calendar permission denied/restricted. User needs to enable in Settings.');
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
    console.error('Calendar permission error:', error);
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
    console.error('Calendar update error:', error);
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
    console.error('Location permission error:', error);
    return false;
  }
};

const getSiFiaCalendar = async (): Promise<string | null> => {
  try {
    console.log('📆 [getSiFiaCalendar] Finding calendars...');
    const calendars = await RNCalendarEvents.findCalendars();
    console.log('📆 [getSiFiaCalendar] Found', calendars.length, 'calendars');
    console.log('📆 [getSiFiaCalendar] Calendar list:', calendars.map(c => ({ id: c.id, title: c.title, source: (c as any).source })));

    // 1) Prefer an existing 'siFia' calendar
    const existingSiFia = calendars.find(cal => cal.title === 'siFia');
    if (existingSiFia) {
      console.log('📆 [getSiFiaCalendar] ✅ Found existing siFia calendar:', existingSiFia.id);
      return existingSiFia.id;
    }

    console.log('📆 [getSiFiaCalendar] No existing siFia calendar found, attempting to create...');

    // 2) Fallback to default calendar if we cannot create (as last resort)
    const defaultCalendar = calendars.find(cal => (cal as any).isPrimary) || calendars[0];
    console.log('📆 [getSiFiaCalendar] Default calendar:', defaultCalendar?.title, defaultCalendar?.id);

    // 3) Try to create a dedicated 'siFia' calendar using the default calendar's source
    // Note: RNCalendarEvents.saveCalendar requires platform-specific fields.
    try {
      const baseSource: any = (defaultCalendar as any)?.source || {};
      console.log('📆 [getSiFiaCalendar] Base source:', baseSource);
      console.log('📆 [getSiFiaCalendar] Platform:', Platform.OS);

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
          console.log('📆 [getSiFiaCalendar] iOS: Using source:', baseSource);
        } else {
          console.log('📆 [getSiFiaCalendar] iOS: ⚠️ No valid source found');
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
        console.log('📆 [getSiFiaCalendar] Android: Config:', config);
      }

      console.log('📆 [getSiFiaCalendar] Attempting to create calendar with config:', config);
      const createdId = await (RNCalendarEvents as any).saveCalendar(config);
      console.log('📆 [getSiFiaCalendar] saveCalendar returned:', createdId);

      if (createdId) {
        console.log('📆 [getSiFiaCalendar] ✅ Successfully created siFia calendar:', createdId);
        return createdId as string;
      } else {
        console.log('📆 [getSiFiaCalendar] ⚠️ saveCalendar returned falsy value');
      }
    } catch (createErr) {
      console.error('📆 [getSiFiaCalendar] ❌ Could not create siFia calendar:', createErr);
      console.error('📆 [getSiFiaCalendar] Error details:', JSON.stringify(createErr));
    }

    console.log('📆 [getSiFiaCalendar] Falling back to default calendar:', defaultCalendar?.id);
    return defaultCalendar?.id || null;
  } catch (error) {
    console.error('📆 [getSiFiaCalendar] ❌ Error getting calendar:', error);
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
    console.log('📅 [syncTimeBlockToCalendar] Starting sync for:', timeBlock.title);

    const hasPermission = await requestCalendarPermissions();
    console.log('📅 [syncTimeBlockToCalendar] Permission status:', hasPermission);

    if (!hasPermission) {
      console.log('📅 [syncTimeBlockToCalendar] ❌ Permission denied');
      return {
        success: false,
        error: 'Calendar permission denied. Please enable calendar access in Settings > Privacy & Security > Calendars > siFia',
      };
    }

    const calendarId = await getSiFiaCalendar();
    console.log('📅 [syncTimeBlockToCalendar] Calendar ID:', calendarId);

    if (!calendarId) {
      console.log('📅 [syncTimeBlockToCalendar] ❌ No calendar ID');
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

    console.log('📅 [syncTimeBlockToCalendar] Event details:', eventDetails);
    console.log('📅 [syncTimeBlockToCalendar] Calling RNCalendarEvents.saveEvent...');

    const eventId = await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);

    console.log('📅 [syncTimeBlockToCalendar] ✅ Event created with ID:', eventId);

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
      console.warn('Analytics error:', analyticsError);
    }

    return { success: true, eventId };
  } catch (error) {
    console.error('Calendar sync error:', error);

    // Track error analytics
    try {
      analytics.trackTimeBlockEvent('timeblock_error', {
        error_type: error instanceof Error ? error.message : 'calendar_sync_error',
        operation: 'sync_to_calendar',
        date: new Date().toISOString().split('T')[0],
      });
    } catch (analyticsError) {
      console.warn('Analytics error:', analyticsError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync to calendar',
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

    console.log('🗓️ Calendar removal - eventId:', eventId, 'realEventId:', realEventId, 'instanceDate:', instanceDate?.toISOString(), 'type:', options?.type);

    // Check if we actually have a real event ID to work with
    if (!realEventId || realEventId === 'undefined' || realEventId === 'null') {
      console.warn('🗓️ No valid calendar event ID found - cannot remove from calendar');
      return { success: false, error: 'No calendar event ID available' };
    }

    // If we have delete options and a date, attempt granular removal (iOS supports this)
    if (options?.type === 'future' && instanceDate) {
      try {
        await (RNCalendarEvents as any).removeEvent(realEventId, {
          futureEvents: true,
          instanceStartDate: instanceDate.toISOString(),
        });
        console.log('🗓️ Successfully removed future events from', instanceDate.toISOString());
      } catch (e) {
        console.warn('🗓️ Future events removal failed, falling back to series removal:', e);
        // Fallback: remove base event if granular removal fails
        await RNCalendarEvents.removeEvent(realEventId);
      }
    } else if (options?.type === 'single' && instanceDate) {
      try {
        await (RNCalendarEvents as any).removeEvent(realEventId, {
          futureEvents: false,
          instanceStartDate: instanceDate.toISOString(),
        });
        console.log('🗓️ Successfully removed single instance on', instanceDate.toISOString());
      } catch (e) {
        console.warn('🗓️ Single instance removal not supported by provider:', e);
        // Do NOT delete the entire series when single-instance deletion isn't supported.
        return { success: false, error: 'GRANULAR_SINGLE_DELETE_UNSUPPORTED' };
      }
    } else {
      // Default: remove this single event/series
      console.log('🗓️ Removing entire event/series:', realEventId);
      await RNCalendarEvents.removeEvent(realEventId);
    }

    return { success: true };
  } catch (error) {
    console.error('Calendar remove error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove from calendar',
    };
  }
};

export const getCurrentLocation = async (): Promise<LocationResult> => {
  try {
    console.log('📍 [getCurrentLocation] Starting location request...');

    const hasPermission = await requestLocationPermissions();
    console.log('📍 [getCurrentLocation] Permission status:', hasPermission);

    if (!hasPermission) {
      console.log('📍 [getCurrentLocation] ❌ Permission denied');
      return { success: false, error: 'Location permission denied' };
    }

    return new Promise((resolve) => {
      console.log('📍 [getCurrentLocation] Calling Geolocation.getCurrentPosition...');

      Geolocation.getCurrentPosition(
        async (position: any) => {
          const { latitude, longitude } = position.coords;
          console.log('📍 [getCurrentLocation] Got coordinates:', latitude, longitude);

          try {
            // Use reverse geocoding to get actual address
            console.log('📍 [getCurrentLocation] Fetching reverse geocode...');
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            console.log('📍 [getCurrentLocation] Reverse geocode response:', data);

            let locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            if (data && (data.locality || data.city)) {
              const city = data.locality || data.city || '';
              const region = data.principalSubdivision || '';
              const country = data.countryName || '';
              locationString = [city, region, country].filter(Boolean).join(', ');
              console.log('📍 [getCurrentLocation] Formatted location:', locationString);
            } else {
              console.log('📍 [getCurrentLocation] No city data, using coordinates:', locationString);
            }

            console.log('📍 [getCurrentLocation] ✅ Success:', locationString);
            resolve({
              success: true,
              location: locationString,
              coordinates: { latitude, longitude },
            });
          } catch (error) {
            console.error('📍 [getCurrentLocation] Reverse geocoding failed:', error);
            // Fallback to coordinates if reverse geocoding fails
            const locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            console.log('📍 [getCurrentLocation] ✅ Fallback to coordinates:', locationString);
            resolve({
              success: true,
              location: locationString,
              coordinates: { latitude, longitude },
            });
          }
        },
        (error: any) => {
          console.error('📍 [getCurrentLocation] ❌ Geolocation error:', error);
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
    console.error('Location error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get location',
    };
  }
};

export const searchLocations = async (query: string): Promise<LocationSearchResult[]> => {
  try {
    // For demo purposes, return mock results
    // In production, integrate with Google Places API or similar
    const mockResults: LocationSearchResult[] = [
      {
        id: 'search_1',
        name: `${query} - Main Location`,
        address: `123 ${query} Street, City, State`,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      },
      {
        id: 'search_2',
        name: `${query} - Secondary Location`,
        address: `456 ${query} Avenue, City, State`,
        coordinates: { latitude: 37.7849, longitude: -122.4094 },
      },
    ];

    return mockResults;
  } catch (error) {
    console.error('Location search error:', error);
    return [];
  }
};

export const deleteRecurringTimeBlock = async (
  timeBlock: TimeBlockData,
  options: DeleteOptions
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
    console.error('Delete recurring error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete recurring time block',
    };
  }
};
