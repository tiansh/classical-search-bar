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
  const currentSearchProviderPromise = callBackend.getDefault();

  Promise.all([domReady, searchProviderListPromise, currentSearchProviderPromise]).then(([, searchProviderList, defaultSearchProvider]) => {
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
      if (id === defaultSearchProvider.id) {
        menuItem.classList.add('current');
      } else {
        menuItem.classList.remove('current');
      }
      menuItems.appendChild(document.importNode(menuItem, true));
    });
    menu.appendChild(menuItems);
    addEventListeners();
  });

  const addEventListeners = function () {
    const eventMenuItem = event => {
      const target = event.target;
      const menuitem = target.closest && target.closest('.panel-list-item');
      return menuitem;
    };
    const allMenuItems = Array.from(document.querySelectorAll('.panel-list-item'));
    const currentMenuItem = () => {
      return allMenuItems.find(item => item.classList.contains('current'));
    };
    const setCurrentMenuItem = current => {
      allMenuItems.forEach(item => {
        if (item === current) item.classList.add('current');
        else item.classList.remove('current');
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
      const item = eventMenuItem(event);
      choseMenuItem(item);
    });
    document.addEventListener('mousemove', event => {
      const item = eventMenuItem(event);
      if (item) setCurrentMenuItem(item);
    });
    document.addEventListener('keyup', event => {
      const key = event.keyCode;
      if ([38, 40].includes(key)) {
        const current = currentMenuItem();
        const index = allMenuItems.indexOf(current);
        const next = index + (key === 38 ? -1 : 1);
        const newIndex = next < 0 ?
          allMenuItems.length - 1 :
          next >= allMenuItems.length ? 0 : next;
        setCurrentMenuItem(allMenuItems[newIndex]);
      } else if (48 < key && key < 58) {
        const index = key - 48 - 1;
        if (index < allMenuItems.length) {
          choseMenuItem(allMenuItems[index]);
        }
      } else if (key === 13) {
        choseMenuItem(currentMenuItem());
      }
    });
  };

}());
