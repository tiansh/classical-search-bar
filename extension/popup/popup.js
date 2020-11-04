; (async function () {

  const callBackend = new Proxy({}, {
    get: (empty, method) => (...params) => (
      browser.runtime.sendMessage({ method, params })
    ),
  });

  const domReady = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve());
  });

  /**
   * @typedef {Object} SearchProviderView
   * @property {number} id
   * @property {'provider'} type
   * @property {string} name
   * @property {string} favicon_url
   * @property {boolean} active
   * @property {boolean} separator
   */
  /**
   * @typedef {Object} SearchProviderFolderView
   * @property {number} id
   * @property {'folder'} type
   * @property {string} name
   * @property {SearchProviderViewList} children
   * @property {SearchProviderFolderView|SearchProviderRootView} parent
   * @property {boolean} active
   */
  /**
   * @typedef {Object} SearchProviderRootView
   * @property {'root'} type
   * @property {SearchProviderViewList} children
   */
  /**
   * @typedef {(SearchProviderView|SearchProviderFolderView)[]} SearchProviderViewList
   */

  /**
   * @param {SearchProviderList} list
   * @returns {SearchProviderRootView}
   */
  const convertListAsTree = function (list, active) {
    const root = { type: 'root', children: [] };
    /** @type {[SearchProviderRootView, ...SearchProviderFolderView[]]} */
    const stack = [root];
    list.forEach(item => {
      const top = stack[stack.length - 1];
      const { id, name, type } = item;
      if (type === 'folder-open') {
        const folder = { id, name, type: 'folder', children: [], parent: top, active: false };
        top.children.push(folder);
        stack.push(folder);
      } else if (type === 'folder-close') {
        stack.pop();
      } else if (type === 'separator') {
        const last = top.children[top.children.length - 1];
        last.separator = true;
      } else {
        const isCurrent = active && id === active.id;
        const sp = { id, name, type: 'provider', favicon_url: item.favicon_url, active: isCurrent };
        top.children.push(sp);
        if (isCurrent) stack.forEach(folder => { folder.active = true; });
      }
    });
    return root;
  };

  const searchProviderRoot = await Promise.all([
    callBackend.getList(),
    callBackend.getDefault(),
  ]).then(([list, active]) => convertListAsTree(list, active));

  const arrowButton = function () {
    /** @type {HTMLTemplateElement} */
    const arrow = document.getElementById('arrow');
    return arrow.content.querySelector('svg').cloneNode(true);
  };

  /**
   * @param {SearchProviderFolderView|SearchProviderView} item
   * @param {HTMLDivElement} item
   */
  const renderMenuItem = function (item, menu) {
    const isFolder = item.type === 'folder';
    const templateId = isFolder ? 'spfolderitem' : 'spitem';
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById(templateId);
    const menuitem = template.content.querySelector('div').cloneNode(true);
    menuitem.dataset.id = item.id;
    const menuText = menuitem.querySelector('.text');
    menuText.textContent = item.name;
    if (isFolder) {
      const moreButton = menuitem.querySelector('.folder-more');
      moreButton.appendChild(arrowButton());
    } else {
      const menuIcon = menuitem.querySelector('.icon img');
      menuIcon.src = item.favicon_url;
    }
    if (item.active) {
      menuitem.classList.add('active');
      menuitem.setAttribute('aria-selected', 'true');
    }
    const result = menu.appendChild(document.importNode(menuitem, true));
    if (item.separator) {
      const template = document.getElementById('spseparatoritem');
      const separator = template.content.querySelector('div').cloneNode(true);
      menu.appendChild(document.importNode(separator, true));
    }
    return result;
  };

  /** @type {{
   * base: SearchProviderRootView|SearchProviderFolderView,
   * index: number,
   * items: HTMLDivElement[],
   * data: WeakMap<HTMLDivElement, SearchProviderFolderView|SearchProviderView>,
   * }
   */
  const currentMenu = {
    base: null,
    index: null,
    items: [],
    data: new WeakMap(),
  };

  /**
   * @param {number|HTMLDivElement} current
   */
  const focusMenuitem = function (current) {
    const index = typeof current === 'number' ? current :
      currentMenu.items.indexOf(current);
    currentMenu.index = index;
    [back, ...currentMenu.items].forEach((menuitem, i) => {
      if (i - 1 === index) {
        menuitem.classList.add('current');
        menuitem.setAttribute('aria-current', 'true');
        if (document.activeElement !== menuitem) menuitem.focus();
      } else {
        menuitem.classList.remove('current');
        menuitem.setAttribute('aria-current', 'false');
      }
    });
    const currentMenuitem = currentMenu.items[index];
    if (currentMenuitem) {
      currentMenuitem.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
  };

  /**
   * @param {SearchProviderRootView|SearchProviderFolderView} base
   */
  const renderPage = function (base) {
    if (base.type === 'folder') {
      const header = document.getElementById('pagetitle');
      header.style.display = 'block';
      const text = header.querySelector('.title-text');
      text.textContent = base.name;
    } else {
      const header = document.getElementById('pagetitle');
      header.style.display = 'none';
    }
    const list = base.children;
    const menu = document.getElementById('menu');
    menu.innerHTML = '';
    const menuitemList = list.map(item => renderMenuItem(item, menu));
    currentMenu.items = menuitemList;
    menuitemList.forEach((item, index) => { currentMenu.data.set(item, list[index]); });
    currentMenu.base = base;
  };

  const backMenuItem = (mouse = false) => {
    if (currentMenu.base.type === 'folder') {
      navigateFolder(currentMenu.base.parent, mouse || currentMenu.base);
    }
  };

  const back = (function () {
    const back = document.getElementById('backbutton');
    back.setAttribute('aria-label', browser.i18n.getMessage('popupBackButton'));
    back.appendChild(arrowButton());
    return back;
  }());

  let mouseMoveOnPosition = null;
  const navigateFolder = function (base, mouseOrTarget) {
    renderPage(base);

    let focus = null;
    if (mouseOrTarget === true) {
      const hoverElements = document.elementsFromPoint(...mouseMoveOnPosition);
      focus = hoverElements.find(el => el.matches('.menuitem'));
    } else if (mouseOrTarget) {
      const index = base.children.indexOf(mouseOrTarget);
      if (index !== -1) focus = index;
    }
    if (focus == null) {
      focus = Math.max(0, base.children.findIndex(item => item.active));
    }
    focusMenuitem(focus);
  };
  navigateFolder(searchProviderRoot);

  /** @param {MouseEvent} event */
  const eventMenuItem = event => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const menuitem = target.closest && target.closest('.menuitem');
    return menuitem;
  };

  const choseMenuItem = (item, mouse) => {
    if (item === back) {
      backMenuItem(mouse);
      return;
    }
    const data = currentMenu.data.get(item);
    if (data.type === 'folder') {
      navigateFolder(data, mouse);
    } else {
      callBackend.setDefault(data.id).then(() => {
        window.close();
        location.reload();
      });
    }
  };
  const expandMenuItem = item => {
    const data = currentMenu.data.get(item);
    if (data && data.type === 'folder') {
      navigateFolder(data);
    }
  };

  document.addEventListener('click', event => {
    if (event.button !== 0) return;
    const item = eventMenuItem(event);
    if (item) choseMenuItem(item, true);
  });

  document.addEventListener('mousemove', event => {
    const item = eventMenuItem(event);
    mouseMoveOnPosition = [event.pageX, event.pageY];
    if (item) focusMenuitem(item);
  });
  document.addEventListener('focusin', event => {
    const item = eventMenuItem(event);
    if (item) focusMenuitem(item);
  });

  document.addEventListener('keydown', event => {
    const key = event.key;
    if (['ArrowUp', 'ArrowDown'].includes(key)) {
      const index = currentMenu.index;
      const next = index + (key === 'ArrowUp' ? -1 : 1);
      const min = currentMenu.base.type === 'root' ? 0 : -1;
      const max = currentMenu.items.length - 1;
      const newIndex = next < min ? max : next > max ? min : next;
      focusMenuitem(newIndex);
    } else if (['End', 'Home'].includes(key)) {
      const newIndex = key === 'End' ? currentMenu.items.length - 1 : 0;
      focusMenuitem(newIndex);
    } else if ('123456789'.includes(key)) {
      const index = Number(key) - 1;
      if (index < currentMenu.items.length) {
        focusMenuitem(index);
        choseMenuItem(currentMenu.items[index]);
      }
    } else if ([' ', 'Enter'].includes(key)) {
      if (currentMenu.index !== -1) {
        choseMenuItem(currentMenu.items[currentMenu.index]);
      } else {
        backMenuItem();
      }
    } else if (['ArrowRight'].includes(key)) {
      expandMenuItem(currentMenu.items[currentMenu.index]);
    } else if (['ArrowLeft'].includes(key)) {
      backMenuItem();
    } else if (key.length === 1 && (('a' <= key && key <= 'z') || ('A' <= key && key <= 'Z'))) {
      const letter = key.toUpperCase();
      const newIndex = currentMenu.base.children.findIndex(item => item.name[0].toUpperCase() === letter);
      if (newIndex !== -1) focusMenuitem(newIndex);
    } else return;
    event.preventDefault();
  });

  document.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  ; (async function () {
    const themeStorage = (await browser.storage.sync.get('theme')).theme;
    const themeType = { Auto: 'Auto', Dark: 'Dark', Light: 'Light' }[themeStorage && themeStorage.type] || 'Auto';
    const rootStyle = document.documentElement.style;

    const preferColor = {};

    const useDark = await {
      Dark: () => true,
      Light: () => false,
      Auto: async function () {
        const [theme, extensions] = await Promise.all([
          browser.theme.getCurrent(),
          browser.management.getAll(),
        ]);
        Object.assign(preferColor, theme);
        const currentTheme = extensions.find(extension => [
          'default-theme@mozilla.org',
          'firefox-compact-light@mozilla.org@personas.mozilla.org',
          'firefox-compact-dark@mozilla.org@personas.mozilla.org',
          'firefox-compact-light@mozilla.org',
          'firefox-compact-dark@mozilla.org',
        ].includes(extension.id) && extension.enabled);
        if (!currentTheme) return false;
        if ([
          'firefox-compact-dark@mozilla.org@personas.mozilla.org',
          'firefox-compact-dark@mozilla.org',
        ].includes(currentTheme.id)) return true;
        if (currentTheme.id === 'default-theme@mozilla.org') {
          return !window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        return false;
      },
    }[themeType]();
    const fallback = useDark ? { popup: '#4a4a4f', popup_text: '#f9f9fa' } : {};
    const popup = preferColor.popup || fallback.popup;
    if (popup) rootStyle.setProperty('--popup', popup);
    const popup_text = preferColor.popup_text || fallback.popup_text;
    if (popup_text) rootStyle.setProperty('--popup-text', popup_text);

  }());

}());
