import { fireEvent, screen } from '@testing-library/svelte';

/** Choose a session by its reference the way a person does: open the picker and click it. */
export async function chooseSession(id: string): Promise<void> {
  await fireEvent.click(screen.getByRole('combobox', { name: 'Session' }));
  const option = document.querySelector(`[role="option"][data-session-id="${CSS.escape(id)}"]`);
  if (!option) throw new Error(`Session ${id} is not offered by the picker`);
  await fireEvent.click(option);
}
