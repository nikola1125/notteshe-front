/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ShopRouteImport } from './routes/shop'
import { Route as ShopIndexRouteImport } from './routes/shop/index'
import { Route as ShopSlugRouteImport } from './routes/shop/$slug'
import { Route as CheckoutRouteImport } from './routes/checkout'
import { Route as WishlistRouteImport } from './routes/wishlist'

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

const ShopIndexRoute = ShopIndexRouteImport.update({
  id: '/shop/',
  path: '/',
  getParentRoute: () => ShopRoute,
} as any)

const ShopSlugRoute = ShopSlugRouteImport.update({
  id: '/shop/$slug',
  path: '$slug',
  getParentRoute: () => ShopRoute,
} as any)

const CheckoutRoute = CheckoutRouteImport.update({
  id: '/checkout',
  path: '/checkout',
  getParentRoute: () => rootRouteImport,
} as any)

const WishlistRoute = WishlistRouteImport.update({
  id: '/wishlist',
  path: '/wishlist',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/shop': typeof ShopIndexRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
  '/wishlist': typeof WishlistRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/shop': typeof ShopIndexRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
  '/wishlist': typeof WishlistRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/shop': typeof ShopRoute
  '/shop/': typeof ShopIndexRoute
  '/shop/$slug': typeof ShopSlugRoute
  '/checkout': typeof CheckoutRoute
  '/wishlist': typeof WishlistRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/shop' | '/shop/$slug' | '/checkout' | '/wishlist'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/shop' | '/shop/$slug' | '/checkout' | '/wishlist'
  id: '__root__' | '/' | '/shop' | '/shop/' | '/shop/$slug' | '/checkout' | '/wishlist'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ShopRoute: typeof ShopRoute
  CheckoutRoute: typeof CheckoutRoute
  WishlistRoute: typeof WishlistRoute
}
export interface ShopRouteChildren {
  ShopIndexRoute: typeof ShopIndexRoute
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
    '/shop/': {
      id: '/shop/'
      path: '/'
      fullPath: '/shop/'
      preLoaderRoute: typeof ShopIndexRouteImport
      parentRoute: typeof ShopRouteImport
    }
    '/shop/$slug': {
      id: '/shop/$slug'
      path: '$slug'
      fullPath: '/shop/$slug'
      preLoaderRoute: typeof ShopSlugRouteImport
      parentRoute: typeof ShopRouteImport
    }
    '/checkout': {
      id: '/checkout'
      path: '/checkout'
      fullPath: '/checkout'
      preLoaderRoute: typeof CheckoutRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/wishlist': {
      id: '/wishlist'
      path: '/wishlist'
      fullPath: '/wishlist'
      preLoaderRoute: typeof WishlistRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const ShopRouteWithChildren = ShopRoute._addFileChildren({
  ShopIndexRoute: ShopIndexRoute,
  ShopSlugRoute: ShopSlugRoute,
} as any)

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  ShopRoute: ShopRouteWithChildren,
  CheckoutRoute: CheckoutRoute,
  WishlistRoute: WishlistRoute,
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
