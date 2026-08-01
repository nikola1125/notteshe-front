/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ShopRouteImport } from './routes/shop'
import { Route as ShopSlugRouteImport } from './routes/shop/$slug'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

const ShopRoute = ShopRouteImport.update({
  id: '/shop',
  path: '/shop',
  getParentRoute: () => rootRouteImport,
} as any)

const ShopSlugRoute = ShopSlugRouteImport.update({
  id: '/shop/$slug',
  path: '/shop/$slug',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/shop' | '/shop/$slug'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/shop' | '/shop/$slug'
  id: '__root__' | '/' | '/shop' | '/shop/$slug'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ShopRoute: typeof ShopRoute
  ShopSlugRoute: typeof ShopSlugRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/shop': {
      id: '/shop'
      path: '/shop'
      fullPath: '/shop'
      preLoaderRoute: typeof ShopRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/shop/$slug': {
      id: '/shop/$slug'
      path: '/shop/$slug'
      fullPath: '/shop/$slug'
      preLoaderRoute: typeof ShopSlugRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ShopRoute: ShopRoute,
  ShopSlugRoute: ShopSlugRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
