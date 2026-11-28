import { fireEvent, screen } from '@testing-library/svelte';

/** Choose a session by its reference the way a person does: open the picker and click it. */
export async function chooseSession(id: string): Promise<void> {
  const control = screen.getByRole('button', { name: /^Session:/ });
  if (control.getAttribute('aria-expanded') !== 'true') await fireEvent.click(control);
  const option = document.querySelector(`[role="grid"] [data-session-id="${CSS.escape(id)}"]`);
  if (!option) throw new Error(`Session ${id} is not offered by the picker`);
  await fireEvent.click(option);
}
