; (async function () {

  const callBackend = new Proxy({}, {
    get: (empty, method) => (...params) => (
      browser.runtime.sendMessage({ method, params })
    ),
  });

  await new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve());
  });

  ; (function () {
    const placeholders = Array.from(document.querySelectorAll('[data-i18n]'));
    placeholders.forEach(span => {
      const i18n = span.dataset.i18n;
      const text = browser.i18n.getMessage(i18n);
      span.textContent = text;
    });
  }());

  const defaultFavicon = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjxzdmcgd2lkdGg9IjEyOHB4IiBoZWlnaHQ9IjEyOHB4IiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBmaWxsPSJjb250ZXh0LWZpbGwiIGZpbGwtb3BhY2l0eT0iY29udGV4dC1maWxsLW9wYWNpdHkiPg0KPHBhdGggZD0ibTYgMWE1IDUgMCAwIDAgMCAxMGE1IDUgMCAwIDAgMCAtMTB2MmEzIDMgMCAwIDEgMCA2YTIgMiAwIDAgMSAwIC02TTkuODI4IDguNDE0bC0xLjQxNCAxLjQxNEwxMi41ODU4IDE0QTEgMSAwIDAgMCAxNCAxMi41ODU4eiIvPg0KPC9zdmc+';

  const renderSeachProviderItem = (function () {
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById('sptemplate').cloneNode(true);
    return function ({ id, name, favicon_url, active }) {
      const content = template.content;
      const menuText = content.querySelector('.text');
      menuText.textContent = name;
      const menuIcon = content.querySelector('.icon img');
      menuIcon.src = favicon_url;
      const checkbox = content.querySelector('input[type="checkbox"]');
      checkbox.checked = active;
      const menuItem = content.querySelector('.spitem');
      menuItem.dataset.id = id;
      return menuItem;
    };
  }());
  const renderSeachProviderFolderItem = (function () {
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById('foldertemplate').cloneNode(true);
    return function ({ id, name, type }) {
      const content = template.content;
      const menuItem = content.querySelector('.spitem').cloneNode(true);
      menuItem.dataset.id = id;
      const menuText = menuItem.querySelector('.text');
      if (type === 'folder-open') {
        menuText.textContent = name;
        menuItem.classList.add('spfolder-open');
      } else {
        menuText.remove();
        menuItem.classList.add('spfolder-close');
      }
      return menuItem;
    };
  }());
  const renderSeachProviderSeparatorItem = (function () {
    /** @type {HTMLTemplateElement} */
    const template = document.getElementById('separatortemplate').cloneNode(true);
    return function ({ id }) {
      const content = template.content;
      const menuItem = template.content.querySelector('.spitem').cloneNode(true);
      menuItem.dataset.id = id;
      return menuItem;
    };
  }());

  let currentList = null;
  let currentItem = (function () {
    const rawObject = {};
    [...document.querySelectorAll('[data-form-input]')].forEach(input => {
      const attribute = input.getAttribute('data-form-target');
      const prop = input.getAttribute('data-form-attr');
      input.addEventListener('input', () => {
        rawObject[prop] = input[attribute];
        if (prop === 'type') {
          setDetailType(input[attribute]);
        }
      });
    });
    const faviconinput = document.getElementById('faviconinput');
    faviconinput.addEventListener('input', () => {
      const file = faviconinput.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        rawObject.favicon_url = reader.result;
        renderProp('favicon_url', rawObject.favicon_url);
        faviconinput.value = null;
      });
      reader.readAsDataURL(file);
    });
    const faviconimg = document.getElementById('faviconimg');
    faviconimg.addEventListener('error', () => {
      if (faviconimg.src !== rawObject.favicon_url) return;
      faviconimg.src = rawObject.favicon_url = defaultFavicon;
    });

    const renderProp = function (prop, value) {
      const element = document.querySelector(`[data-form-attr="${prop}"]`);
      const attribute = element.getAttribute('data-form-target');
      element[attribute] = value;
    };
    const highlightItem = function (id) {
      [...document.querySelectorAll('.spitem')].forEach(menuitem => {
        menuitem.classList.remove('current');
        if (+menuitem.dataset.id === id) menuitem.classList.add('current');
      });
      const configPanel = document.getElementById('config_panel');
      configPanel.classList.remove('edit-form', 'create-form');
      configPanel.classList.add(id ? 'edit-form' : 'create-form');
    };
    const showHidePostParams = function (value) {
      const postParams = document.getElementById('postparams');
      if (value) postParams.style.display = '';
      else postParams.style.display = 'none';
    };
    const showHideEncoding = function (value) {
      const encoding = document.getElementById('encoding');
      if (value) encoding.style.display = '';
      else encoding.style.display = 'none';
    };
    const setDetailType = function (type) {
      const spdetail = document.getElementById('spdetail');
      const items = Array.from(spdetail.querySelectorAll('[data-form-type]'));
      items.forEach(item => {
        const active = item.getAttribute('data-form-type').split(/\s+/).includes(type);
        item.hidden = !active;
      });
      const typeInput = document.getElementById('typeinput');
      typeInput.value = type;
      const typeText = document.getElementById('typetext');
      typeText.textContent = browser.i18n.getMessage({
        provider: 'configTypeProvider',
        'folder-open': 'configTypeFolder',
        separator: 'configTypeSeparator',
      }[type]);
    };
    return new Proxy(rawObject, {
      get: (obj, prop) => obj[prop],
      set: (obj, prop, value) => {
        const all = [
          'id',
          'name',
          'search_url',
          'favicon_url',
          'active',
          'search_form',
          'search_url_post_params',
          'encoding',
        ];
        if (all.includes(prop)) {
          obj[prop] = value;
          if (prop === 'id') highlightItem(value);
          else renderProp(prop, value);
          if (prop === 'search_url_post_params') showHidePostParams(value);
          if (prop === 'encoding') showHideEncoding(value);
        }
        if (prop === 'type') {
          obj[prop] = value;
          setDetailType(value);
        }
        return true;
      },
    });
  }());

  const renderList = async function () {
    const searchProviderList = currentList = await callBackend.getListAll();
    const menu = document.getElementById('splist');
    const menuItems = document.createDocumentFragment();
    searchProviderList.forEach(item => {
      if (item.type === 'folder-open' || item.type === 'folder-close') {
        menuItems.appendChild(document.importNode(renderSeachProviderFolderItem(item), true));
      } else if (item.type === 'separator') {
        menuItems.appendChild(document.importNode(renderSeachProviderSeparatorItem(item), true));
      } else {
        menuItems.appendChild(document.importNode(renderSeachProviderItem(item), true));
      }
    }, 0);
    menu.innerHTML = '';
    menu.appendChild(menuItems);
  };

  const focusItem = function (id) {
    Object.assign(currentItem, currentList.find(sp => sp.id === id));
  };

  const addItem = function () {
    Object.assign(currentItem, {
      id: 0,
      type: 'provider',
      name: '',
      search_url: '',
      favicon_url: defaultFavicon,
      search_form: '',
      search_url_post_params: null,
      encoding: null,
      active: true,
    });
  };

  const initialList = async function () {
    await renderList();
    focusItem(currentList[0].id);
  };
  await initialList();

  document.getElementById('splist').addEventListener('click', event => {
    const item = event.target.closest('.spitem');
    if (!item) return;
    const id = +item.dataset.id;
    focusItem(id);
    event.preventDefault();
  });

  document.getElementById('splist').addEventListener('input', event => {
    event.preventDefault();
  });

  document.getElementById('splist').addEventListener('keyup', event => {
    const key = event.keyCode;
    if ([38, 40].includes(key)) {
      const index = currentList.findIndex(sp => sp.id === currentItem.id);
      const next = index + (key === 38 ? -1 : 1);
      const newIndex = index < 0 ? currentItem.length - 1 :
        next >= currentItem.length ? 0 : next;
      focusItem(currentList[newIndex].id);
    }
  });

  document.getElementById('faviconinputbutton').addEventListener('click', () => {
    document.getElementById('faviconinput').click();
  });

  document.getElementById('addbutton').addEventListener('click', () => {
    addItem();
    document.getElementById('nameinput').focus();
  });

  document.getElementById('splist').addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.matches('.spitem input[type="checkbox"]')) return;
    const item = target.closest('.spitem');
    const id = +item.dataset.id;
  });

  document.getElementById('savebutton').addEventListener('click', async () => {
    try {
      const savedItemId = await callBackend.saveItem(Object.assign({}, currentItem));
      await renderList();
      focusItem(savedItemId);
    } catch (_ignore) {
      const spdetail = document.getElementById('spdetail');
      spdetail.classList.add('form-invalid');
      setTimeout(() => {
        spdetail.classList.remove('form-invalid');
      }, 1000);
    }
  });

  document.getElementById('removebutton').addEventListener('click', async () => {
    const id = currentItem.id; if (!id) return;
    const index = currentList.findIndex(sp => sp.id === id); if (index === -1) return;
    await callBackend.removeItem(id);
    await renderList();
    focusItem(currentList[Math.min(index, currentList.length - 1)].id);
  });

  const resetButton = document.getElementById('resetbutton');
  const realResetButton = document.getElementById('realresetbutton');
  const showResetButton = function (show) {
    let oldButton, newButton;
    if (show) {
      oldButton = resetButton;
      newButton = realResetButton;
    } else {
      oldButton = realResetButton;
      newButton = resetButton;
    }
    let hasFocus = document.activeElement === oldButton;
    oldButton.style.display = 'none';
    newButton.style.display = 'inline';
    if (hasFocus) newButton.focus();
  };
  realResetButton.addEventListener('click', async () => {
    showResetButton(false);
    await callBackend.resetList();
    initialList();
  });
  resetButton.addEventListener('click', async () => {
    showResetButton(true);
    setTimeout(() => { showResetButton(false); }, 3000);
  });
  showResetButton(false);

  const movebuttons = diff => {
    return async () => {
      const id = currentItem.id; if (!id) return;
      const index = currentList.findIndex(sp => sp.id === id);
      const new_index = index + diff;
      if (new_index < 0 || new_index >= currentList.length) return;
      callBackend.moveItem(id, new_index);
      await renderList();
      focusItem(id);
    };
  };
  document.getElementById('moveupbutton').addEventListener('click', movebuttons(-1));
  document.getElementById('movedownbutton').addEventListener('click', movebuttons(1));

  const exportButton = document.getElementById('exportbutton');
  const getExportData = async function () {
    const searchProviderList = await callBackend.getListAll();
    const search_providers = searchProviderList.map(sp => ({
      provider: () => ({
        name: sp.name,
        type: sp.type,
        search_url: sp.search_url,
        favicon_url: sp.favicon_url,
        suggest_url: sp.suggest_url,
        search_form: sp.search_form,
        search_url_post_params: sp.search_url_post_params || '',
        encoding: sp.encoding || '',
        active: sp.active,
      }),
      'folder-open': () => ({ name: sp.name, type: sp.type }),
      'folder-close': () => ({ type: sp.type }),
      separator: () => ({ type: sp.type }),
    }[sp.type]()));
    return {
      version: 2,
      min_version: 2,
      extension: {
        name: browser.i18n.getMessage('extensionName'),
        version: browser.runtime.getManifest().version,
      },
      search_providers,
    };
  };
  exportButton.addEventListener('click', async () => {
    const output = await getExportData();
    const fileContent = JSON.stringify(output, null, 2) + '\n';
    const blob = new Blob([fileContent], { type: 'application/octet-binary' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('download', 'classical-search-bar.json');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.parentNode.removeChild(link);
    }, 0);
  });

  ; (function () {
    const parseSearchProviderImport = data => {
      if (!+data.min_version || data.min_version > 2) throw TypeError();
      const searchList = data.search_providers;
      if (!Array.isArray(searchList)) throw TypeError();
      if (!searchList.length) throw TypeError();
      const importList = searchList.map(sp => {
        if (sp.type === 'folder-open') {
          return { name: (sp.name || '') + '', type: sp.type };
        }
        if (sp.type === 'folder-close' || sp.type === 'separator') {
          return { type: sp.type };
        }
        return {
          name: (sp.name || '') + '',
          type: 'provider',
          search_url: (sp.search_url || '') + '',
          favicon_url: (sp.favicon_url || defaultFavicon) + '',
          suggest_url: (sp.suggest_url || '') + '',
          search_form: (sp.search_form || '') + '',
          search_url_post_params: ((sp.search_url_post_params || '') + '') || null,
          encoding: ((sp.encoding || '') + '') || null,
          active: !!sp.active,
        };
      });
      return importList;
    };

    let currentMode = null;
    const importOverwriteButton = document.getElementById('importoverwritebutton');
    const importAppendButton = document.getElementById('importappendbutton');
    /** @type {HTMLInputElement} */
    const importFileButton = document.getElementById('importinput');
    const importSettings = function () {
      importFileButton.click();
    };
    importOverwriteButton.addEventListener('click', () => {
      currentMode = 'overwrite';
      importSettings();
    });
    importAppendButton.addEventListener('click', () => {
      currentMode = 'append';
      importSettings();
    });
    const failedImport = () => {
      alert(browser.i18n.getMessage('importFailedAlert'));
    };
    importFileButton.addEventListener('input', () => {
      const [file] = importFileButton.files;
      const reader = new FileReader();
      reader.addEventListener('load', async () => {
        try {
          const data = reader.result;
          const searchers = parseSearchProviderImport(JSON.parse(data));
          const importSuccess = await callBackend.importList(searchers, currentMode);
          if (!importSuccess) throw Error();
        } catch (e) {
          failedImport();
        }
        await renderList();
        focusItem(currentList[0].id);
      });
      reader.addEventListener('error', () => {
        failedImport();
      });
      reader.readAsText(file);
      importFileButton.value = null;
    });
  }());

  document.getElementById('theme_panel').addEventListener('input', async () => {
    const checked = document.querySelector('#theme_panel input[type="radio"]:checked');
    const value = { Auto: 'Auto', Dark: 'Dark', Light: 'Light' }[checked.value] || 'Auto';
    browser.storage.sync.set({ theme: { type: checked.value } });
  });

  const updateSelectedTheme = async () => {
    const storage = (await browser.storage.sync.get('theme')).theme;
    const value = { Auto: 'Auto', Dark: 'Dark', Light: 'Light' }[storage && storage.type] || 'Auto';
    const inputs = Array.from(document.querySelectorAll('#theme_panel input[type="radio"]'));
    inputs.forEach(input => {
      input.checked = input.value === value;
    });
  };
  updateSelectedTheme();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes.theme) return;
    updateSelectedTheme();
  });

}());

// Firefox 64 uglified its user interface, and we would follow it
; (async function () {

  const browserInfo = await browser.runtime.getBrowserInfo();
  const mainVersion = parseInt(browserInfo.version, 10);
  if (mainVersion >= 64) {
    document.body.style.background = 'var(--in-content-box-background)';
  }

}());
