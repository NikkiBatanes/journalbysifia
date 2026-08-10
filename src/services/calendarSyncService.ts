/**
 * Enterprise-Grade Calendar Sync Service
 * Handles native iOS/Android calendar integration for TimeBlocks
 * Features: Sync, repeat handling, location services, feature gating
 */

import { Alert, Platform, PermissionsAndroid } from 'react-native';
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
  alarmMinutes?: number; // Minutes before event to trigger alarm (null/undefined = no alarm)
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

const getCalendarPermissionDeniedMessage = (): string => (
  Platform.OS === 'android'
    ? 'Calendar permission denied. Please enable calendar access in Settings > Apps > siFia > Permissions > Calendar.'
    : 'Calendar permission denied. Please enable calendar access in Settings > Privacy & Security > Calendars > siFia.'
);

const getCalendarUnavailableMessage = (): string => (
  Platform.OS === 'android'
    ? 'Could not access a writable device calendar. Please make sure Calendar is available on this Android device, then try again.'
    : 'Could not access calendar.'
);

const showLocationPermissionDisclosure = (): Promise<boolean> => (
  new Promise(resolve => {
    Alert.alert(
      'Use Current Location?',
      'siFia collects your approximate or precise location only when you tap the current-location button to fill a time block location. Coordinates may be sent to OpenStreetMap Nominatim to show a readable place name. siFia does not use this location for ads, AI guidance, or background tracking. You can type a location manually instead.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Continue',
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      },
    );
  })
);

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
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
        PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
      ]);

      const readGranted = grants[PermissionsAndroid.PERMISSIONS.READ_CALENDAR] === PermissionsAndroid.RESULTS.GRANTED;
      const writeGranted = grants[PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR] === PermissionsAndroid.RESULTS.GRANTED;

      if (!readGranted || !writeGranted) {
        return false;
      }

      const status = await RNCalendarEvents.requestPermissions();
      return status === 'authorized';
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
    Logger.info('updateTimeBlockInCalendar: Starting update for event', { calendarEventId });
    Logger.info('updateTimeBlockInCalendar: Time block:', {
      title: timeBlock.title,
      startTime: timeBlock.startTime.toISOString(),
      endTime: timeBlock.endTime.toISOString(),
    });

    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      Logger.warn('updateTimeBlockInCalendar: Permission denied');
      return { success: false, error: getCalendarPermissionDeniedMessage() };
    }

    const calendarId = await getSiFiaCalendar();
    if (!calendarId) {
      Logger.warn('updateTimeBlockInCalendar: No calendar ID');
      return { success: false, error: getCalendarUnavailableMessage() };
    }

    // Create recurrence rule if needed
    let recurrence: string | undefined;
    if (timeBlock.repeat.frequency !== 'never') {
      recurrence = getRNCalendarRecurrence(timeBlock.repeat);
      Logger.info('updateTimeBlockInCalendar: Recurrence', { recurrence });
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

    // Add alarm/reminder if user has set one (including "at time of event" when alarmMinutes is 0)
    if (timeBlock.alarmMinutes !== undefined && timeBlock.alarmMinutes !== null && timeBlock.alarmMinutes >= 0) {
      eventDetails.alarms = [{
        date: -timeBlock.alarmMinutes, // Negative value means minutes before event, 0 means at event time
      }];
    }

    if (recurrence) {
      eventDetails.recurrence = recurrence;
    }

    Logger.info('updateTimeBlockInCalendar: Event details', { eventDetails });

    const updatedEventId = await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);

    Logger.info('updateTimeBlockInCalendar: Event updated! Event ID', { eventId: updatedEventId });

    return { success: true };
  } catch (error) {
    Logger.error('updateTimeBlockInCalendar: Error', error as Error, { component: 'calendarSyncService' });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update calendar event' };
  }
};

