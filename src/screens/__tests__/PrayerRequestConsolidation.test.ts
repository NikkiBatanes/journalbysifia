import fs from 'fs';
import path from 'path';

describe('Prayer Requests summary', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../PrayerListScreen.tsx'), 'utf8');

  it('transfers one request reminder from the first date to a pinned overlay', () => {
    expect(source).toContain('sectionIndex === 0');
    expect(source).toContain('!requestBadgePinned');
    expect(source).toContain("requestBadgePinned\n          && pendingRequests.length > 0");
    expect(source).toContain("activeTab !== 'requests'");
    expect(source).toContain('renderRequestReminderBadge()');
    expect(source).toContain('firstSectionHeaderYRef.current');
    expect(source).toContain('sectionTitleWithRequestBadge');
    expect(source).toContain('requestSummaryBadge');
    expect(source).toContain("position: 'absolute'");
    expect(source).toContain('right: 18');
    expect(source).toContain("{pendingRequests.length} {pendingRequests.length === 1 ? 'request' : 'requests'}");
    expect(source).not.toContain('All-time requests waiting for prayer');
    expect(source).not.toContain('all-time-prayer-requests');
    expect(source).not.toContain("{pendingRequests.length > 0 && activeTab !== 'requests' && (");
    expect(source).not.toContain('const requestCount = section.prayers.filter');
    expect(source).not.toContain('sectionRequestBadge');
    expect(source).not.toContain('sectionCount');
  });

  it('opens a requests-only view and clears conflicting filters', () => {
    expect(source).toContain("setActiveTab('requests')");
    expect(source).toContain('setSelectedTypes([])');
    expect(source).toContain('setSelectedPeople([])');
    expect(source).toContain('setSelectedTopics([])');
    expect(source).toContain('onPress={showAllPrayerRequests}');
  });

  it('keeps the Needs Prayer filter tag clear of the top edge', () => {
    expect(source).toContain("activeFiltersScroll: {marginHorizontal: -18, marginTop: 8");
    expect(source).toContain("activeFiltersRow: {paddingHorizontal: 18, paddingVertical: 2");
  });
});
