export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },

    // Liquid-Glass-Theming – die .glass/.glass-soft-Klassen kommen aus main.css.
    card: {
      slots: {
        root: 'glass ring-0 rounded-2xl'
      }
    },
    modal: {
      slots: {
        content: 'glass ring-0 rounded-2xl',
        overlay: 'bg-black/30 backdrop-blur-sm'
      }
    },
    popover: {
      slots: {
        content: 'glass ring-0 rounded-2xl'
      }
    },
    dropdownMenu: {
      slots: {
        content: 'glass ring-0 rounded-xl'
      }
    },
    tooltip: {
      slots: {
        content: 'glass ring-0 rounded-lg text-highlighted'
      }
    },
    input: {
      slots: {
        base: 'glass-soft rounded-xl'
      }
    },
    textarea: {
      slots: {
        base: 'glass-soft rounded-xl'
      }
    },
    select: {
      slots: {
        base: 'glass-soft rounded-xl',
        content: 'glass ring-0 rounded-xl'
      }
    },
    selectMenu: {
      slots: {
        base: 'glass-soft rounded-xl',
        content: 'glass ring-0 rounded-xl'
      }
    },
    button: {
      slots: {
        base: 'rounded-xl'
      }
    },
    tabs: {
      slots: {
        list: 'glass-soft rounded-xl',
        indicator: 'rounded-lg'
      }
    }
  }
})
