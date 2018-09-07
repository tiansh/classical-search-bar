; (async function () {

  const callBackend = new Proxy({}, {
    get: (empty, method) => (...params) => (
      browser.runtime.sendMessage({ method, params })
    ),
  });

  const domReady = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve());
  });

  const [
    searchProviderList,
    defaultSearchProvider,
  ] = await Promise.all([
    callBackend.getList(),
    callBackend.getDefault(),
  ]);

  const menuItems = searchProviderList.map(({ id, name, favicon_url }) => {
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById('menuitem');
    const content = template.content;
    const menuText = content.querySelector('.text');
    menuText.textContent = name;
    const menuIcon = content.querySelector('.icon img');
    menuIcon.src = favicon_url;
    const menuItem = content.querySelector('.menuitem');
    menuItem.dataset.id = id;
    if (id === defaultSearchProvider.id) {
      menuItem.classList.add('current', 'active');
      menuItem.setAttribute('aria-current', 'true');
    } else {
      menuItem.classList.remove('current', 'active');
      menuItem.removeAttribute('aria-current');
    }
    return document.importNode(menuItem, true);
  });
  document.getElementById('menu').append(...menuItems);

  const eventMenuItem = event => {
    const target = event.target;
    const menuitem = target.closest && target.closest('.menuitem');
    return menuitem;
  };
  const currentMenuItem = () => {
    return menuItems.find(item => item.classList.contains('current'));
  };
  const scrollCurrentIntoView = () => {
    currentMenuItem().scrollIntoView({ behavior: 'instant', block: 'nearest' });
  };
  const setCurrentMenuItem = current => {
    menuItems.forEach(item => {
      if (item === current) {
        item.classList.add('current');
        item.setAttribute('aria-current', 'true');
        if (document.activeElement !== item) item.focus();
      } else {
        item.classList.remove('current');
        item.removeAttribute('aria-current');
      }
    });
  };
  const choseMenuItem = item => {
    const id = item && +item.dataset.id || item.dataset.id;
    if (!id) return;
    callBackend.setDefault(id).then(() => {
      window.close();
    });
  };
  document.addEventListener('click', event => {
    if (event.button !== 0) return;
    const item = eventMenuItem(event);
    choseMenuItem(item);
  });
  document.addEventListener('mousemove', event => {
    const item = eventMenuItem(event);
    if (item) setCurrentMenuItem(item);
  });
  document.addEventListener('keydown', event => {
    const key = event.keyCode;
    if ([38, 40].includes(key)) {
      const current = currentMenuItem();
      const index = menuItems.indexOf(current);
      const next = index + (key === 38 ? -1 : 1);
      const newIndex = next < 0 ?
        menuItems.length - 1 :
        next >= menuItems.length ? 0 : next;
      setCurrentMenuItem(menuItems[newIndex]);
      scrollCurrentIntoView();
    } else if (48 < key && key < 58) {
      const index = key - 48 - 1;
      if (index < menuItems.length) {
        choseMenuItem(menuItems[index]);
      }
    } else if (key === 13 || key === 32) {
      choseMenuItem(currentMenuItem());
    } else return;
    event.preventDefault();
  });
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
  });
  document.addEventListener('focusin', event => {
    const item = eventMenuItem(event);
    setCurrentMenuItem(item);
  });
  scrollCurrentIntoView();

  ; (async function () {
    const themeStorage = (await browser.storage.sync.get('theme')).theme;
    const themeType = { Auto: 'Auto', Dark: 'Dark', Light: 'Light' }[themeStorage && themeStorage.type] || 'Auto';
    const rootStyle = document.documentElement.style;

    if (themeType === 'Auto') {
      const [theme, extensions] = await Promise.all([
        browser.theme.getCurrent(),
        browser.management.getAll(),
      ]);
      const currentTheme = extensions.find(extension => [
        'default-theme@mozilla.org',
        'firefox-compact-light@mozilla.org@personas.mozilla.org',
        'firefox-compact-dark@mozilla.org@personas.mozilla.org',
        'firefox-compact-light@mozilla.org',
        'firefox-compact-dark@mozilla.org',
      ].includes(extension.id) && extension.enabled);
      if (currentTheme) {
        if ([
          'firefox-compact-dark@mozilla.org@personas.mozilla.org',
          'firefox-compact-dark@mozilla.org',
        ].includes(currentTheme.id)) {
          rootStyle.setProperty('--popup', '#4a4a4f');
          rootStyle.setProperty('--popup-text', '#f9f9fa');
        }
      }
      ['popup', 'popup_text'].forEach(key => {
        const color = (theme.colors || {})[key];
        if (!color) return;
        const value = Array.isArray(color) ? `rgb(${color})` : color;
        const cssKey = key.replace(/_/g, '-');
        rootStyle.setProperty(`--${cssKey}`, value);
      });
    } if (themeType === 'Dark') {
      rootStyle.setProperty('--popup', '#4a4a4f');
      rootStyle.setProperty('--popup-text', '#f9f9fa');
    }

  }());

}());
