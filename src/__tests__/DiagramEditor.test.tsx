import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { Flockdoc } from '../types';
import { DiagramEditor } from '../features/editor/DiagramEditor';

const excalidrawState = vi.hoisted(() => ({ updateScene: vi.fn() }));

vi.mock('@excalidraw/excalidraw', () => {
  const api = { id: 'excalidraw-api', updateScene: excalidrawState.updateScene, getSceneElements: vi.fn(() => []) };
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
    Excalidraw: vi.fn(({ children, excalidrawAPI }: { children?: React.ReactNode; excalidrawAPI?: (api: object) => void }) => {
      excalidrawAPI?.(api);
      return <div data-testid="excalidraw">{children}</div>;
    }),
    MainMenu,
    useHandleLibrary: vi.fn(),
  };
});

afterEach(() => {
  document.modelContext = undefined;
  excalidrawState.updateScene.mockReset();
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

describe('DiagramEditor Excalidraw integration', () => {
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

  it('connects Excalidraw library callbacks to the originating Diagram tab', async () => {
    const originalName = window.name;
    window.name = 'existing-window-name';
    const { useHandleLibrary } = await import('@excalidraw/excalidraw');
    const { unmount } = render(<DiagramEditor item={item} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} />);

    await waitFor(() => expect(Excalidraw).toHaveBeenCalled());
    const props = vi.mocked(Excalidraw).mock.lastCall![0] as Record<string, unknown>;
    expect(window.name).toBe('flockdocdiagram1');
    expect(props.libraryReturnUrl).toBe(`${location.origin}${location.pathname}`);
    await waitFor(() => expect(useHandleLibrary).toHaveBeenCalledWith({
      excalidrawAPI: expect.objectContaining({ id: 'excalidraw-api' }),
    }));

    unmount();
    expect(window.name).toBe('existing-window-name');
    window.name = originalName;
  });

  it('routes Diagram WebMCP writes through Excalidraw and collaborative persistence', async () => {
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<unknown> | unknown }>();
    document.modelContext = { registerTool: (tool, options) => {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
    } };
    const onDiagramSceneChange = vi.fn().mockResolvedValue(undefined);
    const view = render(<DiagramEditor item={item} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} onDiagramSceneChange={onDiagramSceneChange} />);

    await waitFor(() => expect(tools.has('upsert_diagram_elements')).toBe(true));
    await tools.get('upsert_diagram_elements')?.execute({ elements: [{ id: 'box-1', type: 'rectangle' }] });
    expect(excalidrawState.updateScene).toHaveBeenCalledWith({ elements: [{ id: 'box-1', type: 'rectangle' }], captureUpdate: 'never' });
    expect(onDiagramSceneChange).toHaveBeenCalledWith({ elements: [{ id: 'box-1', type: 'rectangle' }] });

    view.unmount();
    expect(tools.size).toBe(0);
  });
});
