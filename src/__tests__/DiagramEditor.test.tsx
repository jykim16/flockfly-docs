import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { Flockdoc } from '../types';
import { DiagramEditor } from '../features/editor/DiagramEditor';

vi.mock('@excalidraw/excalidraw', () => {
  const menuItem = (name: string) => () => <span data-menu-item={name} />;
  const MainMenu = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <div data-testid="excalidraw-main-menu">{children}</div>,
    {
      DefaultItems: {
        SaveAsImage: menuItem('save-as-image'),
        SearchMenu: menuItem('search'),
        Help: menuItem('help'),
        ClearCanvas: menuItem('clear-canvas'),
      },
    },
  );
  return {
    CaptureUpdateAction: { NEVER: 'never' },
    Excalidraw: vi.fn(({ children }: { children?: React.ReactNode }) => <div data-testid="excalidraw">{children}</div>),
    MainMenu,
  };
});

const item: Flockdoc = {
  id: 'diagram-1',
  name: 'Architecture',
  type: 'diagram',
  prefix: '',
  modifiedAt: 'Just now',
  collaborators: [],
  permissions: { canRead: true, canComment: true, canEdit: true, canShare: true, canDelete: true },
  snapshot: { elements: [] },
};

describe('DiagramEditor Excalidraw menu', () => {
  it('keeps only the Excalidraw controls supported by Flockdocs', async () => {
    const { container } = render(<DiagramEditor item={item} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} />);

    await waitFor(() => expect(Excalidraw).toHaveBeenCalledOnce());
    const props = vi.mocked(Excalidraw).mock.lastCall![0] as Record<string, unknown>;

    expect(props.aiEnabled).toBe(false);
    expect(props.UIOptions).toEqual({
      canvasActions: {
        changeViewBackgroundColor: false,
        clearCanvas: true,
        export: false,
        loadScene: false,
        saveAsImage: true,
        saveToActiveFile: false,
        toggleTheme: false,
      },
      tools: { image: false },
    });
    expect([...container.querySelectorAll('[data-menu-item]')].map(node => node.getAttribute('data-menu-item'))).toEqual([
      'save-as-image',
      'search',
      'help',
      'clear-canvas',
    ]);
  });
});
