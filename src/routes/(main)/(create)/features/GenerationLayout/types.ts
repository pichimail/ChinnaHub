'use client';

export interface GenerationLayoutCommonProps {
  breadcrumb: { href: string; title: string }[];
  generationTopicsSelector: (s: any) => any;
  namespace: 'audio' | 'image' | 'video';
  navKey: string;
  useStore: (selector: (s: any) => any) => any;
  viewModeStatusKey: 'audioTopicViewMode' | 'imageTopicViewMode' | 'videoTopicViewMode';
}
