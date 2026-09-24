import React from 'react';
import {FlatList, Pressable, ScrollView, Text} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {
  WeeklyReviewMomentsList,
  type ReviewMomentGroup,
} from '../WeeklyReviewMomentsList';
import type {ReviewCaptureItem} from '../../../services/reviewCaptureService';

const moment = (
  id: string,
  selectedDate = '2026-09-17',
): ReviewCaptureItem => ({
  id,
  selectedDate,
  kind: 'gratitude',
  presentation: 'gratitude_list',
  title: id,
  lines: [id],
});

const sharedProps = {
  cardWidth: 310,
  header: <Text>Moments from this week</Text>,
  empty: <Text>No moments this week</Text>,
  renderGroupHeader: (group: ReviewMomentGroup) => <Text>{group.title}</Text>,
};

it('shows the heading immediately and mounts only nearby cards from a busy week', () => {
  const groups: ReviewMomentGroup[] = Array.from(
    {length: 12},
    (_groupValue, index) => ({
      key: `group-${index}`,
      title: `Group ${index}`,
      presentation: 'gratitude_list',
      items: Array.from({length: 50}, (_cardValue, card) =>
        moment(`${index}-${card}`),
      ),
    }),
  );
  const renderCard = jest.fn(({item}: {item: ReviewCaptureItem}) => (
    <Text>{item.title}</Text>
  ));
  const screen = render(
    <WeeklyReviewMomentsList
      {...sharedProps}
      groups={groups}
      renderCard={renderCard}
    />,
  );

  expect(screen.getByText('Moments from this week')).toBeVisible();
  expect(screen.getByText('0-0')).toBeVisible();
  expect(renderCard).toHaveBeenCalledTimes(4);
  expect(screen.queryByText('11-49')).toBeNull();
});

it('updates bookmarks on mounted cards when the parent selection changes', () => {
  const groups: ReviewMomentGroup[] = [
    {
      key: 'gratitude',
      title: 'Gratitudes',
      presentation: 'gratitude_list',
      items: [moment('Quiet morning')],
    },
  ];
  const Harness = () => {
    const [selected, setSelected] = React.useState(false);
    return (
      <WeeklyReviewMomentsList
        {...sharedProps}
        groups={groups}
        renderCard={({item}) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={item.title}
            accessibilityState={{checked: selected}}
            onPress={() => setSelected(value => !value)}>
            <Text>{item.title}</Text>
          </Pressable>
        )}
      />
    );
  };
  const screen = render(<Harness />);

  fireEvent.press(screen.getByRole('checkbox', {name: 'Quiet morning'}));
  expect(
    screen.getByRole('checkbox', {name: 'Quiet morning', checked: true}),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('checkbox', {name: 'Quiet morning'}));
  expect(
    screen.getByRole('checkbox', {name: 'Quiet morning', checked: false}),
  ).toBeTruthy();
});

it('renders later cards when their carousel is scrolled', () => {
  jest.useFakeTimers();
  try {
    const groups: ReviewMomentGroup[] = [
      {
        key: 'gratitude',
        title: 'Gratitudes',
        presentation: 'gratitude_list',
        items: Array.from({length: 20}, (_, index) =>
          moment(`Moment ${index}`),
        ),
      },
    ];
    const screen = render(
      <WeeklyReviewMomentsList
        {...sharedProps}
        groups={groups}
        renderCard={({item}) => <Text>{item.title}</Text>}
      />,
    );
    expect(screen.queryByText('Moment 6')).toBeNull();

    const carousel = screen
      .UNSAFE_getAllByType(FlatList)
      .find(list => list.props.horizontal)!;
    const scrollView = carousel.findByType(ScrollView);
    fireEvent(scrollView, 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 386, height: 220}},
    });
    fireEvent(scrollView, 'contentSizeChange', 6484, 220);
    fireEvent.scroll(scrollView, {
      nativeEvent: {
        contentOffset: {x: 1932, y: 0},
        contentSize: {width: 6484, height: 220},
        layoutMeasurement: {width: 386, height: 220},
      },
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByText('Moment 6')).toBeVisible();
    screen.unmount();
  } finally {
    jest.useRealTimers();
  }
});

it('keeps all of a day’s to-dos together in one card', () => {
  const groups: ReviewMomentGroup[] = [
    {
      key: 'todos',
      title: 'To-dos',
      presentation: 'todo',
      items: [
        moment('Call', '2026-09-17'),
        moment('Visit', '2026-09-17'),
        moment('Rest', '2026-09-18'),
      ],
    },
  ];
  const screen = render(
    <WeeklyReviewMomentsList
      {...sharedProps}
      groups={groups}
      renderCard={({relatedItems}) => (
        <Text>{relatedItems.map(item => item.title).join(', ')}</Text>
      )}
    />,
  );

  expect(screen.getByText('Call, Visit')).toBeVisible();
  expect(screen.getByText('Rest')).toBeVisible();
});

it('shows the empty state with the page heading', () => {
  const renderCard = jest.fn(() => <Text>Unexpected card</Text>);
  const screen = render(
    <WeeklyReviewMomentsList
      {...sharedProps}
      groups={[]}
      renderCard={renderCard}
    />,
  );

  expect(screen.getByText('Moments from this week')).toBeVisible();
  expect(screen.getByText('No moments this week')).toBeVisible();
  expect(renderCard).not.toHaveBeenCalled();
});

it('reports when a swipe starts and ends inside a moments carousel', () => {
  const onCarouselTouchStart = jest.fn();
  const onCarouselTouchEnd = jest.fn();
  const groups: ReviewMomentGroup[] = [
    {
      key: 'gratitude',
      title: 'Gratitudes',
      presentation: 'gratitude_list',
      items: [moment('Quiet morning')],
    },
  ];
  const screen = render(
    <WeeklyReviewMomentsList
      {...sharedProps}
      groups={groups}
      onCarouselTouchStart={onCarouselTouchStart}
      onCarouselTouchEnd={onCarouselTouchEnd}
      renderCard={({item}) => <Text>{item.title}</Text>}
    />,
  );
  const carousel = screen
    .UNSAFE_getAllByType(FlatList)
    .find(list => list.props.horizontal)!;

  carousel.props.onTouchStart();
  expect(onCarouselTouchStart).toHaveBeenCalledTimes(1);
  carousel.props.onTouchEnd();
  expect(onCarouselTouchEnd).toHaveBeenCalledTimes(1);
});
