import React from 'react';
import { Alert, Dimensions, Platform, StyleSheet, View as RNView } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import TruthToCarryShareComposer from '../TruthToCarryShareComposer';
import ForMeDayShareCard, {FOR_ME_DAY_GOSPEL, getForMeDayShareText} from '../ForMeDayShareCard';
import { triggerLightHaptic } from '../../utils/haptics';

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { Social: { SMS: 'sms', INSTAGRAM_STORIES: 'instagram-stories' }, shareSingle: jest.fn().mockResolvedValue({}), open: jest.fn() },
}));
jest.mock('react-native-view-shot', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({
        capture: async () => props.options?.fileName === 'journal-story-share' ? '/tmp/story.png' : '/tmp/reflection.png',
      }));
      return ReactMock.createElement(View, null, props.children);
    }),
    captureRef: jest.fn().mockResolvedValue('data:image/png;base64,reflection'),
  };
});
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../common/ThemedText', () => require('react-native').Text);
jest.mock('../../config/environment', () => ({ ENV: {} }));
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn(), triggerSuccessHaptic: jest.fn() }));
jest.mock('../../utils/ProductionLogger', () => ({ Logger: { error: jest.fn() } }));

describe('Truth to Carry Message sharing', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('uses the full Journal by siFia brand on the share card', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    expect(screen.getByLabelText('Journal by siFia logo')).toBeTruthy();
  });

  it('scrolls to the bottom edge while keeping content above the safe area', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    const scroll = screen.getByLabelText('Share composer content');

    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(scroll.props.automaticallyAdjustContentInsets).toBe(false);
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(16);
  });

  it('renders a structured morning summary card without text-style controls', () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        variant="morning-summary"
        text="Morning summary"
        morningSummary={{
          feeling: 'Overwhelmed',
          feelingIcon: 'waves',
          feelingIconType: 'material',
          feelingVerse: 'Come to Me, all who are weary and burdened.',
          feelingVerseReference: 'Matthew 11:28 · NASB',
          focus: 'Family',
          focusIcon: 'home',
          focusIconType: 'material',
          focusReflection: 'Be present in the conversations at home.',
          prioritiesCount: 2,
          todosCount: 2,
          psalmNumber: 1,
          psalmRead: true,
          observations: ['Sovereign King', 'Refuge'],
          reminder: 'Carry God’s faithfulness into what comes next.',
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Morning summary share card')).toBeTruthy();
    expect(screen.getByText('You’re ready for today.')).toBeTruthy();
    expect(screen.getByText('Overwhelmed')).toBeTruthy();
    expect(screen.getByText('Matthew 11:28 · NASB')).toBeTruthy();
    expect(screen.getByText('Psalm 1')).toBeTruthy();
    expect(screen.getByText('Sovereign King · Refuge')).toBeTruthy();
    expect(screen.getAllByText('Carry God’s faithfulness into what comes next.').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Edit post style')).toBeNull();
  });

  it('renders a streak card with its routine identity and full week', () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        variant="streak"
        text={'3-day morning streak\n\nYour morning reflection is complete.'}
        streakSummary={{
          routine: 'morning',
          title: '3-day morning streak',
          message: 'Your morning reflection is complete.',
          weekStart: 'Monday',
          dayStates: ['completed', 'completed', 'completed', 'today', 'future', 'future', 'future'],
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText('3-day morning streak share card')).toBeTruthy();
    expect(screen.getByLabelText('morning rhythm icon')).toBeTruthy();
    expect(screen.getByText('MORNING RHYTHM COMPLETE')).toBeTruthy();
    expect(screen.getByText('3-day morning streak')).toBeTruthy();
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
      expect(screen.getByText(day)).toBeTruthy();
    });
    expect(screen.queryByLabelText('Edit post style')).toBeNull();
  });

  it('lets the user choose typography and separates supporting truth', async () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        text={'Jesus calls you to rest.\n\nYou do not need to earn his grace.'}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Jesus calls you to rest.')).toBeTruthy();
    expect(screen.getByText('You do not need to earn his grace.')).toBeTruthy();
    expect(screen.queryByLabelText('Use Script text style')).toBeNull();
    expect(screen.getByLabelText('Swipe left or right to choose a template')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Edit post style'));
    const scriptButton = await screen.findByText('Script');
    expect(StyleSheet.flatten(screen.getByText('Jesus calls you to rest.').props.style).fontFamily).toBe('Lora-Bold');
    fireEvent.press(scriptButton);
    expect(StyleSheet.flatten(screen.getByText('Jesus calls you to rest.').props.style).fontFamily)
      .not.toBe('Lora-Bold');
    fireEvent.press(screen.getByLabelText('Close post editor'));
    await waitFor(() => expect(screen.queryByLabelText('Use Script text style')).toBeNull());
  });

  it('adjusts share-card text with a continuous size control', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Edit post style'));

    const initialSize = StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize;
    const slider = screen.getByLabelText('Text size');
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(slider.props.accessibilityValue.now).toBe(96);
    expect(StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize).toBeLessThan(initialSize);
    expect(triggerLightHaptic).toHaveBeenCalled();
  });

  it('lets every Journal user choose whether to show share-card branding', async () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Message').props.accessibilityState.disabled).toBe(false));
    expect(screen.getByText('www.journalby.sifia.app')).toBeTruthy();

    const watermarkToggle = screen.getByLabelText('Show Journal by siFia watermark');
    expect(watermarkToggle.props.accessibilityState.checked).toBe(true);
    fireEvent.press(watermarkToggle);

    expect(screen.queryByText('www.journalby.sifia.app')).toBeNull();
    expect(screen.getByText('Hidden from this post')).toBeTruthy();
  });

  it('does not present a tier upsell for share-card branding', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    expect(screen.queryByText('Available with Growth')).toBeNull();
    expect(screen.queryByText('Get Growth')).toBeNull();
  });

  it('provides haptic feedback when closing', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Close share composer'));
    expect(triggerLightHaptic).toHaveBeenCalledTimes(1);
  });

  it('uses the 9:16 capture for Instagram Stories', async () => {
    Platform.OS = 'android';
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Instagram'));

    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'instagram-stories',
      backgroundImage: 'file:///tmp/story.png',
    })));
  });

  it.each(['ios', 'android'] as const)('keeps Messages on the 4:5 image attachment on %s', async os => {
    Platform.OS = os;
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'sms',
      recipient: '',
      type: 'image/png',
      url: os === 'ios' ? 'data:image/png;base64,reflection' : 'file:///tmp/reflection.png',
    })));
    if (os === 'ios') {
      expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ result: 'data-uri' }));
      const captureOptions = jest.mocked(captureRef).mock.calls.at(-1)?.[1];
      expect(captureOptions).not.toHaveProperty('width');
      expect(captureOptions).not.toHaveProperty('height');
    } else {
      expect(captureRef).not.toHaveBeenCalled();
    }
  });

  it('does not open Messages when image capture fails', async () => {
    Platform.OS = 'ios';
    jest.mocked(captureRef).mockRejectedValueOnce(new Error('Capture failed'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(Share.shareSingle).not.toHaveBeenCalled();
  });

  it('customizes a milestone while keeping its gospel, date, and branding in both exports', () => {
    const milestone = {title: 'Today, I begin\nmy life with Jesus.', occasion: 'A NEW BEGINNING', date: 'September 22, 2026'};
    const screen = render(<TruthToCarryShareComposer visible variant="for-me-day" milestone={milestone} text={getForMeDayShareText(milestone)} onClose={jest.fn()} />);

    expect(screen.getByText('Share your New Life Day')).toBeTruthy();
    expect(screen.getByText(FOR_ME_DAY_GOSPEL)).toBeTruthy();
    expect(screen.getByText(milestone.date)).toBeTruthy();
    expect(screen.getByLabelText('Journal by siFia app icon')).toBeTruthy();
    ['Ivory', 'Sage', 'Midnight', 'Rose', 'Lavender', 'Terracotta'].forEach(color => {
      expect(screen.queryByLabelText(`Use ${color} background`)).toBeNull();
    });
    expect(screen.queryByLabelText('Use Celebration card style')).toBeNull();

    fireEvent.press(screen.getByLabelText('Edit post style'));
    ['Ivory', 'Sage', 'Midnight', 'Rose', 'Lavender', 'Terracotta'].forEach(color => {
      expect(screen.queryByLabelText(`Use ${color} background`)).toBeNull();
    });
    const keepsakeSelectorStyle = StyleSheet.flatten(screen.getByLabelText('Use Keepsake card style').props.style);
    expect(keepsakeSelectorStyle).toEqual(
      expect.objectContaining({borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)'}),
    );
    expect(keepsakeSelectorStyle.borderBottomWidth).toBeUndefined();
    fireEvent.press(screen.getByLabelText('Use Celebration card style'));
    fireEvent.press(screen.getByLabelText('Use Modern text style'));
    fireEvent.press(screen.getByLabelText('Align text left'));

    const cards = screen.UNSAFE_getAllByType(ForMeDayShareCard);
    expect(cards).toHaveLength(3); // Visible preview, post export, story export.
    cards.forEach(card => {
      expect(card.props).toEqual(expect.objectContaining({
        data: milestone, layout: 'celebration', titleFont: 'Poppins-SemiBold', textAlign: 'left', showBranding: true,
      }));
    });
    expect(cards[1].props.width).toBeGreaterThan(cards[0].props.width);
    expect(cards[2].props.width).toBeGreaterThan(cards[0].props.width);
    expect(cards[1].props.height / cards[1].props.width).toBeCloseTo(1.25);
    expect(cards[2].props.height / cards[2].props.width).toBeCloseTo(16 / 9);

    fireEvent.press(screen.getByLabelText('Close post editor'));
    expect(screen.queryByLabelText('Use Celebration card style')).toBeNull();

    fireEvent.press(screen.getByLabelText('Show Journal by siFia watermark'));
    expect(screen.queryByLabelText('Journal by siFia app icon')).toBeNull();
    screen.UNSAFE_getAllByType(ForMeDayShareCard).forEach(card => expect(card.props.showBranding).toBe(false));
    expect(screen.getByText(FOR_ME_DAY_GOSPEL)).toBeTruthy();
  });

  it('keeps the Celebration card border rounded like Keepsake', () => {
    const milestone = {title: 'Today, I begin\nmy life with Jesus.', occasion: 'A NEW BEGINNING', date: 'September 22, 2026'};
    const screen = render(
      <ForMeDayShareCard
        data={milestone}
        width={300}
        layout="celebration"
      />,
    );
    const border = screen.UNSAFE_getAllByType(RNView).find(view => view.props.pointerEvents === 'none');

    expect(StyleSheet.flatten(border?.props.style).borderRadius).toBe(12);
  });

  it('shares the full milestone and mini gospel as text', async () => {
    const milestone = {title: 'My life with Jesus\nbegan here.', occasion: '5 YEARS OF FOLLOWING JESUS', date: 'September 22, 2021'};
    const text = getForMeDayShareText(milestone);
    const screen = render(<TruthToCarryShareComposer visible variant="for-me-day" milestone={milestone} text={text} onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Text'));
    await waitFor(() => expect(Share.open).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Share your New Life Day', subject: 'My New Life Day', message: text,
    })));
    expect(text).toContain(FOR_ME_DAY_GOSPEL);
    expect(text).toContain(milestone.date);
  });

  it('applies color and photo backgrounds to the milestone preview and exports', async () => {
    const milestone = {title: 'Today, I begin\nmy life with Jesus.', occasion: 'A NEW BEGINNING', date: 'September 22, 2026'};
    const screen = render(<TruthToCarryShareComposer visible variant="for-me-day" milestone={milestone} text={getForMeDayShareText(milestone)} onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Edit post style'));
    const viewportWidth = Math.min(Dimensions.get('window').width, 480);
    const itemWidth = Math.min(viewportWidth - 72, 300) + 12;
    const carousel = screen.getByLabelText('Swipe left or right to choose a template');
    fireEvent(carousel, 'layout', {nativeEvent: {layout: {width: viewportWidth, height: 375, x: 0, y: 0}}});
    fireEvent(carousel, 'contentSizeChange', itemWidth * 26, 375);
    const scrollTo = (index: number) => {
      const nativeEvent = {
        contentOffset: {x: index * itemWidth, y: 0},
        contentSize: {width: itemWidth * 26, height: 375},
        layoutMeasurement: {width: viewportWidth, height: 375},
      };
      fireEvent.scroll(carousel, {nativeEvent});
      fireEvent(carousel, 'momentumScrollEnd', {nativeEvent});
    };

    scrollTo(1);
    await waitFor(() => {
      const sageCards = screen.UNSAFE_getAllByType(ForMeDayShareCard).filter(card => card.props.palette?.id === 'sage');
      expect(sageCards).toHaveLength(3);
    });
    scrollTo(6);
    await waitFor(() => {
      const photoCards = screen.UNSAFE_getAllByType(ForMeDayShareCard).filter(card => card.props.image);
      expect(photoCards.length).toBeGreaterThanOrEqual(3);
      photoCards.forEach(card => expect(card.props.data).toEqual(milestone));
    });
  });

  it('exports the milestone through the existing Instagram Stories action', async () => {
    Platform.OS = 'android';
    const milestone = {title: 'Today, I begin\nmy life with Jesus.', occasion: 'A NEW BEGINNING', date: 'September 22, 2026'};
    const screen = render(<TruthToCarryShareComposer visible variant="for-me-day" milestone={milestone} text={getForMeDayShareText(milestone)} onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Instagram'));
    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'instagram-stories', backgroundImage: 'file:///tmp/story.png',
    })));
  });

});
