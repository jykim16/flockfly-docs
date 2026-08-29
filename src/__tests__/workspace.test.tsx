import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Flockdoc workspace', () => {
  it('uses the shared Flockfly platform shell and coastal branding', () => {
    render(<App />);
    const header = screen.getByRole('banner', { name: 'Flockfly platform navigation' });
    expect(within(header).getByLabelText('Flockfly Flockdoc')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('aria-current', 'page');
    expect(within(header).getByText('jkim@flockfly.ai')).toBeInTheDocument();
  });

  it('uses the agreed Paper, Spreadsheet, and Flockdoc terminology', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My workspace' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    const menu = screen.getByRole('menu', { name: 'Create' });
    expect(within(menu).getByRole('menuitem', { name: 'Paper' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Spreadsheet' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Folder' })).toBeInTheDocument();
  });

  it('filters the workspace and opens the selected item activity drawer', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));
    const table = screen.getByRole('table', { name: 'Flockdocs' });
    expect(within(table).getByText('Product launch brief')).toBeInTheDocument();
    expect(within(table).queryByText('2026 Planning Calendar')).not.toBeInTheDocument();
    fireEvent.click(within(table).getByText('Product launch brief'));
    expect(screen.getByRole('complementary', { name: 'Document details' })).toHaveTextContent('Comments');
  });
});
