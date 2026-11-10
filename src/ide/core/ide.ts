/** The objects every part of the IDE shares. Built once in app.ts. */
import type { WorkspaceFS } from './fs';
import type { Workspace } from './settings';
import type { Editors } from '../ui/editors';
import type { Explorer } from '../ui/explorer';
import type { Output, Problems } from '../ui/panels';
import type { SearchView } from '../ui/search';
import type { Workbench } from '../ui/workbench';

export type IdeUser = { name: string; email: string; role: string };
export type IDE = {
  ws: Workspace;
  fs: WorkspaceFS;
  editors: Editors;
  explorer: Explorer;
  wb: Workbench;
  output: Output;
  problems: Problems;
  search: SearchView;
  user: IdeUser | null;
};
