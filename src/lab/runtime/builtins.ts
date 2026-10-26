/**
 * Packages student code can import in the lab preview. Anything else gets a friendly
 * "isn't available in this lab" error from the module system.
 */
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as RN from './rn-shim.ts';
import * as ExpoRouter from '../../runner/router-shim.tsx';
import { createPackages } from './packages.tsx';

export type BuiltinContext = {
  /** load a student file by root-relative path, e.g. 'app/index' */
  requireFile: (spec: string) => Record<string, unknown> | null;
  /** react-dom/client createRoot stand-in, so a real `main.tsx` can render <App /> */
  createRoot: (element: unknown) => { render(node: unknown): void; unmount(): void };
};

export function createBuiltins(ctx: BuiltinContext): Record<string, unknown> {
  return {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxRuntime,
    'react-native': RN,
    'react-dom/client': { createRoot: ctx.createRoot },
    // file-based routing: app/_layout.tsx, (tabs), [param] screens, <Link> and router.push all work
    'expo-router': ExpoRouter,
    'expo-router/drawer': { Drawer: ExpoRouter.Drawer },
    ...createPackages(RN),
  };
}
