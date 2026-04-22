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
  Keyboard,
} from 'react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { MapPin, Navigation } from 'lucide-react-native';
import ThemedText from './common/ThemedText';
import { getCurrentLocation, searchLocations } from '../services/calendarSyncService';
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

  // const { user } = useAuth(); // Unused
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  useEffect(() => {
    setInputValue(currentLocation);
  }, [currentLocation]);

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
    Keyboard.dismiss();

  };

  const handleInputFocus = () => {
    if (inputValue.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for selection
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <MapPin size={16} color={Colors.textGray} />
        <TextInput
          style={[
            styles.textInput,
            { fontFamily: getFontFamily(fontKey, 'regular') },
          ]}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.textGray}
          returnKeyType="done"
        />

        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleGetCurrentLocation}
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    minHeight: 44,
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
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textGray,
    marginLeft: 8,
  },
  suggestionsList: {
    maxHeight: 180,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionInfo: {
    marginLeft: 8,
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: 12,
    color: Colors.textGray,
  },
  noResultsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 16,
  },
});
