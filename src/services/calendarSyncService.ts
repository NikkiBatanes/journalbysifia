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
    if (Platform.OS === 'ios') {
      const status = await RNCalendarEvents.requestPermissions();
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
    const calendars = await RNCalendarEvents.findCalendars();
    
    // Look for existing siFia calendar
    const siFiaCalendar = calendars.find(cal => cal.title === 'siFia Time Blocks');
    if (siFiaCalendar) {
      return siFiaCalendar.id;
    }

    // For react-native-calendar-events, we'll use the default calendar
    // Creating custom calendars requires more complex setup
    const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];
    return defaultCalendar?.id || null;
  } catch (error) {
    console.error('Error getting calendar:', error);
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

    const eventDetails = {
      title: timeBlock.title,
      startDate: timeBlock.startTime.toISOString(),
      endDate: timeBlock.endTime.toISOString(),
      location: timeBlock.location || '',
      notes: timeBlock.notes || '',
      calendarId,
      allDay: timeBlock.isAllDay,
      recurrence,
    };

    const eventId = await RNCalendarEvents.saveEvent(timeBlock.title, eventDetails);

    // Track success analytics
    try {
      analytics.trackTimeBlockEvent('timeblock_created', {
        timeblock_id: timeBlock.id,
        category: 'calendar_sync',
        duration_minutes: Math.round((timeBlock.endTime.getTime() - timeBlock.startTime.getTime()) / (1000 * 60)),
        was_all_day: timeBlock.isAllDay,
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
      error: error instanceof Error ? error.message : 'Failed to sync to calendar' 
    };
  }
};

export const removeTimeBlockFromCalendar = async (
  eventId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return { success: false, error: 'Calendar permission denied' };
    }

    await RNCalendarEvents.removeEvent(eventId);

    return { success: true };
  } catch (error) {
    console.error('Calendar remove error:', error);
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to remove from calendar' 
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
            // Use reverse geocoding to get actual address
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            
            let locationString = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            if (data && (data.locality || data.city)) {
              const city = data.locality || data.city || '';
              const region = data.principalSubdivision || '';
              const country = data.countryName || '';
              locationString = [city, region, country].filter(Boolean).join(', ');
            }
            
            resolve({
              success: true,
              location: locationString,
              coordinates: { latitude, longitude },
            });
          } catch (error) {
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
          console.error('Location error:', error);
          resolve({ 
            success: false, 
            error: error.message || 'Failed to get location' 
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
      error: error instanceof Error ? error.message : 'Failed to get location' 
    };
  }
};

export const searchLocations = async (query: string): Promise<LocationSearchResult[]> => {
  try {
    // For demo purposes, return mock results
    // In production, integrate with Google Places API or similar
    const mockResults: LocationSearchResult[] = [
      {
        id: `search_1`,
        name: `${query} - Main Location`,
        address: `123 ${query} Street, City, State`,
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
      },
      {
        id: `search_2`,
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
      error: error instanceof Error ? error.message : 'Failed to delete recurring time block' 
    };
  }
};
