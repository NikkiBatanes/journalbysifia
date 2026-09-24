import {getNewLifeDayCopy} from '../newLifeDayCopy';

describe('New Life Day copy', () => {
  it('is future-facing until a date has been saved', () => {
    expect(getNewLifeDayCopy(false)).toEqual({
      title: 'The Day I Say Yes',
      subtitle: 'You can add this when you’re ready.',
    });
  });

  it('becomes personal and commemorative after a date is saved', () => {
    expect(getNewLifeDayCopy(true)).toEqual({
      title: 'My New Life Day',
      subtitle: 'The day I said yes to Jesus.',
    });
  });
});
