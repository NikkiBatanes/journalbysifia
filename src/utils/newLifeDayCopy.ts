export interface NewLifeDayCopy {
  title: string;
  subtitle: string;
}

export const getNewLifeDayCopy = (hasSavedDate: boolean): NewLifeDayCopy =>
  hasSavedDate
    ? {
        title: 'My New Life Day',
        subtitle: 'The day I said yes to Jesus.',
      }
    : {
        title: 'The Day I Say Yes',
        subtitle: 'You can add this when you’re ready.',
      };
