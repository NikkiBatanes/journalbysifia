/**
 * calendarSyncService.test.ts
 * Test suite for the calendar sync service
 */

import {
  syncTimeBlockToCalendar,
  updateTimeBlockInCalendar,
  requestCalendarPermissions,
} from '../calendarSyncService';
import { TimeBlockData } from '../calendarSyncService';
import * as RNCalendarEvents from 'react-native-calendar-events';

// Mock react-native-calendar-events
jest.mock('react-native-calendar-events', () => ({
  default: {
    findCalendars: jest.fn(),
    saveCalendar: jest.fn(),
    saveEvent: jest.fn(),
    requestPermissions: jest.fn(),
    authorizationStatus: jest.fn(),
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock Logger
jest.mock('../../utils/ProductionLogger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock analytics
jest.mock('../../utils/analytics', () => ({
  trackTimeBlockEvent: jest.fn(),
}));

describe('calendarSyncService', () => {
  const mockRNCalendarEvents = RNCalendarEvents as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTimeBlock: TimeBlockData = {
    id: 'test-timeblock-123',
    title: 'Test Time Block',
    startTime: new Date('2024-01-01T10:00:00.000Z'),
    endTime: new Date('2024-01-01T11:00:00.000Z'),
    location: 'Test Location',
    notes: 'Test Notes',
    isAllDay: false,
    alarmMinutes: 15,
    repeat: {
      frequency: 'weekly',
      customDays: [1, 3, 5], // Monday, Wednesday, Friday
    },
    calendarEventId: 'existing-event-123',
  };

  describe('syncTimeBlockToCalendar', () => {
    it('should sync a time block to calendar successfully', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('new-event-123');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('new-event-123');
      expect(mockRNCalendarEvents.saveEvent).toHaveBeenCalled();
    });

    it('should update existing calendar event if calendarEventId exists', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event update
      mockRNCalendarEvents.saveEvent.mockResolvedValue('updated-event-123');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('updated-event-123');

      // Verify the event was updated with correct ID
      const saveEventCall = mockRNCalendarEvents.saveEvent.mock.calls[0];
      expect(saveEventCall[1]).toEqual(expect.objectContaining({
        id: 'existing-event-123',
      }));
    });

    it('should handle permission denied', async () => {
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('denied');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Calendar permission denied');
    });

    it('should handle calendar not found', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock no calendars found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([]);

      // Mock calendar creation
      mockRNCalendarEvents.saveCalendar.mockResolvedValue('new-calendar-123');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(true);
      expect(mockRNCalendarEvents.saveCalendar).toHaveBeenCalled();
    });

    it('should handle calendar creation failure', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock no calendars found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([]);

      // Mock calendar creation failure
      mockRNCalendarEvents.saveCalendar.mockResolvedValue(null);

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not access calendar');
    });

    it('should handle event creation failure', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation failure
      mockRNCalendarEvents.saveEvent.mockRejectedValue(new Error('Event creation failed'));

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to sync time block');
    });

    it('should handle all-day events correctly', async () => {
      const allDayBlock: TimeBlockData = {
        ...mockTimeBlock,
        isAllDay: true,
        startTime: new Date('2024-01-01T00:00:00.000Z'),
        endTime: new Date('2024-01-02T00:00:00.000Z'),
      };

      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('allday-event-123');

      const result = await syncTimeBlockToCalendar(allDayBlock);

      expect(result.success).toBe(true);

      // Verify all-day event properties
      const saveEventCall = mockRNCalendarEvents.saveEvent.mock.calls[0];
      expect(saveEventCall[1]).toEqual(expect.objectContaining({
        isAllDay: true,
      }));
    });

    it('should handle recurring events correctly', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('recurring-event-123');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(true);

      // Verify recurrence rule was included
      const saveEventCall = mockRNCalendarEvents.saveEvent.mock.calls[0];
      expect(saveEventCall[1]).toHaveProperty('recurrence');
    });

    it('should handle events with alarms correctly', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('event-with-alarm');

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(true);

      // Verify alarm was included
      const saveEventCall = mockRNCalendarEvents.saveEvent.mock.calls[0];
      expect(saveEventCall[1]).toEqual(expect.objectContaining({
        alarms: expect.arrayContaining([
          expect.objectContaining({
            date: -15, // 15 minutes before
          }),
        ]),
      }));
    });

    it('should handle network errors gracefully', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock network error
      mockRNCalendarEvents.findCalendars.mockRejectedValue(new Error('Network error'));

      const result = await syncTimeBlockToCalendar(mockTimeBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to sync time block');
    });
  });

  describe('updateTimeBlockInCalendar', () => {
    it('should update an existing calendar event successfully', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event update
      mockRNCalendarEvents.saveEvent.mockResolvedValue('updated-event-123');

      const result = await updateTimeBlockInCalendar('existing-event-123', mockTimeBlock);

      expect(result.success).toBe(true);
      expect(mockRNCalendarEvents.saveEvent).toHaveBeenCalledWith(
        mockTimeBlock.title,
        expect.objectContaining({
          id: 'existing-event-123',
          title: mockTimeBlock.title,
          startDate: mockTimeBlock.startTime.toISOString(),
          endDate: mockTimeBlock.endTime.toISOString(),
          location: mockTimeBlock.location,
          notes: mockTimeBlock.notes,
        })
      );
    });

    it('should handle update failure gracefully', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock update failure
      mockRNCalendarEvents.saveEvent.mockRejectedValue(new Error('Update failed'));

      const result = await updateTimeBlockInCalendar('existing-event-123', mockTimeBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update calendar event');
    });
  });

  describe('requestCalendarPermissions', () => {
    it('should request calendar permissions successfully', async () => {
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      const result = await requestCalendarPermissions();

      expect(result).toBe(true);
      expect(mockRNCalendarEvents.requestPermissions).toHaveBeenCalled();
    });

    it('should handle permission denial', async () => {
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('denied');

      const result = await requestCalendarPermissions();

      expect(result).toBe(false);
    });

    it('should handle permission errors', async () => {
      mockRNCalendarEvents.requestPermissions.mockRejectedValue(new Error('Permission error'));

      const result = await requestCalendarPermissions();

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null time block gracefully', async () => {
      const result = await syncTimeBlockToCalendar(null as any);

      expect(result).toBe(false);
    });

    it('should handle time block with missing required fields', async () => {
      const invalidBlock = {
        ...mockTimeBlock,
        title: '', // Empty title
        startTime: null as any, // Null start time
      };

      const result = await syncTimeBlockToCalendar(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid time block');
    });

    it('should handle extremely long titles and descriptions', async () => {
      const longBlock: TimeBlockData = {
        ...mockTimeBlock,
        title: 'a'.repeat(1000), // Very long title
        notes: 'b'.repeat(5000), // Very long notes
      };

      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('long-event-123');

      const result = await syncTimeBlockToCalendar(longBlock);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in event data', async () => {
      const specialBlock: TimeBlockData = {
        ...mockTimeBlock,
        title: 'Event with special chars: 🚀 ñáéíóú 漢字 🎉',
        notes: 'Notes with emojis: 🎯✨💫 and unicode: café naïve résumé',
        location: 'Location with symbols: @#$%&*()',
      };

      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('special-event-123');

      const result = await syncTimeBlockToCalendar(specialBlock);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent calendar operations', async () => {
      // Mock permissions granted
      mockRNCalendarEvents.requestPermissions.mockResolvedValue('authorized');

      // Mock calendar found
      mockRNCalendarEvents.findCalendars.mockResolvedValue([
        { id: 'calendar-123', title: 'siFia', isPrimary: false },
      ]);

      // Mock event creation
      mockRNCalendarEvents.saveEvent.mockResolvedValue('concurrent-event-123');

      // Run multiple sync operations concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        syncTimeBlockToCalendar({
          ...mockTimeBlock,
          id: `concurrent-${i}`,
          title: `Concurrent Event ${i}`,
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
