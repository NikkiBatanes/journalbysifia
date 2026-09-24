import {returnToMainTab} from '../returnToMainTab';

describe('returnToMainTab', () => {
  it('selects the existing tab before popping the detail screen', () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({
        routes: [
          {name: 'MainTabs', state: {key: 'main-tabs-key'}},
          {name: 'ForMeDay'},
        ],
      })),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    returnToMainTab(navigation, 'More');

    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'main-tabs-key',
        payload: expect.objectContaining({name: 'More'}),
      }),
    );
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('falls back to nested navigation when tab state is unavailable', () => {
    const navigation = {
      canGoBack: jest.fn(() => true),
      dispatch: jest.fn(),
      getState: jest.fn(() => ({routes: [{name: 'MainTabs'}]})),
      goBack: jest.fn(),
      navigate: jest.fn(),
    };

    returnToMainTab(navigation, 'More');

    expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', {
      screen: 'More',
    });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
