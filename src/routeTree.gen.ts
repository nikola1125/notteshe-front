/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ShopRouteImport } from './routes/shop'
import { Route as ShopSlugRouteImport } from './routes/shop/$slug'
import { Route as CheckoutRouteImport } from './routes/checkout'

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

const CheckoutRoute = CheckoutRouteImport.update({
  id: '/checkout',
  path: '/checkout',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/shop' | '/shop/$slug' | '/checkout'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/shop' | '/shop/$slug' | '/checkout'
  id: '__root__' | '/' | '/shop' | '/shop/$slug' | '/checkout'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ShopRoute: typeof ShopRoute
  ShopSlugRoute: typeof ShopSlugRoute
  CheckoutRoute: typeof CheckoutRoute
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
    '/checkout': {
      id: '/checkout'
      path: '/checkout'
      fullPath: '/checkout'
      preLoaderRoute: typeof CheckoutRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ShopRoute: ShopRoute,
  ShopSlugRoute: ShopSlugRoute,
  CheckoutRoute: CheckoutRoute,
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
