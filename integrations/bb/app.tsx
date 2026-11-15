import { definePluginApp } from '@get-bb/plugin-sdk/app';
import { ContextTab } from './app/ContextTab';
import { ContextRow, ContextSegment, useContextSegmentVisible } from './app/ContextRow';

export default definePluginApp((app) => {
  app.slots.experimental_threadContextCardRow({
    id: 'context',
    group: '3_context',
    order: 10,
    component: ContextRow,
  });
  app.slots.experimental_threadContextSegment({
    id: 'context',
    title: 'Context',
    group: '3_context',
    order: 10,
    summary: ContextSegment,
    useVisible: useContextSegmentVisible,
  });
  app.slots.experimental_tab({
    id: 'context',
    context: { kind: 'thread' },
    availability: 'action',
    title: 'Context',
    icon: 'highwater/gauge',
    layout: 'flush',
    component: ContextTab,
  });
});
