import { useMobile } from './use-mobile';

export type LayoutMode = 'desktop' | 'mobile';

export function useEditorLayout() {
  const isMobile = useMobile();

  const layoutMode: LayoutMode = isMobile ? 'mobile' : 'desktop';

  return {
    layoutMode,
    isMobile,
    isDesktop: !isMobile,
  };
}