export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const alreadyGranted = await PermissionsAndroid.check(permission);
      if (alreadyGranted) {
        return true;
      }

      const acceptedDisclosure = await showLocationPermissionDisclosure();
      if (!acceptedDisclosure) {
        return false;
      }

      const granted = await PermissionsAndroid.request(
        permission,
        {
          title: 'Use Current Location',
          message: 'siFia uses your location only when you ask for it to suggest a readable time block location.',
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
    Logger.info('getSiFiaCalendar: Found calendars', { count: calendars.length });

    // 1) Prefer an existing 'siFia' calendar
    const existingSiFia = calendars.find(cal => cal.title === 'siFia' && cal.allowsModifications);
    if (existingSiFia) {
      Logger.info('getSiFiaCalendar: Using existing siFia calendar', { calendarId: existingSiFia.id });
      return existingSiFia.id;
    }

    // 2) If no calendars exist at all, we need to create one from scratch
    if (calendars.length === 0) {
      Logger.warn('getSiFiaCalendar: No calendars found on device, attempting to create siFia calendar');
    }

    // 3) Get writable calendar for source/fallback reference (if available)
    const writableCalendar =
      calendars.find(cal => cal.allowsModifications && (cal as any).isPrimary) ||
      calendars.find(cal => cal.allowsModifications);
    const defaultCalendar = writableCalendar || calendars.find(cal => (cal as any).isPrimary) || calendars[0];

    // 4) Try to create a dedicated 'siFia' calendar
    try {
      const baseSource: any = (defaultCalendar as any)?.source || {};

      const config: any = {
        title: 'siFia',
        color: '#FF6B6B',
        entityType: 'event',
        name: 'siFia',
      };

      if (Platform.OS === 'ios') {
        // iOS requires a valid source
        if (baseSource && baseSource.id) {
          config.source = baseSource;
          Logger.info('getSiFiaCalendar: Using source from existing calendar:', baseSource.id);
        } else {
          // If no calendars exist, try to use iCloud or local source
          Logger.info('getSiFiaCalendar: No source available, attempting to create with default iCloud source');
          // Try to create with iCloud source (most common on iOS)
          config.source = {
            name: 'iCloud',
            type: 'com.apple.icloud',
          };
        }
      } else {
        // Android requires ownerAccount and accessLevel for local calendars
        const sourceName = typeof (defaultCalendar as any)?.source === 'string' && (defaultCalendar as any).source
          ? (defaultCalendar as any).source
          : 'siFia';
        const sourceType = typeof (defaultCalendar as any)?.type === 'string' && (defaultCalendar as any).type
          ? (defaultCalendar as any).type
          : undefined;
        const ownerAccount = (defaultCalendar as any)?.ownerAccount || sourceName;
        const source = sourceType
          ? { name: sourceName, type: sourceType }
          : { name: sourceName, isLocalAccount: true };

        config.source = source;
        config.ownerAccount = ownerAccount;
        config.accessLevel = 'owner';
        Logger.info('getSiFiaCalendar: Android config:', { ownerAccount, source });
      }

      Logger.info('getSiFiaCalendar: Attempting to create siFia calendar with config:', config);
      const createdId = await (RNCalendarEvents as any).saveCalendar(config);

      if (createdId) {
        Logger.info('getSiFiaCalendar: Successfully created siFia calendar:', createdId);
        return createdId as string;
      } else {
        Logger.warn('getSiFiaCalendar: saveCalendar returned no ID');
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

    // 5) Last resort: use an existing writable calendar if available
    if (writableCalendar?.id) {
      Logger.warn('getSiFiaCalendar: Falling back to writable calendar', { calendarId: writableCalendar.id });
      return writableCalendar.id;
    }

    if (defaultCalendar?.id) {
      Logger.warn('getSiFiaCalendar: Calendar exists but is not writable', { calendarId: defaultCalendar.id });
    }

    Logger.error('getSiFiaCalendar: No calendar available and could not create one');
    return null;
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
    Logger.info('syncTimeBlockToCalendar: Starting sync for', { title: timeBlock.title });
    Logger.info('syncTimeBlockToCalendar: Existing calendar event ID', { eventId: timeBlock.calendarEventId });

    const hasPermission = await requestCalendarPermissions();

    if (!hasPermission) {
      Logger.warn('syncTimeBlockToCalendar: Permission denied');
      return {
        success: false,
        error: getCalendarPermissionDeniedMessage(),
      };
    }

    const calendarId = await getSiFiaCalendar();

    if (!calendarId) {
      Logger.warn('syncTimeBlockToCalendar: No calendar ID');
      return { success: false, error: getCalendarUnavailableMessage() };
    }

    // Create recurrence rule if needed
    let recurrence: string | undefined;
    if (timeBlock.repeat.frequency !== 'never') {
      recurrence = getRNCalendarRecurrence(timeBlock.repeat);
      Logger.info('syncTimeBlockToCalendar: Recurrence', { recurrence });
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

    // Add alarm/reminder if user has set one (including "at time of event" when alarmMinutes is 0)
    if (timeBlock.alarmMinutes !== undefined && timeBlock.alarmMinutes !== null && timeBlock.alarmMinutes >= 0) {
      eventDetails.alarms = [{
        date: -timeBlock.alarmMinutes, // Negative value means minutes before event, 0 means at event time
      }];
    }

    if (recurrence) {
      eventDetails.recurrence = recurrence;
    }

    Logger.info('syncTimeBlockToCalendar: Event details:', {
      title: eventDetails.title,
      startDate: eventDetails.startDate,
      endDate: eventDetails.endDate,
      calendarId: eventDetails.calendarId,
      hasExistingEventId: !!timeBlock.calendarEventId,
    });

    let eventId: string;

    if (timeBlock.calendarEventId) {
      // Update existing event
      Logger.info('syncTimeBlockToCalendar: Updating existing event', { eventId: timeBlock.calendarEventId });
      const updateDetails = {
        ...eventDetails,
        id: timeBlock.calendarEventId,
      };
      eventId = await RNCalendarEvents.saveEvent(timeBlock.title, updateDetails);
      Logger.info('syncTimeBlockToCalendar: Event updated! Event ID', { eventId });
    } else {
      // Create new event
      Logger.info('syncTimeBlockToCalendar: Creating new event...');
      eventId = await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);
      Logger.info('syncTimeBlockToCalendar: Event created! Event ID', { eventId });
    }

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
      return { success: false, error: getCalendarPermissionDeniedMessage() };
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
    } else if (options?.type === 'all') {
      // Remove ALL instances of recurring event (entire series)
      // For recurring events, we need to pass futureEvents: true to delete the entire series
      try {
        await (RNCalendarEvents as any).removeEvent(realEventId, {
          futureEvents: true,
        });
        Logger.info('🗓️ Successfully removed all recurring event instances', {
          component: 'calendarSyncService',
        });
      } catch (e) {
        Logger.warn('🗓️ Recurring series removal with options failed, trying simple removal', {
          component: 'calendarSyncService',
          errorMessage: e instanceof Error ? e.message : String(e),
        });
        // Fallback: try simple removal
        await RNCalendarEvents.removeEvent(realEventId);
      }
    } else {
      // Default: remove single non-recurring event
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
    // Prioritize local results by adding countrycodes parameter for Philippines
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=jsonv2&addressdetails=1&limit=5&countrycodes=ph`;

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
