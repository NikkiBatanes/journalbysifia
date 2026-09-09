/**
 * Enterprise Location Selector Component
 * Provides current location, recent locations, and search functionality
 * Integrates with calendar gating for premium features
 */

import React, { useState, useEffect, useRef } from 'react';
import { Logger } from '../utils/ProductionLogger';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { MapPin, Navigation } from 'lucide-react-native';
import ThemedText from './common/ThemedText';
import { getCurrentLocation, searchLocations } from '../services/calendarSyncService';
import { triggerLightHaptic } from '../utils/haptics';
// import { useAuth } from '../context/IndustryStandardAuthContext'; // Unused

interface LocationResult {
  success: boolean;
  location?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  error?: string;
}

interface LocationSelectorProps {
  onLocationSelect: (location: string) => void;
  currentLocation?: string;
  placeholder?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  onLocationSelect,
  currentLocation = '',
  placeholder = 'Add location',
}) => {
  const [inputValue, setInputValue] = useState(currentLocation);
  const [searchResults, setSearchResults] = useState<Array<{
    name: string;
    address: string;
    coordinates: { latitude: number; longitude: number };
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<TextInput>(null);

  // const { user } = useAuth(); // Unused
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  useEffect(() => {
    setInputValue(currentLocation);
  }, [currentLocation]);

  // Refocus input when modal appears to keep keyboard open
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [showSuggestions]);

  const handleGetCurrentLocation = async () => {

    setIsLoadingLocation(true);

    try {
      // Check if native module is available before calling

      const result: LocationResult = await getCurrentLocation();

      if (result.success && result.location) {

        setInputValue(result.location);
        onLocationSelect(result.location);
        setShowSuggestions(false);

      } else {

        // Fallback to manual entry prompt
        setInputValue('');
        setShowSuggestions(true);
      }
    } catch (error) {
      Logger.error('🗺️ [LocationSelector] ❌ Exception', error as Error, { component: 'LocationSelector' });
      // Graceful fallback - just focus the input for manual entry
      setInputValue('');
      setShowSuggestions(true);
    } finally {
      setIsLoadingLocation(false);

    }
  };

  const handleSearchLocations = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const results = await searchLocations(query);

      if (results && results.length > 0) {
        setSearchResults(results);

      } else {
        setSearchResults([]);
      }
    } catch (error) {
      Logger.error('Error searching locations', error as Error, { component: 'LocationSelector' });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    onLocationSelect(text);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearchLocations(text);
    }, 300); // 300ms debounce

    setShowSuggestions(text.length > 0);
  };

  const handleSuggestionSelect = (location: { name: string; address: string }) => {
    const fullLocation = `${location.name}, ${location.address}`;
    setInputValue(fullLocation);
    onLocationSelect(fullLocation);
    setShowSuggestions(false);

  };

  const handleInputFocus = () => {
    if (inputValue.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Don't auto-dismiss on blur - let user dismiss by selecting or tapping outside
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <MapPin size={16} color={Colors.hopeWhite} />
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            { fontFamily: getFontFamily(fontKey, 'medium') },
          ]}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.6)"
          returnKeyType="done"
          keyboardAppearance="dark"
        />

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={() => {
            triggerLightHaptic();
            handleGetCurrentLocation();
          }}
          disabled={isLoadingLocation}
        >
          {isLoadingLocation ? (
            <ActivityIndicator size="small" color={Colors.alertCoral} />
          ) : (
            <Navigation size={16} color={Colors.alertCoral} />
          )}
        </TouchableOpacity>
      </View>

      {/* Autocomplete Suggestions */}
      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.alertCoral} />
              <ThemedText style={styles.loadingText}>Searching locations...</ThemedText>
            </View>
          )}

          {searchResults.length > 0 && (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSuggestionSelect(item)}
                  activeOpacity={0.7}
                >
                  <MapPin size={14} color={Colors.textGray} />
                  <View style={styles.suggestionInfo}>
                    <ThemedText style={styles.suggestionName} weight="medium">
                      {item.name}
                    </ThemedText>
                    <ThemedText style={styles.suggestionAddress}>
                      {item.address}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}

          {!isSearching && searchResults.length === 0 && inputValue.length > 2 && (
            <View style={styles.noResultsContainer}>
              <ThemedText style={styles.noResultsText}>
                No locations found. Keep typing to search or use current location.
              </ThemedText>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 44,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#29342E',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    margin: 16,
    marginTop: 120,
    maxHeight: 300,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginLeft: 8,
    marginRight: 8,
    paddingVertical: 12,
    minHeight: 44,
  },
  currentLocationButton: {
    padding: 4,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.anchorBlue,
    borderRadius: 24,
    marginTop: -240,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#29342E',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
    fontFamily: 'medium',
  },
  suggestionsList: {
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 4,
    fontFamily: 'medium',
  },
  suggestionAddress: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'regular',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'medium',
  },
});
