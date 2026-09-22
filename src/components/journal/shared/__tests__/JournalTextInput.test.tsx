import React from 'react';
import {TextInput} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import JournalTextInput from '../JournalTextInput';
import {JournalListBlock} from '../JournalListBlock';
import {JournalTableBlock} from '../JournalTableBlock';
import JournalColumnBlock from '../JournalColumnBlock';
import JournalNestedBlockEditor from '../JournalNestedBlockEditor';
import {type JournalBlock} from '../journalBlocks';
import {Colors} from '../../../../theme/colors';

jest.mock('../../../../hooks/useTheme', () => ({useTheme: () => ({currentFont: 'lexend'})}));
jest.mock('../../../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('lucide-react-native', () => ({Pencil: 'Pencil'}));
jest.mock('../../ReflectionSpecialBlock', () => 'ReflectionSpecialBlock');

const ivory = {
  selectionColor: Colors.hopeWhite,
  cursorColor: Colors.hopeWhite,
  selectionHandleColor: Colors.hopeWhite,
};

describe('journal input native color lifecycle', () => {
  it('provides ivory before autoFocus and before the parent can focus its ref', () => {
    const apply = jest.spyOn(TextInput.prototype, 'setNativeProps');
    const onFocus = jest.fn();
    const register = jest.fn((input: TextInput | null) => {
      if (input) {
        expect(apply).toHaveBeenCalledWith(ivory);
        input.focus();
      }
    });
    const view = render(<JournalTextInput testID="title" autoFocus ref={register} onFocus={onFocus} />);
    expect(view.getByTestId('title').props).toMatchObject({...ivory, autoFocus: true});
    fireEvent(view.getByTestId('title'), 'focus', {nativeEvent: {}});
    expect(onFocus).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(register).toHaveBeenLastCalledWith(null);
    apply.mockRestore();
  });

  it('keeps light-surface inputs sage, including after a tone change', () => {
    const ref = React.createRef<TextInput>();
    const view = render(<JournalTextInput themed ref={ref} testID="note" />);
    expect(view.getByTestId('note').props).toMatchObject(ivory);
    view.rerender(<JournalTextInput themed ref={ref} testID="note" accentColor={Colors.sage} />);
    const apply = jest.spyOn(ref.current!, 'setNativeProps');
    fireEvent(view.getByTestId('note'), 'pressIn', {nativeEvent: {}});
    expect(apply).toHaveBeenLastCalledWith({
      selectionColor: Colors.sage, cursorColor: Colors.sage, selectionHandleColor: Colors.sage,
    });
    apply.mockRestore();
  });

  it('colors and refreshes the actual list row and table cell, not only the registered first input', () => {
    const view = render(<>
      <JournalListBlock kind="bullets" points={['first', 'second']} tone="onDark"
        onChangeTitle={jest.fn()} onChangePoints={jest.fn()} onDelete={jest.fn()} />
      <JournalTableBlock rows={[['heading 1', 'heading 2'], ['cell 1', 'cell 2']]} editing tone="onDark"
        onChangeRows={jest.fn()} onChangeCellAlignments={jest.fn()} onChangeEditing={jest.fn()} onDelete={jest.fn()} />
    </>);
    const inputs = view.UNSAFE_getAllByType(TextInput);
    expect(inputs).toHaveLength(7);
    const originalSetters = inputs.map(input => input.instance.setNativeProps);
    const spies = inputs.map(input => (input.instance.setNativeProps = jest.fn()));
    inputs.forEach((input, index) => {
      expect(input.props).toMatchObject(ivory);
      spies.forEach(spy => spy.mockClear());
      fireEvent(input, 'focus', {nativeEvent: {}});
      expect(spies[index]).toHaveBeenCalledWith(ivory);
      // The focused input is refreshed first. Table focus may then re-render
      // and reattach sibling refs as it changes the active alignment cell.
      expect(spies[index].mock.invocationCallOrder[0]).toBe(Math.min(
        ...spies.flatMap(spy => spy.mock.invocationCallOrder),
      ));
    });
    inputs.forEach((input, index) => {input.instance.setNativeProps = originalSetters[index];});
  });

  it('covers the quote and its separate author input inside a column', () => {
    const onChange = jest.fn();
    const view = render(<JournalNestedBlockEditor
      block={{id: 'column-quote', kind: 'quote', text: '', secondary: ''}}
      tone="onDark" onChange={onChange} onDelete={jest.fn()} onFocus={jest.fn()} />);
    const inputs = view.UNSAFE_getAllByType(TextInput);
    expect(inputs).toHaveLength(2);
    inputs.forEach(input => expect(input.props).toMatchObject(ivory));
    fireEvent.changeText(view.getByPlaceholderText('— Speaker / Author'), 'Author');
    expect(onChange).toHaveBeenCalledWith({secondary: '— Author'});
  });

  it('keeps newly added table rows and columns ivory after saving and reopening the grid', () => {
    const TableHarness = () => {
      const [rows, setRows] = React.useState([['', ''], ['', '']]);
      const [editing, setEditing] = React.useState(false);
      return <JournalTableBlock rows={rows} editing={editing} tone="onDark"
        onChangeRows={setRows} onChangeEditing={setEditing}
        onChangeCellAlignments={jest.fn()} onDelete={jest.fn()} />;
    };
    const view = render(<TableHarness />);
    fireEvent.press(view.getByLabelText('Edit table'));
    fireEvent.press(view.getByLabelText('Add row'));
    fireEvent.press(view.getByLabelText('Add column'));
    const inputs = view.UNSAFE_getAllByType(TextInput);
    expect(inputs).toHaveLength(9);
    inputs.forEach(input => expect(input.props).toMatchObject(ivory));
    fireEvent.changeText(inputs[8], 'New bottom-right cell');
    fireEvent.press(view.getByLabelText('Save table'));
    expect(view.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    fireEvent.press(view.getByLabelText('Edit table'));
    const reopened = view.UNSAFE_getAllByType(TextInput);
    expect(reopened).toHaveLength(9);
    reopened.forEach(input => expect(input.props).toMatchObject(ivory));
    expect(view.getByDisplayValue('New bottom-right cell').props).toMatchObject(ivory);
  });

  it('applies ivory when Write fields are inserted into either column', () => {
    const onSelectSide = jest.fn();
    const renderColumns = (leftBlocks: JournalBlock[], rightBlocks: JournalBlock[]) => (
      <JournalColumnBlock leftBlocks={leftBlocks} rightBlocks={rightBlocks}
        tone="onDark" onSelectSide={onSelectSide} onDelete={jest.fn()}
        renderBlock={block => <JournalNestedBlockEditor key={block.id} block={block}
          tone="onDark" onChange={jest.fn()} onFocus={jest.fn()} onDelete={jest.fn()} />} />
    );
    const view = render(renderColumns([], []));
    const left: JournalBlock = {id: 'left-write', kind: 'text', text: 'Left', columnSide: 'left'};
    const right: JournalBlock = {id: 'right-write', kind: 'text', text: 'Right', columnSide: 'right'};
    fireEvent.press(view.getByLabelText('Select left column'));
    expect(onSelectSide).toHaveBeenLastCalledWith('left');
    view.rerender(renderColumns([left], []));
    expect(view.getByDisplayValue('Left').props).toMatchObject(ivory);
    fireEvent.press(view.getByLabelText('Select right column'));
    expect(onSelectSide).toHaveBeenLastCalledWith('right');
    view.rerender(renderColumns([left], [right]));
    expect(view.getByDisplayValue('Right').props).toMatchObject(ivory);
    expect(view.getByDisplayValue('Left').props).toMatchObject(ivory);
  });
});
