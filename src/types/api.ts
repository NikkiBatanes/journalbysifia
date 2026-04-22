// src/types/api.ts
// Comprehensive TypeScript types for API responses and requests

// Base API response wrapper
export interface ApiResponse<T = any> {
  data: T;
  error: null;
  status: 'success';
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
  status: 'error';
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Supabase specific error types
export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Journal entry content types
export type JournalContentType =
  | 'gratitude'
  | 'todo'
  | 'today_win'
  | 'looking_forward'
  | 'todays_focus'
  | 'win'
  | 'tomorrow_in_his_hands';

export type Priority = 'high' | 'medium' | 'low';

// Base journal entry interface
export interface JournalEntry {
  id: string;
  user_id: string;
  content_type: JournalContentType;
  content: string;
  selected_date: string;
  created_at: string;
  updated_at: string;
  completed?: boolean;
  priority?: Priority;
  metadata?: Record<string, any>;
}

// Specific content type interfaces for better type safety
export interface TodaysFocusContent {
  focus: string;
  priorities: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
}

export interface GratitudeContent {
  items: Array<{
    id: string;
    text: string;
  }>;
}

export interface TodoContent {
  text: string;
  completed: boolean;
  priority?: Priority;
}

export interface TodayWinContent {
  wins: Array<{
    id: string;
    text: string;
  }>;
}

export interface LookingForwardContent {
  items: Array<{
    id: string;
    text: string;
  }>;
}

// Typed journal entries for specific content types
export interface TodaysFocusEntry extends Omit<JournalEntry, 'content'> {
  content_type: 'todays_focus';
  content: TodaysFocusContent | string; // string for backward compatibility
}

export interface GratitudeEntry extends Omit<JournalEntry, 'content'> {
  content_type: 'gratitude';
  content: GratitudeContent | string;
}

export interface TodoEntry extends Omit<JournalEntry, 'content'> {
  content_type: 'todo';
  content: TodoContent | string;
}

export interface TodayWinEntry extends Omit<JournalEntry, 'content'> {
  content_type: 'today_win';
  content: TodayWinContent | string;
}

export interface LookingForwardEntry extends Omit<JournalEntry, 'content'> {
  content_type: 'looking_forward';
  content: LookingForwardContent | string;
}

// Union type for all journal entries
export type TypedJournalEntry =
  | TodaysFocusEntry
  | GratitudeEntry
  | TodoEntry
  | TodayWinEntry
  | LookingForwardEntry;

// API request types
export interface CreateJournalEntryRequest extends Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> {}

export interface UpdateJournalEntryRequest extends Partial<Omit<JournalEntry, 'id' | 'user_id' | 'created_at'>> {}

export interface GetJournalEntriesRequest {
  userId: string;
  date: string;
  contentType?: JournalContentType;
}

export interface GetEntriesInDateRangeRequest {
  userId: string;
  startDate: string;
  endDate: string;
  contentType?: JournalContentType;
}

// API response types
export interface GetJournalEntriesResponse extends ApiResponse<JournalEntry[]> {}
export interface CreateJournalEntryResponse extends ApiResponse<JournalEntry> {}
export interface UpdateJournalEntryResponse extends ApiResponse<JournalEntry> {}
export interface DeleteJournalEntryResponse extends ApiResponse<void> {}

// Retry configuration
export interface RetryConfig {
  attempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
  retryCondition?: (error: any) => boolean;
}

// Error boundary types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// React Query specific types
export interface QueryConfig {
  staleTime?: number;
  gcTime?: number;
  retry?: boolean | number | ((failureCount: number, error: any) => boolean);
  retryDelay?: number | ((retryAttempt: number, error: any) => number);
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  enabled?: boolean;
}

export interface MutationConfig {
  retry?: boolean | number | ((failureCount: number, error: any) => boolean);
  retryDelay?: number | ((retryAttempt: number, error: any) => number);
  onSuccess?: (data: any, variables: any, context: any) => void;
  onError?: (error: any, variables: any, context: any) => void;
  onSettled?: (data: any, error: any, variables: any, context: any) => void;
}
