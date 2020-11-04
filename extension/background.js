/* global getDefaultSearchProviderList */

; (async function () {
  const DOMAIN = '6905b838-e843-4ee3-9df0-b4c79673b21c.invalid';

  const messageExport = (function () {
    /** @type {Map<string, Function>} */
    const exported = new Map();

    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const { method, params = [] } = request;
      const handler = exported.get(method);
      try {
        return Promise.resolve(handler(...params));
      } catch (exception) {
        return Promise.reject(exception);
      }
    });

    return f => {
      exported.set(f.name, f);
      return f;
    };
  }());

  /**
   * @typedef {Object} SearchProvider
   * @property {number} id
   * @property {'provider'} type
   * @property {string} name
   * @property {string} search_url
   * @property {string} favicon_url
   * @property {string} suggest_url
   * @property {string} search_form
   * @property {string} search_url_post_params
   * @property {string} encoding
   * @property {boolean} active
   * @property {boolean} is_default
   */
  /**
   * @typedef {Object} SearchProviderFolderOpen
   * @property {number} id
   * @property {'folder-open'} type
   * @property {string} name
   */
  /**
   * @typedef {Object} SearchProviderSeparator
   * @property {number} id
   * @property {'separator'} type
   */
  /**
   * @typedef {Object} SearchProviderFolderClose
   * @property {number} id
   * @property {'folder-close'} type
   */
  /**
   * @typedef {(SearchProvider|SearchProviderFolderOpen|SearchProviderFolderClose|SearchProviderSeparator)[]} SearchProviderList
   */

  /**
   * @param {Object} sp
   * @returns {SearchProvider}
   */
  const copySearchProvider = sp => ({
    id: +sp.id,
    type: 'provider',
    name: '' + sp.name,
    search_url: sp.search_url ? '' + sp.search_url : null,
    favicon_url: sp.favicon_url ? '' + sp.favicon_url : null,
    suggest_url: sp.suggest_url ? '' + sp.suggest_url : null,
    search_form: sp.search_form ? '' + sp.search_form : sp.search_url ? new URL('/', '' + sp.search_url).href : null,
    search_url_post_params: sp.search_url_post_params ? '' + sp.search_url_post_params : null,
    encoding: sp.encoding ? '' + sp.encoding : null,
    active: !!sp.active,
    is_default: !!sp.is_default,
  });
  /**
   * @param {Object} open
   * @returns {SearchProviderFolderOpen}
   */
  const copySearchProviderFolderOpen = open => ({
    id: +open.id,
    type: 'folder-open',
    name: '' + open.name,
  });
  /**
   * @param {Object} close
   * @returns {SearchProviderFolderClose}
   */
  const copySearchProviderFolderClose = close => ({
    id: +close.id,
    type: 'folder-close',
  });
  /**
   * @param {Object} separator
   * @returns {SearchProviderSeparator}
   */
  const copySearchProviderSeparator = separator => ({
    id: +separator.id,
    type: 'separator',
  });

  /**
   * @param {Object[]} list
   * @returns {SearchProviderList}
   */
  const copySearchProviderList = list => list.map(item => {
    if (item.type === 'folder-open') return copySearchProviderFolderOpen(item);
    else if (item.type === 'folder-close') return copySearchProviderFolderClose(item);
    else if (item.type === 'separator') return copySearchProviderSeparator(item);
    else return copySearchProvider(item);
  });

  const config = await (async function () {
    const key = 'searchProviderList';

    const readStorage = async function () {
      const data = (await browser.storage.local.get(key))[key];
      if (data == null) {
        const sync = (await browser.storage.sync.get(key))[key];
        if (sync != null) {
          await writeStorage(sync);
          return sync;
        }
      }
      return data;
    };
    const writeStorage = async function (setting) {
      await browser.storage.local.set({ [key]: setting });
    };
    /**
     * @param {SearchProviderList} list
     * @returns {SearchProvider}
     */
    const normalizeConfig = function (list) {
      if (list.reduce((/** @type {SearchProviderFolderOpen[]} */stack, item) => {
        if (item.type === 'folder-close') {
          if (!stack.length || stack.pop().id !== item.id) throw Error();
        } else if (item.type === 'folder-open') {
          stack.push(item);
        }
        return stack;
      }, []).length) throw Error();
      /** @type {SearchProvider[]} */
      const providers = list.filter(item => item.type === 'provider');
      if (!providers.length) throw Error();
      providers.forEach(sp => { if (!sp.active) sp.is_default = false; });
      const default_sp = providers.find(sp => sp.is_default) ||
        providers.find(sp => sp.active) || providers[0];
      default_sp.is_default = default_sp.active = true;
      if (providers.find(sp => !sp.id)) throw Error();
      if (providers.find(sp => sp !== default_sp && sp.is_default)) throw Error();
      return default_sp;
    };
    /**
     * @returns {Promise<{ list: SearchProviderList, default_sp: SearchProvider }>}
     */
    const readConfig = async function () {
      try {
        const setting = await readStorage();
        if (!Array.isArray(setting)) throw Error();
        const list = copySearchProviderList(setting);
        const default_sp = normalizeConfig(list);
        return { list, default_sp };
      } catch (_ignore) {
        return resetConfig();
      }
    };
    /**
     * @returns {Promise<{ list: SearchProviderList, default_sp: SearchProvider }>}
     */
    const writeConfig = async function (list) {
      if (!Array.isArray(list)) {
        return resetConfig();
      }
      try {
        const setting = copySearchProviderList(list);
        normalizeConfig(setting);
        await writeStorage(setting);
        return readConfig();
      } catch (_ignore) {
        return resetConfig();
      }
    };
    /**
     * @returns {Promise<{ list: SearchProviderList, default_sp: SearchProvider }>}
     */
    const resetConfig = async function () {
      return writeConfig(window.getDefaultSearchProviderList());
    };

    /** @type {(() => any)[]} */
    const setDefaultCallback = [];
    let { list, default_sp } = await readConfig();

    const saveList = async function (newList) {
      ({ list, default_sp } = await writeConfig(newList));
      setDefaultCallback.forEach(f => f());
    };
    const resetList = async function () {
      saveList(null);
    };
    const getList = function () {
      /** @type {(SearchProviderFolderOpen|SearchProviderSeparator)[]} */
      const pending = [];
      /** @type {SearchProviderList} */
      const filtered = [];
      list.forEach(item => {
        if (item.type === 'folder-open') {
          pending.push(item);
        } else if (item.type === 'folder-close') {
          let top = pending.pop();
          if (top && top.type === 'separator') top = pending.pop();
          if (!top) filtered.push(item);
        } else if (item.type === 'separator') {
          let top = pending.pop();
          pending.push(top || item);
        } if (item.active) {
          let top = pending.pop();
          if (top && top.type === 'separator') {
            filtered.push(top);
            top = pending.pop();
          }
          if (top) filtered.push(top);
          filtered.push(item);
          pending.push(null);
        }
      });
      return filtered;
    };
    const getListAll = function () {
      return list.slice(0);
    };
    const getDefault = function () {
      return default_sp;
    };
    /**
     * @param {SearchProvider} default_new
     */
    const setDefault = async function (id) {
      const default_new = list.find(item => item.id === id);
      default_sp.is_default = false;
      default_sp = default_new;
      default_sp.is_default = true;
      await saveList(list);
    };
    const onSetDefault = function (callback) {
      setDefaultCallback.push(callback);
    };
    const nextId = function () {
      let id = 1;
      while (list.find(sp => sp.id === id)) id++;
      return id;
    };
    const addSearchProvider = async function (sp) {
      const id = nextId();
      const item = Object.assign(copySearchProvider(sp), { id, is_default: false });
      list.push(item);
      await saveList(list);
      return id;
    };
    const addSearchProviderFolder = async function (item) {
      const id = nextId();
      const open = Object.assign(copySearchProviderFolderOpen(item), { id, type: 'folder-open' });
      const close = Object.assign(copySearchProviderFolderClose(item), { id, type: 'folder-close' });
      list.push(open, close);
      await saveList(list);
      return id;
    };
    const addSearchProviderSeparator = async function () {
      const id = nextId();
      list.push(copySearchProviderSeparator({ id }));
      await saveList(list);
      return id;
    };
    const addItem = async function (item) {
      if (item.type === 'folder-open') return addSearchProviderFolder(item);
      if (item.type === 'separator') return addSearchProviderSeparator(item);
      else return addSearchProvider(item);
    };
    const setSearchProvider = async function (id, sp) {
      const item = list.find(sp => sp.id === id);
      Object.assign(item, copySearchProvider(sp), { is_default: item.is_default }, { id });
      if (!item.active) item.is_default = false;
      await saveList(list);
      return id;
    };
    const setSearchProviderFolder = async function (id, open) {
      const item = list.find(sp => sp.id === id);
      Object.assign(item, copySearchProviderFolderOpen(open), { id });
      await saveList(list);
      return id;
    };
    const setItem = async function (id, item) {
      if (item.type === 'folder-open') return setSearchProviderFolder(id, item);
      if (item.type === 'separator') return id;
      else return setSearchProvider(id, item);
    };
    const moveItem = async function (id, index) {
      const top = list.findIndex(sp => sp.id === id);
      const len = list.slice(top + 1).findIndex(sp => sp.id === id) + 2;
      const items = list.splice(top, len);
      list.splice(index, 0, ...items);
      await saveList(list);
    };
    const removeItem = async function (id) {
      const removed = list.filter(sp => sp.id !== id);
      if (removed.length === list.length) return false;
      if (removed.find(sp => sp.type === 'provider') == null) return false;
      await saveList(removed);
      return true;
    };
    const importList = async function (spList, mode) {
      if (!spList || !spList.length) return false;
      const listBackup = list.slice(0);
      try {
        if (mode === 'overwrite') list.splice(0);
        copySearchProviderList(spList).reduce((/** @type {SearchProviderFolderOpen[]} */stack, sp) => {
          if (sp.type === 'folder-close') Object.assign(sp, { id: stack.pop().id });
          else Object.assign(sp, { id: nextId(list) });
          if (sp.type === 'folder-open') stack.push(sp);
          list.push(sp);
          return stack;
        }, []);
        await saveList(list);
      } catch (_ignore) {
        list.splice(0, list.length, ...listBackup);
        await saveList(list);
        return false;
      }
      return true;
    };
    return {
      getList,
      getListAll,
      getDefault,
      setDefault,
      onSetDefault,
      addItem,
      setItem,
      moveItem,
      removeItem,
      resetList,
      importList,
    };
  }());

  messageExport(function getList() {
    return copySearchProviderList(config.getList());
  });
  messageExport(function getListAll() {
    return copySearchProviderList(config.getListAll());
  });
  messageExport(function getDefault() {
    return config.getDefault();
  });
  messageExport(function setDefault(id) {
    config.setDefault(id);
  });
  messageExport(function saveItem(sp) {
    if (sp.id) return config.setItem(sp.id, sp);
    else return config.addItem(sp);
  });
  messageExport(function moveItem(id, index) {
    return config.moveItem(id, index);
  });
  messageExport(function removeItem(id) {
    return config.removeItem(id);
  });
  messageExport(function resetList() {
    return config.resetList();
  });
  messageExport(function importList(spList, mode) {
    return config.importList(spList, mode);
  });

  /*
   * Convert user searchTerms to %hh encoded format
   * When input encoding is configured as UTF-8, we use `encodeURIComponent` which works great
   * When input encoding is other values:
   *   We try to create a form, set accept-charset on the form, put this text in it, and then submit
   *   We capture the form submit request, and parse encoded string form the url
   */
  const encodingText = (function () {
    const resolveEncoding = new Map();
    let resolveEncodingIndex = 0;
    const encode = async function (text, charset) {
      if (!charset || /utf-8/i.test(charset)) return encodeURIComponent(text);
      const index = ++resolveEncodingIndex;
      const promise = new Promise(resolve => {
        resolveEncoding.set(index, resolve);
      });
      const container = document.createElement('div');
      container.id = `encoding_container_${index}`;
      const form = document.createElement('form');
      form.acceptCharset = charset;
      form.action = `https://${DOMAIN}/encoding`;
      container.appendChild(form);
      const indexInput = document.createElement('input');
      indexInput.value = index;
      indexInput.name = 'index';
      form.appendChild(indexInput);
      const textInput = document.createElement('input');
      textInput.value = text;
      textInput.name = 'text';
      form.appendChild(textInput);
      const iframe = document.createElement('iframe');
      iframe.name = form.target = `encoding_frame_${index}`;
      container.appendChild(iframe);
      document.body.appendChild(container);
      form.submit();
      return promise;
    };
    browser.webRequest.onBeforeRequest.addListener(async details => {
      if (!details.documentUrl.startsWith(browser.extension.getURL('/'))) return {};
      const url = details.url;
      const params = url.split(/[?&]/g).slice(1).map(s => s.split('='));
      const encoded = params.find(([key, value]) => key === 'text')[1];
      const index = +params.find(([key, value]) => key === 'index')[1];
      resolveEncoding.get(index)(encoded);
      resolveEncoding.delete(index);
      const container = document.getElementById(`encoding_container_${index}`);
      container.parentNode.removeChild(container);
      return { cancel: true };
    }, {
      urls: [`https://${DOMAIN}/encoding?*`],
      types: ['sub_frame'],
    }, ['blocking']);
    return encode;
  }());

  const getUrl = async function (type, searchTerms) {
    const defaultSp = config.getDefault();
    const placeSearchTerms = async (url, charset) => {
      const encoded = await encodingText(searchTerms, charset);
      return url.replace(/\{searchTerms\}/g, () => encoded);
    };
    if (type === 'search') {
      const url = await placeSearchTerms(defaultSp.search_url, defaultSp.encoding);
      if (!defaultSp.search_url_post_params) {
        return url;
      } else {
        const postPage = new URL(browser.extension.getURL('/post/post.html'));
        const postParams = defaultSp.search_url_post_params
          .replace(/\{searchTerms\}/g, () => encodeURIComponent(searchTerms));
        postPage.searchParams.set('url', url);
        postPage.searchParams.set('post', postParams);
        postPage.searchParams.set('encoding', defaultSp.encoding || 'utf-8');
        return postPage.href;
      }
    } else if (type === 'suggest') {
      return await placeSearchTerms(defaultSp.suggest_url, defaultSp.encoding);
    } else if (type === '') {
      return defaultSp.search_form || new URL('/', defaultSp.search_url).href;
    } else {
      return null;
    }
  };

  // Redirect search request to fake search provider to the one user selected
  browser.webRequest.onBeforeRequest.addListener(async details => {
    try {
      const url = new URL(details.url);
      const type = url.pathname.slice(1);
      const searchTerms = url.searchParams.get('searchTerms') || '';
      const redirectUrl = await getUrl(type, searchTerms);
      return { redirectUrl };
    } catch (_ignore) { /* fallthrough */ }
    return { cancel: true };
  }, {
    urls: [`https://${DOMAIN}/*`],
    types: ['main_frame'],
  }, ['blocking']);

  const updateButton = function () {
    const defaultSp = config.getDefault();
    browser.browserAction.setIcon({ path: defaultSp.favicon_url });
    const title = browser.i18n.getMessage('extensionButtonTitle')
      .replace(/%s/ig, () => defaultSp.name);
    browser.browserAction.setTitle({ title });
  };
  config.onSetDefault(updateButton);
  updateButton();

  const choseSearchProvider = function (type) {
    const list = config.getList(), default_sp = config.getDefault();
    const index = list.indexOf(default_sp);
    const target = (index + list.length + (type === 'next' ? 1 : -1)) % list.length;
    const default_new = list[target];
    config.setDefault(default_new.id);
  };

  browser.commands.onCommand.addListener(command => {
    if (command === 'search-provider-next') choseSearchProvider('next');
    if (command === 'search-provider-prev') choseSearchProvider('prev');
  });

}());
