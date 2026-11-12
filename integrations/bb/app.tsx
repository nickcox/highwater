import { definePluginApp } from '@get-bb/plugin-sdk/app';
import { ContextTab } from './app/ContextTab';

export default definePluginApp((app) => {
  app.slots.experimental_tab({
    id: 'context',
    context: { kind: 'thread' },
    availability: 'action',
    title: 'Context',
    icon: 'ChartNoAxesCombined',
    layout: 'flush',
    component: ContextTab,
  });
});
