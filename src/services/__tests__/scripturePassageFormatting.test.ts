import {formatScripturePassage, usesPoetryLayout} from '../scripturePassageFormatting';

describe('scripture passage formatting', () => {
  const proseVerses = [
    {number: '21', lines: ['Then Peter asked Jesus a question.']},
    {
      number: '22',
      lines: ['Jesus said, “Keep forgiving.”'],
      segments: [[
        {text: 'Jesus said, '},
        {text: '“Keep forgiving.”', wordsOfJesus: true},
      ]],
    },
  ];

  it('flows prose verses together with small-number and red-letter ranges', () => {
    expect(formatScripturePassage(proseVerses, 'Matthew 18:21-22')).toEqual({
      text: '21 Then Peter asked Jesus a question. 22 Jesus said, “Keep forgiving.”',
      verseNumberRanges: [{start: 0, end: 2}, {start: 38, end: 40}],
      wordsOfJesusRanges: [{start: 53, end: 70}],
      poetryLayout: false,
    });
  });

  it.each(['Psalm 23', 'Psalms 119:1-2', 'Proverbs 3:5-6'])(
    'puts each poetry verse on its own line for %s',
    reference => {
      const formatted = formatScripturePassage(proseVerses, reference);
      expect(formatted.text).toContain('question.\n22 Jesus');
      expect(formatted.poetryLayout).toBe(true);
    },
  );

  it('keeps prose books in a continuous paragraph', () => {
    expect(usesPoetryLayout('Matthew 18')).toBe(false);
    expect(formatScripturePassage(proseVerses, 'Matthew 18').text).not.toContain('\n');
  });
});
