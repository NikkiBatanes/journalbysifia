# Reflection input color audit

All editable fields in this flow use `shared/JournalTextInput.tsx`. The default
caret, selection and Android handle color is `Colors.hopeWhite` (`#FFFEFA`).
Shared blocks pass sage only when used on light surfaces outside the dark editor.

| Entry path | Editor / inputs |
| --- | --- |
| Heart Journal: Thoughts, Notes, Reflection, Brain Dump, Lesson, Idea, Letter, Other | ReflectionLogEditor title and shared blocks |
| Custom Other name | ReflectionEditorScreen |
| Every guided journey, including My mind feels full | GuidedReflectionExperience title, full-screen writing, reference/attribution, Scripture and shared blocks |
| Choose a question | ReflectionLogEditor, with a locked prompt and shared writing blocks |
| Blocks within either column | JournalNestedBlockEditor; delegates list, table and special blocks to the same components |

Shared coverage includes Write, captures, quote author, list title and **every**
row, **every** table cell, Scripture reference, section title, action, photo
caption and voice note. Parent refs used for navigation often register only the
first input; color handling must remain local to each individual input.

Do not restore the old delayed recoloring timers: they happen after the first
visible caret. The shared input declares colors on mount and reapplies them on
its own ref attachment, press and focus without changing text/selection.

Native fixes require rebuilds:

- iOS: the React Native patch preserves tint when Fabric replaces a backing
  input. See `patches/README.md` for the upstream fix and upgrade guidance.
- Android: `SifiaEditText` supplies a tintable cursor on API 29+. A null drawable
  makes RN's cursor-color setter do nothing. Older versions retain the text-color
  fallback, since Android 9 has no supported cursor tint API.

On rebuilt iOS and Android apps, check the **first visible caret**, not just its
settled color: open each entry path, focus/edit a title, add Write inside both
columns, focus a second list row and non-first table cell, edit quote attribution,
then switch guided steps and reopen an entry. Also check text-selection handles.
Check shared blocks on light Session Notes surfaces remain sage.

Jest verifies mount-time props, correct native-ref targeting, ref forwarding,
tone changes and the shared-input boundary. It cannot verify the OS-rendered
first frame; a native build alone does not establish that visual result either.
