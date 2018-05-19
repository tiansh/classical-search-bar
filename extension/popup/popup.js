; (function () {

  const callBackend = new Proxy({}, {
    get: (empty, method) => (...params) => (
      browser.runtime.sendMessage({ method, params })
    ),
  });

  const domReady = new Promise(resolve => {
    document.addEventListener('DOMContentLoaded', () => resolve());
  });

  const searchProviderListPromise = callBackend.getList();

  Promise.all([domReady, searchProviderListPromise]).then(([, searchProviderList]) => {
    const menu = document.getElementById('menu');
    const menuItems = document.createDocumentFragment();
    searchProviderList.forEach(({ id, name, favicon_url }) => {
      /** @type {HTMLTemplateElement} */
      const template = document.getElementById('menuitem');
      const content = template.content;
      const menuText = content.querySelector('.text');
      menuText.textContent = name;
      const menuIcon = content.querySelector('.icon img');
      menuIcon.src = favicon_url;
      const menuItem = content.querySelector('.panel-list-item');
      menuItem.dataset.id = id;
      menuItems.appendChild(document.importNode(menuItem, true));
    });
    menu.appendChild(menuItems);
  });

  domReady.then(() => {
    document.addEventListener('click', event => {
      const target = event.target;
      const menuitem = target.closest && target.closest('.panel-list-item');
      const id = menuitem && +menuitem.dataset.id || menuitem.dataset.id;
      if (!id) return;
      callBackend.setDefault(id).then(() => {
        window.close();
      });
    });
  });

}());
