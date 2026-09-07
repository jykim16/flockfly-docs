import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorFocusModeControl } from '../features/editor/EditorFocusModeControl';

describe('EditorFocusModeControl', () => {
  afterEach(() => document.body.classList.remove('flockdoc-focus-mode'));

  it('enters focus mode and makes the Flockfly interface easy to restore', () => {
    render(<EditorFocusModeControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    expect(document.body).toHaveClass('flockdoc-focus-mode');
    expect(screen.getByRole('button', { name: 'Back to Flockfly' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Flockfly' }));
    expect(document.body).not.toHaveClass('flockdoc-focus-mode');
  });

  it('restores the Flockfly interface with Escape', () => {
    render(<EditorFocusModeControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter full screen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.body).not.toHaveClass('flockdoc-focus-mode');
  });
});
