import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Flockdoc workspace', () => {
  it('uses the shared Flockfly platform shell and coastal branding', () => {
    render(<App />);
    const header = screen.getByRole('banner', { name: 'Flockfly platform navigation' });
    expect(within(header).getByLabelText('Flockfly Flockdoc')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Flockdoc' })).toHaveAttribute('aria-current', 'page');
    expect(within(header).getByText('Preview workspace')).toBeInTheDocument();
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

  it('starts without seeded documents or mock collaboration data', () => {
    render(<App />);
    const table = screen.getByRole('table', { name: 'Flockdocs' });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText('No flockdocs yet')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Document details' })).not.toBeInTheDocument();
    expect(screen.getByText('Storage data unavailable')).toBeInTheDocument();
  });
});
