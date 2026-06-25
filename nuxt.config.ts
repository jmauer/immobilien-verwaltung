// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase'
  ],

  devtools: {
    enabled: true
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Immobilienverwaltung',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // Nur das tatsächlich genutzte Icon-Set serverseitig bündeln. Sonst würde
  // @nuxt/icon das riesige simple-icons-Set mitbündeln und den Build (OOM) killen.
  icon: {
    serverBundle: {
      collections: ['lucide']
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  supabase: {
    // Unangemeldete Nutzer werden auf /login umgeleitet.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login', '/registrieren', '/onboarding'],
      saveRedirectToCookie: true
    }
  }
})
