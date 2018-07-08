/* global defaultProviderList */

; (async function () {
  const messageExport = (function () {
    /** @type {Map<string, Function>} */
    const exported = new Map();

    browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
      const { method, params = [] } = request;
      const handler = exported.get(method);
      return new Promise(async (resolve, reject) => {
        try { resolve(await handler(...params)); }
        catch (ex) { reject(ex); }
      });
    });

    return f => {
      exported.set(f.name, f);
      return f;
    };
  }());

  const copySearchProvider = sp => ({
    id: +sp.id,
    name: '' + sp.name,
    search_url: new URL('' + sp.search_url).href,
    favicon_url: new URL('' + sp.favicon_url).href,
    suggest_url: sp.suggest_url ? new URL('' + sp.suggest_url).href : '',
    search_from: (sp.search_from ? new URL('' + sp.search_from) : new URL('/', '' + sp.search_url)).href,
    search_url_post_params: sp.search_url_post_params ? '' + sp.search_url_post_params : null,
    active: !!sp.active,
    is_default: !!sp.is_default,
  });

  const config = await (async function () {
    const key = 'searchProviderList';

    const normalizeConfig = function (list) {
      list.forEach(sp => { if (!sp.active) sp.is_default = false; });
      const default_sp = list.find(sp => sp.is_default) ||
        list.find(sp => sp.active) || list[0];
      default_sp.is_default = default_sp.active = true;
      if (list.find(sp => !sp.id)) throw Error();
      if (list.find(sp => sp !== default_sp && sp.is_default)) throw Error();
      return default_sp;
    };
    const readConfig = async function () {
      try {
        const setting = (await browser.storage.sync.get(key))[key];
        if (!Array.isArray(setting)) throw Error();
        const list = setting.map(copySearchProvider);
        const default_sp = normalizeConfig(list);
        return { list, default_sp };
      } catch (_ignore) {
        return resetConfig();
      }
    };
    const writeConfig = async function (list) {
      try {
        if (!Array.isArray(list)) throw Error();
        const setting = list.map(copySearchProvider);
        normalizeConfig(setting);
        await browser.storage.sync.set({ [key]: setting });
        return readConfig();
      } catch (_ignore) {
        return resetConfig();
      }
    };
    const resetConfig = async function () {
      return writeConfig(defaultProviderList());
    };

    const setDefaultCallback = [];
    let { list, default_sp } = await readConfig();

    const saveList = async function (newList) {
      ({ list, default_sp } = await writeConfig(newList));
      setDefaultCallback.forEach(f => f());
    };
    const getList = function () {
      return list.filter(sp => sp.active);
    };
    const getListAll = function () {
      return list.slice(0);
    };
    const getDefault = function () {
      return default_sp;
    };
    const setDefault = async function (default_new) {
      default_sp.is_default = false;
      default_sp = default_new;
      default_sp.is_default = true;
      await saveList(list);
      setDefaultCallback.forEach(f => f());
    };
    const onSetDefault = function (callback) {
      setDefaultCallback.push(callback);
    };
    const addItem = async function (sp) {
      let id = 1; while (list.find(sp => sp.id === id)) id++;
      const item = Object.assign(copySearchProvider(sp), { id, is_default: false });
      list.push(item);
      await saveList(list);
      return item;
    };
    const setItem = async function (id, sp) {
      const item = list.find(sp => sp.id === id);
      Object.assign(item, copySearchProvider(sp), { is_default: item.is_default });
      if (!item.active) item.is_default = false;
      await saveList(list);
      return item;
    };
    const moveItem = async function (id, index) {
      const old = list.findIndex(sp => sp.id === id);
      const item = list.splice(old, 1)[0];
      list.splice(index, 0, item);
      await saveList(list);
      return item;
    };
    const removeItem = async function (id) {
      if (list.length <= 1) return false;
      const index = list.findIndex(sp => sp.id === id);
      if (index === -1) return false;
      list.splice(index, 1);
      await saveList(list);
      return true;
    };
    const resetList = async function (id) {
      ({ list, default_sp } = await resetConfig());
      setDefaultCallback.forEach(f => f());
    };
    const importList = async function (spList, mode) {
      if (!spList || !spList.length) return false;
      const listBackup = list.slice(0);
      try {
        if (mode === 'overwrite') list.splice(0);
        let id = 1; while (list.find(sp => sp.id === id)) id++;
        spList.map(copySearchProvider).forEach(sp => {
          const item = Object.assign(sp, { id: id++ });
          list.push(item);
        });
        setDefault(normalizeConfig(list));
        await saveList(list);
      } catch (_ignore) {
        list.splice(0, list.length, ...listBackup);
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
    return config.getList().map(copySearchProvider);
  });
  messageExport(function getListAll() {
    return config.getListAll().map(copySearchProvider);
  });
  messageExport(function getDefault(id) {
    return config.getDefault();
  });
  messageExport(function setDefault(id) {
    config.setDefault(config.getList().find(sp => sp.id === id));
  });
  messageExport(function saveItem(sp) {
    if (sp.id) return config.setItem(sp.id, sp);
    else return config.addItem(sp);
  });
  messageExport(function moveItem(sp, index) {
    return config.moveItem(sp.id, index);
  });
  messageExport(function removeItem(sp) {
    return config.removeItem(sp.id);
  });
  messageExport(function resetList() {
    return config.resetList();
  });
  messageExport(function importList(spList, mode) {
    return config.importList(spList, mode);
  });

  const getUrl = function (type, searchTerms) {
    const defaultSp = config.getDefault();
    const placeSearchTerms = url => (
      url.replace(/\{searchTerms\}/g, () => encodeURIComponent(searchTerms))
    );
    if (type === 'search') {
      const url = placeSearchTerms(defaultSp.search_url);
      if (!defaultSp.search_url_post_params) {
        return url;
      } else {
        const postPage = new URL(browser.extension.getURL('/post/post.html'));
        const postParams = placeSearchTerms(defaultSp.search_url_post_params);
        postPage.searchParams.set('url', url);
        postPage.searchParams.set('post', postParams);
        return postPage.href;
      }
    } else if (type === 'suggest') {
      return placeSearchTerms(defaultSp.suggest_url);
    } else if (type === '') {
      return defaultSp.search_from || new URL('/', defaultSp.search_url).href;
    } else {
      return null;
    }
  };

  // Redirect search request to fake search provider to the one user selected
  browser.webRequest.onBeforeRequest.addListener(details => {
    try {
      const url = new URL(details.url);
      const type = url.pathname.slice(1);
      const searchTerms = url.searchParams.get('searchTerms') || '';
      const redirectUrl = getUrl(type, searchTerms);
      return { redirectUrl };
    } catch (_ignore) { /* fallthrough */ }
    return { cancel: true };
  }, {
    urls: ['https://6905b838-e843-4ee3-9df0-b4c79673b21c.invalid/*'],
    types: ['main_frame'],
  }, ['blocking']);

  const updateIcon = function () {
    browser.browserAction.setIcon({ path: config.getDefault().favicon_url });
  };
  config.onSetDefault(updateIcon);
  updateIcon();

  const choseSearchProvider = function (type) {
    const list = config.getList(), default_sp = config.getDefault();
    const index = list.indexOf(default_sp);
    const target = (index + list.length + (type === 'next' ? 1 : -1)) % list.length;
    const default_new = list[target];
    config.setDefault(default_new);
  };

  browser.commands.onCommand.addListener(command => {
    if (command === 'search-provider-next') choseSearchProvider('next');
    if (command === 'search-provider-prev') choseSearchProvider('prev');
  });

}());
